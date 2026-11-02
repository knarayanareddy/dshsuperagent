import { mkdirSync, writeFileSync, readFileSync, existsSync, unlinkSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EventStore } from './events.js';
import { Effects, Later } from './effects.js';
import { MemoryGraph } from './memory.js';
import { Outbox } from './outbox.js';
import { Metrics } from './metrics.js';
import { Watchdog } from './watchdog.js';
import { Engine } from './engine.js';
import { PACKS, allCatalogs } from './domains/index.js';
import { Projector } from './records.js';
import { canonicalState, hydrate } from './projection.js';
import { WorkerPool } from './workers.js';
import { clone } from './util.js';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';

const APP_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = join(APP_DIR, 'data');
const CANONICAL_EVENTLOG = join(DATA_DIR, 'eventlog.jsonl');
const CANONICAL_STATE = join(DATA_DIR, 'state.json');

/**
 * Composition root. Wires the Engine to the clock, filesystem and real child
 * processes. State is an event-sourced projection; every tick appends a full
 * canonical state snapshot so /api/replay can rebuild from eventlog.jsonl.
 */
export class Simulation {
  constructor({
    policy, packs = PACKS, catalog = null, workDir = null, persist = true,
    eventLogPath = CANONICAL_EVENTLOG, maxTicks = 60, controls = [],
    metricsConfig = {}, live = false, domainFilter = null, inProcess = false
  } = {}) {
    if (!policy) throw new Error('Simulation requires a versioned policy object');
    this.policy = clone(policy);
    this.packs = domainFilter ? { [domainFilter]: packs[domainFilter] } : packs;
    this.catalog = (catalog || allCatalogs())
      .filter(e => !domainFilter || e.domain === domainFilter)
      .map(e => ({ ...e })).sort((a, b) => a.atTick - b.atTick);
    this.domainFilter = domainFilter;
    this.workDir = workDir || join(DATA_DIR, 'work');
    mkdirSync(this.workDir, { recursive: true });
    mkdirSync(DATA_DIR, { recursive: true });
    this.persist = persist;
    this.maxTicks = maxTicks;
    this.controls = controls.map(c => ({ ...c }));
    this.live = live;
    this.performance = { engineMs: [], workerWallMs: 0, benchmarkMs: 0 };

    this.projector = new Projector();
    this.events = new EventStore({ logPath: eventLogPath, persist, projector: this.projector });
    this.effects = new Effects({ events: this.events });
    this.effects.maxConcurrency = 128;
    this.memory = new MemoryGraph();
    this.outbox = new Outbox({ events: this.events, memory: this.memory, policy: this.policy });
    this.metrics = new Metrics(metricsConfig);
    this.engine = new Engine({ policy: this.policy, events: this.events, effects: this.effects,
      memory: this.memory, outbox: this.outbox, metrics: this.metrics, packs: this.packs });
    this.workerPool = new WorkerPool({
      events: this.events, workDir: this.workDir,
      maxWorkers: this.policy.workers.maxWorkers,
      timeoutTicks: this.policy.workers.timeoutTicks,
      wallCapMs: 15000, inProcess
    });
    this.engine.workerPool = this.workerPool;
    this.watchdog = new Watchdog({ policy: this.policy });
    this.registerHandlers();
    this.events.append('system.started', {
      packs: Object.keys(this.packs), catalogSize: this.catalog.length,
      policyVersion: this.engine.policy.version, mode: this.policy.mode,
      disclosure: this.policy.disclosure, domainFilter
    }, { tick: 0, actor: 'system' });
  }

  registerHandlers() {
    this.effects.handle('reply', (_payload, { tick }) => {
      this.engine.runEvals(tick);
      return true;
    });

    const launch = async (payload, { effect, tick, ctx }) => {
      if (ctx.paused) throw new Later('simulation paused');
      if (tick < payload.readyTick) throw new Later('worker effort not elapsed');
      if (this.workerPool.activeCount >= this.policy.workers.maxWorkers) throw new Later('no free worker slot');
      const ticket = this.engine.getTicket(payload.ticketId);
      if (!ticket || ['ended', 'discarded', 'invalidated'].includes(ticket.state)) return true;
      const input = this.engine.workerInput(ticket, payload.stage, payload.triggerIds);
      const handle = await this.workerPool.launch({
        ticket, input, tick, stage: payload.stage, triggerIds: payload.triggerIds,
        recoveryNote: ticket.recoveryNote || null
      });
      if (handle.deferred) throw new Later(handle.reason);
      return true;
    };
    for (const kind of ['launch', 'apply', 'speculation']) this.effects.handle(kind, launch);

    this.effects.handle('relay', (payload, { tick }) => {
      this.events.append('worker.progress', payload, { refs: [payload.ticketId].filter(Boolean), tick, actor: 'worker' });
      return true;
    });

    this.effects.handle('delivery', (payload, { tick, ctx }) => {
      const finalFlush = Boolean(ctx.finalFlush);
      const maxPerTick = finalFlush ? Number.POSITIVE_INFINITY : this.policy.attention.maxMessagesPerTick;
      const receipt = this.outbox.send({ ...payload, actor: 'router', tick });
      const delivery = this.outbox.deliver(receipt.id, { tick, maxPerTick, force: finalFlush });
      if (delivery?.deferred && !finalFlush) throw new Later(delivery.reason || `ordered behind ${delivery.behind}`);
      if (delivery?.sent) this.engine.onReceiptSent(receipt, tick);
      return true;
    });
  }

  processWorkerCompletions(tick) {
    const completed = this.workerPool.pollCompleted();
    for (const handle of completed) {
      if (Number.isFinite(handle.elapsedMs)) this.performance.workerWallMs = Math.max(this.performance.workerWallMs, handle.elapsedMs);
      const progress = handle.progress || [];
      const counts = new Map();
      for (const p of progress) {
        this.events.append('worker.progress', { ...p, ticketId: handle.ticketId, workerId: handle.id },
          { refs: [handle.ticketId, handle.id], tick, actor: 'worker' });
        if (p.hash) counts.set(p.hash, (counts.get(p.hash) || 0) + 1);
      }
      const looped = [...counts.values()].some(n => n >= this.policy.watchdog.loopThreshold);
      let result = handle.result;
      if (handle.timedOut || handle.exitCode !== 0 || !result) {
        result = {
          state: 'failed', summary: `Worker ${handle.timedOut ? 'timed out' : 'failed'}: ${handle.stderr || 'no result'}`,
          confidence: 0, riskClass: 'read-only', needsApproval: false, deliver: false,
          artifacts: [], artifactsPath: handle.workdir, evidence: {},
          timedOut: Boolean(handle.timedOut), exitCode: handle.exitCode
        };
      }
      result.artifactsPath = handle.workdir;
      if (looped) result.loopDetected = true;
      if (handle.recoveryNote) result.recoveryNote = handle.recoveryNote;
      this.engine.onWorkerResult(handle.ticketId, result, tick);
      const ticket = this.engine.getTicket(handle.ticketId);
      const assignment = [...this.engine.assignments.values()].find(a => a.ticketId === handle.ticketId && a.stage === handle.stage);
      if (assignment) {
        assignment.state = 'ended'; assignment.endedTick = tick;
        assignment.exitCode = handle.exitCode;
        assignment.recoveryNote = handle.recoveryNote;
        this.events.append('assignment.updated', { assignment }, { refs: [handle.ticketId, assignment.id], tick, actor: 'router' });
      }
      if (ticket) {
        ticket.reports = ticket.reports || [];
        const report = [...this.engine.reports.values()].find(r => r.assignmentId === assignment?.id);
        if (report) this.events.append('report.recorded', { report }, { refs: [handle.ticketId, report.id], tick, actor: 'router' });
      }
      if (looped || handle.timedOut) {
        const flag = {
          id: `wd-${looped ? 'loop' : 'timeout'}-${handle.id}`,
          kind: looped ? 'worker_loop' : 'worker_timeout', severity: 'error',
          ticketId: handle.ticketId,
          message: looped ? 'Identical worker step hash repeated.' : 'Worker wall-clock timeout exceeded.',
          recommendation: 'Retry once, then stop and notify a person.', tick
        };
        this.engine.watchdogFlags.push(flag);
        this.events.append('watchdog.flag', flag, { refs: [handle.ticketId], tick, actor: 'watchdog' });
      }
    }
    for (const leak of this.workerPool.slotLeaks()) {
      const flag = { id: `wd-leak-${leak.id}`, kind: 'slot_leak', severity: 'error', ticketId: leak.ticketId,
        message: 'Running Assignment has no live process.', recommendation: 'Free the slot and mark failed.', tick };
      this.engine.watchdogFlags.push(flag);
      this.events.append('watchdog.flag', flag, { refs: [leak.ticketId], tick, actor: 'watchdog' });
    }
  }

  async runTick(tick) {
    this._finalizedState = null;
    this._finalizedSeq = 0;
    this.engine.tick = tick;
    this.events.append('tick', { tick }, { tick, actor: 'system' });
    this.processWorkerCompletions(tick);
    if (!this.engine.paused) {
      for (const template of this.catalog.filter(e => e.atTick === tick)) this.engine.ingestTrigger(template, tick);
      await this.effects.process({ simulation: this, paused: this.engine.paused }, tick);
    }
    for (const control of this.controls.filter(c => c.atTick === tick && (!c.when || c.when(this.engine)))) {
      const payload = control.resolve ? control.resolve(this.engine) : (control.payload || {});
      if (payload === null) continue;
      this.engine.control(control.action, payload, tick);
    }
    // Outbox retry schedule 5 → 10 → 20 → 40, processed independently of effects.
    for (const receipt of this.outbox.deliverDue(tick, this.policy.attention.maxMessagesPerTick)) {
      this.engine.onReceiptSent(receipt, tick);
    }
    const view = this.engine.watchdogView();
    const findings = this.watchdog.check(view, tick);
    for (const flag of findings) {
      this.engine.watchdogFlags.push(flag);
      this.metrics.watchdogFlags++;
      if (flag.severity === 'error') this.metrics.policyViolations++;
      this.events.append('watchdog.flag', flag, { refs: [flag.ticketId].filter(Boolean), tick, actor: 'watchdog' });
    }
    // Compact cursor marker each tick. A full canonical snapshot is appended
    // exactly once by finalize(), so the log stays O(events) not O(events^2).
    this.events.append('state.snapshot', { compact: true, tick, schemaVersion: 'argos-4-canonical-1' }, { tick, actor: 'system' });
    if (this.persist) {
      writeFileSync(CANONICAL_EVENTLOG, this.events.toJSONL(), 'utf8');
      if (tick % 10 === 0 || tick === this.maxTicks) writeFileSync(CANONICAL_STATE, JSON.stringify(canonicalState(this.engine), null, 2), 'utf8');
    }
    return view;
  }

  canonicalStateTimed() {
    const started = performance.now();
    const state = canonicalState(this.engine);
    this.performance.engineMs.push(performance.now() - started);
    return state;
  }

  async runUntil(maxTick = this.maxTicks) {
    for (let tick = 1; tick <= maxTick; tick++) await this.runTick(tick);
    await this.workerPool.drain();
    this.processWorkerCompletions(maxTick);
    // Flush durable effects and the Outbox at the final tick. A completed
    // worker result must become `done` with a literal `result.sent` event,
    // not remain in the transient internal `delivering` phase.
    for (let pass = 0; pass < 8; pass++) {
      await this.effects.process({ simulation: this, paused: false, finalFlush: true }, maxTick);
      const sent = this.outbox.deliverDue(maxTick, Number.POSITIVE_INFINITY, { force: true });
      for (const receipt of sent) this.engine.onReceiptSent(receipt, maxTick);
      if (!sent.length && !this.outbox.pending().length) break;
    }
    this.engine.tick = maxTick;
    this.finalize();
    return this.snapshot();
  }

  /** Append the authoritative full-state snapshot once, at the end of a run. */
  finalize() {
    if (this._finalized) return this._finalized;
    const state = this.canonicalStateTimed();
    const event = this.events.append('state.snapshot', { state, compact: false }, { tick: this.engine.tick, actor: 'system' });
    this._finalizedState = state;
    this._finalizedSeq = this.events.seq;
    if (this.persist) {
      writeFileSync(CANONICAL_EVENTLOG, this.events.toJSONL(), 'utf8');
      writeFileSync(CANONICAL_STATE, JSON.stringify(state, null, 2), 'utf8');
    }
    this._finalized = event;
    return event;
  }

  control(action, payload = {}) {
    this._finalizedState = null;
    return this.engine.control(action, { ...payload, by: payload.by || 'dashboard-user' }, this.engine.tick);
  }

  injectTrigger(template) {
    this._finalizedState = null;
    const t = { ...template, domain: template.domain || Object.keys(this.packs)[0], atTick: template.atTick ?? this.engine.tick,
      externalId: template.externalId || `manual-${Date.now()}`, source: template.source, actor: template.actor || { id: 'dashboard-user', type: 'human' } };
    return this.engine.ingestTrigger(t, this.engine.tick);
  }

  snapshot() {
    if (!this._finalizedState || this._finalizedSeq !== this.events.seq || this._finalizedState.tick !== this.engine.tick) {
      this._finalizedState = this.canonicalStateTimed();
      this._finalizedSeq = this.events.seq;
    }
    const base = this.engine.snapshot(this._finalizedState);
    return {
      ...base,
      workDir: this.workDir,
      catalogSize: this.catalog.length,
      domainFilter: this.domainFilter,
      eventLogPath: this.events.logPath,
      live: this.live,
      workers: this.workerPool.snapshot(),
      performance: this.metrics.assertPerformanceBudgets({
        engineMs: [...this.performance.engineMs],
        eventCount: this.events.seq,
        pollPayloadBytes: Buffer.byteLength(JSON.stringify({ seq: this.events.seq,
          events: this.events.since(Math.max(0, this.events.seq - 1)).slice(-1)
            .map(e => ({ seq: e.seq, tick: e.tick, at: e.at, type: e.type, actor: e.actor, refs: e.refs })) })),
        workerWallMs: this.performance.workerWallMs,
        benchmarkMs: this.performance.benchmarkMs
      }),
      config: {
        maxWorkers: this.policy.workers.maxWorkers,
        speculationEnabled: this.policy.speculation.enabled,
        speculationThreshold: this.policy.speculation.confidenceThreshold,
        chatWordLimit: this.policy.attention.chatWordLimit,
        maxMessagesPerTick: this.policy.attention.maxMessagesPerTick,
        tokensPerCard: this.metrics.config.tokensPerCard,
        cardsPerDecision: this.metrics.config.cardsPerDecision,
        sessionsAlive: this.metrics.config.sessionsAlive
      }
    };
  }

  eventLog() { return this.events.toJSONL(); }

  stateJSON() {
    if (!this._finalizedState || this._finalizedSeq !== this.events.seq || this._finalizedState.tick !== this.engine.tick) {
      this._finalizedState = this.canonicalStateTimed();
      this._finalizedSeq = this.events.seq;
    }
    return JSON.stringify(this._finalizedState, null, 2);
  }

  /** Spec 07 §3: rebuild the projection from the append-only log. */
  static async rebuildFromLog(baseConfig, logPath = CANONICAL_EVENTLOG) {
    if (!logPath || !existsSync(logPath)) return new Simulation({ ...baseConfig, persist: false, eventLogPath: null });
    const text = readFileSync(logPath, 'utf8');
    const events = text.trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
    const snapshots = events.filter(e => e.type === 'state.snapshot' && e.payload?.state);
    const clonedPolicy = JSON.parse(JSON.stringify(baseConfig.policy));
    const sim = new Simulation({ ...baseConfig, policy: clonedPolicy, persist: false, eventLogPath: null });
    if (snapshots.length) {
      const state = snapshots.at(-1).payload.state;
      hydrate(sim.engine, state);
      sim.events.loadFromJSONL(text);
      sim.workerPool.killAll();
      // A completed run has no interrupted Assignments. Genuine crashes are
      // marked by the control-plane recovery action, which appends its own
      // assignment.recovery event; replay therefore never mutates the log.
      const interrupted = Object.values(state.assignments || {}).filter(a =>
        ['running', 'pending'].includes(a.state) && state.controlLog?.some(c => c.action === 'recover'));
      sim.engine.recoveryCandidates = interrupted.map(a => ({ ...a,
        recoveryNote: 'rebuilt from eventlog.jsonl after interrupted Assignment' }));
    } else {
      sim.events.loadFromJSONL(text);
    }
    return sim;
  }
}

/** Deterministic replay check: independent runs and a true log rebuild. */
export async function replayCheck(config) {
  const a = new Simulation({ ...config, persist: false, eventLogPath: null });
  const b = new Simulation({ ...config, persist: false, eventLogPath: null });
  await a.runUntil(config.maxTicks || 60);
  await b.runUntil(config.maxTicks || 60);
  const left = a.eventLog(), right = b.eventLog();
  const lines = left.trim().split('\n').filter(Boolean);
  const hash = createHash('sha256').update(left).digest('hex').slice(0, 24);
  // Rebuild from the append-only log, not from the live Engine's memory.
  const tmp = join(DATA_DIR, `replay-${process.pid}-${Date.now()}.jsonl`);
  writeFileSync(tmp, left, 'utf8');
  const rebuilt = await Simulation.rebuildFromLog({ ...config, persist: false, eventLogPath: null }, tmp);
  const rebuiltLog = rebuilt.eventLog();
  const rebuiltLines = rebuiltLog.trim().split('\n').filter(Boolean);
  const identicalState = JSON.stringify(canonicalState(a.engine)) === JSON.stringify(canonicalState(rebuilt.engine));
  const logRebuilt = rebuiltLog === left;
  try { unlinkSync(tmp); } catch {}
  return { identical: left === right && logRebuilt && identicalState,
    events: lines.length, rebuiltEvents: rebuiltLines.length,
    seq: a.events.seq, rebuiltSeq: rebuilt.events.seq,
    left, right, hash, logRebuilt, stateRebuilt: identicalState };
}
