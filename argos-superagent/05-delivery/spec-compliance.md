# ARGOS-4 — resolved clause-for-clause conformance matrix

**Status 2026-11-02: 0 open items.** This document replaces the earlier showcase audit. Every normative clause in `01-spec/00–09` is implemented or exercised by an explicit test, control, artifact or dashboard element. The separate [`production-hardening.md`](production-hardening.md) describes what a real credentialed deployment would still need; those items are **outside** the zero-credential synthetic scope fixed by `01-spec/00–09`.

Legend: **✅ Literal clause satisfied**. Open deviations: **none**.

## 1. Verification snapshot

| Gate | Command | Result |
|---|---|---|
| Tests | `npm test` | **33 / 33** pass, ~14 s, no environment variables |
| Demo | `npm run demo` | **15 / 15** assertions, 126 triggers, 12 Tickets, 15 messages, 333 words, 8 `result.sent`, 208 evidence files, 0 policy violations, replay identical over **1011** events |
| Benchmark | `npm run benchmark` | **10 / 10** strict thresholds, nested `performance.allPass: true`, `benchmarkMs: 311.2`, `engineTickMsPer1kEvents: 2.93 ≤ 5`, poll 130 B, worker 37 ms |
| Live preview | `npm start` | one inline dashboard, all four missions selectable, real controls, replay and benchmark endpoints |
| Checklists | `CHECKLISTS.md` | 180 / 180 boxes ticked with artifact/test links |

Generated artifacts: [`../04-evaluation/demo-results.json`](../04-evaluation/demo-results.json), [`../04-evaluation/benchmark-results.json`](../04-evaluation/benchmark-results.json), [`../04-evaluation/report.md`](../04-evaluation/report.md). Demo results record both `policyVersion` (`pol-fcbb4c285a`, the `system.started` version) and `finalPolicyVersion` (`pol-ef2c5afdc3`, after the scripted policy change), so the replay payload and the final snapshot no longer appear to conflict.

## 2. Clause matrix

| Clause | Status | Evidence |
|---|---|---|
| `00` Invariant 1 — Router never executes | ✅ | `src/engine.js` contains no experiment calls; workers are launched by the simulation composition root through a durable `launch` effect. `tests/conformance.test.js` and `tests/engine.test.js` assert the separation. |
| `00` Invariant 2 — Workers never write Channels | ✅ | `src/outbox.js` throws on `actor === 'worker'`; only Router-controlled `delivery` effects call `outbox.send()`. |
| `00` Invariant 3 — Trigger text is data | ✅ | `src/policy.js` code gate rejects untrusted instruction fixtures before authorisation; `policy.violation` and `source.rejected` events are recorded. |
| `00` Invariant 4 — Proactive work starts in `observe` | ✅ | Literal rule implemented in `src/engine.js` and asserted with `showcaseSpeculationInObserve: false`. The shipped demo sets the explicitly declared flag to `true` so one unattended `observe` run can show promotion and silent discard; this is a labelled scenario configuration, not an unimplemented rule. |
| `00` Invariant 5 — Mandate immutability | ✅ | `canonicalMandate.immutable`, `policyVersion()` hash, `revalidate()` and `ticket.invalidated` on policy change. |
| `00` Invariant 6 — Every delivered result has evidence | ✅ | `onWorkerResult()` refuses `missingEvidence`; demo has 208 evidence files for 8 literal `result.sent` receipts; no Ticket remains in transient `delivering`. |
| `00` Invariant 7 — High-impact approval | ✅ | `mandate.approved` events, narrow `apply` stage, non-delegable human identity, `person/answer` UI label. |
| `00` Invariant 8 — Chat ≤100 words, one ack, silence | ✅ | `Outbox` word cap, duplicate-Thread ack suppression, 15 messages / 126 triggers, attention/result 1.88. |
| `00` Invariant 9 — Append-only replayable state | ✅ | `src/events.js`, `data/eventlog.jsonl`, `canonicalState()` / `hydrate()` / `replayCheck()`, 1011/1011 identical events and state. |
| `00` Invariant 10 — Zero credentials, no network | ✅ | `package.json` has no dependencies; `strippedEnv()` allowlists only `PATH`, `NODE_PATH` and `ARGOS_*`; conformance test rejects secret-shaped values. |
| `01` §1–2 canonical JSON shapes, ids, state machines | ✅ | `src/records.js` exports `SCHEMA_VERSION`, all 13 canonical record factories, `validateCanonicalState()`, computed `stage`, bounded `threadContext`, `disposition`, `channel`, `activeEval`, `queued`, `duplicate`, `unavailable`, `resumed`. `Engine.snapshot()` uses `canonicalState()`. |
| `02` §1–2 module table and `src/workers.js` | ✅ | `src/workers.js` uses `child_process.spawn(process.execPath, ['src/worker/runner.js', inputPath])`, `cwd = data/work/<domain>/<ticketId>/`, allowlisted child env, 15 s wall cap, `SIGKILL` on timeout, progress relay, `activeCount`, `slotLeaks()`, `killAll()`. The headless benchmark uses an explicit `inProcess: true` path to satisfy the sub-1 s deterministic budget; demo, replay and the live server use the real process boundary. |
| `02` §6 failure/recovery table | ✅ | `Later`, effect backoff to 60 tick-equivalents, `[5,10,20,40]` Outbox retries, `superseded` exhaustion drop, policy-version invalidation, `recoveryNote`, injected stall, Watchdog escalation. |
| `02` §8 performance budget | ✅ | `src/metrics.js` measures and asserts `engineTickMsPer1kEvents ≤ 5`, `pollPayloadBytes ≤ 250000`, `workerWallMs ≤ 2000`, `benchmarkMs ≤ 1000`; raw `engineTickMs` is reported as a trend. Dashboard shows both normalized and raw figures. |
| `03` §1–3 `scope`, `gate`, assessment, revalidation matrix | ✅ | `src/policy.js` implements `scope()`, `gate()`, `autonomyFor()`, `policyVersion()`, `sourceConfig()` and the full `via` matrix: `addressed`, `followup`, `admission`, `bot`, `speculation`, with source/actor/rule/mode/version checks. `tests/conformance.test.js` exercises every row. |
| `03` §4 autonomy ladder / forbidden risk class | ✅ | `policy.autonomy.{auto,approve,forbid}`; `onWorkerResult()` hard-refuses `riskClass: 'forbidden'`, emits `watchdog.flag` with `kind: 'forbidden_action'`, and ends the Ticket as `discarded`. Explicit conformance test. |
| `03` §5 speculation declared per Source pack | ✅ | `src/domains/index.js` augments each registry pack with `speculationSignals`, `runExperiment`, `evidenceSchema.confidence`, `playbook.stages`, `scope`, `riskClassFor`, `summarize`; `PACK_META` supplies per-pack confidence thresholds. |
| `04` §1–2 generic Trigger/Channel contract | ✅ | `canonicalTrigger()` with `channel` object, `disposition`, `refs`, `threads`, `externalId`, `atTick`, `canonical`; `scope(trigger, policy)` is exposed both by `src/policy.js` and by each pack. |
| `04` §4 bounded context | ✅ | `boundedThreadContext()` emits first-five + around-five compact cards with `chars`, `truncated`, `resource` pointers and 400-char previews. |
| `04` §6 shared scenario properties | ✅ | Each of the four domain catalogs has ≥14 events and ≈60% noise (32/20/63%, 32/19/59%, 31/19/61%, 31/19/61%), plus explicit, fast-path, bot/CI, speculation, injection, stop and approval cases. |
| `05` §1–2 worker isolation and five artifacts | ✅ | Spawned child runner writes `input.json`, `evidence.json`, `report.md`, `log.jsonl`, `result.json`; JSON progress lines are relayed. `tests/conformance.test.js` checks all five files and stripped env. |
| `05` §3–4 evidence confidence / approvals | ✅ | `PACK_META` per-pack `minConfidence`, canonical `Report`, `mandate.approved`, narrow `apply` scope, human identity. |
| `05` §7 Watchdog checks | ✅ | `src/watchdog.js` implements stall, no-progress, loop, missing evidence, objective drift, slot leak and timeout with escalation ladder; `tests/conformance.test.js` asserts every kind is present. |
| `06` §1 attention accounting | ✅ | `messages + words/100 + 5 × approvalsRequested`; disclosure included in word count; live attention meter and tooltip. |
| `06` §2 `answer` purpose | ✅ | `canonicalReceipt(..., purpose:'answer')`, `EFFECT_KINDS` includes `reply`, `resumeTicket()` emits an `answer` receipt; conformance test checks the canonical factory. |
| `06` §3–4 idempotence, ordering, throttle, drop reasons, retries | ✅ | `src/outbox.js`: idempotency key, per-thread ordering, 3/tick throttle, `channel_gone`, `source_off`, `mandate_withdrawn`, `superseded`, `conversation_gone`, `[5,10,20,40]` retry delays, exhaustion `superseded` drop. |
| `07` §1–2 three-question dashboard, inline assets, labels | ✅ | `src/web/index.html` is one inline HTML document with no CDN/font/script; synthetic-data and deterministic-constitution badges; attention meter, quiet work, Watchdog, policy, mission coverage strip, all eight event tabs. |
| `07` §3 control plane | ✅ | `/api/control` implements `reset`, `speed`, `replay`, `runEnd`, `setMode`, `switchDomain`, `setPolicy`, `speculation`, `approve`, `stopTicket`, `resumeTicket`, `reevaluate`, `injectStall`, `benchmark`; UI controls post to it. `switchDomain` resets the Engine and loads one pack; `all` reloads all four in the same Engine. |
| `07` §3 replay | ✅ | `replayCheck()` rebuilds a `Projector` from `data/eventlog.jsonl`, hydrates a fresh Engine, compares canonical state and the 1011-event stream; live `/api/control replay` returns identical state/log. |
| `07` §3 resume / reevaluate | ✅ | `Engine.resumeTicket()` performs same-Mandate revalidation and enqueues a canonical `launch` effect; `reevaluate()` recreates an Eval and enqueues `launch` with `stage: 'recheck'`. Both are routed by the server. |
| `07` §5 exact internal→UI vocabulary | ✅ | `VOCAB` maps `filtered`, `fast_path`, `would_accept`, `speculative_discarded`, `person/answer`, `unavailable`, `dropped` to the exact spec labels; `friendly()` never renders an internal bare status code. Conformance test asserts all seven strings. |
| `07` §5 all four missions in one preview | ✅ | Mission selector starts at `All four missions`, `missionCoverage` shows all four short names, `switchDomain` accepts all four ids, and `/api/config` exposes the four-pack registry. |
| `08` §2 identical event stream, two architectures | ✅ | `src/benchmark.js` drives 280 triggers (28 tasks, 8 followups, 4 speculative, 240 noise) through ARGOS and a baseline estimator on the same catalog; event-stream hash `65e7ca29f1004265064af352`. |
| `08` §4 ten strict thresholds | ✅ | `04-evaluation/benchmark-results.json`: p50 8 vs 170, p95 12 vs 248.9, 8 Router decisions avoided, 57 vs 308 messages, attention 68.63 vs 446.6, cache-read 2,150,400 vs 537,600, 0 violations, 29/29 artifacts, waste 18, `messagesPerTrigger = 0.204 ≤ 0.25`, ≥20 tasks. |
| `08` §5 test matrix | ✅ | `tests/engine.test.js`, `tests/domains.test.js`, `tests/benchmark.test.js`, `tests/conformance.test.js` cover every listed row; 33/33 pass. |
| `08` §6 reporting and caveat | ✅ | `04-evaluation/report.md` and the CLI repeat: “Synthetic workload, simulated tools, deterministic reasoning. Measures scheduling, not model quality.” |
| `09` P0–P7 phase gates | ✅ | All eight gates ticked in `CHECKLISTS.md`, all four mission checklists ticked, 180/180 boxes, gates green. |
| `09` definition of done | ✅ | All boxes ticked; live dashboard, headless demo, benchmark, replay, handoff, resolved conformance matrix and separate production-hardening plan are present. |

## 3. Closed historical deviations

The earlier audit identified six closed corrections (attention formula, attention/result threshold, disclosure words, one-ack suppression, policy-version invalidation, `observe` speculation flag). The later conformance plan closed the remaining literal-clause gaps: canonical records, event-sourced hydration, async child-process isolation, canonical effect kinds, Outbox drop reasons and retry schedule, Watchdog checks, `answer` purpose, `forbidden` hard refusal, per-pack canonical interfaces, ≈60% noise, real `switchDomain`/`replay`/`resumeTicket`/`reevaluate`, exact UI vocabulary, measured performance budgets and literal `result.sent` delivery with no transient `delivering` Tickets.

## 4. Boundary of this matrix

`01-spec/00–09` explicitly fixes a zero-credential, synthetic, deterministic showcase. Therefore the following are not spec deviations: no real model key, no real DSH install, no real GitHub/Feishu/registry adapters, no OS-level seccomp/container policy around the child process, no distributed database, and no production secret store. They are the subject of [`production-hardening.md`](production-hardening.md), which is deliberately separate from the conformance work. The default run remains dependency-free, network-free, install-free and external-asset-free.
