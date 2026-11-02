# ARGOS-4 evaluation report

**Generated:** 2026-11-02 from `03-app/` · **Workload:** 280 synthetic triggers (28 tasks, 8 follow-ups, 4 speculative signals, 240 noise signals) across four domains · **Mode:** `auto` · **Event log:** 3,259 events, sha256 `65e7ca29f1004265064af352`.

> **Caveat, repeated deliberately:** synthetic workload, simulated tools, deterministic reasoning. This measures **scheduling**, not model quality, code quality or real-world safety. The DeepSeek design essay's p50 12.4 min vs 20.4 min and p95 15.7 vs 29.5 min come from a different synthetic experiment and are **not** ARGOS-4 results.

## 1. Two architectures, identical event stream

| | ARGOS-4 Router + Workers | Baseline single-session ReAct |
|---|---|---|
| Authority | two-stage code gate + deterministic constitution + immutable Mandate | one neutral-prompt loop |
| Noise | filtered before any Router decision | interrupts in-progress work |
| Follow-ups | subscription pass-through, no fresh Eval | fresh routing decision |
| Concurrency | 4 worker slots + durable effects | strictly serial queue |
| Speculation | silent pre-start, promote on proof / discard otherwise | none |
| Outbound | router-only Outbox, 100-word cap, throttle | every trigger produces a message |

Both are driven by the same `syntheticCatalog()` with the same `atTick`, `effort` and seeded evidence functions. Constants are declared in [`../03-app/benchmark.config.json`](../03-app/benchmark.config.json): `tokensPerCard=640`, `cardsPerDecision=3`, `sessionsAlive=4`, `baselineSessionsAlive=1`, `interruptCost=2`, `maxWorkers=4`, `effort 6–11`, `maxTicks=300`.

## 2. Headline results

| Metric | ARGOS-4 | Baseline | Formula / note |
|---|---:|---:|---|
| **p50 completion (ticks)** | **8** | 170 | ticks from work-request Trigger to `result.sent` |
| **p95 completion (ticks)** | **12** | 248.9 | same, 95th percentile over ≥20 tasks |
| Router decisions | 107 | 280 | `evalBatches + explicitAccepts` vs one decision per trigger |
| Router decisions avoided | **8** | 0 | subscription pass-throughs |
| Messages sent | **57** | 308 | every receipt costs human attention |
| Words sent | **1,163** | 13,860 | chat replies capped at 100 words |
| Attention cost | **68.63** | 446.6 | `messages + words/100 + 5×approvals` |
| Messages / trigger | **0.204** | — | target ≤ 0.25 |
| Cache-read tokens est. | 2,150,400 | **537,600** | honest trade-off: parallelism reads more cached context |
| Speculative waste (ticks) | 18 | 0 | compute spent on discarded speculation |
| Silence savings | 243 | 0 | filtered/ignored/discarded signals with zero messages |
| Speculative promoted / discarded | 1 / 3 | 0 / 0 | promote only on deliverable evidence |
| Tasks completed | 29 | 28 | 28 explicit + 1 promoted speculative |
| Evidence artifacts | 29 `evidence.json` | 28 | `artifactsProduced == tasksCompleted` |
| Policy violations | **0** | 0 | must remain zero |
| Watchdog error flags | 0 | — | no invariant breach in the benchmark run |

### Completion-time chart (lower is better)

<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 210" role="img" aria-label="p50 and p95 completion ticks comparison">
  <style>text{font:12px system-ui,sans-serif;fill:#eaf0ff}.muted{fill:#9aa8c7}.bar-a{fill:#4aa8ff}.bar-b{fill:#6b7899}</style>
  <line x1="150" y1="20" x2="150" y2="190" stroke="#33405f"/>
  <text x="10" y="45" class="muted">ARGOS p50</text><rect x="150" y="32" width="14" height="16" class="bar-a"/><text x="172" y="45">8 ticks</text>
  <text x="10" y="80" class="muted">Baseline p50</text><rect x="150" y="67" width="298" height="16" class="bar-b"/><text x="456" y="80">170 ticks</text>
  <text x="10" y="115" class="muted">ARGOS p95</text><rect x="150" y="102" width="21" height="16" class="bar-a"/><text x="179" y="115">12 ticks</text>
  <text x="10" y="150" class="muted">Baseline p95</text><rect x="150" y="137" width="436" height="16" class="bar-b"/><text x="594" y="150">248.9</text>
  <text x="150" y="185" class="muted">0</text><text x="430" y="185" class="muted">≈175</text><text x="570" y="185" class="muted">≈260 ticks</text>
</svg>

### The honest trade-off

<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 130" role="img" aria-label="attention cost and cache read tokens">
  <style>text{font:12px system-ui,sans-serif;fill:#eaf0ff}.muted{fill:#9aa8c7}.good{fill:#28d19b}.cost{fill:#ff9f43}</style>
  <text x="10" y="30" class="muted">Attention cost</text>
  <text x="150" y="30" class="good">ARGOS 68.6 ███</text><text x="330" y="30" class="cost">Baseline 446.6 ████████████████████</text>
  <text x="10" y="70" class="muted">Cache-read est.</text>
  <text x="150" y="70" class="cost">ARGOS 2,150,400 ████████████████████</text><text x="430" y="70" class="good">Baseline 537,600 █████</text>
  <text x="10" y="105" class="muted">Lower attention, higher cache reads: the Superagent spends compute to save person-time.</text>
</svg>

## 3. Formulas (normative, implemented in `src/metrics.js`)

```
completionTicks(task)        = resultSentTick - ticketCreatedTick
queueDelay(baseline)        = Σ effort of earlier unfinished tasks
interruptionPenalty         = noiseSignalsWhileBusy × interruptCost
routerDecisions(superagent) = evalBatches + explicitAccepts
routerDecisionsAvoided      = pass-through follow-ups with no Eval
cacheReadTokensEst          = Σ triggers × tokensPerCard × cardsPerDecision × sessionsAlive
attentionCost               = messagesSent + wordsSent/100 + 5 × approvalsRequested
speculativeWaste            = Σ effortTicks of discarded speculative tasks
silenceSavings              = ignored + filtered + discarded signals with zero messages
```

No constant is tuned to force a win. The baseline is penalised by serial queueing and noise interruption; ARGOS-4 is penalised by higher cache-read tokens and speculative waste.

## 4. Acceptance assertions — 10 / 10 pass

| Assertion | Result |
|---|---|
| p50 Superagent < p50 baseline | ✅ 8 < 170 |
| p95 Superagent < p95 baseline | ✅ 12 < 248.9 |
| Percentiles from ≥20 tasks | ✅ 29 and 28 |
| `routerDecisionsAvoided > 0` | ✅ 8 |
| `cacheReadTokensEst(superagent) > baseline` | ✅ 2,150,400 > 537,600 |
| `policyViolations == 0` | ✅ 0 |
| `artifactsProduced == tasksCompleted` | ✅ 29 == 29 |
| `speculativeWaste > 0` in `auto` mode | ✅ 18 ticks |
| `messagesSent / triggersIngested ≤ 0.25` | ✅ 0.204 |
| Identical event stream shape | ✅ 280 triggers, 3,259 events, hash `65e7ca29f1004265064af352` |

## 5. Headless four-mission demo

`npm run demo` produced [`demo-results.json`](demo-results.json): **126 triggers**, **12 Tickets**, **15 messages**, **333 words**, **6 would-accept**, **6 fast paths**, **2 speculative promotions**, **3 silent discards**, **208 evidence files**, **0 policy violations**, **12 Watchdog flags**, **8 results delivered**, **attention cost 28.33** and **attention/result 1.88** (spec 06 threshold ≤ 2.0). All four missions produced at least one `done` Ticket with `evidence.json`, `input.json`, `log.jsonl`, `report.md` and `result.json`. Replay of two independent 60-tick runs produced byte-identical 1011-event JSONL logs. All **15 / 15** demo assertions passed.

The live dashboard numbers may differ slightly because the live clock interleaves manual injections, speed changes and human controls. The benchmark is a headless, fixed-seed comparison; the demo is a scripted, observable tour.

## 6. Test matrix

| Test file | Coverage | Result |
|---|---|---|
| [`../03-app/tests/engine.test.js`](../03-app/tests/engine.test.js) | gate strengths, allowlists, injection, observe ledger, fast path, revalidation, Router/Worker separation, Outbox cap/ordering/drops, speculation, Watchdog, Chain of Recall, replay | ✅ |
| [`../03-app/tests/domains.test.js`](../03-app/tests/domains.test.js) | four packs, pure deterministic experiments, worker artifacts, negative/approval cases, four-domain demo + replay | ✅ |
| [`../03-app/tests/benchmark.test.js`](../03-app/tests/benchmark.test.js) | catalog determinism, baseline estimator, all ten acceptance thresholds | ✅ |
| [`../03-app/tests/conformance.test.js`](../03-app/tests/conformance.test.js) | canonical records, revalidation matrix, subprocess isolation, UI vocabulary, replay, performance budgets, zero credentials | ✅ |

`npm test`: **33 / 33** subtests pass with no environment variables. [`../CHECKLISTS.md`](../CHECKLISTS.md): **180 / 180** phase boxes ticked.

## 7. What this does not prove

- It does not prove that an LLM would make the same authorization decisions; the default adapter is deterministic.
- It does not prove that the four domain experiments model real datasets, power grids, package registries or legal obligations. All data is synthetic and pinned.
- It does not prove production security: the default worker has a real OS process boundary, an allowlisted env and a 15 s cap, but no seccomp/container isolation. See [`../05-delivery/handoff.md`](../05-delivery/handoff.md) and [`../05-delivery/production-hardening.md`](../05-delivery/production-hardening.md).
- It does not reproduce DeepSeek's essay benchmark; it re-runs the *shape* of that experiment on ARGOS-4's own event streams with declared formulas.
