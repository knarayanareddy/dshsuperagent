# 03 — Worker playbook and evidence · Helios Replication Lab

## 1. Execution environment

One workdir per Ticket: `../../03-app/data/work/science-replication-lab/<ticketId>/`. The runner is spawned with `cwd` set to that directory, a stripped environment (no secrets, no `HOME`, no cloud credentials), no network, a subprocess timeout, and permission to import only pure functions from `src/domains/experiments.js`. This directly addresses the upstream disclaimer that wrappers are "defaults, not a security boundary".

## 2. Playbook stages

| Stage | Action | Independent check | Artifacts |
| --- | --- | --- | --- |
| `load-dataset` | Read pinned synthetic dataset (seeded by claim id + version); verify checksum and n. | checksum match, n ≥ 200 | `input.json`, `dataset-summary.json` |
| `recompute` | Compute baseline mean, treatment mean, absolute and relative effect. | analytic effect finite, no NaN | `stats.json` |
| `bootstrap` | 2,000 resamples for a 95% CI on the effect; approximate two-sided p. | CI finite; independent re-run identical | `bootstrap.json` |
| `seed-sweep` | Repeat across 12 seeds; compute variance and sign stability. | ≥10/12 seeds agree in sign | `seed-runs.csv` |
| `verdict` | Compare effect to claimed effect and tolerance; decide `reproduced`, `falsified`, `material-delta`. | three independent checks agree | `evidence.json`, `report.md`, `result.json` |
| `recheck` (fast path) | Re-enter with a follow-up Input and a wider seed sweep; preserve prior artifacts. | same input hash except stage | amended `evidence.json` |

Progress events stream to the dashboard but **never** to a Channel. A fast-path follow-up re-enters as `recheck`/`apply` with an amended `input.json`, preserving prior artifacts.

## 3. Mandatory artifacts

| File | Purpose |
|---|---|
| `input.json` | `science-replication-lab` ticket/trigger/mandate/thread context/stage/seed/policyVersion — replay input |
| `evidence.json` | machine-checkable schema below |
| `report.md` | Problem → method → result → validation → limitations → evidence links → confidence |
| `log.jsonl` | one line per step with step hash (loop detection) |
| `result.json` | `science-replication-lab` state, summary, confidence, riskClass, needsApproval, evidenceRefs |

Domain extras: see the stage table above.

## 4. Evidence schema

| Field | Meaning |
| --- | --- |
| `claimId`, `datasetVersion`, `seed`, `n` | reproducibility identity |
| `baselineMean`, `treatmentMean`, `effect`, `effectRel` | measured result |
| `ciLow`, `ciHigh`, `pApprox` | uncertainty |
| `seedRuns[]` (12) | stability |
| `claimedEffect`, `tolerance`, `delta` | claim comparison |
| `reproduced`, `verdict`, `confidence` | machine-checkable decision |
| `checks` (analytic/bootstrap/seed/replay) | independent-check agreement |

## 5. Confidence

`0.4·dataCompleteness + 0.3·checkAgreement + 0.2·effectMagnitude + 0.1·replayStability`; min 0.65 to report `ready`.

A `ready` Report below `evidenceSchema.minConfidence` is rejected as `blocked`. Speculative promotion additionally requires `policy.speculation.confidenceThreshold` (default 0.72).

## 6. Delivery predicate

Deliver when `!reproduced` **or** `|delta| > tolerance`. Speculative claim-77 is designed to reproduce → **silent discard**; claim-42 is designed to fail → **promoted result**.

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
