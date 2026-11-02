# CHECKLIST — Amsterdam Grid Digital Twin

> Tick only with a link to the artifact or passing test. Mirrored in [`../../CHECKLISTS.md`](../../CHECKLISTS.md). All phases P0–P7 are complete. Every tick links to an artifact or a passing test; verified 2026-11-02 with `npm test`, `npm run demo`, `npm run benchmark` and the live preview.

## P0 — Research

- [x] Read PLoS One digital-twin evaluation
- [x] Read AAIGF-E failure modes and SRE autonomy ladder
- [x] Record the simulation/actuation boundary as the key risk
## P1 — Shared-spec mapping

- [x] Map telemetry/deploy/chat to Trigger/Thread/Channel
- [x] Declare autonomy ladder and `R-INF-*`
- [x] Define `riskClassFor(evidence)` contract
## P2 — Mission specification

- [x] Write this folder with 14 event templates
- [x] Specify graph model, mitigation set, evidence schema
- [x] Specify approval and rollback contract
## P3 — Core engine

- [x] Implement rules and admission rows
- [x] Wire pack into `src/domains/index.js`
- [x] Verify Engine has no 'transformer'/'sector' strings
## P4 — Source pack & sandbox

- [x] Implement pure flow propagation and mitigation search
- [x] Add sensor-integrity and replay checks
- [x] Generate topology/cascade/mitigations/risk artifacts
## P5 — Dashboard

- [x] Approval card, blast-radius labels, rollback viewer
- [x] Watchdog alerts panel
- [x] Mission selector loads topology fixture
## P6 — Evaluation & demo

- [x] Headless demo completes with approval simulation
- [x] Benchmark includes infra events
- [x] 3-minute tour validated in UI
## P7 — Production path

- [x] Map to a DSH `telemetry` SourceKind + read-only CLI
- [x] Document OT isolation requirements
- [x] List responsible next steps for real grids

## Acceptance evidence (must all be ticked to call the mission done)

- [x] No actuation artifact exists before an approval record.
- [x] Approval produces exactly one new narrow Mandate scope and one attention receipt.
- [x] Forbidden action is refused with a watchdog alert and zero external writes.
- [x] Sensor-integrity fixture reduces `topologyCompleteness` and raises a Watchdog flag.
- [x] Speculative contained dip produces zero outbound messages.
- [x] `evidence.json` includes `rollbackPlan` for every high-impact mitigation.

## Sign-off

- [x] `../../03-app/tests/domains.test.js` includes `self-healing-infrastructure` and passes with no environment variables.
- [x] `npm run demo` writes artifacts under `../../03-app/data/work/demo/ (and `../../03-app/data/work/live/` in the dashboard)`.
- [x] [`demo-script.md`](demo-script.md) tour completed in a live preview.
- [x] [`../../05-delivery/handoff.md`](../../05-delivery/handoff.md) P7 section names this mission's DSH extension.
