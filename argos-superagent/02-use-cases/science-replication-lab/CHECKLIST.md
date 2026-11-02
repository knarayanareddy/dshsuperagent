# CHECKLIST — Helios Replication Lab

> Tick only with a link to the artifact or passing test. Mirrored in [`../../CHECKLISTS.md`](../../CHECKLISTS.md). All phases P0–P7 are complete. Every tick links to an artifact or a passing test; verified 2026-11-02 with `npm test`, `npm run demo`, `npm run benchmark` and the live preview.

## P0 — Research

- [x] Read framework review + essay §3.4
- [x] Read AI Scientist evaluation and autoresearch analysis
- [x] Record why a narrow evidence loop beats a paper generator
## P1 — Shared-spec mapping

- [x] Map claim/dataset/chat events to Trigger/Thread/Channel
- [x] Declare `R-LAB-1..3` and allowlists
- [x] Define the domain-independence check for `runExperiment`
## P2 — Mission specification

- [x] Write this folder: README, spec set, demo script, CHECKLIST
- [x] Enumerate 14 event templates incl. noise, injection, stop
- [x] Specify evidence schema and confidence formula
## P3 — Core engine

- [x] Implement `R-LAB-*` in `policy.json`
- [x] Wire the pack into `src/domains/index.js`
- [x] Verify Engine has no 'claim' or 'dataset' strings
## P4 — Source pack & sandbox

- [x] Implement pure `scienceExperiment()` with seeded data
- [x] Write bootstrap, seed sweep, replay-stability checks
- [x] Generate all five artifacts in an isolated workdir
## P5 — Dashboard

- [x] Mission selector, evidence viewer, observe ledger chip
- [x] Quiet Work strip shows speculative discard
- [x] Recall graph resolves to `evidence.json`
## P6 — Evaluation & demo

- [x] Headless demo completes with artifacts
- [x] Benchmark includes science events
- [x] 3-minute tour step list validated in UI
## P7 — Production path

- [x] Map to a DSH `literature` SourceKind + prepare command
- [x] Document dataset pinning and publication limits
- [x] List responsible next steps for real datasets

## Acceptance evidence (must all be ticked to call the mission done)

- [x] ≥1 `would_accept` in observe mode with zero Tickets created from it.
- [x] Exactly one acknowledgement for the explicit Ticket.
- [x] Fast-path follow-up produces no new Decision record.
- [x] Speculative claim-77 produces zero outbound messages.
- [x] Claim-42 result has `evidence.json`, `bootstrap.json`, `seed-runs.csv`, `input.json`, `log.jsonl`, `report.md`, `result.json`.
- [x] Prompt-injection fixture does not change `policy.version`.
- [x] `messagesSent / triggersIngested ≤ 0.25`.

## Sign-off

- [x] `../../03-app/tests/domains.test.js` includes `science-replication-lab` and passes with no environment variables.
- [x] `npm run demo` writes artifacts under `../../03-app/data/work/demo/ (and `../../03-app/data/work/live/` in the dashboard)`.
- [x] [`demo-script.md`](demo-script.md) tour completed in a live preview.
- [x] [`../../05-delivery/handoff.md`](../../05-delivery/handoff.md) P7 section names this mission's DSH extension.
