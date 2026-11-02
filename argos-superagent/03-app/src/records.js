import { key, clone, isoFromTick, wordCount, truncate } from './util.js';

/**
 * Canonical record shapes from 01-spec/01-domain-model.md.
 * These are the authoritative shapes exposed on /api/state, data/state.json
 * and the event-sourced projector. Internal Engine helpers may carry extra
 * fields, but every record crossing a boundary is one of these shapes.
 */

export const SCHEMA_VERSION = 'argos-4-canonical-1';
export const simAt = tick => isoFromTick(tick);

const rid = (prefix, ...parts) => key(prefix, ...parts);

export function canonicalTrigger(template, tick, pack, gateResult, disposition = {}) {
  const source = template.source;
  const threads = (template.threads || []).slice();
  const primary = threads[0] || `${source}:${template.externalId}`;
  const id = rid('trigger', source, template.externalId);
  return {
    id, source, at: simAt(tick), tick,
    threads,
    actor: template.actor || { id: '', type: 'system' },
    human: template.human !== false,
    addressed: template.addressed || null,
    text: template.text || '',
    meta: template.meta || {},
    channel: {
      thread: primary,
      address: `${source}:${primary}`,
      kind: template.channelKind || 'chat'
    },
    disposition: {
      filtered: Boolean(disposition.filtered),
      reachedTickets: [],
      handedBack: [],
      decisions: [],
      reasonCodes: disposition.reasonCodes || []
    },
    refs: [id, ...threads],
    // Extensions used by the deterministic showcase; not part of the gate.
    domain: template.domain,
    externalId: template.externalId,
    packId: pack?.id || template.domain,
    tags: (template.tags || []).slice(),
    effort: template.effort || 0,
    speculative: Boolean(template.meta?.speculative || template.tags?.includes('speculative')),
    atTick: template.atTick ?? tick,
    receivedTick: tick,
    strength: gateResult?.strength || null,
    basis: gateResult?.basis || null,
    gateResult: gateResult || null
  };
}

export function canonicalThread(threadKey, source, { label, url, meta, tick = 0 } = {}) {
  return {
    key: threadKey, source,
    label: label || threadKey,
    url: url || `argos://thread/${encodeURIComponent(threadKey)}`,
    triggers: [], subscriptions: [], queued: [], decisions: [],
    activeEval: null, expired: 0, meta: meta || {},
    refs: [threadKey],
    // Extensions retained for the live UI.
    id: threadKey, domain: meta?.domain || source.split(':')[0],
    state: 'observing', createdTick: tick, ticketIds: []
  };
}

export function canonicalCorrelation(triggerId, threadKeys, tick) {
  return {
    id: rid('correlation', triggerId, threadKeys.join(',')),
    threadKeys: threadKeys.slice(), triggerId,
    createdTick: tick, at: simAt(tick), refs: [triggerId, ...threadKeys]
  };
}

export function canonicalDecision({ trigger, gateResult, assessment, outcome, policyVersion, tick, seq }) {
  const evalId = rid('eval', trigger.id, seq);
  return {
    id: rid('decision', trigger.id, seq),
    threadKey: trigger.threads[0] || trigger.channel.thread,
    triggerIds: [trigger.id], evalId, policyVersion,
    strength: gateResult.strength,
    outcome: outcome.outcome,
    reasonCodes: [...(gateResult.reasonCodes || []), ...(outcome.reasonCodes || [])],
    ruleJudgements: assessment?.ruleJudgements || [],
    intentEvidence: assessment?.intentEvidence || null,
    at: simAt(tick), tick, dismissed: false,
    refs: [trigger.id, evalId, ...trigger.threads],
    // Extensions.
    domain: trigger.domain, basis: gateResult.basis,
    assessment: assessment ? {
      direction: assessment.direction, reason: assessment.reason,
      matchedRules: assessment.matchedRules, ruleJudgements: assessment.ruleJudgements,
      intentEvidence: assessment.intentEvidence, adapter: assessment.adapter
    } : null,
    batchSize: assessment?.batchSize || 0,
    threadContextSize: assessment?.threadContextSize || 0
  };
}

export function canonicalPolicy(policy) {
  return {
    version: policy.version, mode: policy.mode,
    rules: policy.rules || [],
    sources: policy.sources || {},
    speculation: policy.speculation || {},
    autonomy: policy.autonomy || {},
    attention: policy.attention || {},
    workers: policy.workers || {},
    watchdog: policy.watchdog || {},
    // Extensions: volatile fields excluded from the version hash.
    revision: policy.revision || 'v2',
    disclosure: policy.disclosure || 'ARGOS automated agent — not a human.',
    evalLatencyTicks: policy.evalLatencyTicks || 1,
    clock: policy.clock || 1, paused: policy.paused || false
  };
}

export function canonicalMandate({ ticketId, trigger, policy, via, strength, matchedRules, tick, speculative }) {
  return {
    id: rid('mandate', ticketId, policy.version, trigger.id),
    policyVersion: policy.version, ticketId,
    strength, scope: trigger.meta?.scope || trigger.meta?.playbook || 'run',
    matchedRules: matchedRules || [],
    actorId: trigger.actor?.id || '', source: trigger.source,
    receivingScope: trigger.channel.thread,
    via, speculative: Boolean(speculative), createdTick: tick,
    stopped: null,
    refs: [ticketId, trigger.id],
    // Extensions.
    triggerIds: [trigger.id], ruleIds: matchedRules || [],
    immutable: true, disclosure: policy.disclosure
  };
}

export function canonicalTicket({ ticketId, trigger, pack, mandate, opts, tick }) {
  const stage = trigger.meta?.playbook || trigger.meta?.requestKind || 'run';
  return {
    id: ticketId,
    title: `${pack.short || pack.id} · ${trigger.externalId}`,
    domain: trigger.domain, mandateId: mandate.id,
    state: 'open', stage, stageReason: 'accepted',
    channels: [{ thread: trigger.channel.thread, address: trigger.channel.address, kind: trigger.channel.kind }],
    inputs: [], assignments: [],
    subscriptions: trigger.threads.map(t => ({ thread: t, own: true, contextOnly: false })),
    reports: [], artifacts: [],
    speculative: Boolean(opts.speculative), createdTick: tick,
    endedTick: null, outcome: null,
    attention: { acks: 0, messages: 0, approvals: 0 },
    refs: [ticketId, mandate.id, trigger.id, ...trigger.threads],
    // Extensions used by the existing engine/UI.
    packName: pack.name, externalId: trigger.externalId, triggerId: trigger.id,
    threadKeys: trigger.threads.slice(), channelKind: trigger.channel.kind,
    silent: Boolean(opts.speculative), promoted: false,
    ackSent: false, resultSent: false, attentionSent: false, resultCount: 0, rechecks: 0,
    artifactsPath: null, confidence: null, riskClass: null,
    needsApproval: false, question: '', approvals: [], lastSummary: '', lastEvidence: null,
    effort: trigger.effort || 0, startedTick: null, readyTick: null,
    completionTick: null, completedTick: null
  };
}

export function canonicalAssignment({ ticket, stage, triggerIds, tick, workdir, workerId, recoveryNote = null }) {
  return {
    id: rid('assignment', ticket.id, stage, triggerIds.join(',')),
    ticketId: ticket.id, workerId: workerId || `worker-${rid('slot', ticket.id, stage).slice(0, 6)}`,
    workdir, state: 'pending', startedTick: tick, endedTick: null,
    exitCode: null, recoveryNote,
    refs: [ticket.id, ...triggerIds]
  };
}

export function canonicalInput({ ticket, trigger, kind, text, tick, delivered = true }) {
  return {
    id: rid('input', ticket.id, trigger?.id || kind, tick),
    ticketId: ticket.id, triggerId: trigger?.id || null, kind,
    text: text || trigger?.text || '', deliveredTick: delivered ? tick : null,
    readTick: null, at: simAt(tick), tick,
    refs: [ticket.id, trigger?.id].filter(Boolean)
  };
}

export function canonicalReport({ assignment, result, tick }) {
  return {
    id: rid('report', assignment.id, tick),
    assignmentId: assignment.id,
    state: result.state || 'ready',
    summary: result.summary || '',
    confidence: result.confidence ?? 0,
    evidenceRefs: (result.artifacts || []).map(a => `artifact:${assignment.ticketId}:${a}`),
    needsApproval: Boolean(result.needsApproval),
    riskClass: result.riskClass || 'read-only',
    at: simAt(tick), tick,
    refs: [assignment.id, assignment.ticketId]
  };
}

export function canonicalReceipt({ ticketId, threadKey, purpose, text, kind, tick, reason = '' }) {
  return {
    id: rid('receipt', ticketId, threadKey, purpose, text),
    ticketId, threadKey, purpose, text,
    words: wordCount(text), status: 'pending', attempts: 0,
    dropReason: null, createdTick: tick, sentTick: null,
    reason, kind: kind || 'chat',
    refs: [ticketId, threadKey].filter(Boolean),
    // Retry schedule from spec 06 §4.
    nextAttemptTick: tick, retryDelays: [5, 10, 20, 40]
  };
}

export function canonicalEffect({ kind, effectKey, payload, tick }) {
  return {
    id: rid('effect', kind, effectKey, tick),
    kind, key: effectKey, payload: { ...(payload || {}) },
    state: 'due', attempts: 0, dueTick: tick, lastError: null,
    refs: [payload?.ticketId].filter(Boolean)
  };
}

export function canonicalEvent(event) {
  return {
    seq: event.seq, tick: event.tick, at: event.at || simAt(event.tick),
    type: event.type, actor: event.actor || 'system',
    payload: event.type === 'state.snapshot' ? { compact: true, tick: event.tick, schemaVersion: SCHEMA_VERSION } : { ...(event.payload || {}) },
    refs: event.refs || []
  };
}

/** Spec 01 §2: stage is computed by first-match, never authoritative. */
export function computeStage(ticket) {
  const reports = (ticket.reports || []).map(r => (typeof r === 'string' ? { state: null } : r));
  const latest = reports.at(-1);
  const hasHumanSinceReport = (ticket.inputs || []).some(i => i.deliveredTick !== null && i.kind === 'fast_path');
  if ((ticket.inputs || []).some(i => i.deliveredTick === null)) return { stage: 'person/delivery', stageReason: 'input_delivery_failed' };
  if (ticket.needsApproval || (ticket.approvals || []).some(a => a.pending)) return { stage: 'person/answer', stageReason: 'open_approval_or_question' };
  if (latest?.state === 'ready' && (ticket.artifacts || []).length) return { stage: 'person/review', stageReason: 'artifact_awaits_acceptance' };
  if (['failed', 'blocked'].includes(latest?.state) && !hasHumanSinceReport) return { stage: 'person/failed', stageReason: 'failed_report_without_human_message' };
  if (!(ticket.assignments || []).some(a => a.state === 'running')) return { stage: 'working/queued', stageReason: 'no_running_assignment' };
  if (latest?.state === 'waiting') return { stage: 'idle', stageReason: 'report_waiting' };
  return { stage: 'working', stageReason: 'assignment_running' };
}

/** Spec 04 §1: bounded, truncated Thread context with resource pointers. */
export function boundedThreadContext(triggers, focusTriggerId, limit = 10) {
  // Canonical order is deterministic: tick, then stable ID. Live Map insertion
  // order and snapshot rehydration order must not change the projection.
  triggers = [...triggers].sort((a, b) =>
    (Number(a.tick) || 0) - (Number(b.tick) || 0)
      || (String(a.id || '') < String(b.id || '') ? -1 : String(a.id || '') > String(b.id || '') ? 1 : 0));
  const first = triggers.slice(0, 5);
  const idx = triggers.findIndex(t => t.id === focusTriggerId);
  const around = idx >= 0 ? triggers.slice(Math.max(0, idx - 2), idx + 3) : [];
  const seen = new Set();
  const out = [];
  for (const t of [...first, ...around]) {
    if (!t || seen.has(t.id)) continue;
    seen.add(t.id);
    const clipped = truncate(t.text, 400);
    out.push({
      id: t.id, at: t.at, tick: t.tick, actor: t.actor,
      text: clipped.text, chars: clipped.chars, truncated: clipped.truncated,
      resource: `argos://trigger/${t.id}`, inline: true
    });
    if (out.length >= limit) break;
  }
  return out;
}

export function validateCanonicalState(state) {
  const required = ['triggers', 'threads', 'correlations', 'decisions', 'mandates', 'tickets',
    'assignments', 'inputs', 'reports', 'receipts', 'effects', 'events'];
  for (const k of required) if (!state[k]) throw new Error(`Canonical state missing ${k}`);
  for (const t of Object.values(state.tickets)) {
    if (!['open', 'ended', 'resumed'].includes(t.state)) throw new Error(`Ticket ${t.id} has non-canonical state ${t.state}`);
    if (!t.stage || !t.stageReason) throw new Error(`Ticket ${t.id} missing computed stage`);
    if (!Array.isArray(t.inputs) || !Array.isArray(t.assignments) || !Array.isArray(t.reports)) throw new Error(`Ticket ${t.id} missing canonical child arrays`);
  }
  for (const r of Object.values(state.receipts)) {
    if (!['pending', 'sent', 'dropped'].includes(r.status)) throw new Error(`Receipt ${r.id} has non-canonical status ${r.status}`);
  }
  for (const e of Object.values(state.effects)) {
    if (!['due', 'running', 'done', 'failed'].includes(e.state)) throw new Error(`Effect ${e.id} has non-canonical state ${e.state}`);
  }
  return true;
}

/**
 * Event-sourced projection. Every tick also appends a full `state.snapshot`
 * event, so rebuilding from the append-only log is deterministic and O(n).
 * Granular `*.record` events carry the individual canonical records for audit.
 */
export class Projector {
  constructor() {
    this.state = {
      schemaVersion: SCHEMA_VERSION, tick: 0, paused: false, mode: 'observe',
      policy: null, metrics: null, memory: null, packs: [],
      triggers: {}, threads: {}, correlations: {}, decisions: {}, mandates: {},
      tickets: {}, assignments: {}, inputs: {}, reports: {}, receipts: {},
      effects: {}, events: [], watchdogFlags: [], controlLog: [], speculation: []
    };
  }

  apply(event) {
    const p = event.payload || {};
    const put = (bucket, record, id = record?.id || record?.key) => {
      if (record && id) this.state[bucket][id] = { ...record };
    };
    switch (event.type) {
      case 'state.snapshot':
        if (p.state) this.state = { ...p.state, events: [...(p.state.events || [])] };
        // A compact snapshot event is only a cursor marker; keep current state.
        break;
      case 'trigger.received':
      case 'trigger.filtered':
      case 'trigger.duplicate': put('triggers', p.trigger || p.record); break;
      case 'thread.updated': put('threads', p.thread || p.record, (p.thread || p.record)?.key); break;
      case 'correlation.created': put('correlations', p.correlation || p.record); break;
      case 'eval.recorded':
      case 'decision.recorded': put('decisions', p.decision || p.record); break;
      case 'mandate.created': put('mandates', p.mandate || p.record); break;
      case 'ticket.created':
      case 'ticket.updated':
      case 'ticket.assigned':
      case 'ticket.resumed':
      case 'ticket.ended':
      case 'ticket.invalidated': put('tickets', p.ticket || p.record); break;
      case 'assignment.created':
      case 'assignment.updated':
      case 'assignment.recovery': put('assignments', p.assignment || p.record); break;
      case 'input.created': put('inputs', p.input || p.record); break;
      case 'report.recorded': put('reports', p.report || p.record); break;
      case 'receipt.queued':
      case 'receipt.updated':
      case 'message.sent':
      case 'message.dropped': put('receipts', p.receipt || p.record); break;
      case 'effect.enqueued':
      case 'effect.updated':
      case 'effect.done':
      case 'effect.failed': put('effects', p.effect || p.record); break;
      case 'watchdog.flag': this.state.watchdogFlags.push({ ...p }); break;
      case 'control': this.state.controlLog.push({ ...p }); break;
      case 'policy.changed': if (p.policy) this.state.policy = { ...p.policy }; break;
      case 'tick': this.state.tick = event.tick; break;
      default: break;
    }
    this.state.events.push({ ...event,
      payload: event.type === 'state.snapshot'
        ? { compact: true, tick: event.tick, schemaVersion: SCHEMA_VERSION }
        : { ...(event.payload || {}) } });
    if (this.state.events.length > 600) this.state.events.splice(0, 100);
  }

  snapshot() { return clone(this.state); }
}
