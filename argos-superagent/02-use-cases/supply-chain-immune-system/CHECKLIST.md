# CHECKLIST — Immune System

> Tick only with a link to the artifact or passing test. Mirrored in [`../../CHECKLISTS.md`](../../CHECKLISTS.md). All phases P0–P7 are complete. Every tick links to an artifact or a passing test; verified 2026-11-02 with `npm test`, `npm run demo`, `npm run benchmark` and the live preview.

## P0 — Research

- [x] Read AIBOM / CSAF-VEX research
- [x] Read runtime supply-chain threat systematization
- [x] Record static-matching false-positive problem
## P1 — Shared-spec mapping

- [x] Map advisory/SBOM/chat to Trigger/Thread/Channel
- [x] Declare `R-SC-*` and bot list
- [x] Define VEX + attestation contract
## P2 — Mission specification

- [x] Write this folder with 13 event templates
- [x] Specify dependency graph fixture and exploit test
- [x] Specify provenance hash chain
## P3 — Core engine

- [x] Implement rules and admission rows
- [x] Wire pack into `src/domains/index.js`
- [x] Verify Engine has no 'CVE'/'package' strings
## P4 — Source pack & sandbox

- [x] Implement pure graph traversal + exploit test
- [x] Generate patch/vex/attestation artifacts
- [x] Add replay-stability check
## P5 — Dashboard

- [x] Artifact viewer supports diff/JSON/attestation
- [x] Quiet Work shows discarded advisories
- [x] Mission selector loads SBOM fixture
## P6 — Evaluation & demo

- [x] Headless demo completes with VEX artifacts
- [x] Benchmark includes supply-chain events
- [x] 3-minute tour validated in UI
## P7 — Production path

- [x] Map to a DSH `osv` SourceKind + worktree prepare command
- [x] Document real advisory/SBOM integration
- [x] List responsible next steps for signed advisories

## Acceptance evidence (must all be ticked to call the mission done)

- [x] `vexStatus` is derived from `reachability` and `exploit-test`, never from prose.
- [x] Unreachable advisory speculation produces a proactive `not_affected` VEX after proof, not a blind alert.
- [x] `patch.diff` exists but no external write event exists.
- [x] `attestation.json` sha256 chain validates over all listed artifacts.
- [x] Injection fixture does not change `policy.version`.
- [x] Fast-path follow-up produces no new Decision record.

## Sign-off

- [x] `../../03-app/tests/domains.test.js` includes `supply-chain-immune-system` and passes with no environment variables.
- [x] `npm run demo` writes artifacts under `../../03-app/data/work/demo/ (and `../../03-app/data/work/live/` in the dashboard)`.
- [x] [`demo-script.md`](demo-script.md) tour completed in a live preview.
- [x] [`../../05-delivery/handoff.md`](../../05-delivery/handoff.md) P7 section names this mission's DSH extension.
