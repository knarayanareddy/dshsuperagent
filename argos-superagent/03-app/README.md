# ARGOS-4 application

Zero-credential, dependency-free ESM implementation of the Superagent coordination contract. Node 20+. No `npm install`, no model key, no GitHub account, no DSH install, no external network calls in the default run.

## Run it

```bash
npm start          # http://0.0.0.0:3000 — live dashboard, 1 tick / 900 ms at 1×
npm test           # 33 subtests: engine, domains, benchmark, conformance
npm run demo       # headless 60-tick four-mission demo + replay check
npm run benchmark  # 300-tick two-architecture comparison
```

`npm start` binds `0.0.0.0` so the Arena live preview can proxy it. Override the port with `PORT=8080 npm start`. The dashboard is a single inline HTML file: no CDN, fonts, external CSS or scripts.

## Module map

| File | Responsibility |
|---|---|
| `src/engine.js` | Sole writer of domain state. Router/Eval, Tickets, Mandates, subscriptions, speculation. **No domain conditionals.** |
| `src/policy.js` | Two-stage gate + deterministic constitution, policy-version hashing, autonomy ladder, revalidation. |
| `src/model.js` | Deterministic `assess()`; optional `narrate()` prose seam via `ARGOS_LLM_URL` / `ARGOS_LLM_KEY`. Decisions never depend on an LLM. |
| `src/records.js` | Canonical record factories, state validator, computed stages, bounded context. |
| `src/projection.js` | Canonical projection, hydrate-from-log, O(records) indexes. |
| `src/events.js` | Append-only JSONL `EventStore`; replay cursor. |
| `src/effects.js` | Durable side-effect queue with `Later` deferral and retry/backoff. |
| `src/outbox.js` | Router-only receipts; idempotence, 100-word chat cap, per-thread ordering, throttle. |
| `src/memory.js` | Inline & Spill compact cards + Chain-of-Recall BFS expansion. |
| `src/metrics.js` | Attention, compute, cache-read and completion accounting. |
| `src/watchdog.js` | External semantic checker; deduplicated findings appended by the composition root. |
| `src/simulation.js` | Composition root: wires the Engine to the clock and filesystem, executes effects. |
| `src/domains/index.js` | Source-pack registry. Adding a fifth pack requires **no Engine change**. |
| `src/domains/*.js` | Four event catalogs, rules, playbooks, evidence schemas. |
| `src/domains/experiments.js` | Pure deterministic domain computations; no I/O, no Engine imports. |
| `src/workers.js` | Slot pool: `child_process.spawn`, stripped env, 15 s cap, timeout kill. |
| `src/worker/runner.js` | Spawned child worker: validates evidence and writes artifacts. |
| `src/web/server.js` | HTTP + JSON API; live tick loop; benchmark/replay endpoints. |
| `src/web/index.html` | Three-question dashboard, controls, recall SVG, artifact viewer, benchmark chart. |
| `src/cli.js` | `demo`, `benchmark`, `serve` entry points. |
| `policy.json` | Versioned constitution: sources, rules, autonomy, attention, speculation, watchdog. |
| `benchmark.config.json` | Declared workload constants; no tuned-to-win magic numbers. |

## Literal conformance + production hardening

The resolved clause matrix is [`../05-delivery/spec-compliance.md`](../05-delivery/spec-compliance.md) (0 open items). The default run stays zero-credential; real deployment controls are a separate [`../05-delivery/production-hardening.md`](../05-delivery/production-hardening.md).

## Ten invariants enforced in code

1. The Router never executes a domain experiment.
2. Workers never write to Channels; `Outbox.send()` asserts `actor === 'router'`.
3. Trigger text is data, never authority.
4. Proactive work starts in `observe`; `auto` only accepts matched-rule inferred work.
5. Mandates are immutable and policy-version bound.
6. Every result has an `evidence.json` artifact with a confidence score.
7. High-impact actions require a recorded human approval.
8. Chat replies are capped at 100 words.
9. Every state change is an append-only event; replay reproduces an identical log.
10. The default run needs zero credentials and makes zero external network calls.

## Worker artifacts

Each Ticket writes into `data/work/<ticket-id>/`:

- `input.json` — frozen trigger, mandate, thread context, stage and policy version
- `evidence.json` — machine-checkable evidence envelope with sha256
- `log.jsonl` — deterministic playbook step log
- `report.md` — human-readable finding with provenance and the synthetic-data disclaimer
- `result.json` — router-facing result envelope
- domain-specific files: `bootstrap.json`, `seed-runs.csv`, `topology.json`, `cascade.json`, `mitigations.json`, `vex.json`, `patch.diff`, `attestation.json`, `control-matrix.csv`, `gaps.json`, etc.

The live and headless runs also maintain canonical `data/eventlog.jsonl` (append-only replay log) and `data/state.json` (reconstructible projection snapshot) per spec 02 §7 and invariant 9. The headless demo additionally keeps its own log at `data/work/demo/events.jsonl`.

`policy.json` contains one **demo-only** switch: `speculation.showcaseSpeculationInObserve`. It is `true` here so a single `observe` run can show speculative promotion and silent discard. Set it to `false` to enforce invariant 4 literally: speculation then records `would_speculate` decisions until the operator switches to `auto`.

## HTTP API

| Route | Returns |
|---|---|
| `GET /` | inline dashboard |
| `GET /api/state?since=<seq>` | full projection + events since cursor |
| `GET /api/snapshot` | same projection without the cursor |
| `GET /api/events?since=<seq>` | event tail and latest seq |
| `GET /api/recall?id=<ref>&hops=<n>` | Chain-of-Recall nodes/edges |
| `GET /api/artifact?ticket=<id>&file=<name>` or `?path=<rel>` | workdir-scoped artifact text |
| `GET /api/checklists` | parsed checkbox counts from the docs |
| `GET /api/config` | packs, policy version, benchmark config |
| `GET /api/health` | liveness, tick, speed, pause state |
| `GET /api/benchmark` | saved benchmark results |
| `POST /api/benchmark` | run the two-architecture benchmark |
| `POST /api/control` | `pause`, `resume`, `speed`, `reset`, `replay`, `runEnd`, `setMode`, `setPolicy`, `speculation`, `approve`, `deny`, `stopTicket`, `injectStall`, `switchDomain`, `reevaluate` |
| `POST /api/inject` | custom Trigger through the real code gate |
| `POST /api/demo/run` | reset and run the 60-tick script headlessly |
| `POST /api/replay` | deterministic replay check |

## Optional LLM adapter

Set `ARGOS_LLM_URL` (OpenAI-compatible `/chat/completions`), `ARGOS_LLM_KEY` and optionally `ARGOS_LLM_MODEL`. Only `narrate()` uses it to rewrite a result sentence; every authorization, evidence, artifact and delivery decision remains deterministic. No credentials are read in the default run.

## Benchmark caveat

`npm run benchmark` compares scheduling on a **synthetic** 280-trigger workload with simulated tools and deterministic reasoning. It does **not** measure model quality, code quality or real-world safety. See [`../04-evaluation/report.md`](../04-evaluation/report.md).
