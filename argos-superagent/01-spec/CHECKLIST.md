# Platform CHECKLIST — phases P0–P7

> Tick only with a link to the artifact or the passing test. Mirrored in [`../CHECKLISTS.md`](../CHECKLISTS.md). Each mission folder has its own instantiation.

## P0 — Research & review

- [x] Clone upstream and read README, SETUP, docs 000–008 → `../research/dsh-superagent/`, [`../00-research/01-framework-review.md`](../00-research/01-framework-review.md)
- [x] Read the full design essay translation → [`../00-research/05-sources.md`](../00-research/05-sources.md) P2
- [x] Document what ships vs what is only in the essay → review §4
- [x] Compare ≥10 similar systems across three families → [`../00-research/02-similar-projects.md`](../00-research/02-similar-projects.md)
- [x] Score ≥12 use cases on a fixed rubric; select four → [`../00-research/03-use-case-landscape.md`](../00-research/03-use-case-landscape.md)
- [x] Write feature adaptation matrix incl. rejected adaptations → [`../00-research/04-feature-adaptation-matrix.md`](../00-research/04-feature-adaptation-matrix.md)
- [x] Bibliography with primary/secondary separation → [`../00-research/05-sources.md`](../00-research/05-sources.md)

## P1 — Shared specification

- [x] Charter, goals, non-goals, glossary, invariants → [`00-charter-and-glossary.md`](00-charter-and-glossary.md)
- [x] Domain model with record shapes and state machines → [`01-domain-model.md`](01-domain-model.md)
- [x] Architecture with module contract table and sequences → [`02-system-architecture.md`](02-system-architecture.md)
- [x] Policy, authorization, autonomy ladder, threat model → [`03-policy-authorization.md`](03-policy-authorization.md)
- [x] Event contracts for all four packs + fifth-pack checklist → [`04-event-contracts.md`](04-event-contracts.md)
- [x] Worker sandbox, artifacts, confidence, approvals → [`05-worker-execution-and-evidence.md`](05-worker-execution-and-evidence.md)
- [x] Attention model, outbox, honesty rules → [`06-attention-and-communication.md`](06-attention-and-communication.md)
- [x] UI/API contract → [`07-observability-ui.md`](07-observability-ui.md)
- [x] Benchmark formulas and thresholds → [`08-evaluation-benchmarks.md`](08-evaluation-benchmarks.md)
- [x] Phase gates and definition of done → [`09-phases-and-definition-of-done.md`](09-phases-and-definition-of-done.md)

## P2 — Per-domain specification

- [x] `science-replication-lab` folder complete → [`../02-use-cases/science-replication-lab/CHECKLIST.md`](../02-use-cases/science-replication-lab/CHECKLIST.md)
- [x] `self-healing-infrastructure` folder complete → [`../02-use-cases/self-healing-infrastructure/CHECKLIST.md`](../02-use-cases/self-healing-infrastructure/CHECKLIST.md)
- [x] `supply-chain-immune-system` folder complete → [`../02-use-cases/supply-chain-immune-system/CHECKLIST.md`](../02-use-cases/supply-chain-immune-system/CHECKLIST.md)
- [x] `living-compliance` folder complete → [`../02-use-cases/living-compliance/CHECKLIST.md`](../02-use-cases/living-compliance/CHECKLIST.md)
- [x] Index with comparison table → [`../02-use-cases/00-index.md`](../02-use-cases/00-index.md)

## P3 — Core engine

- [x] `Engine`, `Policy`, `Events`, `Effects`, `Outbox`, `Memory`, `Model`, `Metrics`, `Watchdog` implemented → `../03-app/src/`
- [x] Ten non-negotiable invariants asserted in code → `../03-app/tests/engine.test.js`
- [x] `engine.js` contains no domain vocabulary → grep test
- [x] Replay from event log reproduces identical state → test

## P4 — Domain packs & sandbox

- [x] Four Source packs with event catalogs, rules, playbooks → `../03-app/src/domains/`
- [x] Pure deterministic experiments with independent checks → `../03-app/src/domains/experiments.js`
- [x] Runner with stripped env, workdir isolation, timeout → `../03-app/src/worker/runner.js`
- [x] All four domains produce valid evidence artifacts → `../03-app/tests/domains.test.js`

## P5 — Dashboard & API

- [x] Live server bound to `0.0.0.0`, no external assets → `../03-app/src/web/server.js`
- [x] Three-question layout, all controls wired → `../03-app/src/web/index.html`
- [x] Recall graph, artifact viewer, benchmark chart → `../03-app/src/web/index.html`
- [x] Synthetic-data and deterministic-adapter labelling → UI header

## P6 — Evaluation & demo

- [x] `npm test` green with no env vars → `../03-app/tests/`
- [x] `npm run demo` completes four missions with artifacts → `../03-app/data/work/`
- [x] `npm run benchmark` meets all thresholds → [`../04-evaluation/benchmark-results.json`](../04-evaluation/benchmark-results.json)
- [x] Scripted 3-minute tour → [`../05-delivery/demo-script.md`](../05-delivery/demo-script.md)
- [x] Slide deck → [`../05-delivery/deck.html`](../05-delivery/deck.html)

## P7 — Production path & handoff

- [x] Concept→DSH `SourceKind` mapping → [`../05-delivery/handoff.md`](../05-delivery/handoff.md)
- [x] Security gap register with mitigations → handoff §4
- [x] Fifth-Source extension recipe → handoff §6
- [x] Limitations and responsible-next-steps → handoff §7
