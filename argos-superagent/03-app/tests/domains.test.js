import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadPolicy, demoControls, APP_DIR } from '../src/demo.js';
import { Simulation, replayCheck } from '../src/simulation.js';
import { allCatalogs, PACKS, PACK_IDS, experimentIds, getPack } from '../src/domains/index.js';
import { runExperiment } from '../src/domains/experiments.js';
import { executeWorker } from '../src/worker/runner.js';

const WORK = join(APP_DIR, 'data', 'work', 'test-domains');

const INPUTS = {
  'science-replication-lab': { meta:{ claimId:'42', claimedEffect:0.12, tolerance:0.02, dataset:'v2' }, stage:'run' },
  'self-healing-infrastructure': { meta:{ asset:'T-7', sector:3, snapshot:118 }, stage:'run' },
  'supply-chain-immune-system': { meta:{ advisoryId:'GHSA-2026-4412', hash:'9f3' }, stage:'run' },
  'living-compliance': { meta:{ obligationId:'A72', requestKind:'map' }, stage:'run' }
};

test('Source-pack registry has four packs and a matching experiment registry', () => {
  assert.equal(PACK_IDS.length, 4);
  assert.deepEqual([...experimentIds()].sort(), [...PACK_IDS].sort());
  for (const id of PACK_IDS) {
    const pack = getPack(id);
    assert(pack.sources.length >= 3);
    assert(pack.ruleIds.length >= 3);
    assert(pack.playbook.length >= 5);
    assert(pack.eventCatalog.length >= 10);
    assert(pack.evidenceSchema.required.length >= 4);
  }
  assert.equal(allCatalogs().length, PACK_IDS.reduce((n, id) => n + getPack(id).eventCatalog.length, 0));
});

test('every domain experiment is pure, deterministic, and evidence-complete', () => {
  for (const id of PACK_IDS) {
    const pack = getPack(id);
    const template = INPUTS[id];
    const input = {
      trigger: { text:'@argos run the pinned check', meta:template.meta, threads:[`test:${id}`], domain:id },
      ticketId:`unit-${id}`, mandate:{ id:'mandate-unit', policyVersion:'pol-unit', ruleIds:pack.ruleIds },
      threadContext:[], stage:template.stage, followUps:[], approval:null, policyVersion:'pol-unit'
    };
    const a = runExperiment(id, input);
    const b = runExperiment(id, input);
    assert.deepEqual(a, b, `${id} must be deterministic`);
    assert(a.confidence >= pack.evidenceSchema.minConfidence);
    assert(Object.keys(a.artifacts).length >= 4);
    for (const field of pack.evidenceSchema.required) assert(field in a.evidence, `${id} missing ${field}`);
    assert(a.summary.length > 10);
    assert(a.riskClass);
  }
});

test('worker runner writes report.md and result.json for all four domains', () => {
  for (const id of PACK_IDS) {
    const pack = getPack(id);
    const template = INPUTS[id];
    const ticket = { id:`runner-${id}` };
    const input = {
      trigger: { text:'@argos run the pinned check', meta:template.meta, threads:[`test:${id}`], domain:id },
      ticketId:ticket.id, mandate:{ id:'mandate-unit', policyVersion:'pol-unit', ruleIds:pack.ruleIds },
      threadContext:[], stage:template.stage, followUps:[], approval:null, policyVersion:'pol-unit'
    };
    const result = executeWorker({ pack, ticket, input, workDir:WORK, tick:1, policyVersion:'pol-unit' });
    const dir = join(WORK, ticket.id);
    for (const f of ['evidence.json', 'input.json', 'log.jsonl', 'report.md', 'result.json']) {
      assert(existsSync(join(dir, f)), `${id} missing ${f}`);
      assert(result.artifacts.includes(f));
    }
    const evidence = JSON.parse(readFileSync(join(dir, 'evidence.json'), 'utf8'));
    assert.equal(evidence.domain, id);
    assert.equal(evidence.adapter, 'deterministic-constitution');
    assert.equal(evidence.sha256.length, 64);
    assert(readFileSync(join(dir, 'log.jsonl'), 'utf8').trim().split('\n').length === pack.playbook.length);
    const report = readFileSync(join(dir, 'report.md'), 'utf8');
    assert(report.includes('Synthetic simulation data'));
    assert(report.includes(pack.id));
    const parsed = JSON.parse(readFileSync(join(dir, 'result.json'), 'utf8'));
    assert.equal(parsed.ticketId, ticket.id);
    assert.equal(parsed.domain, id);
  }
});

test('negative / approval cases stay honest', () => {
  const unreachable = runExperiment('supply-chain-immune-system', {
    trigger:{ meta:{ advisoryId:'GHSA-2026-4499', hash:'9f4', unreachable:true }, text:'unused advisory' },
    mandate:{ policyVersion:'pol-unit' }, stage:'run', followUps:[]
  });
  assert.equal(unreachable.evidence.vexStatus, 'not_affected');
  assert.equal(unreachable.evidence.activationPathFound, false);

  const guidance = runExperiment('living-compliance', {
    trigger:{ meta:{ obligationId:'A72', requestKind:'guidance', hint:'logging' }, text:'draft guidance' },
    mandate:{ policyVersion:'pol-unit' }, stage:'run', followUps:[]
  });
  assert.equal(guidance.deliver, false);
  assert.equal(guidance.evidence.gaps.length, 0);

  const infra = runExperiment('self-healing-infrastructure', {
    trigger:{ meta:{ asset:'T-7', sector:3 }, text:'assess cascade' },
    mandate:{ policyVersion:'pol-unit' }, stage:'run', followUps:[]
  });
  assert.equal(infra.needsApproval, true);
  assert.equal(infra.riskClass, 'high-impact');
  assert(infra.evidence.rollbackPlan);

  const signed = runExperiment('living-compliance', {
    trigger:{ meta:{ obligationId:'A72', requestKind:'attestation' }, text:'prepare attestation' },
    mandate:{ policyVersion:'pol-unit' }, stage:'apply', followUps:[],
    approval:{ by:'grc.ada', tick:34 }
  });
  assert.equal(signed.needsApproval, false);
  assert.equal(signed.evidence.signOff.by, 'grc.ada');
});

test('the full four-domain demo produces done Tickets with artifacts in every mission', async () => {
  const sim = new Simulation({
    policy: loadPolicy(), catalog: allCatalogs(), controls: demoControls(),
    workDir: WORK, persist: false, eventLogPath: null, maxTicks: 60
  });
  const snap = await sim.runUntil(60);
  const done = snap.tickets.filter(t => ['done', 'ended'].includes(t.phase || t.state));
  const domains = new Set(done.map(t => t.domain));
  assert.equal(domains.size, 4);
  for (const t of done) {
    for (const f of ['evidence.json', 'input.json', 'log.jsonl', 'report.md', 'result.json']) assert(t.artifacts.includes(f));
    assert(t.confidence > 0.6);
  }
  assert(snap.metrics.policyViolations === 0);
  assert(snap.metrics.artifactsProduced === snap.metrics.resultsDelivered);
  const replay = await replayCheck({
    policy: loadPolicy(), catalog: allCatalogs(), controls: demoControls(),
    workDir: WORK, persist: false, eventLogPath: null, maxTicks: 60
  });
  assert.equal(replay.identical, true);
});
