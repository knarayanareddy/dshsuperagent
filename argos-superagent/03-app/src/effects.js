import { key } from './util.js';
import { canonicalEffect } from './records.js';

/** A handler can defer work without counting a failure (no free slot, paused, etc.). */
export class Later extends Error {
  constructor(reason = 'deferred') { super(reason); this.name = 'Later'; }
}

/** Canonical effect kinds from 01-spec/01 §1. */
export const EFFECT_KINDS = ['launch', 'delivery', 'relay', 'reply', 'speculation', 'apply'];

/** Durable side-effect queue: enqueued inside the Engine transaction, run after commit. */
export class Effects {
  constructor({ events }) {
    this.events = events;
    this.queue = [];
    this.handlers = new Map();
    this.order = 0;
    this.maxConcurrency = 6;
  }

  handle(kind, fn) { this.handlers.set(kind, fn); }

  enqueue(kind, itemKey, payload = {}, tick = 0) {
    if (!EFFECT_KINDS.includes(kind)) throw new Error(`Non-canonical effect kind: ${kind}`);
    const existing = this.queue.find(e => e.kind === kind && e.key === itemKey && (e.state === 'due' || e.state === 'running'));
    if (existing) { existing.payload = payload; existing.dueTick = tick; return existing; }
    const record = canonicalEffect({ kind, effectKey: itemKey, payload, tick });
    const effect = { ...record, order: this.order++ };
    this.queue.push(effect);
    this.events.append('effect.enqueued', { effect },
      { refs: [effect.id, itemKey].filter(Boolean), tick });
    return effect;
  }

  cancel(predicate) {
    for (const e of this.queue) {
      if ((e.state === 'due' || e.state === 'running') && predicate(e)) {
        e.state = 'failed'; e.lastError = 'cancelled';
        this.events.append('effect.updated', { effect: e }, { tick: e.dueTick });
      }
    }
  }

  async process(ctx, tick) {
    let running = 0;
    const due = this.queue.filter(e => e.state === 'due' && e.dueTick <= tick).sort((a, b) => a.order - b.order);
    for (const effect of due) {
      if (running >= this.maxConcurrency) break;
      running++;
      const handler = this.handlers.get(effect.kind);
      if (!handler) { effect.state = 'failed'; effect.lastError = `no handler for ${effect.kind}`; running--; continue; }
      effect.state = 'running';
      try {
        const result = await handler(effect.payload, { effect, tick, ctx });
        if (result === false) throw new Later('handler returned false');
        effect.state = 'done';
        effect.lastError = null;
        this.events.append('effect.updated', { effect }, { tick });
      } catch (error) {
        if (error instanceof Later) {
          effect.state = 'due'; effect.dueTick = tick + 1; effect.lastError = error.message;
          this.events.append('effect.updated', { effect }, { tick });
          continue;
        }
        effect.attempts += 1;
        effect.lastError = String(error.message || error);
        if (effect.attempts >= 3) {
          effect.state = 'failed';
          this.events.append('effect.failed', { effectId: effect.id, kind: effect.kind, error: effect.lastError }, { tick, actor: 'watchdog' });
        } else {
          effect.state = 'due';
          // Spec 02 §6: 2s doubling to 60s equivalent.
          effect.dueTick = tick + Math.min(60, 2 ** (effect.attempts + 1));
        }
        this.events.append('effect.updated', { effect }, { tick });
      }
      running--;
    }
  }

  all() { return this.queue; }
  pending() { return this.queue.filter(e => e.state === 'due' || e.state === 'running'); }
  failed() { return this.queue.filter(e => e.state === 'failed'); }
}
