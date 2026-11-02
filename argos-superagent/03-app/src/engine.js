import { key, wordCount, clone } from './util.js';
import { gate, assessCandidate, assessmentOutcome, revalidate, autonomyFor, mandateId, policyVersion, sourceConfig, scope } from './policy.js';
import { canonicalState, hydrate } from './projection.js';
import { canonicalTrigger, canonicalAssignment, canonicalInput, canonicalReport, canonicalReceipt, canonicalDecision, canonicalMandate, canonicalTicket, canonicalPolicy } from './records.js';
import { buildInput } from './worker/runner.js';

/**
 * ARGOS-4 Engine — the sole writer of domain state.
 *
 * It contains NO domain conditionals: every mission is injected as a Source pack.
 * Workers never write Channels and the Engine never runs an experiment: it enqueues
 * durable effects, which the composition root (simulation.js) executes.
 */
export class Engine {
  constructor({ policy, events, effects, memory, outbox, metrics, packs }) {
    this.policy = policy;
    this.policy.revision = policy.revision || 'v2';
    this.policy.version = policyVersion(this.policy);
    this.events = events;
    this.effects = effects;
    this.memory = memory;
    this.outbox = outbox;
    this.metrics = metrics;
    this.packs = packs;
    this.tick = 0;
    this.paused = false;
    this.triggers = new Map();
    this.pendingTriggers = [];
    this.threads = new Map();
    this.tickets = new Map();
    this.mandates = new Map();
    this.evaluations = [];
    this.subscriptions = [];
    this.watchdogFlags = [];
    this.controlLog = [];
    this.assignments = new Map();
    this.inputs = new Map();
    this.reports = new Map();
    this.correlations = new Map();
    this.rejectedTriggers = new Map();
    this.duplicateTriggers = new Map();
    this.workerPool = null;
    this.seq = 0;
  }

  /* ───────────────────────────── intake ───────────────────────────── */

  ingestTrigger(template, tick = this.tick) {
    const domain = template.domain;
    const pack = this.packs[domain];
    if (!pack) throw new Error(`Trigger has no registered Source pack: ${domain}`);
    const stableId = key('trigger', template.source, template.externalId);
    if (this.triggers.has(stableId) || this.rejectedTriggers.has(stableId)) {
      this.duplicateTriggers.set(stableId, { id: stableId, externalId: template.externalId, atTick: template.atTick ?? tick, tick });
      const dup = canonicalTrigger(template, tick, this.packs[template.domain], null, { filtered: true, reasonCodes: ['duplicate'] });
      dup.id = stableId; dup.disposition.filtered = true; dup.disposition.reasonCodes = ['duplicate'];
      this.events.append('trigger.duplicate', { trigger: dup, triggerId: stableId, externalId: template.externalId, disposition: 'duplicate' },
        { refs: [stableId], tick, actor: 'router' });
      return null;
    }
    const trigger = {
      id: stableId,
      domain, source: template.source, actor: template.actor || { id: '', type: 'system' },
      human: template.human !== false, addressed: template.addressed || null,
      text: template.text || '', meta: template.meta || {},
      threads: (template.threads || []).slice(),
      channelKind: template.channelKind || 'chat',
      tags: (template.tags || []).slice(), effort: template.effort || 0,
      speculative: Boolean(template.meta?.speculative || template.tags?.includes('speculative')),
      externalId: template.externalId, atTick: template.atTick ?? tick,
      receivedTick: tick, strength: null, basis: null, admitted: false
    };
    // Stage 1 gate runs at intake: untrusted text never becomes a domain Trigger.
    const gateResult = gate({ trigger, policy: this.policy, threadSubscriptions: this.threadSubscriptions(trigger) });
    trigger.gateResult = gateResult;
    trigger.strength = gateResult.strength;
    trigger.basis = gateResult.basis;
    trigger.admitted = !gateResult.filtered;
    if (gateResult.filtered) {
      this.rejectTrigger(template, gateResult.reasonCodes, tick);
      return null;
    }
    this.triggers.set(trigger.id, trigger);
    this.metrics.onTrigger(false);
    const canonical = canonicalTrigger(template, tick, pack, trigger.gateResult,
      { filtered: false, reasonCodes: trigger.gateResult.reasonCodes });
    canonical.id = trigger.id;
    trigger.canonical = canonical;
    this.events.append('trigger.received', { trigger: canonical,
      triggerId: trigger.id, externalId: trigger.externalId, domain,
      source: trigger.source, actor: trigger.actor.id, text: trigger.text,
      threads: trigger.threads, tags: trigger.tags
    }, { refs: [trigger.id], tick });
    this.memory.register(trigger.id, {
      kind: 'trigger', title: `${pack.name} · ${trigger.externalId}`, text: trigger.text,
      refs: trigger.threads, meta: { source: trigger.source, domain, atTick: trigger.atTick }
    });
    for (const t of trigger.threads) {
      if (!this.threads.has(t)) this.threads.set(t, { id: t, domain, state: 'observing', createdTick: tick, ticketIds: [] });
      if (!this.memory.card(t)) {
        this.memory.register(t, { kind: 'thread', title: `thread · ${t}`, text: `Subscription root for ${t}`,
          refs: [trigger.id], meta: { domain } });
      } else {
        this.memory.link(t, [trigger.id]);
      }
    }
    this.pendingTriggers.push(trigger.id);
    this.effects.enqueue('reply', key('eval', tick), {}, tick + (this.policy.evalLatencyTicks || 1));
    return trigger;
  }

  rejectTrigger(template, reasonCodes, tick = this.tick) {
    const id = key('trigger', template.source, template.externalId);
    const pack = this.packs[template.domain];
    const canonical = canonicalTrigger(template, tick, pack, { strength: 'not_admitted', basis: 'gate', reasonCodes, filtered: true },
      { filtered: true, reasonCodes });
    canonical.id = id;
    this.rejectedTriggers.set(id, canonical);
    this.metrics.onTrigger(true);
    this.events.append('trigger.filtered', { trigger: canonical }, { refs: [id], tick, actor: 'router' });
    this.events.append('source.rejected', {
      externalId: template.externalId, domain: template.domain,
      source: template.source, actor: template.actor?.id, reasonCodes, text: template.text
    }, { refs: [id], tick });
    if (reasonCodes.includes('untrusted_content_ignored') || template.tags?.includes('injection')) {
      this.events.append('policy.violation', {
        externalId: template.externalId, reasonCodes, action: 'blocked_before_trigger'
      }, { refs: [id], tick, actor: 'watchdog' });
    }
    return id;
  }

  /* ───────────────────────────── Router / Eval ───────────────────────────── */

  threadSubscriptions(trigger) {
    // Only genuinely in-flight work receives a fast-path follow-up. A completed
    // or delivering Ticket must not be resurrected by "thanks" or stale signals.
    const followupStates = ['queued', 'running'];
    return trigger.threads.map(threadKey => ({
      threadKey,
      own: [...this.tickets.values()].some(t => t.threadKeys.includes(threadKey) && followupStates.includes(t.state)),
      contextOnly: false
    }));
  }

  runEvals(tick) {
    const batchIds = this.pendingTriggers.splice(0);
    if (!batchIds.length) return;
    const batch = batchIds.map(id => this.triggers.get(id)).filter(Boolean);
    this.metrics.onBatch(batch.length);
    let speculativeStarted = 0;
    // Invariant 4: production policy launches speculative Tickets only in auto.
    // The showcase flag below is a documented, opt-out demo convenience so one
    // observe-mode run can display both promotion and silent discard.
    const allowSpeculation = this.policy.mode === 'auto'
      || this.policy.speculation.showcaseSpeculationInObserve === true;
    for (const trigger of batch) {
      this.seq++;
      if (trigger.meta?.stop) { this.stopByThreads(trigger.threads, trigger.actor.id, tick); continue; }
      if (trigger.meta?.policyChange) { this.setPolicyVersion(trigger.meta.version || 'v3', 'policy-change event', tick); continue; }
      const gateResult = trigger.gateResult || gate({ trigger, policy: this.policy, threadSubscriptions: this.threadSubscriptions(trigger) });
      this.events.append('trigger.admitted', { triggerId: trigger.id, strength: gateResult.strength, basis: gateResult.basis, reasonCodes: gateResult.reasonCodes },
        { refs: [trigger.id], tick, actor: 'router' });
      // Speculative signals are a distinct channel: they must not be swallowed
      // by an existing Thread's fast path.
      if (trigger.speculative) {
        this.metrics.wouldSpeculate++;
        if (!this.policy.speculation.enabled || !allowSpeculation) {
          this.metrics.silenceSavings++;
          this.events.append('speculation.would_speculate', {
            triggerId: trigger.id, mode: this.policy.mode,
            reason: this.policy.speculation.enabled ? 'observe_mode' : 'speculation_disabled'
          }, { refs: [trigger.id], tick, actor: 'router' });
          this.pushEvaluation(trigger, gateResult, null, {
            outcome: 'would_speculate', reasonCodes: [this.policy.speculation.enabled ? 'observe_mode' : 'speculation_disabled']
          });
          continue;
        }
        if (speculativeStarted >= (this.policy.speculation.maxPerTick || 2)) {
          this.metrics.silenceSavings++;
          this.events.append('speculation.throttled', {
            triggerId: trigger.id, maxPerTick: this.policy.speculation.maxPerTick
          }, { refs: [trigger.id], tick, actor: 'router' });
          this.pushEvaluation(trigger, gateResult, null, { outcome: 'ignore', reasonCodes: ['speculation_budget'] });
          continue;
        }
        speculativeStarted++;
        this.createTicket(trigger, { via: 'speculation', strength: gateResult.strength, reasonCodes: [...gateResult.reasonCodes, 'speculative_signal'], speculative: true }, tick);
        continue;
      }
      if (gateResult.fastPath) { this.fastPath(trigger, gateResult, tick); continue; }
      if (gateResult.strength === 'explicit') { this.createTicket(trigger, { via: 'addressed', strength: 'explicit', reasonCodes: gateResult.reasonCodes }, tick); continue; }
      const threadContext = this.contextFor(trigger.threads);
      const assessment = assessCandidate({ trigger, batch, policy: this.policy, threadContext, domain: trigger.domain });
      const outcome = assessmentOutcome({ assessment, policy: this.policy, strength: gateResult.strength });
      this.pushEvaluation(trigger, gateResult, assessment, outcome);
      if (outcome.outcome === 'would_accept') {
        this.metrics.wouldAccept++;
        this.metrics.wouldSpeculate++;
        this.events.append('eval.would_accept', { triggerId: trigger.id, matchedRules: outcome.matchedRules, reason: outcome.reason },
          { refs: [trigger.id], tick, actor: 'router' });
      } else if (outcome.outcome === 'accept') {
        this.createTicket(trigger, { via: 'bot', strength: gateResult.strength, matchedRules: outcome.matchedRules }, tick);
      } else {
        this.metrics.silenceSavings++;
        this.events.append('eval.ignored', { triggerId: trigger.id, reasonCodes: outcome.reasonCodes, reason: outcome.reason },
          { refs: [trigger.id], tick, actor: 'router' });
      }
    }
  }

  pushEvaluation(trigger, gateResult, assessment, outcome) {
    const evalRecord = {
      id: key('eval', trigger.id, this.seq), triggerId: trigger.id, domain: trigger.domain,
      tick: this.tick, strength: gateResult.strength, basis: gateResult.basis,
      reasonCodes: gateResult.reasonCodes || [],
      assessment: assessment ? {
        direction: assessment.direction, reason: assessment.reason,
        matchedRules: assessment.matchedRules, ruleJudgements: assessment.ruleJudgements,
        intentEvidence: assessment.intentEvidence, adapter: assessment.adapter
      } : null,
      outcome: outcome.outcome, outcomeReasonCodes: outcome.reasonCodes || [],
      batchSize: assessment?.batchSize || 0, threadContextSize: assessment?.threadContextSize || 0
    };
    this.evaluations.push(evalRecord);
    const decision = canonicalDecision({ trigger: canonicalTrigger({
      domain: trigger.domain, source: trigger.source, externalId: trigger.externalId,
      actor: trigger.actor, human: trigger.human, addressed: trigger.addressed,
      text: trigger.text, meta: trigger.meta, threads: trigger.threads,
      channelKind: trigger.channelKind, tags: trigger.tags, effort: trigger.effort,
      atTick: trigger.atTick
    }, this.tick, this.packs[trigger.domain], gateResult, {}),
      gateResult, assessment, outcome, policyVersion: this.policy.version, tick: this.tick, seq: this.seq });
    decision.id = evalRecord.id; decision.evalId = evalRecord.id;
    this.events.append('decision.recorded', { decision }, { refs: [trigger.id, evalRecord.id], tick: this.tick, actor: 'router' });
    this.events.append('eval.recorded', { evalId: evalRecord.id, triggerId: trigger.id, outcome: outcome.outcome, matchedRules: evalRecord.assessment?.matchedRules || [] },
      { refs: [trigger.id], tick: this.tick, actor: 'router' });
    this.memory.register(evalRecord.id, {
      kind: 'eval', title: `${outcome.outcome} · ${trigger.externalId}`,
      text: `${gateResult.basis}: ${outcome.reason || assessment?.reason || 'filtered'}`,
      refs: [trigger.id, ...trigger.threads]
    });
    for (const t of trigger.threads) this.memory.link(t, [evalRecord.id]);
    return evalRecord;
  }

  contextFor(threadKeys) {
    const cards = [];
    for (const t of threadKeys) {
      const thread = this.threads.get(t);
      if (!thread) continue;
      for (const id of thread.ticketIds.slice(-3)) cards.push(this.memory.card(id));
      for (const [id, c] of this.memory.cards) {
        if (c.refs.includes(t) && cards.length < 6) cards.push(c);
      }
    }
    return cards.filter(Boolean).slice(0, 6);
  }

  fastPath(trigger, gateResult, tick) {
    const ticket = [...this.tickets.values()].find(t => t.threadKeys.some(x => trigger.threads.includes(x)) && ['queued', 'running'].includes(t.state));
    const stage = trigger.meta?.playbook || 'recheck';
    const subscription = {
      id: key('sub', trigger.id, ticket?.id || 'none'), triggerId: trigger.id, ticketId: ticket?.id || null,
      threadKeys: trigger.threads, passThrough: true, routerDecisionsAvoided: 1, createdTick: tick
    };
    this.subscriptions.push(subscription);
    this.memory.register(subscription.id, {
      kind: 'subscription', title: 'pass-through · no Router decision',
      text: `Follow-up ${trigger.externalId} delivered to ${ticket?.id || 'an existing Ticket'}`,
      refs: [trigger.id, ticket?.id, ...trigger.threads].filter(Boolean)
    });
    for (const t of trigger.threads) this.memory.link(t, [subscription.id]);
    this.metrics.onFastPath();
    this.events.append('subscription.pass_through', {
      triggerId: trigger.id, ticketId: ticket?.id || null, threads: trigger.threads, decisionsAvoided: 1
    }, { refs: [trigger.id, ticket?.id].filter(Boolean), tick, actor: 'router' });
    this.pushEvaluation(trigger, gateResult, null, { outcome: 'fast_path', reasonCodes: ['subscribed_thread_followup'] });
    if (ticket) {
      ticket.rechecks++;
      this.enqueueWorker(ticket, stage, [trigger.id], tick, trigger.effort);
    }
  }

  /* ───────────────────────────── Tickets / Mandates ───────────────────────────── */

  createTicket(trigger, opts, tick) {
    if (opts.speculative && !this.policy.speculation.enabled) {
      this.metrics.silenceSavings++;
      this.events.append('speculation.disabled', { triggerId: trigger.id }, { refs: [trigger.id], tick, actor: 'router' });
      this.pushEvaluation(trigger, trigger.gateResult, null, { outcome: 'ignore', reasonCodes: ['speculation_disabled'] });
      return null;
    }
    const pack = this.packs[trigger.domain];
    const stage = trigger.meta?.playbook || trigger.meta?.requestKind || 'run';
    const ticketId = key('ticket', trigger.domain, trigger.id, stage);
    if (this.tickets.has(ticketId)) return this.tickets.get(ticketId);
    const mandate = {
      id: mandateId(ticketId, this.policy, [trigger.id]), ticketId,
      policyVersion: this.policy.version, via: opts.via, strength: opts.strength,
      actorId: trigger.actor?.id || '', source: trigger.source,
      triggerIds: [trigger.id], ruleIds: opts.matchedRules || pack.ruleIds,
      createdTick: tick, stopped: false, immutable: true,
      disclosure: this.policy.disclosure
    };
    const ticket = {
      id: ticketId, domain: trigger.domain, packName: pack.name,
      externalId: trigger.externalId, triggerId: trigger.id,
      threadKeys: trigger.threads.slice(), channelKind: trigger.channelKind,
      stage, speculative: Boolean(opts.speculative), promoted: false,
      state: 'queued', createdTick: tick, startedTick: null, readyTick: null,
      mandateId: mandate.id, ackSent: false, resultSent: false, attentionSent: false, resultCount: 0, rechecks: 0,
      artifacts: [], artifactsPath: null, confidence: null, riskClass: null,
      needsApproval: false, question: '', approvals: [], lastSummary: '', lastEvidence: null,
      effort: trigger.effort || 0, completionTick: null, completedTick: null
    };
    this.tickets.set(ticketId, ticket);
    this.mandates.set(mandate.id, mandate);
    for (const t of ticket.threadKeys) {
      const thread = this.threads.get(t) || { id: t, domain: trigger.domain, state: 'observing', createdTick: tick, ticketIds: [] };
      thread.state = 'active'; thread.ticketIds.push(ticketId); this.threads.set(t, thread);
      this.memory.link(t, [ticketId, mandate.id]);
    }
    this.metrics.ticketsCreated++;
    if (ticket.speculative) this.metrics.speculativeStarted++;
    else this.metrics.onExplicitDecision();
    const canonicalMandateRecord = canonicalMandate({ ticketId, trigger: canonicalTrigger({
      domain: trigger.domain, source: trigger.source, externalId: trigger.externalId,
      actor: trigger.actor, human: trigger.human, addressed: trigger.addressed,
      text: trigger.text, meta: trigger.meta, threads: trigger.threads,
      channelKind: trigger.channelKind, tags: trigger.tags, effort: trigger.effort, atTick: trigger.atTick
    }, tick, pack, trigger.gateResult, {}), policy: this.policy, via: opts.via,
      strength: opts.strength, matchedRules: mandate.ruleIds, tick, speculative: opts.speculative });
    canonicalMandateRecord.id = mandate.id;
    const canonicalTicketRecord = canonicalTicket({ ticketId, trigger: canonicalTrigger({
      domain: trigger.domain, source: trigger.source, externalId: trigger.externalId,
      actor: trigger.actor, human: trigger.human, addressed: trigger.addressed,
      text: trigger.text, meta: trigger.meta, threads: trigger.threads,
      channelKind: trigger.channelKind, tags: trigger.tags, effort: trigger.effort, atTick: trigger.atTick
    }, tick, pack, trigger.gateResult, {}), pack, mandate, opts, tick });
    this.events.append('mandate.created', { mandate: canonicalMandateRecord, mandateId: mandate.id, policyVersion: mandate.policyVersion, via: mandate.via, ruleIds: mandate.ruleIds },
      { refs: [ticketId, trigger.id], tick, actor: 'router' });
    this.events.append('ticket.created', { ticket: canonicalTicketRecord, ticketId, domain: trigger.domain, threadKeys: ticket.threadKeys, speculative: ticket.speculative, stage },
      { refs: [ticketId, trigger.id], tick, actor: 'router' });
    this.memory.register(ticketId, {
      kind: 'ticket', title: `${pack.short} · ${ticket.speculative ? 'speculative' : stage}`,
      text: trigger.text, refs: [trigger.id, mandate.id, ...ticket.threadKeys]
    });
    this.memory.register(mandate.id, {
      kind: 'mandate', title: `mandate · ${mandate.via} · ${mandate.policyVersion}`,
      text: `Immutable authority from ${mandate.actorId || mandate.source}; rules ${mandate.ruleIds.join(', ')}`,
      refs: [ticketId, trigger.id]
    });
    // One acknowledgement per Ticket, and at most one per Thread: a later
    // explicit request on an already-acknowledged Thread does not interrupt again.
    const priorAckOnThread = [...this.tickets.values()].some(t => t.id !== ticketId && t.ackSent
      && t.threadKeys.some(k => ticket.threadKeys.includes(k)));
    if (!ticket.speculative && !ticket.ackSent && !priorAckOnThread) {
      ticket.ackSent = true;
      this.enqueueReceipt({
        ticketId, threadKey: ticket.threadKeys[0] || `thread:${ticketId}`, purpose: 'acknowledgement',
        text: `${this.policy.disclosure} Working on it. Evidence will be posted here.`,
        kind: 'chat', tick
      });
    }
    this.enqueueWorker(ticket, stage, [trigger.id], tick, trigger.effort);
    return ticket;
  }

  enqueueWorker(ticket, stage, triggerIds = [], tick = this.tick, effort = ticket.effort) {
    const readyTick = tick + Math.max(1, effort || 1);
    ticket.readyTick = readyTick;
    if (['queued', 'awaiting_approval', 'delivering'].includes(ticket.state)) ticket.state = 'running';
    ticket.startedTick = tick;
    const kind = ticket.speculative ? 'speculation' : stage === 'apply' ? 'apply' : 'launch';
    const workdir = `data/work/${ticket.domain}/${ticket.id}`;
    const assignment = canonicalAssignment({ ticket, stage, triggerIds, tick, workdir,
      workerId: this.workerPool ? `slot-${this.workerPool.activeCount + 1}` : undefined,
      recoveryNote: ticket.recoveryNote || null });
    this.assignments.set(assignment.id, assignment);
    ticket.assignments = ticket.assignments || [];
    ticket.assignments.push(assignment);
    const inputRecord = canonicalInput({ ticket, trigger: this.triggers.get(triggerIds[0]), kind: stage === 'apply' ? 'approval' : 'fast_path', tick });
    this.inputs.set(inputRecord.id, inputRecord);
    ticket.inputs = ticket.inputs || [];
    ticket.inputs.push(inputRecord);
    this.events.append('assignment.created', { assignment, ticketId: ticket.id }, { refs: [ticket.id, assignment.id], tick, actor: 'router' });
    this.events.append('input.created', { input: inputRecord, ticketId: ticket.id }, { refs: [ticket.id, inputRecord.id], tick, actor: 'router' });
    this.effects.enqueue(kind, key(ticket.id, stage, triggerIds.join(',')), { ticketId: ticket.id, stage, triggerIds, effort, readyTick, assignmentId: assignment.id }, tick + 1);
    this.events.append('ticket.assigned', { ticketId: ticket.id, stage, triggerIds, maxWorkers: this.policy.workers.maxWorkers, kind },
      { refs: [ticket.id, assignment.id], tick, actor: 'router' });
  }

  /* ───────────────────────────── Worker results ───────────────────────────── */

  workerInput(ticket, stage, triggerIds) {
    const trigger = this.triggers.get(ticket.triggerId);
    const extra = triggerIds.map(id => this.triggers.get(id)).filter(Boolean);
    const canonical = canonicalTrigger({
      domain: ticket.domain, source: trigger?.source || ticket.domain,
      externalId: trigger?.externalId || ticket.id, actor: trigger?.actor,
      human: trigger?.human, addressed: trigger?.addressed, text: trigger?.text,
      meta: trigger?.meta, threads: ticket.threadKeys, channelKind: ticket.channelKind,
      tags: trigger?.tags, effort: ticket.effort, atTick: trigger?.atTick
    }, this.tick, this.packs[ticket.domain], trigger?.gateResult, { filtered: false,
      reasonCodes: trigger?.gateResult?.reasonCodes || [] });
    canonical.id = trigger?.id || ticket.triggerId;
    const mandate = clone(this.mandates.get(ticket.mandateId));
    const input = buildInput({
      ticket, trigger: canonical, mandate,
      threadContext: this.contextFor(ticket.threadKeys), stage, triggerIds,
      policyVersion: this.policy.version, tick: this.tick,
      speculative: Boolean(ticket.speculative), recoveryNote: ticket.recoveryNote || null
    });
    input.followUps = extra.map(t => t.text);
    input.approval = ticket.approvals.at(-1) || null;
    return input;
  }

  onWorkerResult(ticketId, result, tick) {
    const ticket = this.tickets.get(ticketId);
    if (!ticket) throw new Error(`Unknown ticket ${ticketId}`);
    if (['ended', 'discarded', 'invalidated'].includes(ticket.state)) return { ignored: true };
    const mandate = this.mandates.get(ticket.mandateId);
    // Speculative mandates are intentionally non-resumable, but their first result
    // is still valid: revalidation only applies to ended-Ticket resume.
    const validity = ticket.speculative
      ? { ok: true, reason: 'speculative_result_within_mandate' }
      : revalidate({ mandate, policy: this.policy, sourceStillListened: true });
    const versionValid = mandate.policyVersion === this.policy.version;
    if (!validity.ok || !versionValid) {
      ticket.state = 'invalidated';
      ticket.phase = 'invalidated';
      ticket.lastSummary = `Mandate invalidated: ${validity.reason}${versionValid ? '' : ' / policy_version_changed'}`;
      this.events.append('ticket.invalidated', { ticketId, reason: ticket.lastSummary }, { refs: [ticketId], tick, actor: 'watchdog' });
      if (ticket.speculative) this.metrics.speculativeDiscarded++;
      return { invalidated: true };
    }
    ticket.state = 'running';
    const assignment = [...this.assignments.values()].find(a => a.ticketId === ticketId && a.stage === ticket.stage)
      || canonicalAssignment({ ticket, stage: ticket.stage, triggerIds: [], tick, workdir: `data/work/${ticket.domain}/${ticket.id}` });
    const drift = result.threadKey && result.threadKey !== ticket.threadKeys[0]
      || result.mandateId && result.mandateId !== ticket.mandateId;
    if (drift) {
      ticket.state = 'ended'; ticket.lastSummary = 'Objective drift: worker report references a different thread or mandate.';
      this.events.append('watchdog.flag', { kind: 'objective_drift', severity: 'error', ticketId, message: ticket.lastSummary, recommendation: 'Stop and audit.' },
        { refs: [ticketId], tick, actor: 'watchdog' });
      return { objectiveDrift: true };
    }
    if (result.missingEvidence || result.state === 'blocked') {
      ticket.state = 'ended'; ticket.lastSummary = 'Missing evidence artifacts; report blocked.';
      this.events.append('watchdog.flag', { kind: 'missing_evidence', severity: 'error', ticketId, message: ticket.lastSummary, recommendation: 'Reject report and re-run.' },
        { refs: [ticketId], tick, actor: 'watchdog' });
      return { blocked: true };
    }
    if (result.riskClass === 'forbidden') {
      ticket.state = 'discarded'; ticket.lastSummary = 'Forbidden action refused by policy.';
      this.events.append('watchdog.flag', { kind: 'forbidden_action', severity: 'error', ticketId, message: ticket.lastSummary, recommendation: 'Hard refusal.' },
        { refs: [ticketId], tick, actor: 'watchdog' });
      return { forbidden: true };
    }
    const report = canonicalReport({ assignment, result: { ...result, state: result.state || 'ready' }, tick });
    this.reports.set(report.id, report);
    ticket.reports = ticket.reports || [];
    ticket.reports.push(report);
    ticket.resultCount++;
    ticket.confidence = result.confidence;
    ticket.riskClass = result.riskClass;
    ticket.needsApproval = result.needsApproval;
    ticket.question = result.question || '';
    ticket.lastSummary = result.summary;
    ticket.lastEvidence = result.evidence;
    ticket.artifacts = result.artifacts;
    ticket.artifactsPath = result.artifactsPath;
    ticket.completedTick = tick;
    this.metrics.workerTicks += result.workerTicks || ticket.effort || 1;
    this.metrics.onEvidenceFiles(result.artifacts.length);
    this.events.append('worker.completed', {
      ticketId, stage: ticket.stage, confidence: result.confidence, riskClass: result.riskClass,
      deliver: result.deliver, needsApproval: result.needsApproval,
      artifactCount: result.artifacts.length, artifactsPath: result.artifactsPath
    }, { refs: [ticketId, ...result.artifacts.map(a => `artifact:${ticketId}:${a}`)], tick, actor: 'worker' });
    for (const a of result.artifacts) {
      this.memory.register(`artifact:${ticketId}:${a}`, {
        kind: 'artifact', title: `evidence · ${a}`, text: `${result.artifactsPath}/${a}`, refs: [ticketId]
      });
    }
    this.memory.register(ticketId, {
      kind: 'ticket', title: `${ticket.packName} · result`, text: result.summary,
      refs: [ticket.triggerId, ticket.mandateId, ...result.artifacts.map(a => `artifact:${ticketId}:${a}`)]
    });

    if (ticket.speculative) {
      const threshold = this.policy.speculation.confidenceThreshold;
      if (result.deliver && result.confidence >= threshold) {
        ticket.speculative = false; ticket.promoted = true; ticket.state = 'delivering';
        this.metrics.speculativePromoted++;
        this.events.append('speculation.promoted', { ticketId, confidence: result.confidence, reason: 'deliverable evidence' },
          { refs: [ticketId], tick, actor: 'router' });
        if (!ticket.resultSent) { ticket.resultSent = true; this.enqueueResult(ticket, tick); }
        else { ticket.state = 'done'; ticket.phase = 'done'; ticket.outcome = 'completed'; }
      } else {
        ticket.state = 'discarded';
        ticket.phase = 'discarded';
        this.metrics.speculativeDiscarded++;
        this.metrics.speculativeWasteTicks += ticket.effort || 1;
        this.metrics.silenceSavings++;
        this.events.append('speculation.discarded', { ticketId, confidence: result.confidence, reason: 'no deliverable evidence' },
          { refs: [ticketId], tick, actor: 'router' });
      }
      return { speculative: true, promoted: ticket.promoted };
    }
    if (result.needsApproval) {
      ticket.state = 'awaiting_approval';
      ticket.phase = 'awaiting_approval';
      this.events.append('ticket.blocked', { ticketId, riskClass: result.riskClass, question: result.question },
        { refs: [ticketId], tick, actor: 'router' });
      if (!ticket.attentionSent) {
        ticket.attentionSent = true;
        this.enqueueReceipt({
          ticketId, threadKey: ticket.threadKeys[0], purpose: 'attention',
          text: `${this.policy.disclosure} ${result.question} Reply approve or stop.`, kind: 'chat', tick
        });
      }
    } else if (!ticket.resultSent) {
      ticket.state = 'delivering';
      ticket.phase = 'delivering';
      ticket.resultSent = true;
      this.enqueueResult(ticket, tick);
    } else {
      // One result per Ticket: a later fast-path recheck may refresh evidence,
      // but must not leave the Ticket in a transient delivering phase.
      ticket.state = 'done';
      ticket.phase = 'done';
      ticket.outcome = 'completed';
    }
    return { speculative: false, needsApproval: result.needsApproval };
  }

  enqueueResult(ticket, tick) {
    this.enqueueReceipt({
      ticketId: ticket.id, threadKey: ticket.threadKeys[0] || `thread:${ticket.id}`, purpose: 'result',
      text: `${this.policy.disclosure} ${ticket.lastSummary} Evidence: ${ticket.artifactsPath}/report.md (synthetic simulation).`,
      kind: ticket.channelKind === 'chat' ? 'chat' : 'document', tick
    });
  }

  enqueueReceipt(payload) {
    const receipt = canonicalReceipt(payload);
    this.effects.enqueue('delivery', key(payload.ticketId, payload.threadKey, payload.purpose, payload.text),
      { ...payload, receipt }, payload.tick);
  }

  onReceiptSent(receipt, tick) {
    this.metrics.onReceipt(receipt);
    const ticket = this.tickets.get(receipt.ticketId);
    if (ticket) {
      ticket.attention = ticket.attention || { acks: 0, messages: 0, approvals: 0 };
      if (receipt.purpose === 'acknowledgement') ticket.attention.acks++;
      else if (receipt.purpose === 'attention') ticket.attention.approvals++;
      else ticket.attention.messages++;
    }
    this.memory.link(receipt.threadKey, [receipt.id]);
    this.memory.link(receipt.ticketId, [receipt.id]);
    if (receipt.purpose === 'result') {
      const ticket = this.tickets.get(receipt.ticketId);
      if (ticket && ticket.completionTick === null) {
        ticket.completionTick = tick;
        ticket.state = 'done';
        ticket.phase = 'done';
        this.metrics.onCompletion(tick - ticket.createdTick);
        this.metrics.onArtifact();
        this.events.append('result.sent', { ticketId: ticket.id, receiptId: receipt.id, completionTicks: tick - ticket.createdTick },
          { refs: [ticket.id, receipt.id], tick, actor: 'router' });
      }
    }
  }

  /* ───────────────────────────── Human control ───────────────────────────── */

  approve(ticketId, by = 'human', tick = this.tick) {
    const ticket = this.tickets.get(ticketId);
    if (!ticket || ticket.state !== 'awaiting_approval') return { ok: false, reason: 'ticket_not_awaiting_approval' };
    ticket.approvals.push({ by, tick, scope: ticket.stage });
    ticket.state = 'queued';
    ticket.phase = 'queued';
    const mandate = this.mandates.get(ticket.mandateId);
    if (!mandate) return { ok: false, reason: 'mandate_missing' };
    this.events.append('mandate.approved', { mandateId: mandate.id, by, scope: ticket.stage, policyVersion: mandate.policyVersion },
      { refs: [ticketId, mandate.id], tick, actor: by });
    this.events.append('ticket.resumed', { ticketId, stage: 'apply' }, { refs: [ticketId], tick, actor: by });
    this.enqueueWorker(ticket, 'apply', [], tick, 2);
    return { ok: true };
  }

  stopByThreads(threadKeys, by = 'human', tick = this.tick) {
    let stopped = 0;
    for (const ticket of this.tickets.values()) {
      if (['ended', 'discarded', 'invalidated', 'done', 'delivering'].includes(ticket.state)) continue;
      if (ticket.threadKeys.some(t => threadKeys.includes(t))) { this.endTicket(ticket, by, 'human stop', tick); stopped++; }
    }
    for (const t of threadKeys) {
      const thread = this.threads.get(t);
      if (thread) thread.state = 'ended';
    }
    return stopped;
  }

  stopByTicketId(ticketId, by = 'human', tick = this.tick) {
    const ticket = this.tickets.get(ticketId);
    if (!ticket) return { ok: false, reason: 'unknown_ticket' };
    this.endTicket(ticket, by, 'human stop', tick);
    return { ok: true };
  }

  endTicket(ticket, by, reason, tick) {
    ticket.state = 'ended';
    ticket.phase = 'ended';
    const mandate = this.mandates.get(ticket.mandateId);
    if (mandate) mandate.stopped = true;
    this.effects.cancel(e => e.payload?.ticketId === ticket.id);
    this.events.append('ticket.ended', { ticketId: ticket.id, by, reason }, { refs: [ticketIdOr(ticket)], tick, actor: by });
    this.metrics.silenceSavings++;
  }

  setPolicyVersion(revision, reason = 'control', tick = this.tick) {
    this.policy.revision = String(revision);
    this.policy.version = policyVersion(this.policy);
    this.events.append('policy.changed', { revision, version: this.policy.version, reason, policy: canonicalPolicy(this.policy) }, { tick, actor: 'router' });
    this.invalidateMandates(tick);
    return this.policy.version;
  }

  setMode(mode, by = 'human', tick = this.tick) {
    if (!['off', 'observe', 'auto'].includes(mode)) return { ok: false, reason: 'invalid_mode' };
    this.policy.mode = mode;
    const version = this.setPolicyVersion(`${mode}-${this.policy.revision}`, `mode=${mode}`, tick);
    this.events.append('mode.changed', { mode, by, version }, { tick, actor: by });
    return { ok: true, version };
  }

  invalidateMandates(tick) {
    for (const ticket of this.tickets.values()) {
      const mandate = this.mandates.get(ticket.mandateId);
      if (!mandate || mandate.policyVersion === this.policy.version) continue;
      if (['ended', 'discarded', 'invalidated', 'done', 'delivering'].includes(ticket.state)) continue;
      // A result already computed before the constitution changed is still
      // deliverable; only genuinely in-flight work loses its Mandate.
      if (ticket.completedTick !== null) continue;
      ticket.state = 'invalidated';
      ticket.phase = 'invalidated';
      ticket.lastSummary = `Mandate withdrawn: policy changed to ${this.policy.version}`;
      this.effects.cancel(e => e.payload?.ticketId === ticket.id);
      this.events.append('ticket.invalidated', { ticketId: ticket.id, reason: ticket.lastSummary }, { refs: [ticket.id], tick, actor: 'watchdog' });
      if (ticket.speculative) this.metrics.speculativeDiscarded++;
    }
  }

  control(action, payload = {}, tick = this.tick) {
    const entry = { action, payload, by: payload.by || 'human', tick };
    this.controlLog.push(entry);
    let result;
    switch (action) {
      case 'pause': this.paused = true; result = { ok: true }; break;
      case 'resume': this.paused = false; result = { ok: true }; break;
      case 'setMode': result = this.setMode(payload.mode, payload.by, tick); break;
      case 'approve': result = this.approve(payload.ticketId, payload.by, tick); break;
      case 'stop': result = payload.ticketId ? this.stopByTicketId(payload.ticketId, payload.by, tick)
        : { ok: true, stopped: this.stopByThreads(payload.threads || [], payload.by, tick) }; break;
      case 'policy': result = { ok: true, version: this.setPolicyVersion(payload.revision || 'v3', 'control', tick) }; break;
      case 'inject': result = { ok: true, triggerId: this.ingestTrigger(payload.trigger, tick)?.id || null }; break;
      case 'answer': result = this.answer(payload, tick); break;
      case 'drop': result = { ok: true, dropped: this.outbox.drop(payload.receiptId, payload.reason || 'superseded', tick) }; break;
      case 'resumeTicket': result = this.resumeTicket(payload.ticketId, payload.by, tick); break;
      case 'reevaluate': result = this.reevaluate(payload.ticketId, payload.by, tick); break;
      default: result = { ok: false, reason: 'unknown_control' };
    }
    this.events.append('control', { action, payload, result, by: entry.by }, { tick, actor: entry.by });
    return result;
  }

  answer(payload, tick) {
    const ticket = this.tickets.get(payload.ticketId);
    if (!ticket) return { ok: false, reason: 'unknown_ticket' };
    this.enqueueReceipt({
      ticketId: ticket.id, threadKey: ticket.threadKeys[0], purpose: 'answer',
      text: `${this.policy.disclosure} ${payload.text || 'Here is the requested short answer.'}`,
      kind: ticket.channelKind, tick, reason: 'direct_question'
    });
    return { ok: true };
  }

  resumeTicket(ticketId, by = 'human', tick = this.tick) {
    const ticket = this.tickets.get(ticketId);
    if (!ticket) return { ok: false, reason: 'unknown_ticket' };
    if (ticket.state !== 'ended') return { ok: false, reason: 'ticket_not_ended' };
    const validity = revalidate({ mandate: this.mandates.get(ticket.mandateId), policy: this.policy, sourceStillListened: true });
    if (!validity.ok) return { ok: false, reason: validity.reason };
    ticket.state = 'resumed';
    ticket.phase = 'queued';
    ticket.endedTick = null;
    ticket.outcome = null;
    this.events.append('ticket.resumed', { ticketId, by, reason: 'revalidated_same_mandate' }, { refs: [ticketId], tick, actor: by });
    this.enqueueWorker(ticket, 'recheck', [], tick, 2);
    return { ok: true, state: 'resumed' };
  }

  reevaluate(ticketId, by = 'human', tick = this.tick) {
    const ticket = this.tickets.get(ticketId);
    if (!ticket) return { ok: false, reason: 'unknown_ticket' };
    const trigger = this.triggers.get(ticket.triggerId);
    if (!trigger) return { ok: false, reason: 'trigger_missing' };
    this.pendingTriggers.push(trigger.id);
    this.effects.enqueue('reply', key('reeval', ticket.id, tick), {}, tick + 1);
    this.events.append('eval.requeued', { ticketId, triggerId: trigger.id, by }, { refs: [ticketId, trigger.id], tick, actor: by });
    return { ok: true };
  }

  /* ───────────────────────────── projection ───────────────────────────── */

  getTicket(id) { return this.tickets.get(id) || null; }

  canonicalState() { return canonicalState(this); }
  hydrateFrom(state) { return hydrate(this, state); }

  /** Lightweight read view for the external Watchdog; avoids building the
   *  full canonical projection on every simulated tick. */
  watchdogView() {
    const tickets = [...this.tickets.values()].map(t => ({
      id: t.id, phase: t.state, state: t.state, startedTick: t.startedTick,
      rechecks: t.rechecks || 0, confidence: t.confidence, riskClass: t.riskClass,
      artifacts: t.artifacts || [], reports: t.reports || [], approvals: t.approvals || []
    }));
    const receipts = this.outbox.all().map(r => ({
      id: r.id, ticketId: r.ticketId, kind: r.kind, words: r.words || 0
    }));
    const events = this.events.all().slice(-400).map(e => ({
      seq: e.seq, tick: e.tick, at: e.at, type: e.type, actor: e.actor,
      payload: e.type === 'state.snapshot' ? { compact: true } : (e.payload || {}), refs: e.refs || []
    }));
    return { tickets, receipts, events };
  }

  snapshot(state = canonicalState(this)) {
    const tickets = Object.values(state.tickets).map(t => ({ ...t, mandate: state.mandates[t.mandateId] || null }));
    return {
      ...state,
      policyVersion: state.policy.version, revision: state.policy.revision,
      disclosure: state.policy.disclosure,
      tickets,
      threads: Object.values(state.threads),
      evaluations: this.evaluations.slice(-80),
      effects: Object.values(state.effects),
      receipts: Object.values(state.receipts),
      subscriptions: this.subscriptions.slice(-80),
      events: state.events.slice(-400),
      memory: state.memory,
      packs: state.packs
    };
  }
}

function ticketIdOr(ticket) { return ticket?.id || 'unknown'; }
