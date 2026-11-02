import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { wordCount, sha256, canonical, isoFromTick } from '../util.js';
import { runExperiment, PACK_META } from '../domains/experiments.js';

/**
 * Isolated worker runner. Spec 05: the child process imports ONLY pure domain
 * functions from src/domains/experiments.js, reads input.json from its own cwd,
 * writes all mandatory artifacts, emits progress lines, and never sees a secret.
 */
const RUNNER_PATH = fileURLToPath(import.meta.url);

export function workdirFor(base, domain, ticketId) {
  return join(base, domain, ticketId);
}

export function buildInput({ ticket, trigger, mandate, threadContext, stage, triggerIds, policyVersion, tick = 0, speculative = false, recoveryNote = null }) {
  return {
    ticketId: ticket.id, domain: ticket.domain, trigger, mandate, threadContext,
    stage, seed: sha256(canonical({ ticketId: ticket.id, stage })).slice(0, 18),
    policyVersion, triggerIds, tick, speculative, recoveryNote,
    channel: trigger.channel, refs: [ticket.id, mandate.id, trigger.id]
  };
}

function progressLines(meta, tick, recoveryNote) {
  return meta.playbook.map((name, i) => {
    const step = i + 1;
    const note = i === 0 ? (recoveryNote ? `recovered: ${recoveryNote}` : 'input envelope pinned')
      : i === meta.playbook.length - 1 ? 'evidence envelope sealed' : 'pure computation';
    const row = { step, name, at: isoFromTick(tick), tick, status: 'ok', note, deterministic: true };
    row.hash = sha256(canonical(row));
    return row;
  });
}

export function executeWorker({ pack, ticket, input, workDir, tick, policyVersion, recoveryNote = null }) {
  const domainId = pack.id;
  const meta = PACK_META[domainId];
  if (!meta) throw new Error(`No pure experiment metadata for ${domainId}`);
  const startedAt = Date.now();
  const result = runExperiment(domainId, { ...input, ticketId: ticket.id });
  const missing = meta.evidenceSchema.required.filter(k => !(k in result.evidence));
  if (missing.length) throw new Error(`Missing mandatory evidence ${missing.join(', ')} for ${domainId}`);
  if (result.confidence < meta.evidenceSchema.minConfidence) throw new Error(`Confidence ${result.confidence} below ${meta.evidenceSchema.minConfidence} for ${domainId}`);
  if (wordCount(result.summary) > 100) throw new Error('Worker summary exceeded the 100-word channel limit');

  const dir = workdirFor(workDir, domainId, ticket.id);
  mkdirSync(dir, { recursive: true });
  const progress = progressLines(meta, tick, recoveryNote);
  const artifacts = { ...result.artifacts };
  artifacts['input.json'] = JSON.stringify(input, null, 2);
  const evidenceEnvelope = {
    ticketId: ticket.id, domain: domainId, stage: input.stage, tick, policyVersion,
    mandateId: input.mandate?.id || null, threadKey: ticket.threadKeys?.[0] || input.channel?.thread || null,
    adapter: 'deterministic-constitution', confidence: result.confidence,
    riskClass: result.riskClass, needsApproval: result.needsApproval,
    deliver: result.deliver, summary: result.summary, evidence: result.evidence,
    checks: result.checks, playbook: meta.playbook
  };
  evidenceEnvelope.sha256 = sha256(canonical(evidenceEnvelope));
  artifacts['evidence.json'] = JSON.stringify(evidenceEnvelope, null, 2);
  artifacts['log.jsonl'] = progress.map(p => JSON.stringify(p)).join('\n') + '\n';

  const reportState = result.riskClass === 'forbidden' ? 'blocked'
    : ticket.speculative || input.speculative
      ? (result.deliver ? 'speculative_confirmed' : 'speculative_discarded')
      : (meta.evidenceSchema.required.every(k => k in result.evidence) ? 'ready' : 'blocked');
  for (const [name, content] of Object.entries(artifacts)) writeFileSync(join(dir, name), String(content), 'utf8');
  const artifactFiles = [...Object.keys(artifacts), 'report.md', 'result.json'];
  const report = [
    `# ${ticket.id} — evidence report`, '',
    `- **Domain:** ${meta.name} (${domainId})`,
    `- **Stage:** ${input.stage}`,
    `- **Policy version:** ${policyVersion}`,
    `- **Mandate:** ${input.mandate?.id || 'none'}`,
    `- **Generated at simulation tick:** ${tick}`,
    `- **Deterministic experiment:** ${meta.playbook.join(' → ')}`,
    `- **Confidence:** ${result.confidence}`,
    `- **Risk class:** ${result.riskClass}`,
    `- **Needs human approval:** ${result.needsApproval}`,
    `- **Report state:** ${reportState}`,
    `- **Evidence sha256:** ${evidenceEnvelope.sha256.slice(0, 24)}`,
    ...(recoveryNote ? [`- **Recovery note:** ${recoveryNote}`] : []),
    '', '## Problem', '', input.trigger?.text || 'Synthetic event under test.',
    '', '## Method', '', meta.playbook.map((s, i) => `${i + 1}. ${s}`).join('\n'),
    '', '## Result', '', result.summary,
    '', '## Limitations', '', 'Synthetic simulation data; deterministic reasoning; no external systems contacted.',
    '', '## Evidence', '', '| field | value |', '| --- | --- |',
    ...Object.entries(result.evidence).filter(([, v]) => !Array.isArray(v) && typeof v !== 'object')
      .map(([k, v]) => `| ${k} | ${String(v)} |`),
    '', '## Artifacts', '', ...artifactFiles.map(f => `- \`${f}\``),
    '', '## Provenance', '', 'Generated by an ARGOS automated worker. Synthetic simulation data; not a production finding.',
    ''
  ].join('\n');
  writeFileSync(join(dir, 'report.md'), report, 'utf8');
  const resultEnvelope = {
    ticketId: ticket.id, domain: domainId, stage: input.stage, tick, policyVersion,
    state: reportState, summary: result.summary, confidence: result.confidence,
    riskClass: result.riskClass, needsApproval: result.needsApproval,
    question: result.question, evidenceSha256: evidenceEnvelope.sha256,
    evidence: result.evidence, deliver: result.deliver,
    artifacts: artifactFiles, artifactsPath: dir,
    mandateId: input.mandate?.id || null,
    threadKey: ticket.threadKeys?.[0] || input.channel?.thread || null,
    progressHashes: progress.map(p => p.hash),
    recoveryNote, elapsedMs: Date.now() - startedAt
  };
  writeFileSync(join(dir, 'result.json'), JSON.stringify(resultEnvelope, null, 2), 'utf8');
  return {
    ...result,
    state: reportState,
    artifactsPath: dir, artifacts: artifactFiles,
    evidenceSha256: evidenceEnvelope.sha256,
    progress, progressHashes: resultEnvelope.progressHashes,
    mandateId: resultEnvelope.mandateId, threadKey: resultEnvelope.threadKey,
    recoveryNote, elapsedMs: resultEnvelope.elapsedMs, workerTicks: Math.max(1, Number(input.tick) || 1)
  };
}

/** CLI entry used by src/workers.js: argv[2] is the absolute input.json path. */
function runCli() {
  const inputPath = resolve(process.argv[2]);
  const dir = dirname(inputPath);
  const input = JSON.parse(readFileSync(inputPath, 'utf8'));
  const domainId = input.domain;
  const meta = PACK_META[domainId];
  if (!meta) throw new Error(`Unknown domain pack: ${domainId}`);
  const ticket = {
    id: input.ticketId, domain: domainId,
    threadKeys: input.channel ? [input.channel.thread] : [],
    speculative: Boolean(input.speculative)
  };
  const result = executeWorker({
    pack: { id: domainId, name: meta.name }, ticket, input,
    workDir: resolve(dir, '..', '..'), tick: Number(input.tick ?? 0),
    policyVersion: input.policyVersion, recoveryNote: input.recoveryNote || null
  });
  for (const p of result.progress) console.log(JSON.stringify(p));
  console.log(JSON.stringify({ type: 'result', ticketId: ticket.id, state: result.state }));
}

if (process.argv[1] && resolve(process.argv[1]) === RUNNER_PATH) {
  runCli();
}
