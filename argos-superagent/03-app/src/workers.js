import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { key, isoFromTick } from './util.js';
import { workdirFor, executeWorker } from './worker/runner.js';
import { PACK_META } from './domains/experiments.js';

const APP_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RUNNER_PATH = join(APP_DIR, 'src', 'worker', 'runner.js');
const SECRET_LIKE = /(^|_)(KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|HOME|AWS|AZURE|GCP|OPENAI|DEEPSEEK)/i;

/**
 * Spec 02/05 worker pool. Each Ticket gets one real `child_process.spawn`
 * in its own workdir with a rebuilt, allowlisted environment. The child imports
 * only pure domain functions; no credential, no HOME, no network library.
 * Awaiting the child's `close` event keeps replay byte-identical while still
 * crossing a real OS process boundary with a hard wall-clock timeout.
 */
export function strippedEnv({ ticketId, domain, stage, policyVersion, tick }) {
  const allowed = {
    PATH: process.env.PATH || '',
    NODE_PATH: join(APP_DIR, 'src'),
    ARGOS_TICKET: ticketId,
    ARGOS_DOMAIN: domain,
    ARGOS_STAGE: stage,
    ARGOS_POLICY_VERSION: policyVersion,
    ARGOS_TICK: String(tick),
    ARGOS_SYNTHETIC: 'true'
  };
  for (const k of Object.keys(allowed)) if (SECRET_LIKE.test(k) && !k.startsWith('ARGOS_')) delete allowed[k];
  return allowed;
}

/** Spawn one child and resolve only when its stdio and exit status are final. */
function spawnAndWait(command, args, { cwd, env, timeout = 15000, maxBuffer = 16 * 1024 * 1024 }, onSpawn = null) {
  return new Promise(resolvePromise => {
    const child = spawn(command, args, {
      cwd, env, shell: false, stdio: ['ignore', 'pipe', 'pipe']
    });
    onSpawn?.(child);
    let stdout = '', stderr = '', timedOut = false, error = null, settled = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeout);
    const finish = (status = null, signal = null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolvePromise({ status, signal, stdout, stderr, error, timedOut });
    };
    child.stdout?.on('data', chunk => {
      stdout += chunk;
      if (Buffer.byteLength(stdout) > maxBuffer) {
        timedOut = true;
        child.kill('SIGKILL');
      }
    });
    child.stderr?.on('data', chunk => { stderr += chunk; });
    child.on('error', err => { error = err; finish(null, null); });
    child.on('close', (status, signal) => finish(status, signal));
  });
}

export class WorkerPool {
  constructor({ events, workDir, maxWorkers = 4, timeoutTicks = 40, wallCapMs = 15000, appDir = APP_DIR, inProcess = false }) {
    this.events = events;
    this.inProcess = inProcess;
    this.workDir = workDir;
    this.maxWorkers = maxWorkers;
    this.timeoutTicks = timeoutTicks;
    this.wallCapMs = wallCapMs;
    this.appDir = appDir;
    this.running = new Map();
    this.completed = [];
    this.order = 0;
    this.spawnCount = 0;
    this.killCount = 0;
  }

  get activeCount() { return this.running.size; }

  async launch({ ticket, input, tick, stage, triggerIds = [], recoveryNote = null }) {
    const dir = workdirFor(this.workDir, ticket.domain, ticket.id);
    mkdirSync(dir, { recursive: true });
    const inputPath = join(dir, 'input.json');
    const frozenInput = {
      ...input, tick, speculative: Boolean(ticket.speculative),
      triggerIds, recoveryNote,
      channel: input.channel || { thread: ticket.threadKeys?.[0], kind: ticket.channelKind || 'chat' }
    };
    writeFileSync(inputPath, JSON.stringify(frozenInput, null, 2), 'utf8');
    const env = strippedEnv({ ticketId: ticket.id, domain: ticket.domain, stage, policyVersion: input.policyVersion, tick });
    const startedAt = Date.now();
    const order = this.order++;
    const id = key('worker-run', ticket.id, stage, order);
    const runningEntry = { id, child: null, startedAt, promise: null, timedOut: false };
    this.running.set(id, runningEntry);

    const work = (async () => {
      let stdout = '', stderr = '', progress = [], result = null;
      let timedOut = false, exitCode = 0, signal = null;
      if (this.inProcess) {
        try {
          const pack = { id: ticket.domain, name: PACK_META[ticket.domain]?.name || ticket.domain };
          const executed = executeWorker({ pack, ticket, input: frozenInput, workDir: this.workDir,
            tick, policyVersion: input.policyVersion, recoveryNote });
          result = { ...executed, workerTicks: Math.max(1, Number(input.tick) || 1) };
          progress = result.progress || [];
          stdout = progress.map(p => JSON.stringify(p)).join('\n');
        } catch (error) {
          exitCode = 1;
          stderr = String(error.message || error);
        }
      } else {
        const childResult = await spawnAndWait(process.execPath, [RUNNER_PATH, inputPath], {
          cwd: dir, env, timeout: this.wallCapMs, maxBuffer: 16 * 1024 * 1024
        }, child => { runningEntry.child = child; });
        timedOut = childResult.timedOut || childResult.signal === 'SIGKILL';
        stdout = childResult.stdout || '';
        stderr = childResult.stderr || String(childResult.error?.message || '');
        progress = stdout.trim().split('\n').filter(Boolean).map(line => {
          try { return JSON.parse(line); } catch { return { raw: line }; }
        }).filter(p => p && p.step !== undefined);
        const resultPath = join(dir, 'result.json');
        if (existsSync(resultPath)) {
          try { result = JSON.parse(readFileSync(resultPath, 'utf8')); } catch { result = null; }
        }
        if (result) result.workerTicks = Math.max(1, Number(input.tick) || 1);
        exitCode = childResult.status;
        signal = childResult.signal;
      }
      runningEntry.timedOut = timedOut;
      return { stdout, stderr, progress, result, timedOut, exitCode, signal };
    })();
    runningEntry.promise = work;
    let outcome;
    try { outcome = await work; }
    finally { this.running.delete(id); }

    const { stdout, stderr, progress, result, timedOut, exitCode, signal } = outcome;
    const handle = {
      id, order,
      ticketId: ticket.id, domain: ticket.domain, stage, triggerIds,
      workdir: dir, inputPath, env: Object.keys(env),
      startedTick: tick, startedAt, at: isoFromTick(tick),
      done: true, exitCode, signal,
      timedOut, killed: timedOut, stdout, stderr, progress, result,
      elapsedMs: Date.now() - startedAt, recoveryNote, wallCapMs: this.wallCapMs,
      inProcess: this.inProcess
    };
    if (timedOut) this.killCount++;
    this.spawnCount++;
    this.completed.push(handle);
    this.events.append('worker.spawned', {
      workerId: handle.id, ticketId: ticket.id, domain: ticket.domain, stage,
      workdir: dir, envKeys: handle.env, wallCapMs: this.wallCapMs,
      timeoutTicks: this.timeoutTicks, maxWorkers: this.maxWorkers,
      exitCode: handle.exitCode, timedOut: handle.timedOut,
      spawn: 'child_process.spawn'
    }, { refs: [ticket.id, handle.id], tick, actor: 'router' });
    return handle;
  }

  pollCompleted() { return this.completed.splice(0).sort((a, b) => a.order - b.order); }
  async drain() {
    await Promise.allSettled([...this.running.values()].map(entry => entry.promise).filter(Boolean));
    this.running.clear();
    return [];
  }
  slotLeaks() {
    const now = Date.now();
    return [...this.running.values()].filter(entry => now - entry.startedAt > this.wallCapMs)
      .map(entry => ({ id: entry.id, ticketId: null }));
  }
  killAll() {
    for (const entry of this.running.values()) {
      if (entry.child && !entry.child.killed) entry.child.kill('SIGKILL');
    }
  }

  snapshot() {
    return { maxWorkers: this.maxWorkers, active: this.running.size, spawnCount: this.spawnCount,
      killCount: this.killCount, wallCapMs: this.wallCapMs,
      timeoutTicks: this.timeoutTicks, running: [...this.running.keys()] };
  }
}
