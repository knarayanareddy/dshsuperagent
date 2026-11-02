# ARGOS-4 — master phase checklists

> **Verified 2026-11-02. 180 / 180 boxes ticked.** A tick is allowed only when it links to an artifact or a passing test; no phase is marked done on prose alone. This file mirrors the five phase checklists below. The ticks certify the **showcase scope and literal clause-for-clause conformance**; the resolved matrix [`05-delivery/spec-compliance.md`](05-delivery/spec-compliance.md) has **0 open items**, and [`05-delivery/production-hardening.md`](05-delivery/production-hardening.md) is the separate real-deployment roadmap.

## Gate rule

| Phase | Exit criterion | Evidence | Status |
|---|---|---|---|
| **P0 — Research & review** | Upstream clone read; essay, ≥10 comparable systems, ≥12 scored use cases, bibliography | [`00-research/`](00-research/01-framework-review.md) · [`05-sources.md`](00-research/05-sources.md) | ✅ |
| **P1 — Shared specification** | Charter, domain model, architecture, policy, event contracts, worker/evidence, attention, UI, benchmarks, phase gates | [`01-spec/00`](01-spec/00-charter-and-glossary.md) → [`09`](01-spec/09-phases-and-definition-of-done.md) | ✅ |
| **P2 — Per-domain specification** | Four mission folders with README, four specs, demo script and phase checklist + comparison index | [`02-use-cases/00-index.md`](02-use-cases/00-index.md) | ✅ |
| **P3 — Core engine** | Router/Worker separation, append-only events, durable effects, outbox, memory, metrics, watchdog, deterministic model | [`03-app/src/engine.js`](03-app/src/engine.js) · [`tests/engine.test.js`](03-app/tests/engine.test.js) | ✅ |
| **P4 — Domain packs & sandbox** | Four Source packs, pure experiments, isolated runner, `evidence.json` / `input.json` / `log.jsonl` / `report.md` / `result.json` per task | [`03-app/src/domains/`](03-app/src/domains/index.js) · [`tests/domains.test.js`](03-app/tests/domains.test.js) | ✅ |
| **P5 — Dashboard & API** | Live server on `0.0.0.0`, three-question UI, inline single-file HTML, recall graph, artifact viewer, benchmark chart, honesty labels | [`03-app/src/web/server.js`](03-app/src/web/server.js) · [`index.html`](03-app/src/web/index.html) | ✅ |
| **P6 — Evaluation & demo** | `npm test`, `npm run demo`, `npm run benchmark` all green; results and report written | [`04-evaluation/`](04-evaluation/README.md) · [`demo-results.json`](04-evaluation/demo-results.json) · [`benchmark-results.json`](04-evaluation/benchmark-results.json) | ✅ |
| **P7 — Production path & handoff** | DSH concept mapping, security gap register, fifth-Source recipe, limitations, responsible next steps | [`05-delivery/handoff.md`](05-delivery/handoff.md) · [`production-hardening.md`](05-delivery/production-hardening.md) · [`demo-script.md`](05-delivery/demo-script.md) · [`deck.html`](05-delivery/deck.html) | ✅ |

## Per-folder checklists

| Checklist | Boxes | Phase coverage |
|---|---:|---|
| [`01-spec/CHECKLIST.md`](01-spec/CHECKLIST.md) | 43 / 43 | Platform P0–P7 |
| [`02-use-cases/science-replication-lab/CHECKLIST.md`](02-use-cases/science-replication-lab/CHECKLIST.md) | 35 / 35 | Mission P0–P7 + acceptance evidence |
| [`02-use-cases/self-healing-infrastructure/CHECKLIST.md`](02-use-cases/self-healing-infrastructure/CHECKLIST.md) | 34 / 34 | Mission P0–P7 + acceptance evidence |
| [`02-use-cases/supply-chain-immune-system/CHECKLIST.md`](02-use-cases/supply-chain-immune-system/CHECKLIST.md) | 34 / 34 | Mission P0–P7 + acceptance evidence |
| [`02-use-cases/living-compliance/CHECKLIST.md`](02-use-cases/living-compliance/CHECKLIST.md) | 34 / 34 | Mission P0–P7 + acceptance evidence |
| **Total** | **180 / 180** | |

## Verification commands

```bash
cd 03-app
npm test          # 33 / 33 passing, no environment variables
npm run demo      # four missions, replay identical, all 15 demo assertions pass
npm run benchmark # 10 / 10 acceptance thresholds pass
npm start         # live dashboard on http://0.0.0.0:3000
```

### Headline results

- `npm test`: **33 / 33** subtests pass across `engine.test.js`, `domains.test.js`, `benchmark.test.js`.
- `npm run demo`: **126 triggers**, **12 Tickets**, **15 messages**, **333 words**, **6 would-accept**, **6 fast paths**, **2 speculative promotions**, **3 silent discards**, **208 evidence files**, **0 policy violations**, **attention/result 1.88 ≤ 2.0**, replay **identical** (1011 events). All four missions produce `done` Tickets with `evidence.json`.
- `npm run benchmark`: ARGOS-4 p50 **8** vs baseline **170** ticks; p95 **12** vs **248.9**; messages **57** vs **308**; attention cost **68.63** vs **446.6**; cache-read estimate **2,150,400** vs **537,600** (the honest parallelism cost); **0** policy violations; `artifactsProduced == tasksCompleted == 29`; `messagesPerTrigger = 0.204 ≤ 0.25`.
- Replay: two independent runs of the same catalog + policy + controls produce byte-identical JSONL event logs.

- Performance budgets: `engineTickMsPer1kEvents 2.93 ≤ 5`, poll payload 130 B, worker 37 ms, `benchmarkMs 311.2 ≤ 1000`, nested `performance.allPass: true`; demo `noTransientDelivering: true` with 8 literal `result.sent` receipts.

## Honesty caveats

- The workload is **synthetic**, tools are **simulated**, and reasoning is a **deterministic constitution**, not an LLM. The benchmark measures scheduling, not model quality. See [`04-evaluation/report.md`](04-evaluation/report.md).
- The live dashboard numbers can differ slightly from the headless benchmark because the live clock interleaves manual injections and human controls.
- ARGOS-4 is **not** a DSH plugin, does not require a model key, GitHub agent account, Feishu, or DSH install, and never contacts external systems in the default run. Production migration gaps are listed in [`05-delivery/handoff.md`](05-delivery/handoff.md) and [`05-delivery/production-hardening.md`](05-delivery/production-hardening.md).
