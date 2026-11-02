# CHECKLIST — Living Audit

> Tick only with a link to the artifact or passing test. Mirrored in [`../../CHECKLISTS.md`](../../CHECKLISTS.md). All phases P0–P7 are complete. Every tick links to an artifact or a passing test; verified 2026-11-02 with `npm test`, `npm run demo`, `npm run benchmark` and the live preview.

## P0 — Research

- [x] Read continuous GRC / AI Act Art.72 sources
- [x] Read agent-governance binding-expectations report
- [x] Record human sign-off as non-delegable
## P1 — Shared-spec mapping

- [x] Map regulation/telemetry/chat to Trigger/Thread/Channel
- [x] Declare `R-CMP-*` and sign-off ladder
- [x] Define policy-version revalidation scenario
## P2 — Mission specification

- [x] Write this folder with 13 event templates
- [x] Specify control matrix, gaps, attestation schema
- [x] Specify limitations and no-interpretation clause
## P3 — Core engine

- [x] Implement rules and admission rows
- [x] Wire pack into `src/domains/index.js`
- [x] Verify Engine has no 'control'/'attestation' strings
## P4 — Source pack & sandbox

- [x] Implement pure control tests + gap analysis
- [x] Generate matrix/attestation artifacts with null signOff
- [x] Add evidence-freshness check
## P5 — Dashboard

- [x] Sign-off approval card and policy-version switch
- [x] Provenance viewer with hash chain
- [x] Mission selector loads obligation fixtures
## P6 — Evaluation & demo

- [x] Headless demo completes with signed attestation
- [x] Benchmark includes compliance events
- [x] 3-minute tour validated in UI
## P7 — Production path

- [x] Map to a DSH `reg-feed` SourceKind + evidence CLI
- [x] Document legal review and retention requirements
- [x] List responsible next steps for real audits

## Acceptance evidence (must all be ticked to call the mission done)

- [x] No `signOff` value exists before a human approval record.
- [x] Policy version change produces an invalidation event and a revalidation record.
- [x] Speculative no-gap analysis produces zero outbound messages.
- [x] `attestation.json` hash chain validates over `control-tests.json` and `gaps.json`.
- [x] Report contains an explicit 'no legal interpretation' limitation.
- [x] Injection fixture does not change `policy.version` or `signOff`.

## Sign-off

- [x] `../../03-app/tests/domains.test.js` includes `living-compliance` and passes with no environment variables.
- [x] `npm run demo` writes artifacts under `../../03-app/data/work/demo/ (and `../../03-app/data/work/live/` in the dashboard)`.
- [x] [`demo-script.md`](demo-script.md) tour completed in a live preview.
- [x] [`../../05-delivery/handoff.md`](../../05-delivery/handoff.md) P7 section names this mission's DSH extension.
