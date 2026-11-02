import { pack as science } from './science.js';
import { pack as infrastructure } from './infrastructure.js';
import { pack as supplychain } from './supplychain.js';
import { pack as compliance } from './compliance.js';
import { experimentIds, runExperiment, PACK_META } from './experiments.js';
import { scope as policyScope } from '../policy.js';

/**
 * Source-pack registry. Adding a fifth pack requires NO Engine changes.
 * Each pack is augmented with the canonical interface from 01-spec/04–05:
 * speculationSignals, runExperiment, evidenceSchema.confidence,
 * playbook.stages, scope, riskClassFor and summarize.
 */
const RAW_PACKS = [science, infrastructure, supplychain, compliance];
for (const pack of RAW_PACKS) {
  const meta = PACK_META[pack.id];
  const stages = [...pack.playbook];
  pack.playbook = Object.assign([...stages], { stages });
  pack.speculationSignals = [...meta.speculationSignals];
  pack.runExperiment = input => runExperiment(pack.id, input);
  pack.evidenceSchema = {
    ...pack.evidenceSchema,
    required: [...meta.evidenceSchema.required],
    minConfidence: meta.evidenceSchema.minConfidence,
    confidence: meta.evidenceSchema.confidence
  };
  pack.scope = (trigger, policy) => policyScope(policy, trigger);
  pack.riskClassFor = meta.riskClassFor;
  pack.summarize = meta.summarize;
}

export const PACKS = Object.fromEntries(RAW_PACKS.map(p => [p.id, p]));
export const PACK_IDS = Object.keys(PACKS);

export function getPack(id) {
  const pack = PACKS[id];
  if (!pack) throw new Error(`Unknown Source pack: ${id}`);
  return pack;
}

export function allCatalogs() {
  return PACK_IDS.flatMap(id => getPack(id).eventCatalog.map(e => ({ ...e, domain: id })));
}

export { experimentIds };
