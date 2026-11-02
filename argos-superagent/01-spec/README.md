# 01 — Platform specification

These documents are the **contract** between the four mission specs and the implementation in [`03-app/`](../03-app/README.md). They are ordered: each document builds only on the ones before it.

| Doc | Contract it fixes | Implementation owner |
|---|---|---|
| [00 Charter & glossary](00-charter-and-glossary.md) | goals, non-goals, invariants, vocabulary | all |
| [01 Domain model](01-domain-model.md) | record shapes, state machines, ids | `src/engine.js`, `src/util.js` |
| [02 System architecture](02-system-architecture.md) | module boundaries, data flow, ports | `src/*.js`, `src/web/server.js` |
| [03 Policy & authorization](03-policy-authorization.md) | gate, assessment, mandate, revalidation, autonomy tiers | `src/policy.js` |
| [04 Event contracts](04-event-contracts.md) | Source/Trigger/Channel schemas for all four packs | `src/domains/*.js` |
| [05 Worker execution & evidence](05-worker-execution-and-evidence.md) | sandbox, artifacts, confidence, approvals | `src/workers.js`, `src/worker/runner.js` |
| [06 Attention & communication](06-attention-and-communication.md) | outbox, word cap, silence, attention accounting | `src/outbox.js`, `src/metrics.js` |
| [07 Observability & UI](07-observability-ui.md) | dashboard layout, controls, API | `src/web/` |
| [08 Evaluation & benchmarks](08-evaluation-benchmarks.md) | metrics, baseline, acceptance thresholds | `src/simulation.js`, `src/metrics.js` |
| [09 Phases & definition of done](09-phases-and-definition-of-done.md) | phase gates, exit criteria | [`CHECKLIST.md`](CHECKLIST.md) |
| [CHECKLIST.md](CHECKLIST.md) | master per-phase tracker | whole programme |

## Non-negotiable invariants (copied into tests)

1. **The Router never executes.** No worker function is reachable from the Router code path.
2. **Workers never write to a Channel.** Only `outbox.send()` called by the Router can create a reply.
3. **Trigger text is data.** No policy, rule, allowlist, mandate or tool permission can be changed by event content.
4. **Proactive work starts in `observe`.** No speculative or inferred ticket launches until the operator switches to `auto`. The literal rule is implemented and asserted with `showcaseSpeculationInObserve: false`; the shipped demo sets the explicitly declared flag to `true` for a single-run demonstration only.
5. **A Mandate is immutable.** Policy changes invalidate in-flight Evals and require revalidation on resume; they never silently widen live authority.
6. **Every delivered result has an evidence artifact.** No prose-only completion.
7. **High-impact actions require a human approval**, recorded as a separate non-delegable Channel write.
8. **Chat replies ≤ 100 words**; one acknowledgement per Ticket; healthy state produces no message.
9. **Every state change is an append-only event**, replayable from `data/eventlog.jsonl`.
10. **Zero credentials in the default run**: no network calls, no secrets in worker environments or model context.

## Shared configuration file

`03-app/policy.json` is the versioned constitution (analogous to `program.md` in `autoresearch` and to upstream prompt versions). It contains: accept mode, rules, allowlists, bot lists, speculation thresholds, worker concurrency, autonomy ladder, attention limits. Its hash is the Policy version recorded on every Mandate.

## Conformance status

The resolved [`../05-delivery/spec-compliance.md`](../05-delivery/spec-compliance.md) has 0 open items against documents 00–09. Real credentialed deployment controls are deliberately outside this specification and are planned in [`../05-delivery/production-hardening.md`](../05-delivery/production-hardening.md).

## Cross-reference to upstream

| ARGOS-4 spec | Upstream counterpart |
|---|---|
| 01 Domain model | `docs/001-domain.md`, `src/core/model.ts` |
| 02 Architecture | `docs/007-architecture.md`, `src/core/engine.ts` |
| 03 Policy | `docs/002-authorization.md`, `src/policy.ts`, `prompts/admission.md` |
| 04 Events | `docs/008-cookbook.md`, `src/sources/kind.ts` |
| 05 Execution | `docs/003-execution.md`, `src/executor/dsh.ts` |
| 06 Attention | `docs/000-philosophy.md`, `docs/004-prompts.md`, `src/app/outbox.ts` |
| 07 UI | `docs/005-panel.md`, `src/client/` |
| 08 Evaluation | essay §7 (not in prototype) |
