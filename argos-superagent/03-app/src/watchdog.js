import { key } from './util.js';

/**
 * External semantic Watchdog. Reads canonical projections, never writes domain
 * state directly; the composition root escalates findings through Engine.
 * Spec 05 §7 checks: stall, loop, missing evidence, objective drift, slot leak,
 * timeout, plus the original injection / integrity / attention checks.
 */
export class Watchdog {
  constructor({ policy }) {
    this.policy = policy;
    this.seen = new Set();
  }

  check(snapshot, tick) {
    const findings = [];
    const add = (kind, severity, ticketId, message, recommendation, subject = '', escalation = 'panel') => {
      const id = key('wd', kind, ticketId || 'global', subject || message);
      if (this.seen.has(id)) return;
      this.seen.add(id);
      findings.push({ id, kind, severity, ticketId, message, recommendation, tick,
        escalation, stage: severity === 'error' ? 'stop_and_attention' : 'flag' });
    };

    for (const ticket of snapshot.tickets) {
      const phase = ticket.phase || ticket.state;
      if (phase === 'running' && ticket.startedTick !== null && tick - ticket.startedTick > this.policy.watchdog.stallTicks) {
        add('stalled_ticket', 'warn', ticket.id, `Ticket ${ticket.id} has been running for ${tick - ticket.startedTick} ticks.`,
          'Check the worker effect queue or stop the ticket.', `stall-${ticket.startedTick}`, 'retry_then_stop');
      }
      if (ticket.rechecks > this.policy.watchdog.loopThreshold) {
        add('loop_suspected', 'warn', ticket.id, `${ticket.rechecks} pass-through rechecks on one ticket.`,
          'Consolidate follow-ups or end the ticket.', `rechecks-${ticket.rechecks}`, 'retry_then_stop');
      }
      if (ticket.confidence !== null && ticket.confidence < 0.65) {
        add('low_confidence', 'warn', ticket.id, `Result confidence ${ticket.confidence} below 0.65.`,
          'Request a second worker or downgrade the claim.', `conf-${ticket.confidence}`);
      }
      if (phase === 'done' && (ticket.artifacts || []).length === 0) {
        add('missing_evidence', 'error', ticket.id, 'A result was sent without evidence artifacts.',
          'Block delivery and re-run the worker.', `no-artifacts-${ticket.id}`, 'stop_and_attention');
      }
      if ((ticket.reports || []).some(r => r.state === 'blocked' || r.state === 'failed')) {
        add('missing_evidence', 'error', ticket.id, 'Worker produced a blocked or failed report.',
          'Reject the report and alert a person.', `blocked-report-${ticket.id}`, 'stop_and_attention');
      }
      if (phase === 'done' && ticket.riskClass === 'high-impact' && (ticket.approvals || []).length === 0) {
        add('approval_bypass', 'error', ticket.id, 'High-impact result delivered without recorded human approval.',
          'Halt actuation and audit the mandate.', `bypass-${ticket.id}`, 'stop_and_attention');
      }
      if (ticket.riskClass === 'forbidden') {
        add('forbidden_action', 'error', ticket.id, 'Forbidden action was attempted.',
          'Hard refusal; withdraw the mandate.', `forbidden-${ticket.id}`, 'stop_and_attention');
      }
    }
    for (const receipt of snapshot.receipts || []) {
      if (receipt.kind === 'chat' && receipt.words > this.policy.attention.chatWordLimit) {
        add('word_cap_breach', 'error', receipt.ticketId, `Chat receipt has ${receipt.words} words.`,
          'Enforce the 100-word cap in Outbox.', receipt.id, 'stop_and_attention');
      }
    }
    for (const event of snapshot.events || []) {
      if (event.type === 'message.sent' && event.actor !== 'router') {
        add('worker_authored_message', 'error', event.payload?.ticketId || null, 'A non-router actor wrote to a Channel.',
          'Revoke the worker and replay the event log.', `event-${event.seq}`, 'stop_and_attention');
      }
      if (event.type === 'source.rejected' && event.payload?.reasonCodes?.includes('untrusted_content_ignored')) {
        add('prompt_injection_blocked', 'info', null, 'Untrusted instruction text was blocked before it became a Trigger.',
          'No action needed; text is data.', `event-${event.seq}`);
      }
      if (event.type === 'trigger.received' && event.payload?.text && /-40°C|implausible/i.test(event.payload.text)) {
        add('sensor_integrity', 'warn', null, 'Implausible sensor reading admitted as data.',
          'Flag for operator review; never auto-actuate on it.', `event-${event.seq}`);
      }
      if (event.type === 'policy.violation') {
        add('untrusted_content_ignored', 'info', null, 'Untrusted content was rejected at intake before authorisation.',
          'No action needed; Trigger text is data.', `event-${event.seq}`);
      }
      if (event.type === 'watchdog.flag' && ['worker_loop', 'worker_timeout', 'slot_leak', 'objective_drift'].includes(event.payload?.kind)) {
        add(event.payload.kind, 'error', event.payload.ticketId || null, event.payload.message || 'Worker supervision finding.',
          event.payload.recommendation || 'Retry once, then stop and notify a person.', `event-${event.seq}`, 'stop_and_attention');
      }
      if (event.type === 'control' && event.payload?.action === 'setMode' && event.payload?.payload?.mode === 'auto') {
        add('mode_auto_enabled', 'info', null, 'Auto mode enabled by a human control.',
          'Matched-rule scope only; high-impact actions still require approval.', `event-${event.seq}`);
      }
    }
    return findings;
  }
}
