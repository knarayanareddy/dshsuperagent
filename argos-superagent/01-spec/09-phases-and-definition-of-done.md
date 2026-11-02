# 09 — Phases and definition of done

> **Status 2026-11-02: all eight gates P0–P7 passed for the showcase scope and literal clause-for-clause conformance.** See [`../CHECKLISTS.md`](../CHECKLISTS.md) (180/180), [`../04-evaluation/report.md`](../04-evaluation/report.md), [`../05-delivery/handoff.md`](../05-delivery/handoff.md), the resolved matrix [`../05-delivery/spec-compliance.md`](../05-delivery/spec-compliance.md) and the separate [`../05-delivery/production-hardening.md`](../05-delivery/production-hardening.md).

The programme has eight phases. Each of the four mission folders has its own `CHECKLIST.md` that instantiates these phases with domain-specific deliverables; this document is the shared gate definition.

| Phase | Name | Exit criteria | Owner |
|---|---|---|---|
| **P0** | Research & review | framework review, landscape, 16 scored use cases, adaptation matrix, bibliography all written; every external claim has a link | research |
| **P1** | Shared specification | docs 00–09 + master checklist; invariants testable; domain-independence clause signed off | platform |
| **P2** | Per-domain specification | four folders, each with README, spec set, event catalog, evidence schema, novelty/risk note, demo script, per-phase CHECKLIST | each mission |
| **P3** | Core engine | Engine, Policy, Events, Effects, Outbox, Memory, Model, Metrics, Watchdog implemented; `engine.test.js` green; zero domain vocabulary in Engine | platform |
| **P4** | Domain packs & worker sandbox | four Source packs, pure experiments, runner, artifacts, `domains.test.js` green | each mission |
| **P5** | Live dashboard & control API | all controls wired, three-question layout, recall graph, artifact viewer, benchmark chart, synthetic-data labelling; runs at `0.0.0.0` for preview | platform |
| **P6** | Evaluation & demo | benchmark thresholds green, headless demo for all four missions, scripted tour, no credential required | delivery |
| **P7** | Production path & handoff | concept→DSH mapping, security gap list, extension cookbook for a fifth Source, limitations and next steps | delivery |

## Gate rules

1. A phase is **done** only when every checkbox in its section is ticked **and** its acceptance test/script passes.
2. A mission is **done** only when its `CHECKLIST.md` P0–P7 sections are all ticked.
3. A phase cannot be marked done by prose alone; link the artifact or the test output in the checklist line.
4. The resolved conformance matrix has 0 open items; any future change must add its owner and follow-up phase before merge.
5. The master [`CHECKLISTS.md`](../CHECKLISTS.md) mirrors every phase for the whole programme.

## Definition of done for the whole programme

- [x] `cd 03-app && npm test` passes with no environment variables set.
- [x] `npm start` serves a live dashboard with all four missions selectable.
- [x] A first-time viewer can see, in under three minutes: a filtered Trigger, an observe decision, an explicit Ticket, a fast-path follow-up, a real evidence artifact, a speculative discard, an approval, a watchdog alert, a recall chain and a benchmark comparison.
- [x] `npm run demo` completes all four missions headlessly and writes artifacts for each.
- [x] `npm run benchmark` writes `04-evaluation/benchmark-results.json` and all thresholds in [`08`](08-evaluation-benchmarks.md) hold.
- [x] `05-delivery/handoff.md` maps every concept to the real `dsh-superagent` extension path, including upstream's security gaps.
- [x] No prose claims a capability that is not visible in the running app; every simulated element is labelled; the resolved conformance matrix has 0 open items.
- [x] [`../05-delivery/production-hardening.md`](../05-delivery/production-hardening.md) is written as a separate real-deployment roadmap.

## Phase-to-artifact map

| Phase | Artifacts |
|---|---|
| P0 | `00-research/*.md` |
| P1 | `01-spec/*.md`, `01-spec/CHECKLIST.md` |
| P2 | `02-use-cases/<mission>/{README.md,spec/*,demo-script.md,CHECKLIST.md}` |
| P3 | `03-app/src/{engine,policy,events,effects,outbox,memory,model,metrics,watchdog}.js`, `03-app/tests/engine.test.js` |
| P4 | `03-app/src/domains/*.js`, `03-app/src/worker/runner.js`, `03-app/tests/domains.test.js`, `03-app/data/work/**` |
| P5 | `03-app/src/web/*`, `03-app/src/simulation.js`, `03-app/src/cli.js` |
| P6 | `04-evaluation/*`, `05-delivery/demo-script.md`, `05-delivery/deck.html` |
| P7 | `05-delivery/handoff.md`, `05-delivery/production-hardening.md`, `03-app/policy.json` migration notes |
