# Living Audit — Living regulatory / audit agent

> **Mission folder** · colour `#4aa8ff` · Source pack id `living-compliance` · SYNTHETIC DEMO DATA
> Audit readiness as a continuously measured property, with a non-delegable human signature.

## Status

P0–P2 complete: research, shared-contract mapping and full specification. P3–P7 tracked in [`CHECKLIST.md`](CHECKLIST.md). Implementation lives in `../../03-app/src/domains/living_compliance.js` (registered by ID) and the shared Engine — this folder is the **contract**, not the code.

## The problem

Compliance was designed for a slower world: controls documented, evidence gathered, risk assessed at fixed points in time. That model assumes systems behave predictably between reviews. 2026 GRC practice is moving to continuous control monitoring, regulatory change mapping and audit evidence generated as a byproduct of governed interactions — but interpretation, risk acceptance and final sign-off remain human responsibilities. The EU AI Act's post-market monitoring expectations make this a live requirement, and 2026 governance guidance is beginning to treat delegation chains and HITL gates as binding controls.

## Why now

Agentic GRC sources report 50–65% reductions in manual evidence collection and 75% reductions in audit preparation time for mature deployments, while consistently warning that agents must not make regulatory interpretations or final sign-offs. DeepSeek's versioned Policy and immutable Mandate are almost purpose-built for this: an attestation can name the exact policy version, matched rule and control set that authorized it.

## What you will see in the live demo

- **0** — Select **Living Audit**; note `sign-attestation` is on the approve ladder. → *Policy card shows `forbid: publish-external`.*
- **2** — Regulatory clarification arrives. → *`would_accept` in observe mode; no Ticket.*
- **7** — Explicit `@argos map change A72`. → *Ticket + ack; worker loads obligations.*
- **12** — Fast-path follow-up adds SOC 2 evidence. → *No new Eval; `control-matrix.csv` gains a row.*
- **15** — Speculative logging-guidance hint. → *Silent gap analysis; no affected controls → discard.*
- **22** — Injection fixture asks the agent to self-sign. → *Policy unchanged; `signOff` remains null.*

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
