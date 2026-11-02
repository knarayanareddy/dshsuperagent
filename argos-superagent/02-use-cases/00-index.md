# 02 — Use-case index

> **Status 2026-11-02:** all four missions are specified, implemented, tested and showcased. Every folder below has P0–P7 ticked in its `CHECKLIST.md`; the master tracker is [`../CHECKLISTS.md`](../CHECKLISTS.md).

Four mission folders, one Engine. Each folder is self-contained: README, `spec/01`–`04`, `demo-script.md` and `CHECKLIST.md` with P0–P7 phase gates.

| Mission | Folder | Novel move | Primary artifact | Approval needed |
| --- | --- | --- | --- | --- |
| Autonomous replication / AI-science lab | [`science-replication-lab/`](science-replication-lab/README.md) | Speculative falsification. | `evidence.json` + `seed-runs.csv` | no |
| Self-healing infrastructure digital twin | [`self-healing-infrastructure/`](self-healing-infrastructure/README.md) | The Mandate is the simulation/actuation boundary. | `mitigations.json` + `risk.json` | **yes** (actuation) |
| Open-source supply-chain immune system | [`supply-chain-immune-system/`](supply-chain-immune-system/README.md) | Speculative exploitability reproduction. | `vex.json` + `attestation.json` | no (draft patch only) |
| Living regulatory / audit agent | [`living-compliance/`](living-compliance/README.md) | The Mandate becomes an auditable authorization object. | `control-matrix.csv` + `attestation.json` | **yes** (sign-off) |

## Why four

They are deliberately *different environments*: claim+dataset, telemetry+topology, dependency graph+advisory, regulation+control set. If the same Trigger → Thread → Eval → Mandate → Ticket → Evidence → Outbox contract holds across all four without a single domain conditional in `engine.js`, the portability claim is demonstrated rather than asserted. Scoring of all 16 candidate use cases: [`../00-research/03-use-case-landscape.md`](../00-research/03-use-case-landscape.md).

## Reading order per mission

1. `README.md` — problem, why now, what you'll see.
2. `spec/01-mission-and-scope.md` — goals, non-goals, invariants, upstream mapping.
3. `spec/02-event-catalog-and-policy.md` — Sources, rules, event templates, fixtures.
4. `spec/03-worker-playbook-and-evidence.md` — stages, artifacts, confidence, approval.
5. `spec/04-novelty-risks-and-related-work.md` — claims, related work, risks, limitations.
6. `demo-script.md` — timed tour.
7. `CHECKLIST.md` — P0–P7 gates.

## Shared vs mission-specific

| Shared (in `../01-spec/`) | Mission-specific (in each folder) |
|---|---|
| domain model, state machines, policy engine, outbox, attention, watchdog, benchmark, UI | Source ids, actors, rules, event catalog, playbook stages, evidence schema, risk register, demo beats |

## Adding a fifth mission

Follow [`../01-spec/04-event-contracts.md`](../01-spec/04-event-contracts.md#7-adding-a-fifth-source-pack-checklist). No Engine edits are allowed.
