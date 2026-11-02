import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { loadPolicy, loadBenchmarkConfig, APP_DIR } from '../src/demo.js';
import { runBenchmark, syntheticCatalog, estimateBaseline } from '../src/benchmark.js';

const WORK = join(APP_DIR, 'data', 'work', 'test-benchmark');
const config = loadBenchmarkConfig();

test('synthetic catalog is deterministic and has the declared workload shape', () => {
  const a = syntheticCatalog(config);
  const b = syntheticCatalog(config);
  assert.equal(a.catalog.length, config.tasks + config.followups + config.speculative + config.noisePerTick * config.noiseUntilTick);
  assert.equal(a.tasks.length, config.tasks);
  assert.equal(JSON.stringify(a.catalog), JSON.stringify(b.catalog));
  assert.equal(new Set(a.catalog.map(e => e.domain)).size, 4);
  assert(a.catalog.every(e => Number.isInteger(e.atTick) && e.atTick > 0));
});

test('baseline estimator uses ≥20 tasks and applies the declared interruption penalty', () => {
  const { catalog, tasks } = syntheticCatalog(config);
  const baseline = estimateBaseline({ catalog, tasks, config });
  assert.equal(baseline.completions, config.tasks);
  assert(baseline.completions >= 20);
  assert(baseline.p95Completion > baseline.p50Completion);
  assert(baseline.noiseInterruptions === config.noisePerTick * config.noiseUntilTick);
  assert.equal(baseline.routerDecisions, catalog.length);
  assert.equal(baseline.cacheReadTokensEst, catalog.length * config.tokensPerCard * config.cardsPerDecision * config.baselineSessionsAlive);
});

test('ARGOS-4 meets every acceptance threshold on the identical event stream', async () => {
  const results = await runBenchmark({ policy: loadPolicy(), config, workDir: WORK });
  assert.equal(results.allPass, true, JSON.stringify(results.assertions, null, 2));
  assert(results.argos.p50Completion < results.baseline.p50Completion);
  assert(results.argos.p95Completion < results.baseline.p95Completion);
  assert(results.argos.routerDecisionsAvoided > 0);
  assert(results.argos.cacheReadTokensEst > results.baseline.cacheReadTokensEst);
  assert.equal(results.argos.policyViolations, 0);
  assert.equal(results.argos.artifactsProduced, results.argos.tasksCompleted);
  assert(results.argos.speculativeWaste > 0);
  assert.equal(results.argos.mode, 'auto');
  assert(results.argos.messagesPerTrigger <= 0.25);
  assert(results.argos.completions >= 20);
  assert.equal(results.workload.domains.length, 4);
  assert(results.eventStream.events > 0);
});
