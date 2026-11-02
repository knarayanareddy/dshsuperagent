# ARGOS-4 handoff — from showcase to the real DSH bundle

**Status:** P7 + literal conformance complete · **Audience:** an engineer who wants to move these four missions onto `deepseek-ai/dsh-superagent-prototype` (or decide not to). **Prerequisite reading:** [`../00-research/01-framework-review.md`](../00-research/01-framework-review.md), [`../01-spec/02-system-architecture.md`](../01-spec/02-system-architecture.md), [`../01-spec/03-policy-authorization.md`](../01-spec/03-policy-authorization.md), [`production-hardening.md`](production-hardening.md).

ARGOS-4 is deliberately **not** a DSH plugin. It is a zero-credential, dependency-free ESM showcase that re-implements the coordination contract so the architecture can be demonstrated end to end in this workspace. This document maps the concepts, names the gaps, and gives a fifth-Source recipe.

## 1. Concept → DSH mapping

| ARGOS-4 | Upstream DSH concept | Migration note |
|---|---|---|
| `Engine` | `Runtime` composition root; `Engine` sole writer split into `Intake`, `Evals`, `Tickets`, `Assignments`, `Replies` | Keep the one-writer-per-state-kind rule; do not let a Worker write state. |
| `EventStore` (JSONL) | SQLite state + append-only event semantics | Replace JSONL with the durable SQLite store; keep the replay cursor and idempotence keys. |
| `Effects` queue | durable `Effects` | Replace the in-memory queue with the durable Effects implementation; preserve `Later` semantics and retry/backoff. |
| `Outbox` | `Outbox` with receipts | Preserve router-only writes, 100-word cap, per-`(ticket,thread)` ordering and throttle. |
| `MemoryGraph` | Inline & Spill / Chain of Recall | Keep compact cards with typed refs; move spilled full text to object storage. |
| `policy.json` | versioned Policy / constitution | Move to the DSH Policy store; keep `policyVersion` hashing and immutable Mandates. |
| two-stage `gate` + `assess` | `Source → Trigger → Thread → Eval → Mandate/Ticket` | Keep text-as-data, allowlists, matched-rule assessment and `off`/`observe`/`auto`. |
| `Source pack` (`src/domains/*.js`) | `SourceKind` + `SourceRegistry` | One pack per `SourceKind`; no Engine conditionals. |
| `executeWorker()` | Executor / Session / workdir per Ticket | Replace the pure experiment with a real Session; keep mandatory artifacts. |
| `Watchdog` | external semantic Watchdog (essay, not in prototype) | Run as a separate service; never let it write domain state directly. |
| `Metrics` | not native in the prototype | Keep attention, cache-read and completion accounting as a first-class concern. |
| `narrate()` optional adapter | BYOM / model slow path | Optional prose only; never used for authorization or evidence. |

## 2. Four mission → SourceKind mapping

| Mission | Sources | Suggested DSH `SourceKind` | Authority posture |
|---|---|---|---|
| Helios Replication Lab | `lab-chat`, `literature-feed`, `dataset-ci` | chat + feed + CI webhook | `observe` default; no external publication |
| Amsterdam Grid Digital Twin | `grid-telemetry`, `ops-chat`, `deploy-ci` | telemetry + chat + CI | `approve` before actuation; `forbid` regional failover |
| Immune System | `advisory-feed`, `sbom-ci`, `sec-chat` | advisory feed + SBOM CI + chat | `approve` before production patch; VEX signing stays human |
| Living Audit | `reg-feed`, `control-telemetry`, `audit-chat` | regulatory feed + control telemetry + chat | `approve` before attestation signature; no legal interpretation |

Every row reuses the same `Engine`. The mission differences are entirely in the pack registry, policy rules, playbooks and evidence schemas.

## 3. What is real in the showcase

- Router/Worker separation, two-stage gate, immutable policy-versioned Mandates, `observe`/`auto`, matched-rule assessment, fast-path subscriptions, batched Evals, durable effects, router-only Outbox, 100-word cap, throttle, Chain of Recall, external Watchdog, attention meter, speculation ledger, canonical `data/eventlog.jsonl` + `data/state.json`, and replay from an append-only log.
- Four executable domain simulations with deterministic seeded evidence, `evidence.json`, `input.json`, `log.jsonl`, `report.md`, `result.json` and domain-specific artifacts.
- A live inline dashboard, a headless demo, a two-architecture benchmark, a resolved clause-for-clause conformance matrix and 33 passing tests.

## 4. Security gap register

| Gap | Showcase mitigation | Production mitigation before any real deployment |
|---|---|---|
| Node version mismatch | Showcase targets Node 20 and has zero dependencies | Upstream requires Node `^22.19.0 \|\| >=24.0.0`; upgrade the runtime and pin it. |
| No seccomp/container isolation | Worker is a spawned child process writing to `data/work/<domain>/<ticketId>/`, with an allowlisted env and 15 s wall cap; this is an OS process boundary, not a hostile-code sandbox | Run each Session in a container/VM with seccomp, no network by default, read-only root FS, CPU/memory/time limits. |
| Both upstream presets default to `danger-full-access` | Showcase never reads credentials or touches external systems | Replace with least-privilege wrappers; treat the operator OS user as untrusted. |
| Prompt injection | Untrusted text is data; unknown actors and injection fixtures are rejected at the code gate | Add content provenance, tool-result sanitisation, per-Source trust labels and adversarial regression tests. |
| Credential exposure | No keys in the default run; optional LLM adapter reads env only for prose | Use a secrets manager, short-lived scoped tokens, egress allowlists, and never pass credentials into a Worker context. |
| Cloud/device trust | N/A — no cloud or local execution environment | Implement the essay's compute/state/environment separation with mutually authenticated channels. |
| Long-term memory / A2A | Compact in-process cards only | Durable memory with retention, consent and cross-agent authentication; unresolved upstream problems. |
| Context boundary | Fixed compact cards and truncated previews | Explicit context budgets, spill encryption, and audit of every expansion hop. |
| Auto-merge / external writes | Forbidden in `policy.json`; no external write event exists in any test | Keep `forbid` and `approve` ladders; require signed human Mandates for publish/patch/actuate. |
| Benchmark realism | Synthetic workload explicitly labelled | Re-run on real event traces before claiming latency or attention savings. |

## 5. Authority and attention rules to preserve verbatim

1. Trigger text never grants authority.
2. Proactive work starts in `observe`; `auto` accepts only matched-rule inferred work. (Showcase caveat: `speculation.showcaseSpeculationInObserve = true` lets speculative signals launch silent Tickets in `observe` so the demo can show promotion/discard without a manual mode switch. Set it to `false` for the production rule; see [`spec-compliance.md`](spec-compliance.md).)
3. Mandates are immutable and bound to a policy hash; a policy change invalidates in-flight work.
4. Ended Tickets require successful revalidation of the same immutable Mandate to resume; speculative Mandates are never resumable.
5. Every result needs `evidence.json` with a confidence score; prose alone is not a result.
6. High-impact actions need a recorded human approval with identity, tick and narrow scope.
7. Chat replies are ≤100 words; one acknowledgement per Ticket; silence is the default.
8. Workers never write Channels; the Router is the only Outbox actor.
9. Every state change is append-only and replayable.
10. Zero credentials in the default run.

## 6. Fifth-Source extension recipe

Adding a fifth mission must not require an `engine.js` change:

1. Create `src/domains/<new>.js` exporting a `pack` object with `id`, `name`, `sources`, `ruleIds`, `playbook`, `evidenceSchema`, `experiment` and `eventCatalog`; `src/domains/index.js` augments it with the canonical `speculationSignals`/`runExperiment`/`confidence`/`scope`/`riskClassFor`/`summarize` interface.
2. Add a pure function to `src/domains/experiments.js` and register it in `EXPERIMENTS`.
3. Register the pack in `src/domains/index.js`.
4. Add its rules and source allowlists to `policy.json` (the policy hash changes automatically).
5. Add `spec/01–04`, `demo-script.md` and `CHECKLIST.md` under `02-use-cases/<new>/`.
6. Add assertions to `tests/domains.test.js`; run `npm test`, `npm run demo`, `npm run benchmark`.
7. Verify with `grep -R "claim\|GHSA\|T-7\|A72" src/engine.js` returns nothing — the Engine must remain domain-agnostic.

The existing [`../01-spec/04-event-contracts.md`](../01-spec/04-event-contracts.md) contains the fifth-pack checklist.

## 7. Limitations and responsible next steps

**Limitations.** All data is synthetic; the domain experiments are deterministic models, not real datasets, grids, registries or legal interpretations. The benchmark measures scheduling on a synthetic workload, not model quality. The live dashboard uses a simulated clock. The optional LLM adapter rewrites prose only and was not exercised in the default run. Replay equality is verified for the deterministic event log, not for wall-clock timing.

**Responsible next steps, in order:**

1. Keep the zero-credential showcase as the reference implementation and regression oracle.
2. Follow [`production-hardening.md`](production-hardening.md): harden the Worker boundary (container/VM sandbox, egress deny, resource caps) before any real tool use.
3. Replace synthetic Source packs with authenticated real Sources, one at a time, starting in `observe`.
4. Re-run the two-architecture benchmark on real traces; publish p50/p95, attention cost and cache-read cost together.
5. Add a human oversight review for every new rule, autonomy-ladder change and approval scope.
6. Only then consider `auto` for low-risk matched-rule work; keep high-impact actions on `approve`.
7. Do not auto-merge, auto-publish, self-sign attestations or actuate a grid without a signed human Mandate.

## 8. Sign-off

- [`../CHECKLISTS.md`](../CHECKLISTS.md): 180 / 180 boxes.
- [`../04-evaluation/report.md`](../04-evaluation/report.md): 10 / 10 benchmark assertions, 15 / 15 demo assertions, 33 / 33 tests.
- [`spec-compliance.md`](spec-compliance.md): 0 open normative items; [`production-hardening.md`](production-hardening.md): separate real-deployment roadmap.
- [`demo-script.md`](demo-script.md) and [`deck.html`](deck.html): the observable tour used for handoff.
- Default run: no DSH install, no GitHub agent account, no Feishu, no model key, no external network calls.
