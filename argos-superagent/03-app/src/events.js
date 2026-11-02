import fs from 'node:fs';
import path from 'node:path';
import { isoFromTick } from './util.js';

/**
 * Append-only event log: the single source of truth for replay.
 * Domain state is derived from these events; nothing mutates it directly.
 */
export class EventStore {
  constructor({ logPath = null, persist = false, projector = null } = {}) {
    this.events = [];
    this.seq = 0;
    this.logPath = logPath;
    this.persist = persist && Boolean(logPath);
    this.projector = projector;
    if (this.persist) {
      fs.mkdirSync(path.dirname(this.logPath), { recursive: true });
      fs.writeFileSync(this.logPath, '');
    }
  }

  append(type, payload = {}, { refs = [], tick = 0, actor = 'system' } = {}) {
    const event = { seq: ++this.seq, tick, at: isoFromTick(tick), type, actor, payload, refs };
    this.events.push(event);
    if (this.events.length > 4000) this.events.splice(0, 1000);
    if (this.persist) fs.appendFileSync(this.logPath, JSON.stringify(event) + '\n');
    if (this.projector) this.projector.apply(event);
    return event;
  }

  since(seq = 0) { return this.events.filter(e => e.seq > seq); }

  all() { return this.events; }

  /** Rebuild an event list and its projection from a JSONL log (used by `replay`). */
  loadFromJSONL(text) {
    this.events = text.trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
    this.seq = this.events.length ? Math.max(...this.events.map(e => e.seq)) : 0;
    if (this.projector) for (const event of this.events) this.projector.apply(event);
    return this.events;
  }

  toJSONL() { return this.events.map(e => JSON.stringify(e)).join('\n') + '\n'; }
}
