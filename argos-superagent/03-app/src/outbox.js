import { key, wordCount } from './util.js';
import { canonicalReceipt } from './records.js';

export const DROP_REASONS = ['channel_gone', 'source_off', 'mandate_withdrawn', 'superseded', 'conversation_gone'];
export const RETRY_DELAYS = [5, 10, 20, 40];

/**
 * Router-only outbound writer. Spec 06: idempotent receipts, per-thread ordering,
 * 100-word cap, throttle, 5→10→20→40 retry, and explicit drop reasons.
 */
export class Outbox {
  constructor({ events, memory, policy }) {
    this.receipts = new Map();
    this.events = events;
    this.memory = memory;
    this.policy = policy;
    this.pendingOrder = [];
  }

  send({ ticketId, threadKey, purpose, text, reason = '', actor = 'router', kind = 'chat', tick = 0, receipt: supplied = null }) {
    if (actor !== 'router') throw new Error('INVARIANT VIOLATION: a worker attempted to write to a Channel');
    const id = key('receipt', ticketId, threadKey, purpose, text);
    if (this.receipts.has(id)) return this.receipts.get(id);
    const words = wordCount(text);
    if (kind === 'chat' && words > this.policy.attention.chatWordLimit) {
      throw new Error(`INVARIANT VIOLATION: chat reply exceeds ${this.policy.attention.chatWordLimit} words (${words})`);
    }
    const receipt = supplied ? { ...supplied, id, words, status: 'pending', attempts: 0,
      createdTick: tick, sentTick: null, dropReason: null, nextAttemptTick: tick, retryDelays: RETRY_DELAYS }
      : canonicalReceipt({ ticketId, threadKey, purpose, text, kind, tick, reason });
    receipt.id = id;
    receipt.kind = kind;
    receipt.reason = reason;
    this.receipts.set(id, receipt);
    this.pendingOrder.push(id);
    this.events.append('receipt.queued', { receipt },
      { refs: [ticketId, threadKey, id].filter(Boolean), tick, actor: 'router' });
    this.events.append('outbox.queued', { receiptId: id, purpose, threadKey, words, preview: text.slice(0, 120) },
      { refs: [ticketId, threadKey, id].filter(Boolean), tick, actor: 'router' });
    this.memory.register(id, { kind: 'receipt', title: `${purpose} · ${words}w`, text, refs: [ticketId, threadKey].filter(Boolean) });
    return receipt;
  }

  deliver(receiptId, { tick = 0, maxPerTick = 3, force = false } = {}) {
    const r = this.receipts.get(receiptId);
    if (!r || r.status !== 'pending') return null;
    const earlier = this.pendingOrder
      .filter(id => id !== receiptId)
      .map(id => this.receipts.get(id))
      .find(x => x && x.status === 'pending' && x.ticketId === r.ticketId && x.threadKey === r.threadKey && x.attempts < 3 && x.createdTick <= r.createdTick
        && this.pendingOrder.indexOf(x.id) < this.pendingOrder.indexOf(receiptId));
    if (earlier) return this.defer(r, `ordered behind ${earlier.id}`, tick);
    const sentThisTick = [...this.receipts.values()].filter(x => x.sentTick === tick).length;
    if (!force && sentThisTick >= maxPerTick) return this.defer(r, 'attention_throttle', tick);
    r.status = 'sent'; r.sentTick = tick;
    this.events.append('receipt.updated', { receipt: r }, { refs: [r.ticketId, r.threadKey, r.id].filter(Boolean), tick, actor: 'router' });
    this.events.append('message.sent', { receiptId: r.id, purpose: r.purpose, threadKey: r.threadKey, text: r.text, words: r.words },
      { refs: [r.ticketId, r.threadKey, r.id].filter(Boolean), tick, actor: 'router' });
    this.memory.register(r.id, { kind: 'receipt', title: `sent · ${r.purpose}`, text: r.text,
      refs: [r.ticketId, r.threadKey].filter(Boolean), meta: { status: 'sent' } });
    return { sent: true, receipt: r };
  }

  defer(r, reason, tick) {
    r.attempts += 1;
    const delay = RETRY_DELAYS[Math.min(r.attempts - 1, RETRY_DELAYS.length - 1)];
    r.nextAttemptTick = tick + delay;
    r.lastDeferReason = reason;
    if (r.attempts >= RETRY_DELAYS.length + 1) return this.drop(r.id, 'superseded', tick);
    this.events.append('receipt.updated', { receipt: r }, { refs: [r.ticketId, r.threadKey, r.id].filter(Boolean), tick, actor: 'router' });
    return { deferred: true, reason, nextAttemptTick: r.nextAttemptTick };
  }

  deliverDue(tick = 0, maxPerTick = 3, { force = false } = {}) {
    const sent = [];
    for (const r of this.pending()) {
      if (!force && r.nextAttemptTick > tick) continue;
      const result = this.deliver(r.id, { tick, maxPerTick, force });
      if (result?.sent) sent.push(r);
    }
    return sent;
  }

  drop(receiptId, reason, tick = 0) {
    const r = this.receipts.get(receiptId);
    if (!r || r.status === 'sent') return null;
    if (!DROP_REASONS.includes(reason)) throw new Error(`Non-canonical drop reason: ${reason}`);
    r.status = 'dropped'; r.dropReason = reason;
    this.events.append('receipt.updated', { receipt: r }, { refs: [r.ticketId, r.threadKey, r.id].filter(Boolean), tick, actor: 'router' });
    this.events.append('message.dropped', { receiptId, reason, text: r.text },
      { refs: [r.ticketId, r.threadKey, r.id].filter(Boolean), tick, actor: 'router' });
    return r;
  }

  dropForTicket(ticketId, reason, tick = 0) {
    return this.pending().filter(r => r.ticketId === ticketId).map(r => this.drop(r.id, reason, tick)).filter(Boolean);
  }

  pending() { return [...this.receipts.values()].filter(r => r.status === 'pending'); }
  all() { return [...this.receipts.values()]; }
}
