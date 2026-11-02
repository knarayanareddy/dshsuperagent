import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { loadPolicy, loadBenchmarkConfig, demoControls } from '../src/demo.js';
import { PACKS, PACK_IDS, allCatalogs } from '../src/domains/index.js';
import { packMeta } from '../src/domains/experiments.js';
import { EventStore } from '../src/events.js';
import {
  SCHEMA_VERSION, canonicalTrigger, canonicalThread, canonicalDecision,
  canonicalPolicy, canonicalMandate, canonicalTicket, canonicalAssignment,
  canonicalInput, canonicalReport, canonicalReceipt, canonicalEffect,
  canonicalEvent, computeStage, boundedThreadContext, validateCanonicalState,
  Projector
} from '../src/records.js';
import { canonicalState, hydrate } from '../src/projection.js';
import { Outbox, DROP_REASONS, RETRY_DELAYS } from '../src/outbox.js';
import { Effects, EFFECT_KINDS, Later } from '../src/effects.js';
import { Watchdog } from '../src/watchdog.js';
import { MemoryGraph } from '../src/memory.js';
import { Metrics } from '../src/metrics.js';
import { Simulation, replayCheck } from '../src/simulation.js';
import { runBenchmark } from '../src/benchmark.js';
import { WorkerPool, strippedEnv } from '../src/workers.js';
import { buildInput, workdirFor } from '../src/worker/runner.js';
import { scope, gate, revalidate } from '../src/policy.js';
import { startServer } from '../src/web/server.js';

const TMP = mkdtempSync(join(tmpdir(), 'argos-conformance-'));
after(() => rmSync(TMP, { recursive: true, force: true }));
const policy = loadPolicy();
const config = loadBenchmarkConfig();
const workDir = join(TMP, 'work');

function baseConfig(overrides = {}) {
  return {
    policy, catalog: allCatalogs(), controls: demoControls(), workDir,
    persist: false, eventLogPath: null, maxTicks: 10, ...overrides
  };
}

test('canonical record factories, state machine, stages and bounded context', () => {
  const pack = PACKS['science-replication-lab'];
  const gateResult = { strength: 'explicit', basis: 'addressed', reasonCodes: [] };
  const trigger = canonicalTrigger({
    domain: pack.id, source: 'lab-chat', externalId: 'conf-1', atTick: 1,
    actor: { id: 'dr.chen', type: 'human' }, human: true, addressed: 'mention',
    text: 'x'.repeat(500), meta: { playbook: 'replicate' },
    threads: ['science:conf-1', 'science:conf-2'], channelKind: 'chat', tags: ['explicit'], effort: 3
  }, 1, pack, gateResult, {});
  const thread = canonicalThread('science:conf-1', 'lab-chat', { tick: 1 });
  const decision = canonicalDecision({
    trigger, gateResult, assessment: null, outcome: { outcome: 'accept', reasonCodes: [] },
    policyVersion: policy.version, tick: 1, seq: 1
  });
  const mandate = canonicalMandate({
    ticketId: 'ticket-1', trigger, policy, via: 'addressed', strength: 'explicit',
    matchedRules: pack.ruleIds, tick: 1, speculative: false
  });
  const ticket = canonicalTicket({ ticketId: 'ticket-1', trigger, pack, mandate, opts: {}, tick: 1 });
  const assignment = canonicalAssignment({ ticket, stage: 'recheck', triggerIds: [trigger.id], tick: 1, workdir: 'data/work/x' });
  const input = canonicalInput({ ticket, trigger, kind: 'fast_path', text: 'follow-up', tick: 1 });
  const report = canonicalReport({ assignment, result: { state: 'ready', artifacts: ['evidence.json'] }, tick: 2 });
  const receipt = canonicalReceipt({ ticketId: ticket.id, threadKey: trigger.threads[0], purpose: 'answer', text: 'answer', kind: 'chat', tick: 2 });
  const effect = canonicalEffect({ kind: 'launch', effectKey: 'x', payload: { ticketId: ticket.id }, tick: 1 });
  const event = canonicalEvent({ seq: 1, tick: 1, type: 'tick', actor: 'system', payload: {}, refs: [] });

  assert.equal(SCHEMA_VERSION, 'argos-4-canonical-1');
  assert.equal(trigger.id, String(trigger.id));
  assert.deepEqual(trigger.threads, ['science:conf-1', 'science:conf-2']);
  assert.equal(trigger.channel.kind, 'chat');
  assert.equal(trigger.disposition.filtered, false);
  assert.equal(thread.activeEval, null);
  assert.deepEqual(thread.queued, []);
  assert.equal(decision.outcome, 'accept');
  assert.equal(canonicalPolicy(policy).version, policy.version);
  assert.equal(mandate.immutable, true);
  assert.equal(ticket.state, 'open');
  assert.equal(assignment.state, 'pending');
  assert.equal(input.deliveredTick, 1);
  assert.equal(report.state, 'ready');
  assert.equal(receipt.purpose, 'answer');
  assert.deepEqual(receipt.retryDelays, [5, 10, 20, 40]);
  assert.equal(effect.kind, 'launch');
  assert.equal(event.type, 'tick');

  const state = {
    triggers: { [trigger.id]: trigger }, threads: { [thread.key]: thread }, correlations: {},
    decisions: { [decision.id]: decision }, mandates: { [mandate.id]: mandate },
    tickets: { [ticket.id]: ticket }, assignments: { [assignment.id]: assignment },
    inputs: { [input.id]: input }, reports: { [report.id]: report },
    receipts: { [receipt.id]: receipt }, effects: { [effect.id]: effect }, events: [event]
  };
  assert.equal(validateCanonicalState(state), true);
  assert.equal(computeStage({ ...ticket, inputs: [input], reports: [report], assignments: [assignment] }).stage, 'working/queued');
  const context = boundedThreadContext([trigger], trigger.id);
  assert.equal(context.length, 1);
  assert.ok(context[0].text.length <= 401);
  assert.equal(context[0].chars, 500);
  assert.equal(context[0].truncated, true);
  assert.match(context[0].resource, /^argos:\/\/trigger\//);
});

test('four Source packs expose the canonical interface and ≈60% noise', () => {
  assert.equal(PACK_IDS.length, 4);
  for (const id of PACK_IDS) {
    const pack = PACKS[id];
    const meta = packMeta(id);
    const events = pack.eventCatalog;
    const noise = events.filter(e => e.tags?.includes('noise')).length;
    const noisePct = Math.round(100 * noise / events.length);
    assert.ok(events.length >= 14, `${id} has ${events.length} events`);
    assert.ok(noisePct >= 55 && noisePct <= 65, `${id} noise ${noisePct}%`);
    assert.ok(pack.sources.length >= 3);
    assert.ok(pack.ruleIds.length >= 3);
    assert.ok(pack.playbook.length >= 5);
    assert.deepEqual(pack.playbook.stages, [...pack.playbook]);
    assert.ok(pack.speculationSignals.length >= 1);
    assert.equal(typeof pack.evidenceSchema.confidence, 'function');
    assert.equal(typeof pack.riskClassFor, 'function');
    assert.equal(typeof pack.summarize, 'function');
    assert.equal(typeof pack.scope, 'function');
    assert.equal(typeof pack.runExperiment, 'function');
    assert.equal(typeof pack.experiment, 'function');
    const scoped = pack.scope({ source: pack.sources[0].id, actor: { id: 'x', type: 'human' }, addressed: 'mention' }, policy);
    assert.equal(typeof scoped.listened, 'boolean');
    assert.equal(typeof scoped.observed, 'boolean');
    const tags = new Set(events.flatMap(e => e.tags || []));
    for (const tag of ['explicit', 'speculative', 'injection', 'noise', 'stop']) assert.ok(tags.has(tag), `${id} missing ${tag}`);
  }
  const all = allCatalogs();
  assert.equal(all.length, PACK_IDS.reduce((n, id) => n + PACKS[id].eventCatalog.length, 0));
});

test('policy scope, gate and revalidation matrix are literal', () => {
  const trigger = { source: 'lab-chat', actor: { id: 'dr.chen', type: 'human' }, human: true, addressed: 'mention', meta: {} };
  const sc = scope(policy, trigger);
  assert.equal(sc.listened, true);
  assert.equal(sc.observed, true);
  assert.equal(gate({ trigger, policy }).strength, 'explicit');
  assert.equal(gate({ trigger: { ...trigger, meta: { injection: true } }, policy }).reasonCodes.includes('untrusted_content_ignored'), true);
  assert.equal(gate({ trigger: { ...trigger, actor: { id: 'stranger', type: 'human' }, addressed: null }, policy }).filtered, true);
  const mandate = { policyVersion: policy.version, via: 'addressed', stopped: false };
  const autoPolicy = { ...policy, mode: 'auto' };
  const ruleId = policy.rules[0].id;
  assert.equal(revalidate({ mandate, policy }).ok, true);
  assert.equal(revalidate({ mandate: { ...mandate, via: 'followup' }, policy }).ok, true);
  assert.equal(revalidate({ mandate: { ...mandate, source: 'lab-chat', actorId: 'stranger' }, policy }).reason, 'actor_no_longer_allowlisted');
  assert.equal(revalidate({ mandate: { ...mandate, via: 'bot', source: 'ops-chat', actorId: 'alert-bot', matchedRules: [ruleId] }, policy: autoPolicy }).ok, true);
  assert.equal(revalidate({ mandate: { ...mandate, via: 'bot', source: 'ops-chat', actorId: 'stranger', matchedRules: [ruleId] }, policy: autoPolicy }).reason, 'bot_or_mode_changed');
  assert.equal(revalidate({ mandate: { ...mandate, via: 'admission', source: 'lab-chat', actorId: 'dr.chen', strength: 'inferred', matchedRules: [ruleId] }, policy: autoPolicy }).ok, true);
  assert.equal(revalidate({ mandate: { ...mandate, via: 'admission', source: 'lab-chat', actorId: 'dr.chen', strength: 'inferred', matchedRules: [ruleId] }, policy }).reason, 'admission_basis_changed');
  assert.equal(revalidate({ mandate: { ...mandate, via: 'speculation' }, policy }).reason, 'speculative_mandate_not_resumable');
  assert.equal(revalidate({ mandate: { ...mandate, stopped: true }, policy }).reason, 'mandate_withdrawn');
  assert.equal(revalidate({ mandate, policy, sourceStillListened: false }).reason, 'source_no_longer_listened');
  assert.equal(revalidate({ mandate: { ...mandate, via: 'unknown', policyVersion: 'stale' }, policy }).reason, 'policy_version_changed');
});

test('forbidden risk class is a hard refusal with a Watchdog alert', async () => {
  const sim = new Simulation(baseConfig({ maxTicks: 10 }));
  await sim.runUntil(10);
  const ticket = [...sim.engine.tickets.values()].find(t => !['ended', 'discarded', 'invalidated'].includes(t.state));
  assert.ok(ticket);
  const out = sim.engine.onWorkerResult(ticket.id, {
    state: 'ready', riskClass: 'forbidden', threadKey: ticket.threadKeys[0], mandateId: ticket.mandateId
  }, 11);
  assert.equal(out.forbidden, true);
  assert.equal(ticket.state, 'discarded');
  assert.ok(sim.events.all().some(e => e.type === 'watchdog.flag' && e.payload.kind === 'forbidden_action'));
});

test('dashboard renders the exact 01-spec/07 vocabulary and all four missions', () => {
  const ui = readFileSync(new URL('../src/web/index.html', import.meta.url), 'utf8');
  const server = readFileSync(new URL('../src/web/server.js', import.meta.url), 'utf8');
  for (const label of [
    'Filtered — outside scope',
    'Follow-up delivered to existing Ticket (no Router decision)',
    'Would accept (observe mode — no work started)',
    'Quiet work discarded — nobody was interrupted',
    'Waiting for your decision',
    'Assessment could not finish',
    'Reply dropped: conversation gone'
  ]) assert.ok(ui.includes(label), `missing UI label: ${label}`);
  assert.ok(ui.includes('All four missions'));
  assert.ok(ui.includes('id="missionCoverage"'));
  assert.ok(server.includes('switchDomain'));
  assert.ok(server.includes('PACK_IDS'));
});

test('Outbox, effects and Watchdog implement the canonical clause vocabulary', () => {
  assert.deepEqual(DROP_REASONS, ['channel_gone', 'source_off', 'mandate_withdrawn', 'superseded', 'conversation_gone']);
  assert.deepEqual(RETRY_DELAYS, [5, 10, 20, 40]);
  assert.deepEqual(EFFECT_KINDS, ['launch', 'delivery', 'relay', 'reply', 'speculation', 'apply']);

  const events = new EventStore({ projector: new Projector() });
  const memory = new MemoryGraph();
  const outbox = new Outbox({ events, memory, policy });
  assert.throws(() => outbox.send({ ticketId: 't', threadKey: 'k', purpose: 'result', text: 'x', actor: 'worker', tick: 1 }), /INVARIANT VIOLATION/);
  assert.throws(() => outbox.send({ ticketId: 't', threadKey: 'k', purpose: 'result', text: 'word '.repeat(101), actor: 'router', tick: 1 }), /exceeds/);
  const r = outbox.send({ ticketId: 't', threadKey: 'k', purpose: 'answer', text: 'answer', actor: 'router', tick: 1 });
  assert.equal(r.status, 'pending');
  outbox.defer(r, 'attention_throttle', 1);
  assert.equal(r.nextAttemptTick, 6);
  assert.equal(outbox.drop(r.id, 'channel_gone', 7).dropReason, 'channel_gone');
  assert.throws(() => new Effects({ events }).enqueue('unknown', 'x', {}, 1), /Non-canonical effect kind/);

  const watchdog = new Watchdog({ policy });
  const snapshot = {
    tickets: [{
      id: 't', phase: 'running', startedTick: 0, rechecks: 4, confidence: 0.4,
      artifacts: [], riskClass: 'forbidden', approvals: [], reports: []
    }, {
      id: 't2', phase: 'done', startedTick: 0, rechecks: 0, confidence: 0.9,
      artifacts: [], riskClass: 'high-impact', approvals: [], reports: []
    }],
    receipts: [{ id: 'r', kind: 'chat', words: 101, ticketId: 't' }],
    events: [
      { seq: 1, type: 'message.sent', actor: 'worker', payload: { ticketId: 't' } },
      { seq: 2, type: 'source.rejected', payload: { reasonCodes: ['untrusted_content_ignored'] } },
      { seq: 3, type: 'trigger.received', payload: { text: '-40°C implausible' } },
      { seq: 4, type: 'watchdog.flag', payload: { kind: 'slot_leak', ticketId: 't', message: 'leak' } },
      { seq: 5, type: 'control', payload: { action: 'setMode', payload: { mode: 'auto' } } }
    ]
  };
  const kinds = new Set(watchdog.check(snapshot, 20).map(f => f.kind));
  for (const kind of ['stalled_ticket', 'loop_suspected', 'low_confidence', 'missing_evidence', 'approval_bypass',
    'forbidden_action', 'word_cap_breach', 'worker_authored_message', 'prompt_injection_blocked',
    'sensor_integrity', 'slot_leak', 'mode_auto_enabled']) assert.ok(kinds.has(kind), `missing ${kind}`);
});

test('worker subprocess isolation, stripped env and five mandatory artifacts', async () => {
  const env = strippedEnv({ ticketId: 't', domain: 'science-replication-lab', stage: 'recheck', policyVersion: policy.version, tick: 1 });
  assert.equal(Object.keys(env).some(k => /KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|HOME|AWS|AZURE|GCP|OPENAI|DEEPSEEK/i.test(k)), false);
  assert.equal(env.ARGOS_SYNTHETIC, 'true');
  const events = new EventStore({ projector: new Projector() });
  const pool = new WorkerPool({ events, workDir: join(TMP, 'workers'), maxWorkers: 1 });
  const pack = PACKS['science-replication-lab'];
  const trigger = canonicalTrigger({
    domain: pack.id, source: 'lab-chat', externalId: 'worker-conf', atTick: 1,
    actor: { id: 'dr.chen', type: 'human' }, human: true, addressed: 'mention',
    text: 'replicate claim-42', meta: { claimId: '42', claimedEffect: 0.12, tolerance: 0.02, dataset: 'v2', playbook: 'replicate' },
    threads: ['science:claim-42'], channelKind: 'chat', tags: ['explicit'], effort: 1
  }, 1, pack, { strength: 'explicit', basis: 'addressed', reasonCodes: [] }, {});
  const ticket = { id: 'ticket-worker', domain: pack.id, threadKeys: trigger.threads, channelKind: 'chat', speculative: false };
  const mandate = { id: 'mandate-worker', policyVersion: policy.version, via: 'addressed' };
  const input = buildInput({ ticket, trigger, mandate, threadContext: [], stage: 'recheck', triggerIds: [trigger.id], policyVersion: policy.version, tick: 1 });
  const handle = await pool.launch({ ticket, input, tick: 1, stage: 'recheck', triggerIds: [trigger.id] });
  assert.equal(handle.exitCode, 0);
  assert.equal(handle.timedOut, false);
  assert.equal(handle.result.workerTicks, 1);
  assert.ok(handle.progress.length >= 5 && handle.progress.length <= 8);
  const dir = workdirFor(join(TMP, 'workers'), pack.id, ticket.id);
  for (const f of ['input.json', 'evidence.json', 'report.md', 'result.json', 'log.jsonl']) assert.ok(existsSync(join(dir, f)), f);
  assert.ok(handle.elapsedMs < 2000, `worker wall time ${handle.elapsedMs}ms`);
});

test('canonical projection, compact snapshot replay, hydrate and honest rebuild counts', async () => {
  const sim = new Simulation(baseConfig());
  await sim.runUntil(10);
  const state = canonicalState(sim.engine);
  assert.equal(validateCanonicalState(state), true);
  assert.equal(state.schemaVersion, SCHEMA_VERSION);
  assert.ok(Object.keys(state.tickets).length > 0);
  assert.ok(Object.values(state.tickets).every(t => ['open', 'ended', 'resumed'].includes(t.state)));
  assert.ok(Object.values(state.tickets).every(t => t.stage && t.stageReason));
  assert.ok(Object.values(state.tickets).every(t => Array.isArray(t.inputs) && Array.isArray(t.assignments) && Array.isArray(t.reports)));

  const logPath = join(TMP, 'compact.jsonl');
  writeFileSync(logPath, sim.eventLog(), 'utf8');
  const rebuilt = await Simulation.rebuildFromLog(baseConfig({ maxTicks: 60 }), logPath);
  assert.equal(rebuilt.eventLog(), sim.eventLog());
  assert.equal(JSON.stringify(canonicalState(rebuilt.engine)), JSON.stringify(state));

  const projector = new Projector();
  const store = new EventStore({ projector });
  const loaded = store.loadFromJSONL(readFileSync(logPath, 'utf8'));
  assert.equal(loaded.length, sim.events.seq);
  assert.ok(projector.snapshot().tickets);
  assert.equal(hydrate(new Simulation(baseConfig()).engine, state).policy.version, sim.engine.policy.version);

  const replay = await replayCheck(baseConfig({ maxTicks: 10, workDir: join(TMP, 'replay') }));
  assert.equal(replay.identical, true);
  assert.equal(replay.logRebuilt, true);
  assert.equal(replay.stateRebuilt, true);
  assert.equal(replay.events, replay.rebuiltEvents);
  assert.equal(replay.seq, replay.rebuiltSeq);
  assert.equal(replay.left, replay.right);
});

test('completed demo Tickets end with literal result.sent, never transient delivering', async () => {
  const sim = new Simulation(baseConfig({ maxTicks: 60 }));
  const snap = await sim.runUntil(60);
  const delivered = snap.tickets.filter(t => t.resultSent);
  assert.ok(delivered.length > 0);
  assert.ok(delivered.every(t => t.state === 'done' || t.phase === 'done'));
  assert.equal(snap.tickets.some(t => (t.state || t.phase) === 'delivering'), false);
  const sent = sim.events.all().filter(e => e.type === 'result.sent');
  assert.equal(sent.length, delivered.length);
});

test('open → ended → resumed, resumeTicket and reevaluate use real mandate semantics', async () => {
  const sim = new Simulation(baseConfig({ controls: [] }));
  const engine = sim.engine;
  const trigger = canonicalTrigger({
    domain: 'science-replication-lab', source: 'lab-chat', externalId: 'resume-conf', atTick: 1,
    actor: { id: 'dr.chen', type: 'human' }, human: true, addressed: 'mention',
    text: 'resume me', meta: {}, threads: ['science:resume'], channelKind: 'chat', tags: [], effort: 1
  }, 1, PACKS['science-replication-lab'], { strength: 'explicit', basis: 'addressed', reasonCodes: [] }, {});
  const mandate = { id: 'mandate-resume', policyVersion: policy.version, via: 'addressed', stopped: false, source: 'lab-chat', actorId: 'dr.chen' };
  const ticket = {
    id: 'ticket-resume', domain: 'science-replication-lab', mandateId: mandate.id,
    triggerId: trigger.id, state: 'ended', stage: 'person/review', stageReason: 'done',
    inputs: [], assignments: [], reports: [], artifacts: [], approvals: [],
    endedTick: 2, outcome: 'done', confidence: 0.9, riskClass: 'read-only',
    createdTick: 1, effort: 1, speculative: false, threadKeys: trigger.threads, channelKind: 'chat'
  };
  engine.triggers.set(trigger.id, trigger);
  engine.mandates.set(mandate.id, mandate);
  engine.tickets.set(ticket.id, ticket);
  engine.tick = 3;

  const resumed = engine.control('resumeTicket', { ticketId: ticket.id, by: 'human' }, 3);
  assert.equal(resumed.ok, true);
  assert.equal(resumed.state, 'resumed');
  assert.equal(engine.tickets.get(ticket.id).state, 'resumed');
  assert.equal(engine.tickets.get(ticket.id).endedTick, null);
  assert.ok(engine.events.all().some(e => e.type === 'ticket.resumed'));
  assert.equal(canonicalState(engine).tickets[ticket.id].state, 'resumed');

  const reeval = engine.control('reevaluate', { ticketId: ticket.id, by: 'human' }, 3);
  assert.equal(reeval.ok, true);
  assert.ok(engine.events.all().some(e => e.type === 'eval.requeued'));
  assert.ok(engine.pendingTriggers.includes(trigger.id));
  assert.ok(engine.effects.all().every(e => EFFECT_KINDS.includes(e.kind)));
  assert.ok(engine.effects.all().some(e => e.kind === 'launch' && e.payload.stage === 'recheck'));
});

test('switchDomain resets state and loads one Source pack; controls use the same Engine', async (t) => {
  const server = await startServer({ port: 0, policy, config, controls: [] });
  t.after(async () => {
    server.closeAllConnections?.();
    await new Promise(resolve => server.close(resolve));
  });
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;
  const post = async (action, payload = {}) => {
    const res = await fetch(`${base}/api/control`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action, ...payload })
    });
    assert.equal(res.ok, true);
    return res.json();
  };
  const get = async path => (await fetch(base + path)).json();

  let r = await post('switchDomain', { domain: 'science-replication-lab' });
  assert.equal(r.result.ok, true);
  assert.equal(r.result.domain, 'science-replication-lab');
  assert.equal(Object.keys(r.snapshot.packs).length, 1);
  assert.equal((await get('/api/config')).domain, 'science-replication-lab');
  assert.equal((await get('/api/health')).domain, 'science-replication-lab');

  r = await post('switchDomain', { domain: 'all' });
  assert.equal(r.result.domain, 'all');
  assert.equal(Object.keys(r.snapshot.packs).length, 4);
  r = await post('switchDomain', { domain: 'not-a-pack' });
  assert.equal(r.result.ok, false);
  assert.equal(r.result.reason, 'unknown_domain');

  r = await post('resumeTicket', { ticketId: 'nonexistent' });
  assert.equal(r.result.ok, false);
  r = await post('reevaluate', { ticketId: 'nonexistent' });
  assert.equal(r.result.ok, false);
  r = await post('replay');
  assert.equal(r.result.identical, true);
  assert.equal(r.result.events, r.result.rebuiltEvents);
  assert.equal(r.result.seq, r.result.rebuiltSeq);
});

test('performance budgets are explicit, measured and asserted', async () => {
  const metrics = new Metrics();
  metrics.triggersIngested = 1000;
  const pass = metrics.assertPerformanceBudgets({ engineMs: [4], eventCount: 1000, pollPayloadBytes: 100000, workerWallMs: 1500, benchmarkMs: 900 });
  assert.equal(pass.allPass, true);
  assert.equal(pass.budgets.engineTickMsPer1kEvents, 4);
  const fail = metrics.assertPerformanceBudgets({ engineMs: [6], eventCount: 1000, pollPayloadBytes: 300000, workerWallMs: 2500, benchmarkMs: 1200 });
  assert.equal(fail.allPass, false);

  const bench = await runBenchmark({ policy, config, workDir: join(TMP, 'benchmark') });
  const budgets = bench.performance.budgets;
  assert.equal(bench.performance.allPass, true);
  assert.ok(budgets.engineTickMsPer1kEvents <= 5);
  assert.ok(budgets.pollPayloadBytes <= 250000);
  assert.ok(budgets.workerWallMs <= 2000);
  assert.ok(budgets.benchmarkMs <= 1000);
});

test('zero credentials: no secret-shaped env and no external network dependency', () => {
  const env = strippedEnv({ ticketId: 't', domain: PACK_IDS[0], stage: 'run', policyVersion: policy.version, tick: 1 });
  assert.equal(Object.keys(env).some(k => /(^|_)(KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|HOME|AWS|AZURE|GCP|OPENAI|DEEPSEEK)/i.test(k)), false);
  assert.equal(Object.values(env).some(v => /sk-|ghp_|AKIA|Bearer /i.test(String(v))), false);
  const source = readFileSync(new URL('../package.json', import.meta.url), 'utf8');
  assert.equal(/"dependencies"\s*:\s*\{[^}]+\}/.test(source), false);
  assert.equal(/"devDependencies"\s*:\s*\{[^}]+\}/.test(source), false);
});
