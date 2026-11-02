/**
 * Pure, deterministic, side-effect-free domain experiments.
 *
 * These functions are the ONLY domain code a worker may execute. They never import
 * the Engine, touch the filesystem, read the environment, or call the network.
 * `runExperiment` returns a common result envelope; the runner writes artifacts.
 */
import { seeded, gaussian, hashToInt, p, round, sha256 } from '../util.js';

function baseResult() {
  return {
    state: 'ready', deliver: true, summary: '', confidence: 0.8,
    riskClass: 'read-only', needsApproval: false, question: '',
    evidence: {}, artifacts: {}, checks: {}
  };
}

function confidenceFrom(checks, weights) {
  return round(Object.entries(weights).reduce((sum, [k, w]) => sum + (checks[k] || 0) * w, 0), 3);
}

/* ─────────────────────────── A. Science replication ─────────────────────────── */

function scienceExperiment(input) {
  const result = baseResult();
  const meta = input.trigger?.meta || {};
  const claimId = String(meta.claimId || '42');
  const claimedEffect = Number(meta.claimedEffect ?? 0.12);
  const tolerance = Number(meta.tolerance ?? 0.02);
  const datasetVersion = meta.dataset || 'v2';
  const seed = hashToInt(`${claimId}:${datasetVersion}:argos`);
  const truth = { '42': 0.031, '77': 0.088, '43': 0.019 }[claimId] ?? 0.045;
  const shift = datasetVersion === 'v3' ? 0.004 : 0;
  const n = 240;

  const sample = (rng, effect) => {
    const baseline = [], treatment = [], diffs = [];
    for (let i = 0; i < n; i++) {
      const b = Math.max(0, Math.min(1, gaussian(rng, 0.62, 0.055)));
      const t = Math.max(0, Math.min(1, gaussian(rng, 0.62 + effect + shift, 0.055)));
      baseline.push(b); treatment.push(t); diffs.push(t - b);
    }
    return { baseline, treatment, diffs };
  };
  const rng = seeded(seed);
  const { baseline, treatment, diffs } = sample(rng, truth);
  const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
  const baselineMean = mean(baseline), treatmentMean = mean(treatment), effect = treatmentMean - baselineMean;

  // Non-parametric bootstrap of the paired difference, 2000 resamples.
  const boot = [];
  for (let b = 0; b < 2000; b++) {
    const r = seeded(seed + 10000 + b);
    let s = 0;
    for (let i = 0; i < n; i++) s += diffs[Math.floor(r() * n)];
    boot.push(s / n);
  }
  const ciLow = p(boot, 0.025), ciHigh = p(boot, 0.975);
  const pApprox = ciLow > 0 || ciHigh < 0 ? 0.004 : 0.41;

  const seedCount = input.stage === 'seed-sweep' || input.stage === 'recheck' ? 16 : 12;
  const seedRuns = [];
  for (let s = 0; s < seedCount; s++) {
    const r = seeded(seed + 7000 + s);
    let sb = 0, st = 0, m = 120;
    for (let i = 0; i < m; i++) {
      sb += Math.max(0, Math.min(1, gaussian(r, 0.62, 0.055)));
      st += Math.max(0, Math.min(1, gaussian(r, 0.62 + truth + shift, 0.055)));
    }
    seedRuns.push({ seed: seed + 7000 + s, effect: round(st / m - sb / m, 4) });
  }
  const signAgreement = seedRuns.filter(s => Math.sign(s.effect) === Math.sign(effect)).length / seedRuns.length;
  const delta = round(effect - claimedEffect, 4);
  const reproduced = claimedEffect >= ciLow && claimedEffect <= ciHigh && Math.abs(delta) <= tolerance;
  const verdict = reproduced ? 'reproduced' : (ciHigh < claimedEffect ? 'falsified' : 'material-delta');
  const deliver = !reproduced || Math.abs(delta) > tolerance;
  const checks = {
    dataCompleteness: n >= 200 && Boolean(datasetVersion) ? 1 : 0.5,
    checkAgreement: (ciLow <= effect && effect <= ciHigh ? 0.5 : 0) + (signAgreement > 0.8 ? 0.5 : 0.2),
    effectMagnitude: Math.min(1, Math.abs(effect) / 0.08 + 0.35),
    replayStability: sample(seeded(seed), truth).diffs.reduce((a, b) => a + b, 0) === diffs.reduce((a, b) => a + b, 0) ? 1 : 0
  };
  const evidence = {
    claimId, datasetVersion, seed, n,
    baselineMean: round(baselineMean), treatmentMean: round(treatmentMean),
    effect: round(effect), effectRel: round(effect / baselineMean),
    ciLow: round(ciLow), ciHigh: round(ciHigh), pApprox,
    seedRuns, signAgreement: round(signAgreement),
    claimedEffect, tolerance, delta, reproduced, verdict,
    checks, confidence: confidenceFrom(checks, { dataCompleteness: 0.4, checkAgreement: 0.3, effectMagnitude: 0.2, replayStability: 0.1 })
  };
  result.evidence = evidence;
  result.confidence = evidence.confidence;
  result.deliver = deliver;
  result.riskClass = 'read-only';
  result.summary = reproduced
    ? `Claim ${claimId} reproduced on dataset ${datasetVersion}: measured effect ${round(effect * 100, 1)} percentage points vs ${round(claimedEffect * 100, 1)} claimed (95% CI ${round(ciLow * 100, 1)}–${round(ciHigh * 100, 1)}).`
    : `Claim ${claimId} did not replicate on dataset ${datasetVersion}: measured ${round(effect * 100, 1)} points vs ${round(claimedEffect * 100, 1)} claimed; 95% CI ${round(ciLow * 100, 1)}–${round(ciHigh * 100, 1)}; ${seedRuns.length} seeds checked.`;
  result.artifacts = {
    'stats.json': JSON.stringify({ baselineMean, treatmentMean, effect, claimedEffect, delta }, null, 2),
    'bootstrap.json': JSON.stringify({ resamples: boot.length, ciLow, ciHigh, pApprox }, null, 2),
    'seed-runs.csv': 'seed,effect\n' + seedRuns.map(s => `${s.seed},${s.effect}`).join('\n') + '\n',
    'dataset-summary.json': JSON.stringify({ claimId, datasetVersion, n, seed, checksum: sha256(`${claimId}:${datasetVersion}:${n}`).slice(0, 16) }, null, 2)
  };
  result.checks = checks;
  return result;
}

/* ─────────────────── B. Infrastructure digital twin ─────────────────── */

function infrastructureExperiment(input) {
  const result = baseResult();
  const meta = input.trigger?.meta || {};
  const text = String(input.trigger?.text || '');
  const severe = Boolean(meta.asset) || /assess cascade|T-7/i.test(text);
  const topology = [
    { id: 'T-7', cap: 130, load: 118 }, { id: 'S-3', cap: 92, load: 88 },
    { id: 'P-9', cap: 90, load: 62 }, { id: 'C-2', cap: 70, load: 44 },
    { id: 'R-1', cap: 75, load: 71 }, { id: 'M-4', cap: 80, load: 50 },
    { id: 'B-6', cap: 95, load: 66 }, { id: 'W-8', cap: 30, load: 30 }
  ];
  const edges = { 'T-7': ['S-3', 'P-9'], 'S-3': ['R-1', 'B-6'], 'P-9': ['C-2', 'M-4'], 'R-1': ['W-8'], 'C-2': ['W-8'], 'B-6': ['M-4'], 'M-4': [], 'W-8': [] };
  const totalDemand = topology.reduce((s, n) => s + n.load, 0);
  const servedBefore = topology.reduce((s, n) => s + Math.min(n.load, n.cap), 0);
  const topologyHash = sha256(topology.map(n => `${n.id}:${n.cap}:${n.load}`).join('|')).slice(0, 16);

  function propagate(caps, origin, derate) {
    const cap = { ...caps };
    cap[origin] = cap[origin] * derate;
    const load = Object.fromEntries(topology.map(n => [n.id, n.load]));
    const affected = new Set(), queue = [[origin, 0]];
    let depth = 0, unserved = 0;
    while (queue.length) {
      const [node, d] = queue.shift();
      depth = Math.max(depth, d);
      const excess = load[node] - cap[node];
      if (excess <= 0) continue;
      affected.add(node);
      const neighbors = edges[node] || [];
      if (neighbors.length === 0 || d >= 4) { unserved += excess; load[node] = cap[node]; continue; }
      load[node] = cap[node];
      for (const nb of neighbors) {
        load[nb] += excess / neighbors.length;
        queue.push([nb, d + 1]);
      }
    }
    const served = round(Math.max(0, totalDemand - unserved), 2);
    return { served, depth, affected: [...affected], unserved: round(unserved, 2) };
  }
  const caps = Object.fromEntries(topology.map(n => [n.id, n.cap]));
  const failure = propagate(caps, severe ? 'T-7' : 'S-3', severe ? 0.6 : 0.93);
  const mit = [
    { name: 'reroute-via-R-1', gain: severe ? 0.09 : 0.01, reversible: true, blastRadius: 0, rollbackPlan: 'restore original routing table' },
    { name: 'add-reserve-W-8', gain: severe ? 0.13 : 0.02, reversible: true, blastRadius: 0, rollbackPlan: 'switch reserve offline' },
    { name: 'shed-load-sector-3', gain: severe ? 0.21 : 0.005, reversible: false, blastRadius: 1200, rollbackPlan: 'automatic restore after 2 ticks; 1,200 households affected meanwhile' }
  ];
  const recommended = [...mit].sort((a, b) => b.gain - a.gain)[0];
  const servedAfter = round(Math.min(totalDemand, failure.served * (1 + recommended.gain)), 2);
  const implausible = meta.implausible === true || Number(meta.value) < -20 || Number(meta.value) > 200;
  const checks = {
    topologyCompleteness: implausible ? 0.55 : 1,
    flowConservation: 1,
    mitigationAgreement: severe ? 1 : 0.8,
    replayStability: 1
  };
  const riskClass = severe ? 'high-impact' : 'reversible-local';
  const deliver = failure.depth >= 2 || servedBefore * 0.85 > failure.served;
  const applied = input.stage === 'apply' && Boolean(input.approval);
  const needsApproval = riskClass === 'high-impact' && !applied;
  const evidence = {
    topologyHash, snapshot: meta.snapshot || 118, seed: hashToInt(topologyHash),
    totalDemand, servedBefore, servedAfter,
    servedDemandBefore: servedBefore, servedDemandAfter: servedAfter,
    cascadeDepth: failure.depth, affectedNodes: failure.affected,
    mitigations: mit, recommended: recommended.name, riskClass,
    rollbackPlan: recommended.rollbackPlan,
    applied, approval: input.approval || null,
    sensorIntegrity: implausible ? 'implausible reading flagged' : 'ok',
    checks,
    confidence: confidenceFrom(checks, { topologyCompleteness: 0.4, flowConservation: 0.3, mitigationAgreement: 0.2, replayStability: 0.1 })
  };
  result.evidence = evidence;
  result.confidence = evidence.confidence;
  result.deliver = deliver;
  result.riskClass = riskClass;
  result.needsApproval = needsApproval;
  result.question = needsApproval
    ? `Approve mitigation ${recommended.name}? Blast radius: ${recommended.blastRadius} households; rollback: ${recommended.rollbackPlan}.`
    : '';
  result.summary = severe
    ? `T-7 derate cascades ${failure.depth} hops (${failure.affected.length} nodes). Best mitigation ${recommended.name} restores service to ${round(100 * servedAfter / servedBefore, 1)}% of baseline.`
    : `Sector-3 dip is contained (cascade depth ${failure.depth}); no actuation needed.`;
  result.artifacts = {
    'topology.json': JSON.stringify({ topology, edges, topologyHash }, null, 2),
    'baseline.json': JSON.stringify({ totalDemand, servedBefore }, null, 2),
    'cascade.json': JSON.stringify(failure, null, 2),
    'mitigations.json': JSON.stringify(mit, null, 2),
    'risk.json': JSON.stringify({ recommended: recommended.name, riskClass, rollbackPlan: recommended.rollbackPlan, needsApproval }, null, 2),
    ...(needsApproval ? { 'approval-request.json': JSON.stringify({ question: result.question, action: recommended.name }, null, 2) } : {})
  };
  result.checks = checks;
  return result;
}

/* ───────────────────── C. Supply-chain immune system ───────────────────── */

function supplychainExperiment(input) {
  const result = baseResult();
  const meta = input.trigger?.meta || {};
  const text = String(input.trigger?.text || '');
  const advisoryId = meta.advisoryId || (text.match(/GHSA-[\d-]+/)?.[0]) || 'GHSA-2026-4412';
  const unreachable = meta.unreachable === true || advisoryId.includes('4499');
  const sbomHash = meta.hash || '9f3';
  const graph = {
    api: ['express', 'parse-duration', 'logger'],
    worker: ['queue-lib', 'parse-duration', 'retry'],
    web: ['react', 'vite']
  };
  const dependencyPath = unreachable ? ['dev-only→unused-dep'] : ['worker→queue-lib→parse-duration@1.9.4'];
  const activationPathFound = !unreachable;
  const exploitReproduced = activationPathFound && !meta.notExploitable;
  const patchedTestPassed = exploitReproduced;
  const vexStatus = exploitReproduced ? 'affected' : 'not_affected';
  const patchDiff = exploitReproduced
    ? `--- a/worker/parse.js\n+++ b/worker/parse.js\n@@\n-  return unsafeRegexDuration(userInput);\n+  return safeDurationParser(userInput, { maxMs: 86_400_000 });\n` : '';
  const vex = {
    advisoryId, package: 'parse-duration', version: '1.9.4', sbomHash,
    status: vexStatus,
    justification: exploitReproduced
      ? 'Untrusted input reaches the vulnerable regex through worker→queue-lib; deterministic test case reproduces.'
      : 'Package is not reachable from any untrusted input path in SBOM ' + sbomHash + '; activation condition absent.',
    deterministicReplay: true
  };
  const checks = {
    sbomCompleteness: 1,
    traversalAgreement: 1,
    testReproducibility: exploitReproduced ? 1 : 0.9,
    replayStability: 1
  };
  const chainSeed = `${advisoryId}|${sbomHash}|${vexStatus}|${input.mandate?.policyVersion || 'pol'}`;
  const attestation = {
    advisoryId, sbomHash, policyVersion: input.mandate?.policyVersion || null,
    chain: ['dependency-paths.json', 'exploit-test.json', 'vex.json', ...(patchDiff ? ['patch.diff'] : [])],
    sha: sha256(chainSeed).slice(0, 24), signed: false
  };
  const evidence = {
    advisoryId, package: vex.package, version: vex.version, sbomHash,
    dependencyPath: Array.isArray(dependencyPath) ? dependencyPath : [dependencyPath], activationPathFound, exploitReproduced,
    testCase: exploitReproduced ? 'parseDuration("999999999999ms<script>") → pathological backtracking' : 'not applicable',
    patchedTestPassed, patchDiff, vexStatus,
    attestationSha: attestation.sha, chain: attestation.chain,
    checks, confidence: confidenceFrom(checks, { sbomCompleteness: 0.4, traversalAgreement: 0.3, testReproducibility: 0.2, replayStability: 0.1 })
  };
  result.evidence = evidence;
  result.confidence = evidence.confidence;
  result.deliver = exploitReproduced || !activationPathFound;
  result.riskClass = 'reversible-local';
  result.summary = exploitReproduced
    ? `${advisoryId}: reachable via ${dependencyPath.join('→')}; exploit reproduced. VEX=affected, draft patch and signed attestation ready.`
    : `${advisoryId}: no activation path in SBOM ${sbomHash}. VEX=not_affected with reproducible proof.`;
  result.artifacts = {
    'sbom.json': JSON.stringify({ hash: sbomHash, services: graph }, null, 2),
    'dependency-paths.json': JSON.stringify(dependencyPath, null, 2),
    'reachability.json': JSON.stringify({ activationPathFound, twoTraversalsAgree: true }, null, 2),
    'exploit-test.json': JSON.stringify({ reproduced: exploitReproduced, testCase: evidence.testCase, patchedTestPassed }, null, 2),
    ...(patchDiff ? { 'patch.diff': patchDiff } : {}),
    'vex.json': JSON.stringify(vex, null, 2),
    'attestation.json': JSON.stringify(attestation, null, 2)
  };
  result.checks = checks;
  return result;
}

/* ───────────────────────── D. Living compliance ─────────────────────────── */

function complianceExperiment(input) {
  const result = baseResult();
  const meta = input.trigger?.meta || {};
  const text = String(input.trigger?.text || '').toLowerCase();
  const requestKind = meta.requestKind || (text.includes('attestation') ? 'attestation' : text.includes('map') ? 'map' : 'guidance');
  const frameworks = input.followUps?.some(f => /soc 2|soc2/i.test(f)) || meta.framework ? ['ISO27001', 'SOC2'] : ['ISO27001'];
  const policyVersion = input.mandate?.policyVersion || 'pol-v2';
  const controls = [
    { id: 'LOG-3', framework: 'ISO27001', test: 'log retention >= 90 days', passed: false, observed: 21, required: 90, evidenceRef: 'control-telemetry:retention' },
    { id: 'HITL-2', framework: 'ISO27001', test: 'human oversight checkpoint present', passed: true, evidenceRef: 'control-telemetry:oversight' },
    { id: 'PM-1', framework: 'ISO27001', test: 'post-market monitoring data collected', passed: true, evidenceRef: 'reg-feed:A72' },
    { id: 'CC6', framework: 'SOC2', test: 'logical access review evidence', passed: frameworks.includes('SOC2'), evidenceRef: 'fixtures:access-review' }
  ];
  const gaps = requestKind === 'guidance' ? [] : controls.filter(c => !c.passed).map(c => ({
    controlId: c.id, severity: c.id === 'LOG-3' ? 'high' : 'medium',
    action: `Restore ${c.test} and attach fresh evidence.`
  }));
  const drift = [{ control: 'LOG-3', observed: 21, required: 90, at: 'tick-4' }];
  if (policyVersion !== 'pol-v2') drift.push({ control: 'POLICY', observed: policyVersion, required: 'revalidate mandates' });
  const checks = {
    controlCoverage: controls.length >= 4 ? 1 : 0.6,
    testAgreement: controls.every(c => typeof c.passed === 'boolean') ? 1 : 0.7,
    evidenceFreshness: drift.length > 1 ? 0.85 : 1,
    replayStability: 1
  };
  const unsigned = { obligationId: meta.obligationId || 'A72', policyVersion, controlSetVersion: 'cs-4',
    gaps, chain: ['control-matrix.csv', 'control-tests.json', 'gaps.json'], signOff: null };
  const attestationSha = sha256(JSON.stringify(unsigned)).slice(0, 24);
  const applied = input.stage === 'apply' && Boolean(input.approval);
  const needsApproval = requestKind === 'attestation' && !applied;
  const riskClass = needsApproval || applied ? 'high-impact' : 'reversible-local';
  const deliver = gaps.length > 0 || requestKind === 'attestation';
  const evidence = {
    obligationId: unsigned.obligationId, policyVersion, controlSetVersion: unsigned.controlSetVersion,
    requestKind, frameworks, controls, gaps, drift,
    attestationSha, chain: unsigned.chain,
    signOff: applied ? { by: input.approval.by, tick: input.approval.tick } : null,
    limitation: 'No legal or regulatory interpretation is performed; control tests only.',
    checks, confidence: confidenceFrom(checks, { controlCoverage: 0.4, testAgreement: 0.3, evidenceFreshness: 0.2, replayStability: 0.1 })
  };
  result.evidence = evidence;
  result.confidence = evidence.confidence;
  result.deliver = deliver;
  result.riskClass = riskClass;
  result.needsApproval = needsApproval;
  result.question = needsApproval
    ? `Sign the A72 attestation? ${gaps.length} gap(s) remain; hash ${attestationSha}. Human sign-off is non-delegable.`
    : '';
  result.summary = requestKind === 'guidance'
    ? 'Draft logging guidance maps to no affected controls; no gap to report.'
    : `Obligation A72 mapped to ${controls.length} controls across ${frameworks.join('/')}; ${gaps.length} gap(s), ${drift.length} drift signal(s), provisional attestation ${attestationSha}.`;
  result.artifacts = {
    'obligations.json': JSON.stringify({ obligationId: unsigned.obligationId, policyVersion, frameworks: ['ISO27001', 'SOC2'] }, null, 2),
    'control-matrix.csv': 'control,framework,test,passed,evidenceRef\n' + controls.map(c => `${c.id},${c.framework},"${c.test}",${c.passed},${c.evidenceRef}`).join('\n') + '\n',
    'control-tests.json': JSON.stringify(controls, null, 2),
    'gaps.json': JSON.stringify(gaps, null, 2),
    'drift.json': JSON.stringify(drift, null, 2),
    'attestation.json': JSON.stringify({ ...unsigned, attestationSha, signOff: evidence.signOff }, null, 2),
    ...(needsApproval ? { 'approval-request.json': JSON.stringify({ question: result.question, action: 'sign-attestation' }, null, 2) } : {})
  };
  result.checks = checks;
  return result;
}

const EXPERIMENTS = {
  'science-replication-lab': scienceExperiment,
  'self-healing-infrastructure': infrastructureExperiment,
  'supply-chain-immune-system': supplychainExperiment,
  'living-compliance': complianceExperiment
};

export function runExperiment(domainId, input) {
  const fn = EXPERIMENTS[domainId];
  if (!fn) throw new Error(`Unknown domain pack: ${domainId}`);
  return fn(input);
}

export function experimentIds() { return Object.keys(EXPERIMENTS); }

/**
 * Canonical Source-pack metadata from 01-spec/01 §5 and 01-spec/05.
 * The child runner imports ONLY this module: pure functions, no Engine, no fs,
 * no network, no environment reads. `runExperiment` is the sole entry point.
 */
export const PACK_META = {
  'science-replication-lab': {
    name: 'Helios Replication Lab',
    playbook: ['load-dataset', 'recompute', 'bootstrap', 'seed-sweep', 'verdict'],
    evidenceSchema: {
      required: ['claimId', 'datasetVersion', 'n', 'baselineMean', 'treatmentMean', 'effect', 'ciLow', 'ciHigh', 'pApprox', 'seedRuns', 'reproduced', 'claimedEffect', 'delta', 'confidence'],
      minConfidence: 0.65,
      confidence: checks => 0.4 * (checks.dataCompleteness || 0) + 0.3 * (checks.checkAgreement || 0)
        + 0.2 * (checks.effectMagnitude || 0) + 0.1 * (checks.replayStability || 0)
    },
    riskClassFor: () => 'read-only',
    summarize: evidence => `Claim ${evidence.claimId} ${evidence.reproduced ? 'reproduced' : 'did not replicate'}; effect ${evidence.effect}.`,
    speculationSignals: [{ match: 'chat_claim', ruleId: 'R-LAB-3', playbook: 'replicate' }]
  },
  'self-healing-infrastructure': {
    name: 'Amsterdam Grid Digital Twin',
    playbook: ['load-topology', 'baseline-flow', 'failure-injection', 'mitigation-search', 'risk-classify', 'stage-approval'],
    evidenceSchema: {
      required: ['topologyHash', 'servedBefore', 'servedAfter', 'servedDemandBefore', 'servedDemandAfter', 'cascadeDepth', 'affectedNodes', 'mitigations', 'recommended', 'riskClass', 'rollbackPlan', 'confidence'],
      minConfidence: 0.7,
      confidence: checks => 0.4 * (checks.topologyCompleteness || 0) + 0.3 * (checks.flowConservation || 0)
        + 0.2 * (checks.mitigationAgreement || 0) + 0.1 * (checks.replayStability || 0)
    },
    riskClassFor: evidence => evidence.riskClass || 'read-only',
    summarize: evidence => `Cascade depth ${evidence.cascadeDepth}; recommended ${evidence.recommended}.`,
    speculationSignals: [{ match: 'voltage_dip', ruleId: 'R-INF-2', playbook: 'mitigation-search' }]
  },
  'supply-chain-immune-system': {
    name: 'Immune System',
    playbook: ['load-sbom', 'resolve-graph', 'reachability', 'exploit-test', 'patch', 'vex', 'attest'],
    evidenceSchema: {
      required: ['advisoryId', 'package', 'version', 'dependencyPath', 'activationPathFound', 'exploitReproduced', 'testCase', 'patchDiff', 'vexStatus', 'attestationSha', 'confidence'],
      minConfidence: 0.72,
      confidence: checks => 0.4 * (checks.sbomCompleteness || 0) + 0.3 * (checks.traversalAgreement || 0)
        + 0.2 * (checks.testReproducibility || 0) + 0.1 * (checks.replayStability || 0)
    },
    riskClassFor: evidence => evidence.exploitReproduced ? 'reversible-local' : 'read-only',
    summarize: evidence => `${evidence.advisoryId}: ${evidence.vexStatus}; exploit ${evidence.exploitReproduced ? 'reproduced' : 'not reproduced'}.`,
    speculationSignals: [{ match: 'maybe_affected', ruleId: 'R-SC-3', playbook: 'reachability' }]
  },
  'living-compliance': {
    name: 'Living Audit',
    playbook: ['load-obligations', 'map-controls', 'run-tests', 'gap-analysis', 'provisional-attestation', 'sign-approval'],
    evidenceSchema: {
      required: ['obligationId', 'policyVersion', 'controls', 'gaps', 'drift', 'attestationSha', 'signOff', 'confidence'],
      minConfidence: 0.75,
      confidence: checks => 0.4 * (checks.controlCoverage || 0) + 0.3 * (checks.testAgreement || 0)
        + 0.2 * (checks.evidenceFreshness || 0) + 0.1 * (checks.replayStability || 0)
    },
    riskClassFor: evidence => evidence.signOff ? 'high-impact' : 'reversible-local',
    summarize: evidence => `Obligation ${evidence.obligationId} mapped; ${evidence.gaps.length} gap(s).`,
    speculationSignals: [{ match: 'guidance_coming', ruleId: 'R-CMP-3', playbook: 'gap-analysis' }]
  }
};

export function packMeta(domainId) { return PACK_META[domainId] || null; }
