import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { Simulation, replayCheck } from './simulation.js';
import { allCatalogs, PACKS } from './domains/index.js';
import { runBenchmark } from './benchmark.js';
import { loadPolicy, loadBenchmarkConfig, demoControls, APP_DIR, ROOT_DIR } from './demo.js';
import { sha256 } from './util.js';

const args = process.argv.slice(2);
const has = flag => args.includes(flag);
const value = (flag, fallback) => {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const policy = loadPolicy();
const benchmarkConfig = loadBenchmarkConfig();

function demoAssertions(snapshot, replay, fullEvents) {
  const tickets = snapshot.tickets;
  const byType = type => fullEvents.filter(e => e.type === type).length;
  const allReceiptsShort = snapshot.receipts.every(r => r.kind !== 'chat' || r.words <= policy.attention.chatWordLimit);
  const domainsWithTickets = new Set(tickets.map(t => t.domain)).size;
  const completedWithEvidence = tickets.filter(t => ['done', 'ended'].includes(t.phase || t.state)).every(t => (t.artifacts || []).length > 0);
  const checks = {
    fourDomainsHaveTickets: domainsWithTickets === 4,
    allChatReceiptsWithin100Words: allReceiptsShort,
    completedTicketsHaveEvidence: completedWithEvidence,
    policyViolationsZero: snapshot.metrics.policyViolations === 0,
    speculativePromoted: snapshot.metrics.speculativePromoted > 0,
    speculativeDiscarded: snapshot.metrics.speculativeDiscarded > 0,
    fastPathUsed: snapshot.metrics.routerDecisionsAvoided > 0,
    observeWouldAccept: snapshot.metrics.wouldAccept > 0,
    policyChangeInvalidatedMandates: byType('ticket.invalidated') > 0 || byType('policy.changed') > 0,
    humanApprovalsRecorded: byType('mandate.approved') > 0,
    injectionsBlocked: byType('policy.violation') > 0,
    watchdogFlagsPresent: snapshot.watchdogFlags.length > 0,
    noTransientDelivering: !tickets.some(t => (t.phase || t.state) === 'delivering'),
    performanceBudgetsMet: snapshot.performance.allPass === true,
    replayIdentical: replay.identical
  };
  return { checks, allPass: Object.values(checks).every(Boolean), byType: {
    'trigger.received': byType('trigger.received'),
    'eval.recorded': byType('eval.recorded'),
    'ticket.created': byType('ticket.created'),
    'worker.completed': byType('worker.completed'),
    'result.sent': byType('result.sent'),
    'speculation.promoted': byType('speculation.promoted'),
    'speculation.discarded': byType('speculation.discarded'),
    'message.sent': byType('message.sent'),
    'policy.changed': byType('policy.changed'),
    'ticket.invalidated': byType('ticket.invalidated'),
    'mandate.approved': byType('mandate.approved'),
    'policy.violation': byType('policy.violation'),
    'watchdog.flag': byType('watchdog.flag')
  } };
}

async function runDemo() {
  const maxTicks = Number(value('--ticks', 60));
  const workDir = join(APP_DIR, 'data', 'work', 'demo');
  mkdirSync(workDir, { recursive: true });
  const config = {
    policy, catalog: allCatalogs(), controls: demoControls(), workDir,
    eventLogPath: join(workDir, 'events.jsonl'), persist: true, maxTicks, live: false
  };
  const sim = new Simulation(config);
  const benchmarkFile = join(ROOT_DIR, '04-evaluation', 'benchmark-results.json');
  if (existsSync(benchmarkFile)) {
    try { sim.performance.benchmarkMs = Number(JSON.parse(readFileSync(benchmarkFile, 'utf8')).benchmarkMs || 0); } catch (_) {}
  }
  const snapshot = await sim.runUntil(maxTicks);
  const replay = await replayCheck({ ...config, persist: false, eventLogPath: null, workDir: join(APP_DIR, 'data', 'work', 'replay') });
  const assertions = demoAssertions(snapshot, replay, sim.events.all());
  const initialPolicyVersion = sim.events.all().find(e => e.type === 'system.started')?.payload?.policyVersion
    || snapshot.policyVersion;
  const results = {
    generatedAt: new Date().toISOString(),
    mode: snapshot.mode, policyVersion: initialPolicyVersion,
    finalPolicyVersion: snapshot.policyVersion, ticks: maxTicks,
    disclosure: snapshot.disclosure,
    metrics: snapshot.metrics,
    tickets: snapshot.tickets.map(t => ({ id: t.id, domain: t.domain, state: t.phase || t.state, speculative: t.speculative,
      promoted: t.promoted, confidence: t.confidence, riskClass: t.riskClass, artifacts: t.artifacts,
      approvals: t.approvals.length, completionTick: t.completionTick })),
    receipts: snapshot.receipts,
    watchdogFlags: snapshot.watchdogFlags,
    eventCounts: assertions.byType,
    assertions: assertions.checks, allPass: assertions.allPass,
    replay,
    eventLogHash: sha256(sim.eventLog()).slice(0, 24),
    eventCount: sim.events.all().length
  };
  mkdirSync(join(ROOT_DIR, '04-evaluation'), { recursive: true });
  writeFileSync(join(ROOT_DIR, '04-evaluation', 'demo-results.json'), JSON.stringify(results, null, 2));
  writeFileSync(join(workDir, 'demo-summary.json'), JSON.stringify(results, null, 2));
  console.log('\nARGOS-4 live demo — four domains, zero credentials');
  console.log('─'.repeat(62));
  console.table({
    'Triggers ingested': snapshot.metrics.triggersIngested,
    'Tickets': snapshot.metrics.ticketsCreated,
    'Messages sent': snapshot.metrics.messagesSent,
    'Words sent': snapshot.metrics.wordsSent,
    'Would-accept (observe)': snapshot.metrics.wouldAccept,
    'Fast paths': snapshot.metrics.routerDecisionsAvoided,
    'Speculative promoted': snapshot.metrics.speculativePromoted,
    'Speculative discarded': snapshot.metrics.speculativeDiscarded,
    'Evidence files': snapshot.metrics.evidenceFiles,
    'Policy violations': snapshot.metrics.policyViolations,
    'Replay identical': replay.identical
  });
  console.log('Assertions:', assertions.allPass ? 'ALL PASS' : 'FAILURES', assertions.checks);
  if (!assertions.allPass) process.exitCode = 1;
  return results;
}

async function runBenchmarkCommand() {
  const workDir = join(APP_DIR, 'data', 'work', 'benchmark');
  mkdirSync(workDir, { recursive: true });
  const out = value('--out', join(ROOT_DIR, '04-evaluation', 'benchmark-results.json'));
  const results = await runBenchmark({ policy, config: benchmarkConfig, workDir });
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(results, null, 2));
  console.log('\nARGOS-4 synthetic scheduling benchmark');
  console.log('─'.repeat(62));
  console.table({
    'p50 completion (ticks)': { ARGOS: results.argos.p50Completion, Baseline: results.baseline.p50Completion },
    'p95 completion (ticks)': { ARGOS: results.argos.p95Completion, Baseline: results.baseline.p95Completion },
    'Router decisions avoided': { ARGOS: results.argos.routerDecisionsAvoided, Baseline: results.baseline.routerDecisionsAvoided },
    'Messages sent': { ARGOS: results.argos.messagesSent, Baseline: results.baseline.messagesSent },
    'Attention cost': { ARGOS: results.argos.attentionCost, Baseline: results.baseline.attentionCost },
    'Cache-read tokens (est)': { ARGOS: results.argos.cacheReadTokensEst, Baseline: results.baseline.cacheReadTokensEst },
    'Speculative waste': { ARGOS: results.argos.speculativeWaste, Baseline: results.baseline.speculativeWaste },
    'Policy violations': { ARGOS: results.argos.policyViolations, Baseline: results.baseline.policyViolations }
  });
  console.log('Assertions:', results.allPass ? 'ALL PASS' : 'FAILURES', results.assertions);
  console.log('Caveat:', results.caveat);
  if (!results.allPass) process.exitCode = 1;
  return results;
}

if (has('--demo')) await runDemo();
else if (has('--benchmark')) await runBenchmarkCommand();
else if (has('--serve')) {
  const { startServer } = await import('./web/server.js');
  await startServer({ port: Number(value('--port', process.env.PORT || 3000)), policy, config: benchmarkConfig, controls: demoControls() });
} else {
  console.log('Usage: node src/cli.js --demo | --benchmark | --serve [--port N] [--ticks N] [--out PATH]');
  console.log('Zero credentials required. Optional prose enrichment: ARGOS_LLM_URL + ARGOS_LLM_KEY.');
}
