# 03 — Worker playbook and evidence · Immune System

## 1. Execution environment

One workdir per Ticket: `../../03-app/data/work/supply-chain-immune-system/<ticketId>/`. The runner is spawned with `cwd` set to that directory, a stripped environment (no secrets, no `HOME`, no cloud credentials), no network, a subprocess timeout, and permission to import only pure functions from `src/domains/experiments.js`. This directly addresses the upstream disclaimer that wrappers are "defaults, not a security boundary".

## 2. Playbook stages

| Stage | Action | Independent check | Artifacts |
| --- | --- | --- | --- |
| `load-sbom` | Read the pinned synthetic SBOM and verify its checksum. | hash match, all services present | `sbom.json` |
| `resolve-graph` | Resolve import paths from each service to the vulnerable package. | paths acyclic, deterministic | `dependency-paths.json` |
| `reachability` | Check whether untrusted input reaches the vulnerable function. | two independent graph traversals agree | `reachability.json` |
| `exploit-test` | Run a deterministic exploitability test case on the isolated fixture. | test reproducible; no network | `exploit-test.json` |
| `patch` | Generate a minimal draft patch (safe replacement) and re-run the test. | patched test fails to reproduce | `patch.diff` |
| `vex` | Emit CSAF-VEX-style `affected` / `not_affected` statement with justification. | status consistent with reachability + test | `vex.json` |
| `attest` | Chain artifact hashes with the policy/mandate ids into an attestation. | sha256 chain verifiable | `attestation.json`, `evidence.json`, `report.md`, `result.json` |

Progress events stream to the dashboard but **never** to a Channel. A fast-path follow-up re-enters as `recheck`/`apply` with an amended `input.json`, preserving prior artifacts.

## 3. Mandatory artifacts

| File | Purpose |
|---|---|
| `input.json` | `supply-chain-immune-system` ticket/trigger/mandate/thread context/stage/seed/policyVersion — replay input |
| `evidence.json` | machine-checkable schema below |
| `report.md` | Problem → method → result → validation → limitations → evidence links → confidence |
| `log.jsonl` | one line per step with step hash (loop detection) |
| `result.json` | `supply-chain-immune-system` state, summary, confidence, riskClass, needsApproval, evidenceRefs |

Domain extras: see the stage table above.

## 4. Evidence schema

| Field | Meaning |
| --- | --- |
| `advisoryId`, `package`, `version`, `sbomHash`, `seed` | reproducibility identity |
| `dependencyPath[]`, `activationPathFound` | execution-bound reachability |
| `exploitReproduced`, `testCase`, `patchedTestPassed` | proof |
| `vexStatus`, `justification` | machine-readable answer |
| `patchDiff`, `attestationSha`, `chain[]` | provenance |
| `confidence`, `riskClass` | decision |

## 5. Confidence

`0.35·sbomCompleteness + 0.3·traversalAgreement + 0.25·testReproducibility + 0.1·replayStability`; min 0.72 for a `not_affected` VEX statement.

A `ready` Report below `evidenceSchema.minConfidence` is rejected as `blocked`. Speculative promotion additionally requires `policy.speculation.confidenceThreshold` (default 0.72).

## 6. Delivery predicate

Deliver when `exploitReproduced` is true **or** a human explicitly asked for a VEX statement with `activationPathFound=false` (proof-carrying negative). Speculative unreachable advisories → **silent discard**.

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
