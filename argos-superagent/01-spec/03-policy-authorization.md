# 03 — Policy, authorization and autonomy

> Normative rule: **authorization is code, never text.** Everything below is enforced by `src/policy.js` and `src/engine.js`; `03-app/policy.json` is the versioned constitution. An LLM adapter, if enabled, may propose an assessment but cannot alter the gate.

## 1. Constitution (`policy.json`)

```jsonc
{
  "version": "<sha256 of canonical content>",
  "mode": "observe",                       // off | observe | auto
  "rules": [
    { "id": "R1", "name": "Reproduce a falsifiable claim", "instruction": "...",
      "signals": ["replicate", "claim", "not reproducible"], "requiresEvidence": true },
    ...
  ],
  "sources": {
    "lab-chat":  { "allowed": ["dr.chen", "mira"], "bots": ["literature-feed"], "observedScopes": ["lab-chat"] },
    ...
  },
  "speculation": { "enabled": true, "confidenceThreshold": 0.72, "maxPerTick": 2 },
  "autonomy": {
    "auto":    ["simulate", "compute", "draft", "attest-provisional"],
    "approve": ["actuate", "patch-prod", "sign-attestation", "publish-advisory"],
    "forbid":  ["delete-data", "rotate-secrets", "regional-failover", "external-write"]
  },
  "attention": { "chatWordLimit": 100, "oneAckPerTicket": true, "maxMessagesPerTick": 3 },
  "workers":   { "maxWorkers": 4, "timeoutTicks": 40 },
  "watchdog":  { "stallTicks": 12, "loopThreshold": 3 }
}
```

Changing `mode`, `rules`, `sources`, `speculation`, `autonomy` or `attention` **changes the Policy version**. Changing clock speed or pause state does not.

## 2. Two-stage filter

### Stage 1 — deterministic gate (fast path)

Inputs: `Trigger`, Source config, Thread, existing Tickets, Policy. Output: `strength`, `basis`, `reasonCodes`.

| Check | Rule |
|---|---|
| Bot's own message | filtered `self_message` |
| Source not listened / scope not observed for unaddressed messages | filtered `out_of_scope` |
| Actor on Source allowlist **and** `addressed` | `explicit` / `addressed` |
| Human follow-up on Thread with an own Ticket | `explicit` / `followup` (fast path, no Eval) |
| Actor on allowlist, unaddressed, in an observed scope | `inferred` / `admission` |
| Bot on Source bot list, observed scope | `inferred` / `bot` |
| Unlisted actor addressing the agent | `not_admitted` unless an admission cell explicitly grants `explicit` |
| `mode = off` and inferred | `not_admitted` |
| Text containing instruction-like content | never affects any check; reason `untrusted_content_ignored` recorded for audit |

### Stage 2 — semantic assessment (slow path)

Only `inferred` candidates reach assessment. The deterministic assessor (or optional LLM adapter) must return:

```jsonc
{
  "intentEvidence": {
    "implementationRequested": true,
    "targetBasis": "specified|existing-standard|unsettled",
    "designDecisionOpen": false,
    "quotes": ["..."]
  },
  "ruleJudgements": [ { "ruleId": "R1", "matched": true, "reason": "..." } ],
  "direction": "implementation_requested|no_action|unavailable",
  "reason": "..."
}
```

Acceptance requires: `implementationRequested`, a specified or existing-standard target, no open design decision, ≥1 matched rule, and no conflicting rules. Ambiguity → `ignore` quietly (never ask a human about routine chatter). Tool/context failure → `unavailable`.

| Strength + assessment | `off` | `observe` | `auto` |
|---|---|---|---|
| `explicit` | Ticket | Ticket | Ticket |
| `inferred`, positive | ignore | `would_accept` (no Ticket) | Ticket |
| `inferred`, negative / ambiguous | ignore | ignore | ignore |
| `not_admitted` | ignore | ignore | ignore |

## 3. Mandate lifecycle

```
accept ──► immutable Mandate ──► live Ticket
                                   │
   policy change ──► notify affected Tickets (does NOT revoke)
                                   │
   ended Ticket + human message ──► revalidate ──► resume (same Mandate id)
                                   │
   person stop ──────────────────► withdraw (terminal)
   failed revalidation ──────────► revoke; messages go back to Eval
```

Revalidation matrix (mirrors upstream `docs/002`):

| `via` | Required to resume |
|---|---|
| `addressed` | Source still listens; actor still allowlisted |
| `followup` | Source still listens; Ticket not stopped by a person |
| `admission` | cell still grants ≥ original strength; membership still holds; `mode=auto`; matched rules still enabled |
| `bot` | bot still listed; `mode=auto`; matched rules still enabled |
| `speculation` | not resumable; a new signal creates a new speculative Ticket |

## 4. Autonomy ladder (adapted from agentic SRE governance)

Every worker artifact declares a `riskClass`:

| Class | Examples | Allowed without approval | Gate |
|---|---|---|---|
| `read-only` | recompute stats, simulate cascade, dependency reachability, control tests | yes | none |
| `reversible-local` | draft patch, provisional VEX, draft gap analysis | yes | logged, reversible |
| `high-impact` | actuate mitigation, publish advisory, sign attestation | **no** | `person/answer` + explicit human approval |
| `forbidden` | delete data, rotate secrets, regional failover, external write | never | hard refusal, watchdog alert |

An approval is a **new, narrow Mandate scope for one action**, not a widening of the original Ticket's authority. It is recorded as a separate non-delegable Channel write with the approver's identity, and it is charged to the attention budget.

## 5. Speculation policy

- Signals are declared per Source pack, not inferred from arbitrary text.
- A speculative Ticket is silent: no ack, no progress, no question.
- Delivery requires `evidence.confidence >= threshold` **and** a domain predicate (e.g., claim falsified, exploit reachable, cascade risk above threshold, control gap found).
- Discarded speculation is counted as `speculativeWaste` (compute cost) and `silenceSavings` (attention saved).
- `maxPerTick` caps background compute so proactivity cannot starve explicit work.
- In `observe` mode, speculative signals produce a `would_speculate` decision only.

> **Implementation note (2026-11-02):** the shipped showcase sets `speculation.showcaseSpeculationInObserve = true` so one `observe` demo can display both promotion and silent discard. With that flag set to `false`, `src/engine.js` records `would_speculate` decisions in `observe` and launches speculative Tickets only in `auto`, exactly as above. See [`../05-delivery/spec-compliance.md`](../05-delivery/spec-compliance.md).

## 6. Attention policy

| Rule | Enforcement |
|---|---|
| Speak only when a person must act or can use a result | `outbox.send` requires a `purpose` and a reason code |
| One acknowledgement per Ticket | `ticket.attention.acks` guard |
| Chat replies ≤ 100 words | hard truncation/refusal in `outbox.js`; structured artifacts carry the detail |
| ≤ 3 outbound messages per tick | `attention.maxMessagesPerTick`; excess waits as pending receipts |
| A healthy state takes no space | UI collapses healthy panels; zero-message ticks are not notifications |
| Honest reporting | drafts marked unfinished; failures reported as failures; no result without evidence |

## 7. Threat model (normative)

| Threat | Control |
|---|---|
| Prompt injection via Trigger text / quoted content | text is data; policy read only from `policy.json`; fixture test asserts no mutation |
| Privilege escalation via follow-up | fast path grants no authority; revalidation on resume |
| Duplicate/replayed events | stable ids + `duplicate` disposition |
| Malicious worker code | only allowlisted pure domain functions are importable; stripped env; no network; timeout |
| Credential leakage | no secrets in runner env, event log, model context or artifacts |
| Runaway speculative compute | `maxPerTick`, slot caps, watchdog |
| Silent objective drift | watchdog checks evidence presence and repeated steps, not just liveness |
| Audit tampering | append-only event log; artifact sha256 recorded in attestation chain |
