import { key } from './util.js';

/**
 * Deterministic "constitution" assessor.
 *
 * The default run does NOT call an LLM: assessment is a reproducible function of
 * (trigger text, meta, enabled rules, policy). This makes the whole system testable
 * and keeps the coordination logic visible. `narrate()` is an optional, asynchronous
 * OpenAI/DeepSeek-compatible enrichment seam used only for prose, never for decisions.
 */
export function assess({ trigger, batch = [], policy, threadContext = [], domain = null }) {
  const text = (trigger.text || '').toLowerCase();
  const meta = trigger.meta || {};
  const rules = policy.rules.filter(r => !r.domain || r.domain === (domain || trigger.domain));
  const ruleJudgements = rules.map(rule => {
    const signals = rule.signals || [];
    const matched = signals.some(s => text.includes(String(s).toLowerCase())) && ruleAppliesToMeta(rule, meta);
    return { ruleId: rule.id, matched, reason: matched
      ? `signal matched: ${signals.filter(s => text.includes(String(s).toLowerCase())).join(', ')}`
      : 'no declared signal matched this trigger' };
  });
  const matched = ruleJudgements.filter(j => j.matched).map(j => j.ruleId);
  const concreteTarget = Boolean(meta.claimId || meta.advisoryId || meta.obligationId || meta.asset || meta.snapshot || meta.hash || meta.dataset || meta.sector);
  const hedging = /(maybe|probably|looks|coffee|pizza|happy friday|anyone seen|could we|perhaps)/.test(text);
  const designWords = /(design|redesign|restyle|ugly|preference|should look)/.test(text) && !concreteTarget;
  const implementationRequested = matched.length > 0 && concreteTarget && !hedging;
  const targetBasis = concreteTarget ? 'specified' : (hedging || designWords ? 'unsettled' : 'existing-standard');
  const designDecisionOpen = !concreteTarget && (hedging || designWords);
  const direction = implementationRequested && !designDecisionOpen && targetBasis !== 'unsettled'
    ? 'implementation_requested' : 'no_action';
  return {
    direction,
    reason: direction === 'implementation_requested'
      ? `Matched ${matched.join(', ')} against a concrete target in the trigger metadata.`
      : 'No settled, evidence-backed implementation request; ignoring quietly.',
    intentEvidence: {
      implementationRequested,
      targetBasis,
      designDecisionOpen,
      quotes: [String(trigger.text || '').slice(0, 160)]
    },
    ruleJudgements,
    matchedRules: matched,
    threadContextSize: threadContext.length,
    batchSize: batch.length,
    adapter: 'deterministic-constitution'
  };
}

function ruleAppliesToMeta(rule, meta) {
  if (!rule.requiresMeta) return true;
  return rule.requiresMeta.some(k => Boolean(meta[k]));
}

/**
 * Optional narrative enrichment. Never affects gate, mandate, evidence or delivery.
 * Enable with ARGOS_LLM_URL (OpenAI-compatible /chat/completions) and ARGOS_LLM_KEY.
 */
export async function narrate(summary, evidence) {
  const url = process.env.ARGOS_LLM_URL, apiKey = process.env.ARGOS_LLM_KEY;
  if (!url || !apiKey) return { enabled: false, text: null };
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: process.env.ARGOS_LLM_MODEL || 'deepseek-chat',
        messages: [
          { role: 'system', content: 'Rewrite the result in one sentence, at most 40 words. Do not add facts.' },
          { role: 'user', content: `${summary}\n\nEvidence: ${JSON.stringify(evidence).slice(0, 1500)}` }
        ],
        max_tokens: 80, temperature: 0
      }),
      signal: AbortSignal.timeout(6000)
    });
    if (!res.ok) throw new Error(`LLM ${res.status}`);
    const data = await res.json();
    return { enabled: true, text: data?.choices?.[0]?.message?.content?.trim() || null, id: key('narrative', summary) };
  } catch (error) {
    return { enabled: true, text: null, error: String(error.message || error) };
  }
}
