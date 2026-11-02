# Amsterdam Grid Digital Twin — Self-healing infrastructure digital twin

> **Mission folder** · colour `#20c9a6` · Source pack id `self-healing-infrastructure` · SYNTHETIC DEMO DATA
> Speculative cascade simulation, parallel mitigation search, and a hard line between simulating and actuating.

## Status

P0–P2 complete: research, shared-contract mapping and full specification. P3–P7 tracked in [`CHECKLIST.md`](CHECKLIST.md). Implementation lives in `../../03-app/src/domains/self_healing_infrastructure.js` (registered by ID) and the shared Engine — this folder is the **contract**, not the code.

## The problem

Operators of coupled infrastructure do not lack alerts — they lack *safe, timely, accountable intervention*. An anomaly on one transformer can cascade through a graph of loads that nobody has in their head. 2026 agentic-SRE practice has converged on a hard rule: agents investigate autonomously, but any action with a large or irreversible blast radius stays human-approved. Grid-sector governance research explicitly models the failure mode of an agent that misreads an investigation mandate as authorization to actuate OT configuration. The hard problem is therefore not detection; it is proving, in simulation, that a proposed mitigation is worth one human decision.

## Why now

A 2026 PLoS One agentic digital-twin study reports (in synthetic evaluation) mean detection latency 3,197s vs 39,374s rule-based, mitigation success 66.2% vs 45.5%, and operator workload reduction 91.7%, attributing gains mainly to multi-agent orchestration. EPRI and National Grid ESO pilots use digital twins to simulate cascading failures without touching live systems. DeepSeek's speculative execution pattern lets that simulation start while humans are still discussing the alert.

## What you will see in the live demo

- **0** — Select **Amsterdam Grid Digital Twin**; note the autonomy ladder in the Policy card. → *`approve` contains `actuate`, `forbid` contains `regional-failover`.*
- **5** — Threshold breach from telemetry. → *`would_accept` in observe mode; no Ticket.*
- **8** — Explicit `@argos assess cascade risk`. → *Ticket + ack; worker loads topology.*
- **12** — Fast-path follow-up adds the canal pump load. → *No new Eval; worker re-runs with amended input.*
- **15** — Speculative voltage-dip signal. → *Silent simulation; contained cascade → discard with zero messages.*
- **18** — Implausible sensor reading. → *Watchdog flag (panel only, no Channel message).*

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
