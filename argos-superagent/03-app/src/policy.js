import { sha256, canonical, key } from './util.js';
import { assess } from './model.js';

/** Volatile fields do not participate in the policy version. */
export function policyVersion(policy) {
  const { version, clock, paused, ...rest } = policy;
  return 'pol-' + sha256(rest).slice(0, 10);
}

export function sourceConfig(policy, source) {
  const cfg = policy.sources?.[source] || { allowed: [], bots: [], observed: [] };
  return { ...cfg, observedScopes: cfg.observedScopes || cfg.observed || [] };
}

/** Spec 04 §1: scope(trigger) -> {listened, observed, row}. */
export function scope(policy, trigger) {
  const cfg = sourceConfig(policy, trigger.source);
  const row = cfg.row || trigger.source;
  return {
    listened: true,
    observed: cfg.observedScopes.includes(trigger.source) || cfg.observedScopes.includes(row),
    row
  };
}

/**
 * Stage 1 — deterministic gate. Trigger text is never read for authorization.
 * Returns { strength, basis, reasonCodes, filtered? }.
 */
export function gate({ trigger, policy, threadSubscriptions = [] }) {
  const cfg = sourceConfig(policy, trigger.source);
  const sc = scope(policy, trigger);
  const observed = cfg.observedScopes.includes(trigger.source);
  const reasonCodes = [];
  if (trigger.actor?.id === 'argos' || trigger.meta?.self) return { filtered: true, strength: 'not_admitted', basis: 'self', reasonCodes: ['self_message'] };
  if (!sc.listened || (!sc.observed && !trigger.addressed)) {
    return { filtered: true, strength: 'not_admitted', basis: 'scope', reasonCodes: ['out_of_scope'] };
  }
  const allowed = (cfg.allowed || []).map(s => String(s).toLowerCase());
  const bots = (cfg.bots || []).map(s => String(s).toLowerCase());
  const actorId = String(trigger.actor?.id || '').toLowerCase();
  const isBot = trigger.actor?.type === 'bot' || trigger.human === false;
  const isAllowedHuman = trigger.human !== false && allowed.includes(actorId);
  if (trigger.meta?.injection) reasonCodes.push('untrusted_content_ignored');

  // Human follow-up on an own Thread: fast path, explicit, no Eval.
  const ownSubscription = threadSubscriptions.find(s => s.own && !s.contextOnly);
  if (!isBot && ownSubscription) {
    return { strength: 'explicit', basis: 'followup', reasonCodes: [...reasonCodes, 'subscribed_thread'], fastPath: true };
  }
  if (isAllowedHuman && trigger.addressed) {
    return { strength: 'explicit', basis: 'addressed', reasonCodes };
  }
  if (isBot && bots.includes(actorId) && (trigger.addressed || observed)) {
    reasonCodes.push('listed_bot');
    return policy.mode === 'off'
      ? { filtered: true, strength: 'not_admitted', basis: 'mode_off', reasonCodes: [...reasonCodes, 'mode_off'] }
      : { strength: 'inferred', basis: 'bot', reasonCodes };
  }
  if (trigger.actor?.type === 'system' && observed) {
    return policy.mode === 'off'
      ? { filtered: true, strength: 'not_admitted', basis: 'mode_off', reasonCodes: ['mode_off'] }
      : { strength: 'inferred', basis: 'admission', reasonCodes: ['system_signal'] };
  }
  if (isAllowedHuman && observed && !trigger.addressed) {
    return policy.mode === 'off'
      ? { filtered: true, strength: 'not_admitted', basis: 'mode_off', reasonCodes: ['mode_off'] }
      : { strength: 'inferred', basis: 'admission', reasonCodes: [...reasonCodes, 'listed_unaddressed'] };
  }
  if (policy.mode === 'off') return { filtered: true, strength: 'not_admitted', basis: 'mode_off', reasonCodes: [...reasonCodes, 'mode_off'] };
  reasonCodes.push(isBot ? 'bot_not_listed' : 'not_a_member');
  return { filtered: true, strength: 'not_admitted', basis: 'gate', reasonCodes };
}

/** Stage 2 — semantic assessment, deterministic by default. */
export function assessCandidate({ trigger, batch, policy, threadContext }) {
  return assess({ trigger, batch, policy, threadContext });
}

export function assessmentOutcome({ assessment, policy, strength }) {
  const { direction, matchedRules, reason, intentEvidence, ruleJudgements } = assessment;
  if (direction === 'unavailable' || assessment.adapter === 'unavailable') {
    return { outcome: 'unavailable', reasonCodes: ['assessor_failure'], reason, matchedRules: [], intentEvidence, ruleJudgements };
  }
  if (direction !== 'implementation_requested' || !intentEvidence.implementationRequested || intentEvidence.designDecisionOpen || intentEvidence.targetBasis === 'unsettled') {
    return { outcome: 'ignore', reasonCodes: ['no_settled_request'], reason, matchedRules: [], intentEvidence, ruleJudgements };
  }
  if (matchedRules.length === 0) {
    return { outcome: 'ignore', reasonCodes: ['no_matching_rule'], reason, matchedRules, intentEvidence, ruleJudgements };
  }
  if (strength !== 'inferred') {
    return { outcome: 'ignore', reasonCodes: ['strength_mismatch'], reason, matchedRules, intentEvidence, ruleJudgements };
  }
  if (policy.mode === 'observe') {
    return { outcome: 'would_accept', reasonCodes: ['observe_mode'], reason, matchedRules, intentEvidence, ruleJudgements };
  }
  if (policy.mode === 'off') {
    return { outcome: 'ignore', reasonCodes: ['mode_off'], reason, matchedRules, intentEvidence, ruleJudgements };
  }
  return { outcome: 'accept', reasonCodes: ['auto_mode_matched_rule'], reason, matchedRules, intentEvidence, ruleJudgements };
}

/** Revalidation before an ended Ticket resumes (upstream docs/002). */
export function revalidate({ mandate, policy, sourceStillListened = true }) {
  if (!sourceStillListened) return { ok: false, reason: 'source_no_longer_listened' };
  if (mandate.stopped) return { ok: false, reason: 'mandate_withdrawn' };
  if (mandate.via === 'speculation') return { ok: false, reason: 'speculative_mandate_not_resumable' };
  if (mandate.policyVersion && mandate.policyVersion !== policy.version) {
    return { ok: false, reason: 'policy_version_changed' };
  }
  const cfg = mandate.source ? sourceConfig(policy, mandate.source) : null;
  const actorStillListed = !cfg || !mandate.actorId
    || cfg.allowed?.map(String).includes(String(mandate.actorId))
    || cfg.bots?.map(String).includes(String(mandate.actorId));
  const rulesStillEnabled = !mandate.matchedRules?.length
    || mandate.matchedRules.every(id => {
      const rule = policy.rules?.find(r => r.id === id);
      return rule && rule.enabled !== false;
    });
  if (mandate.via === 'followup' || mandate.via === 'addressed') {
    if (mandate.via === 'addressed' && !actorStillListed) return { ok: false, reason: 'actor_no_longer_allowlisted' };
    return { ok: true, reason: 'explicit_basis_holds' };
  }
  if (mandate.via === 'bot') {
    return cfg?.bots?.map(String).includes(String(mandate.actorId)) && policy.mode === 'auto' && rulesStillEnabled
      ? { ok: true, reason: 'bot_still_listed' } : { ok: false, reason: 'bot_or_mode_changed' };
  }
  if (mandate.via === 'admission') {
    const strengthHolds = !mandate.strength || ['explicit', 'inferred'].includes(mandate.strength);
    return policy.mode === 'auto' && actorStillListed && strengthHolds && rulesStillEnabled
      ? { ok: true, reason: 'admission_basis_holds' } : { ok: false, reason: 'admission_basis_changed' };
  }
  if (mandate.policyVersion !== policy.version) {
    return { ok: false, reason: 'policy_version_changed' };
  }
  return { ok: true, reason: 'basis_holds' };
}

export function autonomyFor(riskClass, policy) {
  if (policy.autonomy.forbid.includes(riskClass)) return 'forbid';
  if (policy.autonomy.approve.includes(riskClass) || riskClass === 'high-impact') return 'approve';
  return 'auto';
}

export function mandateId(ticketId, policy, triggerIds) {
  return key('mandate', ticketId, policy.version, triggerIds.join(','));
}
