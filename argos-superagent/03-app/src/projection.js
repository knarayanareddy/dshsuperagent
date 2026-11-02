import { canonicalPolicy, canonicalTrigger, canonicalThread, canonicalCorrelation,
  canonicalDecision, canonicalMandate, canonicalTicket, canonicalAssignment,
  canonicalInput, canonicalReport, canonicalReceipt, canonicalEffect, canonicalEvent,
  computeStage, validateCanonicalState, boundedThreadContext, simAt } from './records.js';

/**
 * Builds the canonical projection that is written to data/state.json and served
 * on /api/state. The Engine keeps a small compatibility `phase` field for its
 * existing scheduler; `state`, `stage` and the child arrays here are authoritative
 * at every boundary, as required by 01-spec/01.
 */
export function canonicalState(engine) {
  const triggers = {};
  const threads = {};
  const correlations = {};
  const decisions = {};
  const mandates = {};
  const tickets = {};
  const assignments = {};
  const inputs = {};
  const reports = {};
  const receipts = {};
  const effects = {};
  const events = [];

  const packFor = domain => engine.packs[domain] || { id: domain, name: domain, short: domain };

  const triggerRecords = Object.fromEntries(
    [...(engine.rejectedTriggers || []), ...engine.triggers]
      .sort(([ida, a], [idb, b]) => (Number(a.receivedTick ?? a.atTick ?? a.tick) || 0) - (Number(b.receivedTick ?? b.atTick ?? b.tick) || 0)
        || (String(ida) < String(idb) ? -1 : String(ida) > String(idb) ? 1 : 0)));
  // Build indexes once so the canonical boundary stays O(records), not O(n²).
  const ticketsByTrigger = new Map();
  for (const ticket of engine.tickets.values()) {
    const list = ticketsByTrigger.get(ticket.triggerId) || [];
    list.push(ticket.id);
    ticketsByTrigger.set(ticket.triggerId, list);
  }
  const decisionsByTrigger = new Map();
  const decisionsByThread = new Map();
  const triggersByThread = new Map();
  for (const e of engine.evaluations) {
    const list = decisionsByTrigger.get(e.triggerId) || [];
    list.push(e.id);
    decisionsByTrigger.set(e.triggerId, list);
  }
  for (const [id, t] of Object.entries(triggerRecords)) {
    for (const thread of t.threads || []) {
      const list = triggersByThread.get(thread) || [];
      list.push(id);
      triggersByThread.set(thread, list);
    }
  }
  for (const [triggerId, ids] of decisionsByTrigger) {
    for (const thread of triggerRecords[triggerId]?.threads || []) {
      const list = decisionsByThread.get(thread) || [];
      list.push(...ids);
      decisionsByThread.set(thread, list);
    }
  }
  const subscriptionsByThread = new Map();
  for (const s of engine.subscriptions) {
    for (const thread of s.threadKeys || []) {
      const list = subscriptionsByThread.get(thread) || [];
      list.push({ ticketId: s.ticketId, own: true, contextOnly: false });
      subscriptionsByThread.set(thread, list);
    }
  }
  for (const [id, t] of Object.entries(triggerRecords)) {
    const pack = packFor(t.domain);
    let record;
    const cached = t.canonical || (t.channel && t.disposition ? t : null);
    if (cached) {
      record = { ...cached, id, disposition: { ...cached.disposition } };
    } else {
      const template = {
        domain: t.domain, source: t.source, externalId: t.externalId, actor: t.actor,
        human: t.human, addressed: t.addressed, text: t.text, meta: t.meta,
        threads: t.threads, channelKind: t.channelKind || t.channel?.kind, tags: t.tags,
        effort: t.effort, atTick: t.atTick
      };
      record = canonicalTrigger(template, t.receivedTick ?? t.atTick, pack, t.gateResult, {
        filtered: !t.admitted, reasonCodes: t.gateResult?.reasonCodes || []
      });
      record.id = id;
    }
    record.refs = t.refs || record.refs;
    record.disposition = { ...record.disposition,
      reachedTickets: ticketsByTrigger.get(id) || [], handedBack: [], decisions: decisionsByTrigger.get(id) || [],
      reasonCodes: record.disposition.reasonCodes || [] };
    record.disposition.reachedTickets = ticketsByTrigger.get(id) || [];
    record.disposition.decisions = decisionsByTrigger.get(id) || [];
    triggers[id] = record;
    if ((t.threads || []).length > 1) {
      const c = canonicalCorrelation(id, t.threads, t.receivedTick ?? t.atTick);
      correlations[c.id] = c;
    }
  }

  for (const [key, t] of engine.threads) {
    const record = canonicalThread(key, t.source || key.split(':')[0], {
      label: t.label || key, meta: { domain: t.domain }, tick: t.createdTick || 0
    });
    record.id = key;
    record.state = t.state;
    record.createdTick = t.createdTick || 0;
    record.ticketIds = t.ticketIds || [];
    record.triggers = triggersByThread.get(key) || [];
    record.subscriptions = subscriptionsByThread.get(key) || [];
    record.decisions = decisionsByThread.get(key) || [];
    record.activeEval = null;
    record.expired = 0;
    threads[key] = record;
  }

  for (const e of engine.evaluations) {
    const trigger = engine.triggers.get(e.triggerId);
    if (!trigger) continue;
    const decision = canonicalDecision({
      trigger: triggers[e.triggerId] || trigger,
      gateResult: { strength: e.strength, basis: e.basis, reasonCodes: e.reasonCodes },
      assessment: e.assessment, outcome: { outcome: e.outcome, reasonCodes: e.outcomeReasonCodes },
      policyVersion: e.policyVersion || engine.policy.version,
      tick: e.tick, seq: e.seq || e.id
    });
    decision.id = e.id;
    decision.evalId = e.id;
    decisions[e.id] = decision;
  }

  for (const [id, m] of engine.mandates) {
    const ticket = engine.tickets.get(m.ticketId);
    const trigger = engine.triggers.get(ticket?.triggerId);
    const record = canonicalMandate({
      ticketId: m.ticketId,
      trigger: triggers[trigger?.id] || { id: trigger?.id, actor: { id: m.actorId }, source: m.source, channel: { thread: '' }, meta: {} },
      policy: engine.policy, via: m.via, strength: m.strength,
      matchedRules: m.ruleIds || m.matchedRules, tick: m.createdTick, speculative: m.speculative
    });
    record.id = id;
    record.policyVersion = m.policyVersion;
    record.stopped = m.stopped ? { by: 'control', at: simAt(m.createdTick), reason: m.stopped === true ? 'withdrawn' : m.stopped } : null;
    record.triggerIds = m.triggerIds || [trigger?.id].filter(Boolean);
    record.ruleIds = m.ruleIds || [];
    record.immutable = true;
    record.disclosure = engine.policy.disclosure;
    mandates[id] = record;
  }

  for (const [id, t] of engine.tickets) {
    const trigger = triggers[t.triggerId];
    const pack = packFor(t.domain);
    const mandate = engine.mandates.get(t.mandateId);
    const record = canonicalTicket({
      ticketId: id,
      trigger: trigger || { id: t.triggerId, externalId: t.externalId, domain: t.domain, source: t.source || t.domain,
        channel: { thread: t.threadKeys[0], kind: t.channelKind }, meta: {}, threads: t.threadKeys },
      pack, mandate: mandate || { id: t.mandateId },
      opts: { speculative: t.speculative }, tick: t.createdTick
    });
    record.phase = t.state;
    record.state = t.state === 'resumed' ? 'resumed'
      : ['ended', 'discarded', 'invalidated', 'done', 'delivering'].includes(t.state) ? 'ended' : 'open';
    record.stage = t.stage;
    record.channels = [{ thread: t.threadKeys[0], address: `${t.domain}:${t.threadKeys[0]}`, kind: t.channelKind }];
    const child = map => (t[map] || []).map(x => (typeof x === 'string' ? engine[map].get(x) : x)).filter(Boolean);
    record.inputs = child('inputs');
    record.assignments = child('assignments');
    record.reports = child('reports');
    record.artifacts = t.artifacts || [];
    record.artifactsPath = t.artifactsPath;
    record.speculative = Boolean(t.speculative);
    record.silent = Boolean(t.speculative);
    record.promoted = Boolean(t.promoted);
    record.endedTick = t.completionTick;
    record.outcome = t.state === 'done' ? 'completed' : t.state === 'discarded' ? 'dropped' : t.state === 'invalidated' ? 'stopped' : null;
    record.attention = t.attention || { acks: t.ackSent ? 1 : 0, messages: t.resultSent ? 1 : 0, approvals: (t.approvals || []).length };
    record.ackSent = t.ackSent;
    record.resultSent = t.resultSent;
    record.attentionSent = t.attentionSent;
    record.confidence = t.confidence;
    record.riskClass = t.riskClass;
    record.needsApproval = t.needsApproval;
    record.question = t.question;
    record.approvals = t.approvals || [];
    record.lastSummary = t.lastSummary;
    record.lastEvidence = t.lastEvidence;
    record.effort = t.effort;
    record.rechecks = t.rechecks;
    record.startedTick = t.startedTick;
    record.readyTick = t.readyTick;
    record.completionTick = t.completionTick;
    record.completedTick = t.completedTick;
    record.packName = t.packName;
    record.externalId = t.externalId;
    record.triggerId = t.triggerId;
    record.threadKeys = t.threadKeys;
    record.channelKind = t.channelKind;
    record.mandateId = t.mandateId;
    const computed = computeStage(record);
    record.stage = computed.stage;
    record.stageReason = computed.stageReason;
    tickets[id] = record;
  }

  for (const e of engine.effects.all()) {
    const record = canonicalEffect({ kind: e.kind, effectKey: e.key, payload: e.payload, tick: e.dueTick });
    record.id = e.id;
    record.state = ['cancelled'].includes(e.state) ? 'failed' : e.state;
    record.attempts = e.attempts;
    record.dueTick = e.dueTick;
    record.lastError = e.lastError;
    record.order = e.order;
    effects[e.id] = record;
  }

  for (const [assignmentId, a] of engine.assignments || []) assignments[assignmentId] = a;
  for (const [inputId, i] of engine.inputs || []) inputs[inputId] = i;
  for (const [reportId, r] of engine.reports || []) reports[reportId] = r;
  for (const r of engine.outbox.all()) {
    const record = canonicalReceipt({ ticketId: r.ticketId, threadKey: r.threadKey,
      purpose: r.purpose, text: r.text, kind: r.kind, tick: r.createdTick, reason: r.reason });
    record.id = r.id;
    record.status = r.status;
    record.attempts = r.attempts;
    record.sentTick = r.sentTick;
    record.dropReason = r.dropReason;
    record.nextAttemptTick = r.nextAttemptTick ?? r.createdTick;
    receipts[r.id] = record;
  }
  for (const e of engine.events.all().slice(-500)) {
    const ce = canonicalEvent(e);
    // Never nest a full state snapshot inside another snapshot's event list.
    if (e.type === 'state.snapshot') ce.payload = { compact: true, tick: e.tick, schemaVersion: 'argos-4-canonical-1' };
    events.push(ce);
  }

  const state = {
    schemaVersion: 'argos-4-canonical-1',
    tick: engine.tick, paused: engine.paused, mode: engine.policy.mode,
    policy: canonicalPolicy(engine.policy),
    metrics: engine.metrics.snapshot(),
    memory: { cards: engine.memory.all().slice(-200) },
    packs: Object.values(engine.packs).map(p => ({
      id: p.id, name: p.name, short: p.short, tagline: p.tagline, color: p.color,
      sources: p.sources, ruleIds: p.ruleIds, playbook: p.playbook,
      evidenceSchema: p.evidenceSchema, speculationSignals: p.speculationSignals || []
    })),
    triggers, threads, correlations, decisions, mandates, tickets,
    assignments, inputs, reports, receipts, effects, events,
    watchdogFlags: engine.watchdogFlags.slice(-80),
    controlLog: engine.controlLog.slice(-80),
    speculation: [...engine.tickets.values()].filter(t => t.speculative || t.promoted || t.state === 'discarded').map(t => ({
      ticketId: t.id, domain: t.domain, state: t.state, promoted: t.promoted,
      confidence: t.confidence, wasteTicks: t.state === 'discarded' ? t.effort : 0
    })),
    workers: engine.workerPool?.snapshot?.() || null,
    threadContext: boundedThreadContext([...engine.triggers.values()].map(t => ({
      id: t.id, at: simAt(t.receivedTick ?? t.atTick), tick: t.receivedTick, actor: t.actor, text: t.text
    })), null, 10)
  };
  validateCanonicalState(state);
  return state;
}

/** Rehydrate the Engine's compatibility maps from a canonical projection. */
export function hydrate(engine, state) {
  engine.tick = state.tick;
  engine.paused = state.paused;
  // Restore the full versioned Policy, not just its mode: the version hash is
  // part of the canonical projection and of Mandate validity.
  Object.assign(engine.policy, {
    version: state.policy?.version || engine.policy.version,
    revision: state.policy?.revision || engine.policy.revision,
    mode: state.mode,
    rules: state.policy?.rules || engine.policy.rules,
    sources: state.policy?.sources || engine.policy.sources,
    speculation: state.policy?.speculation || engine.policy.speculation,
    autonomy: state.policy?.autonomy || engine.policy.autonomy,
    attention: state.policy?.attention || engine.policy.attention,
    workers: state.policy?.workers || engine.policy.workers,
    watchdog: state.policy?.watchdog || engine.policy.watchdog,
    disclosure: state.policy?.disclosure || engine.policy.disclosure,
    evalLatencyTicks: state.policy?.evalLatencyTicks || engine.policy.evalLatencyTicks,
    clock: state.policy?.clock || engine.policy.clock,
    paused: Boolean(state.policy?.paused)
  });
  const triggerEntries = Object.entries(state.triggers || {}).sort(([ida, a], [idb, b]) =>
    (Number(a.tick ?? a.atTick) || 0) - (Number(b.tick ?? b.atTick) || 0)
      || (String(ida) < String(idb) ? -1 : String(ida) > String(idb) ? 1 : 0));
  engine.triggers = new Map(triggerEntries.map(([id, t]) => [id, {
    id, canonical: t, domain: t.domain, source: t.source, actor: t.actor, human: t.human,
    addressed: t.addressed, text: t.text, meta: t.meta, threads: t.threads,
    channelKind: t.channel.kind, tags: t.tags, effort: t.effort,
    speculative: t.speculative, externalId: t.externalId, atTick: t.atTick,
    receivedTick: t.tick, strength: t.strength, basis: t.basis,
    admitted: !t.disposition.filtered, gateResult: t.gateResult
  }]));
  engine.threads = new Map(Object.entries(state.threads).map(([key, t]) => [key, {
    id: key, domain: t.meta?.domain || t.domain, source: t.source,
    state: t.state, createdTick: t.createdTick, ticketIds: t.ticketIds || []
  }]));
  engine.tickets = new Map(Object.entries(state.tickets).map(([id, t]) => [id, {
    ...t, state: t.phase || t.state,
    inputs: (t.inputs || []).map(x => (typeof x === 'string' ? state.inputs[x] : x)).filter(Boolean),
    assignments: (t.assignments || []).map(x => (typeof x === 'string' ? state.assignments[x] : x)).filter(Boolean),
    reports: (t.reports || []).map(x => (typeof x === 'string' ? state.reports[x] : x)).filter(Boolean),
    artifactsPath: t.artifactsPath, artifacts: t.artifacts,
    approvals: t.approvals || [], lastSummary: t.lastSummary,
    lastEvidence: t.lastEvidence, confidence: t.confidence, riskClass: t.riskClass,
    needsApproval: t.needsApproval, question: t.question,
    ackSent: t.ackSent, resultSent: t.resultSent, attentionSent: t.attentionSent,
    completionTick: t.completionTick, completedTick: t.completedTick,
    startedTick: t.startedTick, readyTick: t.readyTick, rechecks: t.rechecks || 0
  }]));
  engine.mandates = new Map(Object.entries(state.mandates).map(([id, m]) => [id, {
    ...m, stopped: Boolean(m.stopped), immutable: true,
    triggerIds: m.triggerIds, ruleIds: m.ruleIds
  }]));
  engine.evaluations = Object.values(state.decisions).map(d => ({
    id: d.id, triggerId: d.triggerIds[0], domain: d.domain, tick: d.tick,
    strength: d.strength, basis: d.basis, reasonCodes: d.reasonCodes,
    assessment: d.assessment, outcome: d.outcome, outcomeReasonCodes: d.outcomeReasonCodes || [],
    batchSize: d.batchSize, threadContextSize: d.threadContextSize, seq: d.evalId
  }));
  engine.subscriptions = Object.values(state.threads).flatMap(t => (t.subscriptions || []).map(s => ({
    id: `sub-${t.key}-${s.ticketId}`, triggerId: null, ticketId: s.ticketId,
    threadKeys: [t.key], passThrough: true, routerDecisionsAvoided: 1,
    createdTick: t.createdTick
  })));
  engine.assignments = new Map(Object.entries(state.assignments));
  engine.inputs = new Map(Object.entries(state.inputs));
  engine.reports = new Map(Object.entries(state.reports));
  engine.correlations = new Map(Object.entries(state.correlations || {}));
  engine.rejectedTriggers = new Map(Object.entries(state.triggers || {}).filter(([, t]) => t.disposition?.filtered));
  engine.duplicateTriggers = new Map(Object.entries(state.triggers || {}).filter(([, t]) => t.disposition?.reasonCodes?.includes('duplicate')));
  engine.pendingTriggers = state.pendingTriggers || [];
  engine.seq = state.seq || engine.seq || 0;
  engine.watchdogFlags = state.watchdogFlags || [];
  engine.controlLog = state.controlLog || [];
  // Receipts and effects are owned by Outbox/Effects; restore their views.
  engine.outbox.receipts = new Map(Object.entries(state.receipts).map(([id, r]) => [id, { ...r, kind: r.kind || 'chat', reason: r.reason || '' }]));
  engine.outbox.pendingOrder = Object.values(state.receipts).filter(r => r.status === 'pending').map(r => r.id);
  engine.effects.queue = Object.values(state.effects).map(e => ({ ...e, order: e.order || 0 }));
  engine.effects.order = engine.effects.queue.length;
  // Restore metric counters, bounded memory cards and WorkerPool view.
  if (state.metrics) {
    const m = state.metrics;
    const numeric = ['triggersIngested','triggersFiltered','evalBatches','routerDecisions',
      'routerDecisionsAvoided','wouldAccept','wouldSpeculate','ticketsCreated',
      'speculativeStarted','speculativePromoted','speculativeDiscarded','speculativeWasteTicks',
      'silenceSavings','messagesSent','wordsSent','approvalsRequested','acksSent',
      'resultsDelivered','artifactsProduced','evidenceFiles','policyViolations',
      'watchdogFlags','workerTicks','cacheReadTokensEst'];
    for (const k of numeric) engine.metrics[k] = Number(m[k]) || 0;
    engine.metrics.evalBatchSizes = [...(m.evalBatchSizes || [])];
    engine.metrics.completionTicks = [...(m.completionTicks || [])];
  }
  if (state.memory?.cards) engine.memory.cards = new Map(state.memory.cards.map(c => [c.id, { ...c }]));
  if (state.workers && engine.workerPool) {
    const w = state.workers;
    for (const k of ['maxWorkers', 'spawnCount', 'killCount', 'wallCapMs', 'timeoutTicks']) {
      if (Number.isFinite(w[k])) engine.workerPool[k] = w[k];
    }
    engine.workerPool.running = new Map();
    engine.workerPool.completed = [];
  }
  // The event log is restored by EventStore.loadFromJSONL, not from the
  // projection's compact event list. Do not overwrite it here.
  return engine;
}
