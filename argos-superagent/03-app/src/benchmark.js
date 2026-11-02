import { p, round, sha256 } from './util.js';
import { performance } from 'node:perf_hooks';
import { ev, thread } from './domains/common.js';
import { Simulation } from './simulation.js';

const DOMAINS = {
  'science-replication-lab': { source: 'lab-chat', actor: 'dr.chen' },
  'self-healing-infrastructure': { source: 'ops-chat', actor: 'oncall.ada' },
  'supply-chain-immune-system': { source: 'sec-chat', actor: 'sec.ada' },
  'living-compliance': { source: 'audit-chat', actor: 'grc.ada' }
};
const IDS = Object.keys(DOMAINS);

function taskMeta(domain, i) {
  switch (domain) {
    case 'science-replication-lab': return { claimId: String(42 + (i % 5)), claimedEffect: 0.12, tolerance: 0.02, dataset: i % 2 ? 'v3' : 'v2' };
    case 'self-healing-infrastructure': return { sector: 3, snapshot: 118 + i, load: 0.8 };
    case 'supply-chain-immune-system': return { advisoryId: `GHSA-2026-${4412 + i}`, hash: `9f${i}` };
    case 'living-compliance': return { obligationId: 'A72', requestKind: 'map' };
    default: return {};
  }
}
function taskText(domain, i, meta) {
  switch (domain) {
    case 'science-replication-lab': return `@argos replicate claim-${meta.claimId} on dataset ${meta.dataset}`;
    case 'self-healing-infrastructure': return `@argos simulate a mild sector ${meta.sector} load change`;
    case 'supply-chain-immune-system': return `@argos verify advisory ${meta.advisoryId} against SBOM ${meta.hash}`;
    case 'living-compliance': return `@argos map obligation ${meta.obligationId} to our controls`;
    default: return '@argos run the benchmark task';
  }
}
function speculativeMeta(domain) {
  switch (domain) {
    case 'science-replication-lab': return { claimId: '77', claimedEffect: 0.09, tolerance: 0.02, dataset: 'v2', speculative: true };
    case 'self-healing-infrastructure': return { sector: 3, speculative: true };
    case 'supply-chain-immune-system': return { advisoryId: 'GHSA-2026-4499', hash: '9f4', unreachable: true, speculative: true };
    case 'living-compliance': return { obligationId: 'A72', requestKind: 'guidance', hint: 'logging', speculative: true };
    default: return { speculative: true };
  }
}

/** Deterministic synthetic workload: same constants drive both architectures. */
export function syntheticCatalog(config) {
  const out = [];
  const domains = IDS;
  const tasks = [];
  for (let i = 0; i < config.tasks; i++) {
    const domain = domains[i % domains.length];
    const { source, actor } = DOMAINS[domain];
    const meta = taskMeta(domain, i);
    const atTick = 3 + i * 2;
    const threadKey = thread(domain.replace(/-/g, '').slice(0, 6), `bench-${i}`);
    const t = ev({
      atTick, externalId: `bench-task-${i}`, source, actor: { id: actor, type: 'human' },
      addressed: 'mention', text: taskText(domain, i, meta), meta,
      threads: [threadKey], channelKind: 'chat', tags: ['explicit'], effort: config.effortMin + (i % (config.effortMax - config.effortMin + 1))
    });
    t.domain = domain;
    out.push(t); tasks.push(t);
    if (i < config.followups) {
      const f = ev({
        atTick: atTick + 2, externalId: `bench-followup-${i}`, source, actor: { id: actor, type: 'human' },
        text: `also include the ${domain} follow-up evidence`, meta: { ...meta, followUp: true, playbook: 'recheck' },
        threads: [threadKey], channelKind: 'chat', tags: ['followup'], effort: 2
      });
      f.domain = domain; out.push(f);
    }
  }
  for (let s = 0; s < config.speculative; s++) {
    const domain = domains[s % domains.length];
    const { source, actor } = DOMAINS[domain];
    const t = ev({
      atTick: 62 + s * 2, externalId: `bench-spec-${s}`, source, actor: { id: actor, type: 'human' },
      text: `this ${domain} signal probably looks fine`, meta: speculativeMeta(domain),
      threads: [thread('spec', `bench-${s}`)], channelKind: 'chat', tags: ['speculative'], effort: config.effortMin
    });
    t.domain = domain; out.push(t);
  }
  for (let tick = 1; tick <= config.noiseUntilTick; tick++) {
    for (let j = 0; j < config.noisePerTick; j++) {
      const domain = domains[(tick + j) % domains.length];
      const { source, actor } = DOMAINS[domain];
      const t = ev({
        atTick: tick, externalId: `bench-noise-${tick}-${j}`, source, actor: { id: actor, type: 'human' },
        text: 'coffee?', meta: {}, threads: [thread('noise', 'bench')], channelKind: 'chat', tags: ['noise'], effort: 0
      });
      t.domain = domain; out.push(t);
    }
  }
  return { catalog: out, tasks };
}

/** Neutral-prompt single-session baseline: serial ReAct, noise interrupts, no delegation. */
export function estimateBaseline({ catalog, tasks, config }) {
  const noiseByTick = new Map();
  for (const e of catalog) if (e.tags?.includes('noise')) noiseByTick.set(e.atTick, (noiseByTick.get(e.atTick) || 0) + 1);
  let clock = 0;
  const completionTicks = [];
  for (const task of [...tasks].sort((a, b) => a.atTick - b.atTick)) {
    const queueDelay = Math.max(0, clock - task.atTick);
    const start = task.atTick + queueDelay;
    const finish = start + task.effort;
    let noiseDuring = 0;
    for (let t = start; t < finish; t++) noiseDuring += noiseByTick.get(t) || 0;
    const interruptionPenalty = noiseDuring * config.interruptCost;
    const actualFinish = finish + interruptionPenalty;
    completionTicks.push(actualFinish - task.atTick);
    clock = actualFinish;
  }
  const routerDecisions = catalog.length;
  const messagesSent = catalog.length + tasks.length;
  const wordsSent = messagesSent * config.wordsPerBaselineMessage;
  const attentionCost = messagesSent + wordsSent / 100;
  const noiseCount = catalog.filter(e => e.tags?.includes('noise')).length;
  return {
    architecture: 'single-session ReAct + subagents (neutral prompt)',
    tasksCompleted: tasks.length,
    completions: completionTicks.length,
    completionTicks,
    p50Completion: round(p(completionTicks, 0.5), 2),
    p95Completion: round(p(completionTicks, 0.95), 2),
    routerDecisions,
    routerDecisionsAvoided: 0,
    messagesSent, wordsSent,
    attentionCost: round(attentionCost, 2),
    cacheReadTokensEst: Math.round(routerDecisions * config.tokensPerCard * config.cardsPerDecision * config.baselineSessionsAlive),
    speculativeWaste: 0,
    silenceSavings: 0,
    noiseInterruptions: noiseCount,
    artifactsProduced: tasks.length,
    policyViolations: 0
  };
}

export async function runBenchmark({ policy, config, workDir }) {
  const benchmarkStarted = performance.now();
  const { catalog, tasks } = syntheticCatalog(config);
  const simPolicy = JSON.parse(JSON.stringify(policy));
  simPolicy.mode = config.mode;
  simPolicy.workers.maxWorkers = config.maxWorkers;
  simPolicy.watchdog.stallTicks = 15;
  const sim = new Simulation({
    policy: simPolicy, catalog, workDir, persist: false, eventLogPath: null,
    maxTicks: config.maxTicks, controls: [], live: false, inProcess: true,
    metricsConfig: { tokensPerCard: config.tokensPerCard, cardsPerDecision: config.cardsPerDecision, sessionsAlive: config.sessionsAlive }
  });
  const snapshot = await sim.runUntil(config.maxTicks);
  const benchmarkMs = Number((performance.now() - benchmarkStarted).toFixed(2));
  sim.performance.benchmarkMs = benchmarkMs;
  const argos = {
    architecture: 'ARGOS-4 Router + Workers (proactive, batched, speculative)',
    mode: snapshot.mode,
    tasksCompleted: snapshot.metrics.resultsDelivered,
    completions: snapshot.metrics.completions,
    completionTicks: snapshot.metrics.completionTicks,
    p50Completion: snapshot.metrics.p50Completion,
    p95Completion: snapshot.metrics.p95Completion,
    routerDecisions: snapshot.metrics.routerDecisions,
    routerDecisionsAvoided: snapshot.metrics.routerDecisionsAvoided,
    messagesSent: snapshot.metrics.messagesSent,
    wordsSent: snapshot.metrics.wordsSent,
    attentionCost: snapshot.metrics.attentionCost,
    cacheReadTokensEst: snapshot.metrics.cacheReadTokensEst,
    speculativeWaste: snapshot.metrics.speculativeWasteTicks,
    silenceSavings: snapshot.metrics.silenceSavings,
    speculativePromoted: snapshot.metrics.speculativePromoted,
    speculativeDiscarded: snapshot.metrics.speculativeDiscarded,
    artifactsProduced: snapshot.metrics.artifactsProduced,
    evidenceFiles: snapshot.metrics.evidenceFiles,
    policyViolations: snapshot.metrics.policyViolations,
    messagesPerTrigger: snapshot.metrics.messagesPerTrigger,
    triggersIngested: snapshot.metrics.triggersIngested,
    watchdogFlags: snapshot.metrics.watchdogFlags
  };
  const baseline = estimateBaseline({ catalog, tasks, config });
  const assertions = {
    p50Lower: argos.p50Completion < baseline.p50Completion,
    p95Lower: argos.p95Completion < baseline.p95Completion,
    percentilesFromAtLeast20Tasks: argos.completions >= 20 && baseline.completions >= 20,
    routerDecisionsAvoided: argos.routerDecisionsAvoided > 0,
    cacheReadHonestTradeoff: argos.cacheReadTokensEst > baseline.cacheReadTokensEst,
    policyViolationsZero: argos.policyViolations === 0,
    artifactsEqualTasks: argos.artifactsProduced === argos.tasksCompleted,
    speculativeWasteInAuto: argos.speculativeWaste > 0 && simPolicy.mode === 'auto',
    messagesPerTriggerBelowQuarter: argos.messagesPerTrigger <= 0.25,
    identicalEventStream: catalog.length === config.tasks + config.followups + config.speculative + config.noisePerTick * config.noiseUntilTick
  };
  const allPass = Object.values(assertions).every(Boolean);
  // Reuse the projection budgets captured by runUntil; calling snapshot()
  // again would add another canonical-projection sample to the budget.
  const budgets = { ...snapshot.performance.budgets, benchmarkMs };
  const performanceBudgets = {
    allPass: budgets.engineTickMsPer1kEvents <= budgets.limits.engineTickMsPer1kEvents
      && budgets.pollPayloadBytes <= budgets.limits.pollPayloadBytes
      && budgets.workerWallMs <= budgets.limits.workerWallMs
      && budgets.benchmarkMs <= budgets.limits.benchmarkMs,
    budgets
  };
  return {
    generatedAt: new Date().toISOString(),
    config,
    caveat: config.caveat,
    workload: { triggers: catalog.length, tasks: tasks.length, followups: config.followups, speculative: config.speculative,
      noise: config.noisePerTick * config.noiseUntilTick, domains: IDS },
    argos, baseline, assertions, allPass, benchmarkMs,
    performance: performanceBudgets,
    eventStream: { events: sim.events.all().length, hash: sha256(sim.eventLog()).slice(0, 24) },
    chart: {
      completionTicks: { argos: argos.completionTicks, baseline: baseline.completionTicks },
      attention: { argos: argos.attentionCost, baseline: baseline.attentionCost },
      cacheRead: { argos: argos.cacheReadTokensEst, baseline: baseline.cacheReadTokensEst }
    }
  };
}
