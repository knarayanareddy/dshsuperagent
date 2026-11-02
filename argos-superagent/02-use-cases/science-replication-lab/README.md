# Helios Replication Lab — Autonomous replication / AI-science lab

> **Mission folder** · colour `#7c6cff` · Source pack id `science-replication-lab` · SYNTHETIC DEMO DATA
> An always-on, quietly adversarial replication layer for every claim your team discusses.

## Status

P0–P2 complete: research, shared-contract mapping and full specification. P3–P7 tracked in [`CHECKLIST.md`](CHECKLIST.md). Implementation lives in `../../03-app/src/domains/science_replication_lab.js` (registered by ID) and the shared Engine — this folder is the **contract**, not the code.

## The problem

Research teams discuss dozens of claims a week — preprints, internal benchmarks, "this looks 9% better" chat messages. Almost none are independently recomputed, and the ones that are get checked manually weeks later. Fully autonomous "AI Scientist" systems try to do the entire research lifecycle but pay for it: an independent evaluation found 42% of their experiments failed with coding errors and manuscripts contained weak or hallucinated numbers. The missing layer is not another paper generator; it is a narrow, metric-bound, evidence-first replication loop attached to the conversation where claims are made.

## Why now

Karpathy's `autoresearch` showed that one file, one metric and a fixed five-minute budget can produce hundreds of real experiments overnight; Google's ScientistOne added a Chain-of-Evidence audit that binds claims to raw logs; DeepSeek's essay §3.4 describes "silently reproduce and fix" as a speculative policy. Combining the three gives a system whose default output is silence and whose only output is a falsification or a verified result.

## What you will see in the live demo

- **0** — Select **Helios Replication Lab**. Confirm header: SYNTHETIC DEMO DATA, policy `observe`, speculation on. → *Panel is quiet; zero messages.*
- **2** — Watch `claim-42` arrive from the literature feed. → *Eval → `would_accept` in observe mode. Observe ledger +1, no Ticket.*
- **7** — Explicit `@argos replicate claim-42`. → *Ticket + Mandate + one acknowledgement; worker slot 1 starts.*
- **9** — Open the worker tile; watch `load-dataset → recompute → bootstrap → seed-sweep`. → *Progress events are internal — no Channel messages.*
- **12** — Fast-path follow-up about seed sensitivity. → *Event says 'delivered to existing Ticket (no Router decision)'; `routerDecisionsAvoided++`.*
- **15** — Speculative chat claim `looks 9% better`. → *A silent Ticket appears in Quiet Work; no ack, no progress message.*

Full walkthrough: [`demo-script.md`](demo-script.md).

## Folder contents

| File | Contract |
|---|---|
| [`spec/01-mission-and-scope.md`](spec/01-mission-and-scope.md) | problem, goals, non-goals, personas, invariants, upstream mapping |
| [`spec/02-event-catalog-and-policy.md`](spec/02-event-catalog-and-policy.md) | Sources, actors, rules, 13–14 event templates, admission rows, injection/stop fixtures |
| [`spec/03-worker-playbook-and-evidence.md`](spec/03-worker-playbook-and-evidence.md) | stages, artifacts, evidence schema, confidence, risk/approval |
| [`spec/04-novelty-risks-and-related-work.md`](spec/04-novelty-risks-and-related-work.md) | novelty claims, related work, risk register, open questions |
| [`demo-script.md`](demo-script.md) | timed end-to-end tour with expected UI state |
| [`CHECKLIST.md`](CHECKLIST.md) | P0–P7 phase checklists with acceptance evidence |

## Headline metrics

- `messagesSent / triggersIngested ≤ 0.25`
- ≥1 silent speculative discard with **zero** outbound messages
- ≥1 fast-path follow-up with **no** new Decision
- 100% of results backed by `evidence.json`
- `policyViolations == 0`

## Shared contract

This mission does **not** define a new architecture. It specializes [`../../01-spec/`](../../01-spec/README.md): the same Trigger → Thread → Eval → Mandate → Ticket → Assignment → Evidence → Outbox flow, the same Policy versioning, the same attention budget. Switching missions changes only the Source pack. That is the central claim of ARGOS-4.
