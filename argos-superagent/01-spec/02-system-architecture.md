# 02 — System architecture

## 1. Layered view

```
┌───────────────────────────────────────────────────────────────────────────┐
│ BROWSER (live preview, no external assets)                                │
│  single inline HTML/CSS/JS dashboard: control bar, 3-question layout,    │
│  event stream, ticket board, worker detail, recall graph, metrics        │
└───────────────────────────────┬───────────────────────────────────────────┘
                                │ /api/state, /api/control, /api/recall
┌───────────────────────────────▼───────────────────────────────────────────┐
│ HTTP / control plane (src/web/server.js)                                  │
│  same-origin, JSON body limit, command validation, read models            │
└───────────────────────────────┬───────────────────────────────────────────┘
                                │
┌───────────────────────────────▼───────────────────────────────────────────┐
│ SIMULATION (src/simulation.js)                                            │
│  virtual clock, scenario scheduler, event injection, pause, replay,       │
│  benchmark driver                                                         │
└──────┬──────────────────────────────────────────────────────┬─────────────┘
       │                                                       │
┌──────▼───────────────────────────────────────┐    ┌─────────▼──────────────┐
│ ENGINE (src/engine.js) — only domain writer   │    │ WATCHDOG               │
│  Intake · Evals · Tickets · Assignments ·     │◄───┤ (src/watchdog.js)      │
│  Replies, exposed via role-specific ports     │    │ external control loop  │
└──────┬───────────┬────────────┬──────────────┘    └────────────────────────┘
       │           │            │
   ┌───▼───┐  ┌────▼────┐  ┌────▼─────┐
   │POLICY │  │ EFFECTS │  │ OUTBOX   │  ← one writer per state kind
   └───┬───┘  └────┬────┘  └────┬─────┘
       │           │            │
   ┌───▼───────────▼────────────▼───────────────────────────────────────┐
   │ EVENT STORE (src/events.js) — append-only eventlog.jsonl             │
   │ + MEMORY GRAPH (src/memory.js) — refs for Chain of Recall            │
   │ + METRICS (src/metrics.js) — attention, tokens, p50/p95              │
   └───────────────────────┬─────────────────────────────────────────────┘
                           │
   ┌───────────────────────▼─────────────────────────────────────────────┐
   │ WORKER POOL (src/workers.js)                                         │
   │  slots, spawn, timeout, progress, isolation                          │
   └───────────────────────┬─────────────────────────────────────────────┘
                           │ child_process.spawn(node runner.js)
   ┌───────────────────────▼─────────────────────────────────────────────┐
   │ SANDBOX per Ticket: data/work/<domain>/<ticket>/                     │
   │  input.json · evidence.json · report.md · log.jsonl · result.json     │
   │  (+ patch.diff / vex.json / attestation.json / control-matrix.csv)    │
   │  stripped env, no credentials, allowlisted domain functions only      │
   └─────────────────────────────────────────────────────────────────────┘
```

## 2. Module contract table

| Module | Owns | May call | Must not |
|---|---|---|---|
| `util.js` | ids, hash, word count, seeded RNG, cloning | stdlib only | import any other module |
| `events.js` | append-only log, seq, replay | `util` | mutate domain state |
| `model.js` | deterministic assessor + optional LLM adapter | `util`, `fetch` only when configured | read/write Engine state |
| `policy.js` | gate, assessment outcome, mandate revalidation, version | `util`, `model` | create Tickets |
| `memory.js` | preview cards, reference graph, hop expansion | `util` | write domain records |
| `outbox.js` | receipts, ordering, word cap, send/drop | `util`, `events` | be called by workers |
| `effects.js` | durable queue, backoff, `Later`, concurrency | `util` | execute domain logic |
| `engine.js` | all domain records + role ports | all of the above | know any domain vocabulary; execute subprocesses; send replies directly |
| `workers.js` | slot pool, spawn, kill, progress parsing | `events`, `util`, `fs`, `child_process` | call `outbox.send` or mutate Engine records directly |
| `watchdog.js` | semantic checks, escalation | read-only Engine view + `engine.escalate()` | create Tickets |
| `metrics.js` | counters, percentiles, token estimates, benchmark comparison | `util` | mutate domain state |
| `simulation.js` | clock, scenario schedule, inject, pause, replay, benchmark | `engine`, `domains`, `metrics`, `events` | contain domain-specific logic |
| `domains/*.js` | Source packs + pure deterministic experiments | `util` only (pure) | import Engine, fs, network |
| `worker/runner.js` | sandbox entry: read input, run experiment, write artifacts | `domains`, `fs`, `util` | access any path outside its workdir; read env secrets |
| `web/server.js` | HTTP, static dashboard, control commands | `simulation`, `engine` (read), `memory` | bypass control validation |
| `cli.js` | headless runs | `simulation` | start a browser |

## 3. Sequence: explicit request (slow path)

1. `Simulation` emits a Trigger at its scheduled tick.
2. `Engine.receive` → idempotence check → scope check → store → append to Thread(s) → fan-out to subscriptions (none yet) → enqueue Eval.
3. `Engine.evaluateDue` batches queued triggers (Router batching metric).
4. `Policy.gate` returns `explicit`; `Model.assess` is skipped for explicit strengths.
5. `Engine.decide` records Decision, creates Mandate + Ticket + Subscription + pending Assignment + acknowledgement Receipt, all in one transaction; `Effects` enqueues `launch`.
6. `Effects` → `Workers.launch` → spawn runner in a fresh workdir.
7. Runner writes progress events; `Workers` relays them as internal events (never Channel messages).
8. Runner writes `result.json`; `Workers` calls `Engine.report`.
9. If `riskClass` requires approval → Ticket enters `person/answer`, Router emits one `attention` Receipt. Otherwise Router emits one `result` Receipt with a resource pointer; Ticket → `person/review` → `ended`.
10. `Outbox` sends receipts in order; `Metrics` charges attention; `EventStore` appends every step.

## 4. Sequence: follow-up (fast path)

1. Trigger on a Thread with an `own` subscription.
2. `Engine.receive` stores it, fans out as an `Input` to the Ticket, **skips Eval entirely**, records `fast_path` in the event log and decrements the "router decisions avoided" counter.
3. Worker receives the Input (re-run stage or hand back if out of scope). A human message on an ended Ticket triggers mandate revalidation then resume with the same Mandate.
4. If hand-back occurs once, the Trigger re-enters Eval with the worker's reason.

## 5. Sequence: speculative signal

1. Trigger matches a `speculationSignal` while `policy.speculation.enabled` and `mode="auto"` (in `observe`, only a `would_speculate` record is written).
2. Engine creates a Ticket with `speculative=true`, `silent=true`, `via="speculation"`; **no acknowledgement, no progress messages**.
3. Worker runs the same playbook, but its `Report` is `speculative_confirmed` or `speculative_discarded` based on `evidence.confidence >= threshold` and a domain predicate (e.g., claim falsified).
4. Confirmed → Router creates one `result` Receipt and the Ticket becomes visible in history. Discarded → Ticket ends with `dropped`, zero outbound messages, `metrics.speculativeWaste++`, `metrics.silenceSavings++`.
5. UI shows both columns: "work done quietly" and "attention saved".

## 6. Failure and recovery

| Failure | Detection | Recovery |
|---|---|---|
| Worker subprocess timeout | `Workers` timer + watchdog | kill, `Report(failed)`, retry effect up to 3 with backoff, then `person/failed` |
| Worker loop (identical step hash ×3) | watchdog | flag → retry → stop + attention |
| Missing evidence artifact after `ready` | `Engine.report` validation | reject report, mark `blocked`, watchdog alert |
| Eval deadline | `Engine.evaluateDue` | requeue twice, then `unavailable` + alert |
| Effect failure | `Effects` | 2s doubling to 60s equivalent; `Later` defers without penalty |
| Channel gone | `Outbox` | `dropped` with reason and retained record |
| Policy version change | `Policy.version` | invalidate in-flight Evals, notify affected Tickets, revalidate on resume |
| Process restart | `EventStore` | replay `eventlog.jsonl`, rebuild state, restart interrupted Assignments with recovery note |
| Prompt injection in Trigger text | gate + test fixture | text stays data; no policy mutation; decision reason `untrusted_content_ignored` |

## 7. Compute / state / environment separation (documented seam)

Upstream essay §5 and `docs/007` treat this as future work. ARGOS-4 implements the *shape*:

- **Compute**: the Engine loop is stateless with respect to the filesystem; state is reconstructible from the event log.
- **State**: `data/state.json` + `data/eventlog.jsonl`; swappable to SQLite/Postgres without changing the Engine.
- **Environment**: each Ticket's workdir is an independent execution environment reached through a narrow runner contract (`input.json` → artifacts). A future DSH deployment would replace the local runner with a worktree/VM daemon; the Engine contract does not change.

Security note: no credentials are ever passed to runners or into model context. This directly addresses the essay's §8.4 warning.

## 8. Performance budget

- Engine tick: < 5 ms for 1,000 events.
- Dashboard poll: 500 ms; payload < 250 KB (cards are Inline & Spill, full artifacts fetched on demand).
- Worker: ≤ 8 steps, ≤ 2 s wall time in the live demo.
- Benchmark: < 1 s headless for 4 domains × 2 architectures.
