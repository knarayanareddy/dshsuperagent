# 06 — Attention, communication and the Outbox

> Upstream principle, verbatim: *"Take as little human attention as possible, and give as much value as possible."* This document turns it into code.

## 1. The attention model

Every outbound Channel write costs attention:

```
attentionCost(receipt) = 1                       // base interruption
                       + words / 100             // reading cost, chat only
                       + (purpose === "attention" ? 2 : 0)   // decision required
                       + (approval ? 3 : 0)      // non-delegable human decision
```

The system tracks, per tick and per run:

| Metric | Meaning |
|---|---|
| `messagesSent` | outbound Channel writes |
| `wordsSent` | reading cost |
| `approvalsRequested` | decisions demanded of people |
| `acksSent` | must equal ≤1 per Ticket |
| `noiseFiltered` | Triggers dropped by the code gate |
| `silenceSavings` | speculative discards + positive results that were deliberately not announced |
| `attentionPerUsefulResult` | `messagesSent / resultsDelivered` — the headline number |
| `speculativeWaste` | compute spent on discarded speculation (the honest cost of proactivity) |

A healthy run has a low attention-per-useful-result ratio and a high silence-savings count. The dashboard shows both, because proactivity that never shuts up is a failure even if its results are correct.

## 2. When the system may speak

| Purpose | Allowed trigger | Cap | Example |
|---|---|---|---|
| `acknowledgement` | once, after a Ticket is created for an explicit request | 100 words, one sentence | "Replicating claim-42 against dataset v2; I'll report only if it fails." |
| `result` | worker reported `ready` with evidence, or speculative promotion | 100 words + resource pointer | "Claim-42 did not replicate: effect 3.1% vs 12% claimed (95% CI 1.8–4.4). Evidence: `/evidence/T-…`" |
| `attention` | one concrete question, or a high-impact approval | 100 words, structured | "Approve mitigation `shed-load-sector-3`? Blast radius: 1,200 households; rollback: automatic in 2 ticks." |
| `answer` | a person asked a direct question on a Ticket's own Thread | 100 words | a short factual answer |

**Never** speak for: filtered noise, `observe` decisions, speculative discards, worker progress, routine bot/CI signals, internal watchdog flags (these go to the panel, not the Channel), or "thanks"/"ok" follow-ups.

## 3. Channel bandwidth (essay §4.2, upstream prompts)

| Channel kind | Convention |
|---|---|
| `chat` | one sentence, ≤100 words, minimal interruption, no reasoning trace, no tool-call dump |
| `document` | structured, high density: problem → method → result → validation → limitations → evidence links. Stored as `report.md`; the Channel message is a short pointer |

Workers' reasoning and tool calls stay inside their workdir logs. The Router is the only author of Channel messages. This avoids "several sessions replying independently" confusion.

## 4. Outbox semantics

- `outbox.send()` is called **only** by the Router, in the same transaction as the Decision/Report that justifies it. An assertion rejects any call whose `actor` is a worker.
- Receipts are ordered per `(ticketId, threadKey)`: a later message waits while an earlier one is pending, unless the earlier one has failed three times.
- `send` is idempotent on `receipt.id`.
- `dropped` receipts retain `{at, reason}` and are never re-queued; reasons: `channel_gone`, `source_off`, `mandate_withdrawn`, `superseded`.
- Retries: 5 → 10 → 20 → 40 tick-equivalents (doubling to a cap), matching upstream's 5s→300s pattern.
- `maxMessagesPerTick` throttles bursts; excess receipts stay pending rather than spamming.

## 5. Silence as a feature

| Situation | Behaviour | Counted as |
|---|---|---|
| `observe` positive assessment | record `would_accept`, no Ticket, no message | `observeLedger` |
| Speculative work that finds nothing actionable | end Ticket `dropped`, no message | `silenceSavings++`, `speculativeWaste++` |
| Noise filtered by gate | record disposition with reason code | `noiseFiltered++` |
| Fast-path follow-up handled by the owning worker | no new Eval, no ack | `routerDecisionsAvoided++` |
| Watchdog flag below escalation threshold | panel only | no Channel cost |

The UI has a dedicated **"Quiet work"** strip showing how much work happened without interrupting anyone.

## 6. Honesty requirements

| Rule | Enforcement |
|---|---|
| A draft is marked unfinished | `result.state = "blocked"` for incomplete evidence |
| A failure is a failure | `Report(failed)` → `attention` purpose, never `result` |
| A limit is never bypassed | forbidden actions end Ticket with reason |
| No invented evidence | `Engine.report` validates artifact paths and sha256 before accepting `ready` |
| No duplicate announcements | one `result` per Ticket; `ticket.attention` guard |
| Disclosure | every Chat message begins "ARGOS automated agent — not a human" (configurable, mirrors upstream's Communication section) |

## 7. Attention acceptance thresholds (demo)

| Condition | Threshold |
|---|---|
| `acksSent / ticketsCreated` | ≤ 1.0 |
| `messagesSent / triggersIngested` | ≤ 0.25 in `auto` mode |
| `attentionPerUsefulResult` | ≤ 2.0 |
| Chat word limit | never exceeded (hard assertion) |
| Speculative discards with any outbound message | 0 |
| Watchdog flags posted to a Channel | 0 |
