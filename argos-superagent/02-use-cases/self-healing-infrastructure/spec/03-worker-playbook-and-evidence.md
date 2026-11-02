# 03 — Worker playbook and evidence · Amsterdam Grid Digital Twin

## 1. Execution environment

One workdir per Ticket: `../../03-app/data/work/self-healing-infrastructure/<ticketId>/`. The runner is spawned with `cwd` set to that directory, a stripped environment (no secrets, no `HOME`, no cloud credentials), no network, a subprocess timeout, and permission to import only pure functions from `src/domains/experiments.js`. This directly addresses the upstream disclaimer that wrappers are "defaults, not a security boundary".

## 2. Playbook stages

| Stage | Action | Independent check | Artifacts |
| --- | --- | --- | --- |
| `load-topology` | Load an 8-node synthetic graph (capacities, edges, loads) from the snapshot; compute topology hash. | graph connected, hash stable | `topology.json` |
| `baseline-flow` | Compute served demand and reserve margin before failure. | flow conservation within 1e-6 | `baseline.json` |
| `failure-injection` | Derate T-7 and propagate overload along edges; record cascade depth and affected nodes. | no NaN; deterministic propagation | `cascade.json` |
| `mitigation-search` | Evaluate reroute / add-reserve / shed-load with the same propagation model. | each result reproducible from input | `mitigations.json` |
| `risk-classify` | Map recommendation to `reversible-local` or `high-impact` using blast radius and rollback feasibility. | rollback plan present for high-impact | `risk.json` |
| `stage-approval` | If high-impact, write a staged plan and stop with one concrete question. | no actuation performed | `approval-request.json` |
| `apply` (post-approval) | Re-run with the approved action, write final evidence and rollback steps. | approval scope matches action id | `evidence.json`, `report.md`, `result.json` |

Progress events stream to the dashboard but **never** to a Channel. A fast-path follow-up re-enters as `recheck`/`apply` with an amended `input.json`, preserving prior artifacts.

## 3. Mandatory artifacts

| File | Purpose |
|---|---|
| `input.json` | `self-healing-infrastructure` ticket/trigger/mandate/thread context/stage/seed/policyVersion — replay input |
| `evidence.json` | machine-checkable schema below |
| `report.md` | Problem → method → result → validation → limitations → evidence links → confidence |
| `log.jsonl` | one line per step with step hash (loop detection) |
| `result.json` | `self-healing-infrastructure` state, summary, confidence, riskClass, needsApproval, evidenceRefs |

Domain extras: see the stage table above.

## 4. Evidence schema

| Field | Meaning |
| --- | --- |
| `topologyHash`, `snapshot`, `seed` | reproducibility identity |
| `servedDemandBefore`, `servedDemandAfter`, `reserveMargin` | operational outcome |
| `cascadeDepth`, `affectedNodes[]` | blast radius |
| `mitigations[]` `{name, gain, reversible, blastRadius, rollbackPlan}` | comparable options |
| `recommended`, `riskClass`, `confidence` | machine-checkable decision |
| `approvalScope` (nullable) | non-delegable grant |

## 5. Confidence

`0.35·topologyCompleteness + 0.3·flowConservation + 0.25·mitigationAgreement + 0.1·replayStability`; min 0.70 for a recommendation that asks for approval.

A `ready` Report below `evidenceSchema.minConfidence` is rejected as `blocked`. Speculative promotion additionally requires `policy.speculation.confidenceThreshold` (default 0.72).

## 6. Delivery predicate

Deliver a recommendation only if `cascadeDepth ≥ 2` or `servedDemandAfter < 0.85·before`. A contained speculative dip → **silent discard**. A high-impact mitigation → **one approval question** before any actuation.

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
