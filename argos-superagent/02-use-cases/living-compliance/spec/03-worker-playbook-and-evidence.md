# 03 — Worker playbook and evidence · Living Audit

## 1. Execution environment

One workdir per Ticket: `../../03-app/data/work/living-compliance/<ticketId>/`. The runner is spawned with `cwd` set to that directory, a stripped environment (no secrets, no `HOME`, no cloud credentials), no network, a subprocess timeout, and permission to import only pure functions from `src/domains/experiments.js`. This directly addresses the upstream disclaimer that wrappers are "defaults, not a security boundary".

## 2. Playbook stages

| Stage | Action | Independent check | Artifacts |
| --- | --- | --- | --- |
| `load-obligations` | Load obligation + control set fixtures pinned to a policy version. | version match, no unknown ids | `obligations.json` |
| `map-controls` | Cross-map obligation to ISO 27001 / SOC 2 / internal controls. | every mapping has a source reference | `control-matrix.csv` |
| `run-tests` | Execute deterministic control tests against evidence fixtures. | each test has pass/fail + evidenceRef | `control-tests.json` |
| `gap-analysis` | Compute gaps, severity and required actions; detect drift vs telemetry. | no gap without a failing test | `gaps.json` |
| `provisional-attestation` | Write an unsigned attestation with sha256 chain. | `signOff` must be null | `attestation.json` |
| `sign-approval` | Stage one concrete sign-off question; never self-sign. | no signature present | `approval-request.json`, `evidence.json`, `report.md`, `result.json` |
| `apply` (post-approval) | Record approver identity and tick; re-seal hash chain. | approval scope matches attestation id | final `attestation.json`, `result.json` |

Progress events stream to the dashboard but **never** to a Channel. A fast-path follow-up re-enters as `recheck`/`apply` with an amended `input.json`, preserving prior artifacts.

## 3. Mandatory artifacts

| File | Purpose |
|---|---|
| `input.json` | `living-compliance` ticket/trigger/mandate/thread context/stage/seed/policyVersion — replay input |
| `evidence.json` | machine-checkable schema below |
| `report.md` | Problem → method → result → validation → limitations → evidence links → confidence |
| `log.jsonl` | one line per step with step hash (loop detection) |
| `result.json` | `living-compliance` state, summary, confidence, riskClass, needsApproval, evidenceRefs |

Domain extras: see the stage table above.

## 4. Evidence schema

| Field | Meaning |
| --- | --- |
| `obligationId`, `policyVersion`, `controlSetVersion`, `seed` | reproducibility identity |
| `controls[]` `{id, framework, test, passed, evidenceRef}` | control status |
| `gaps[]` `{controlId, severity, action}` | findings |
| `drift[]` `{control, observed, required}` | continuous monitoring |
| `attestationSha`, `chain[]`, `signOff` | tamper evidence + human signature |
| `confidence`, `riskClass` | decision |

## 5. Confidence

`0.35·controlCoverage + 0.3·testAgreement + 0.25·evidenceFreshness + 0.1·replayStability`; min 0.75 for a provisional attestation.

A `ready` Report below `evidenceSchema.minConfidence` is rejected as `blocked`. Speculative promotion additionally requires `policy.speculation.confidenceThreshold` (default 0.72).

## 6. Delivery predicate

Deliver when `gaps.length > 0` **or** a human explicitly requested an attestation. A speculative hint with no affected controls → **silent discard**. A final signature always requires approval.

## 7. Risk classification and approvals

| `riskClass` | Effect |
|---|---|
| `read-only` | automatic result, no approval |
| `reversible-local` | automatic result, logged and reversible |
| `high-impact` | Ticket → `person/answer`, one `attention` receipt with one concrete question, `apply` only after approval |
| `forbidden` | hard refusal + watchdog alert; Ticket ends `dropped` |

An approval creates a **new narrow Mandate scope for one action** with the approver identity and tick. It is never inherited by later Tickets, and it is charged to the attention budget.

## 8. Negative case (why silence is real)

Every playbook has a case where the correct behaviour is to say nothing: a claim that reproduces, a contained cascade, an unreachable dependency, a control set with no gaps. The demo must show a speculative Ticket ending `dropped` with zero receipts — otherwise "proactivity" is just spam.

## 9. Replay contract

`input.json` + `policy.json` version + domain id + seed must reproduce byte-identical `evidence.json`. The event log records the artifact sha256; the UI's artifact viewer links back to the Trigger and Decision that authorized the work.

## 10. Watchdog checks

Stall (`stallTicks`), repeated step hash (`loopThreshold`), missing artifact after `ready`, objective drift (wrong mandate/thread in report), slot leak and timeout. Escalation: flag → retry → stop + attention. Flags go to the panel, not to a Channel.
