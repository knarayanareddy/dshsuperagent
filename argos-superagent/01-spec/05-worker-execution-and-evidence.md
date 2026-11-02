# 05 — Worker execution, sandbox and evidence

## 1. Worker lifecycle

```
Effect(launch) ──► slot reservation ──► mkdir workdir ──► write input.json
   ──► spawn `node src/worker/runner.js` (cwd = workdir, env stripped)
   ──► progress events (internal only) ──► artifacts ──► result.json
   ──► Engine.report ──► Router reply / approval / silent discard ──► slot free
```

Each Ticket has exactly one workdir: `03-app/data/work/<domain>/<ticketId>/`. A retry or restart reuses the same directory and adds a `recoveryNote`. Fast-path follow-ups re-run the playbook with an amended `input.json` (stage `recheck`), preserving prior artifacts.

## 2. Sandbox contract

| Control | Implementation |
|---|---|
| Filesystem | runner's `cwd` is the Ticket workdir; it writes only there; artifacts are read back by path allowlist |
| Environment | child env is rebuilt from an allowlist (`PATH`, `NODE_PATH`, `ARGOS_*` non-secret flags only). No `*_KEY`, `*_TOKEN`, `*_SECRET`, `HOME`, cloud credentials |
| Code | runner imports **only** pure functions from `src/domains/experiments.js`; no `eval`, no dynamic import from event data, no shell |
| Network | none; the deterministic default makes zero outbound calls |
| Time | subprocess timeout (`workers.timeoutTicks` in simulation time, 15 s wall cap); killed on timeout |
| Output | 4 mandatory files; extra domain files allowed; all JSON parsed with a schema |
| Replay | `input.json` + `policy.json` version + domain id + seed are sufficient to reproduce byte-identical evidence |

This is a deliberate improvement on the upstream prototype, whose own `docs/003` and `docs/006` state that command wrappers and directories are "defaults, not a security boundary" and that workers run `danger-full-access` as the operator's OS user.

## 3. Mandatory artifacts

| File | Schema | Purpose |
|---|---|---|
| `input.json` | `{ticketId, domain, trigger, mandate, threadContext, stage, seed, policyVersion}` | reproducibility |
| `evidence.json` | domain-specific schema (see [`04-event-contracts.md`](04-event-contracts.md)) | machine-checkable result |
| `report.md` | Problem → method → result → limitations → evidence refs → confidence | human-readable structured delivery |
| `log.jsonl` | `{step, at, note, hash}` per step | progress, loop detection, audit |
| `result.json` | `{state, summary, confidence, riskClass, needsApproval, evidenceRefs, artifacts}` | Engine's Report source |

Optional: `patch.diff`, `vex.json`, `attestation.json`, `control-matrix.csv`, `topology.json`, `seed-runs.csv`, `replication-chart.svg`.

## 4. Confidence

`confidence ∈ [0,1]` is computed by the domain's pure function, not by prose. Required components:

```
confidence = 0.4 * dataCompleteness
           + 0.3 * checkAgreement        // independent checks that agree
           + 0.2 * effectMagnitude       // signal vs noise
           + 0.1 * replayStability       // deterministic re-run identical
```

A report with `confidence < evidenceSchema.minConfidence` is `blocked`, never `ready`. Speculative promotion uses `policy.speculation.confidenceThreshold` (default 0.72) **and** the domain delivery predicate.

## 5. Risk classification and approvals

| `riskClass` | Derived from | Effect |
|---|---|---|
| `read-only` | playbook only computed | automatic result |
| `reversible-local` | produced a draft artifact that can be discarded | automatic result, logged |
| `high-impact` | `mitigation.blastRadius`, `patch.target=prod`, `attestation.final=true` | Ticket → `person/answer`; one `attention` Receipt with one concrete question; worker waits |
| `forbidden` | action in `policy.autonomy.forbid` | hard refusal + watchdog alert; Ticket ends `dropped` |

On approval: the Router writes a new narrow Mandate scope `{action, ticketId, approver, tick}` and enqueues an `apply` effect; the runner re-enters with `stage:"apply"`, writes final artifacts, and reports `ready`. On denial: Ticket ends `stopped` with a single short message. Approvals are counted as attention events.

## 6. Domain playbooks (normative stages)

| Domain | Stages | Independent checks | Primary evidence |
|---|---|---|---|
| Science | load → recompute → bootstrap → seed sweep → verdict | analytic effect vs bootstrap CI vs seed variance | `reproduced`, `delta`, `seedRuns` |
| Infrastructure | topology → baseline → failure injection → mitigation search → risk | flow conservation, rollback feasibility, blast radius | `servedDemandBefore/After`, `cascadeDepth` |
| Supply chain | SBOM → graph → reachability → exploit test → patch → VEX → attest | graph resolution vs runtime activation vs patch test | `activationPathFound`, `vexStatus`, `attestationSha` |
| Compliance | obligations → mapping → control tests → gaps → provisional attestation → sign | control test vs telemetry vs policy version | `gaps`, `drift`, `attestationSha`, `signOff` |

Every playbook has a **negative case** (claim reproduces → speculative discard; vulnerability unreachable → `not_affected`; cascade contained → no actuation; controls pass → no gap) so silence is demonstrable, not theoretical.

## 7. Watchdog checks on workers

| Check | Condition | Escalation |
|---|---|---|
| Stall | no progress event for `stallTicks` | flag → retry → stop + attention |
| Loop | same step hash ≥ `loopThreshold` | flag → retry → stop + attention |
| Missing evidence | `result.json` exists without required artifacts | reject report, `blocked` |
| Objective drift | report references a different `threadKey`/`mandateId` than its assignment | stop + alert |
| Slot leak | running Assignment with no live process | free slot, mark `failed` |
| Timeout | wall time exceeded | kill + `failed` |

## 8. Honest delivery rules (from upstream `docs/004`)

- Opening a draft is not readiness: `report.md` labels unfinished work explicitly.
- A failure is reported as a failure; a limit is never bypassed to avoid asking.
- A UI/visual or design change without a settled target stops with a question — encoded as `designDecisionOpen` in assessment.
- Duplicate human work wins: if a Ticket's evidence matches an existing human artifact, the worker closes its own Ticket with one sentence pointing to theirs.
- One concrete question at a time, in a structured form, at the original conversation.
