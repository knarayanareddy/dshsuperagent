# Immune System — Open-source supply-chain immune system

> **Mission folder** · colour `#ff9f43` · Source pack id `supply-chain-immune-system` · SYNTHETIC DEMO DATA
> From static SBOM–CVE matching to execution-bound, proof-carrying 'not affected' statements.

## Status

P0–P2 complete: research, shared-contract mapping and full specification. P3–P7 tracked in [`CHECKLIST.md`](CHECKLIST.md). Implementation lives in `../../03-app/src/domains/supply_chain_immune_system.js` (registered by ID) and the shared Engine — this folder is the **contract**, not the code.

## The problem

Static SBOM matching produces a flood of alerts for vulnerable packages that are installed but never reachable. 2026 research on execution-bound exploitability reports F1 0.93 vs 0.78 for static matching and 37–42% fewer false positives when runtime activation evidence, KEV/EPSS signals and deterministic replay are combined. Meanwhile agent runtimes add a new *semantic* supply chain: skills and prompts can themselves carry injection payloads, and agent frameworks have accumulated CVEs of their own. What teams need is not more alerts but a continuously regenerated, signed answer to 'are we actually affected, and can you prove it?'

## Why now

The AIBOM / CSAF-VEX work extends SBOMs into active provenance artifacts with signed, replayable advisories. DeepSeek's speculative execution gives a natural pattern: reproduce an advisory in the background before anyone asks, then stay quiet if the activation path is unreachable. Upstream's GitHub Source and `git worktree` execution model is the closest domain to this mission, making it the best bridge back to a real DSH deployment.

## What you will see in the live demo

- **0** — Select **Immune System**; inspect the VEX + attestation artifact list in the spec card. → *Policy shows `patch-prod` on the approve ladder.*
- **2** — Advisory GHSA-2026-4412 arrives. → *`would_accept` in observe mode; no Ticket.*
- **8** — Explicit `@argos verify advisory`. → *Ticket + ack; worker resolves the dependency graph.*
- **12** — Fast-path follow-up adds the worker service. → *No new Eval; `dependencyPath` for worker appears.*
- **15** — Speculative 'we might be affected'. → *Silent Ticket; reachable path → promoted with `vex.json` + `patch.diff`.*
- **22** — Injection fixture asks for a push to main. → *Policy unchanged; `external-write` forbidden; alert only.*

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
