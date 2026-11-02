# 07 — Observability, dashboard and control API

## 1. Three questions, in order (from upstream `docs/005`)

1. **Does anything need me now?** — approvals, questions, failed Tickets, watchdog escalations.
2. **Is the system healthy and doing the right things?** — worker load, effects, outbox, policy mode, observe ledger, attention spend.
3. **What is the history of one piece of work?** — Trigger → Decision → Mandate → Ticket → Assignment → Evidence → Reply, expandable hop by hop.

Healthy state takes no space: panels with nothing to report collapse to a single line.

## 2. Layout

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ ARGOS-4  ● LIVE   [mission ▾] [tick 0000] [speed 1×] [pause] [reset] [replay]  │
│ attention ▓▓▓░░░ 0.18/result   quiet work 7   watchdog 0   policy v-9f3       │
├──────────────────────┬──────────────────────────────────┬──────────────────────┤
│ NEEDS ME NOW         │ EVENT STREAM / TIMELINE           │ TICKETS & WORKERS    │
│ approvals (1)        │ filter chips: all|triggers|eval|  │ board: queued /      │
│ questions (0)        │ fast-path|worker|outbox|watchdog  │ working / person /   │
│ failed (0)           │ each row: seq · tick · source ·   │ ended                │
│ ───────────────────  │ strength · reason codes · ref ids │ click → detail with  │
│ POLICY               ├──────────────────────────────────┤ mandate, inputs,     │
│ mode off/observe/auto│ CHAIN OF RECALL (SVG graph)      │ artifacts, timeline  │
│ speculation on/off   │ click a node → expand refs        │                      │
│ rules / allowlists   ├──────────────────────────────────┤ WORKER SLOTS         │
│ inject event form    │ BENCHMARK (SVG bars) p50/p95,    │ 4 slots, progress    │
│ ───────────────────  │ router decisions, tokens,        │ per worker           │
│ QUIET WORK           │ attention                        │                      │
└──────────────────────┴──────────────────────────────────┴──────────────────────┘
```

Colour language: amber = needs a person; blue = working; green = result; grey = filtered/silent; red = watchdog/failure. Every colour has a text label (no colour-only meaning).

## 3. Controls (all wired to `/api/control`)

| Control | Action | Effect |
|---|---|---|
| Mission selector | `switchDomain` | reset state, load a new Source pack, same Engine |
| Speed 0.5× / 1× / 2× / 4× | `speed` | changes real interval, not simulated semantics |
| Pause / resume | `pause` | sources still record; Evals, launches, deliveries and replies stop (upstream `docs/003`) |
| Reset | `reset` | clears runtime state, keeps event-log snapshot for replay |
| Replay | `replay` | rebuilds state from `eventlog.jsonl` |
| Mode selector | `setPolicy` | new Policy version; invalidates in-flight Evals; notifies affected Tickets |
| Speculation toggle | `setPolicy` | new Policy version |
| Inject event | `inject` | choose a catalog event or write custom text; goes through the real gate |
| Approve / deny | `approve` / `deny` | creates narrow Mandate scope or stops Ticket |
| Stop / resume / re-evaluate | `stopTicket` / `resumeTicket` / `reevaluate` | mandate semantics |
| Inject stall | `injectStall` | stops a worker's progress for watchdog demonstration (demo-only, clearly labelled) |
| Run benchmark | `benchmark` | headless two-architecture comparison, results in right panel |
| Recall | `/api/recall?id=&hops=` | expands reference graph |
| Artifact viewer | `/api/artifact?...` | shows `evidence.json` / `report.md` / `patch.diff` |

Demo-only controls are visually badged **"simulation"** so nobody mistakes them for production actuation.

## 4. Read API

| Route | Returns |
|---|---|
| `GET /api/state?since=<seq>` | `{clock, policy, sources, threads, triggers, decisions, tickets, assignments, receipts, effects, workers, watchdog, metrics, attention, approvals, benchmark, events[]}` |
| `GET /api/recall?id=<ref>&hops=<n>` | `{root, nodes[], edges[]}` with compact cards and next-hop ids |
| `GET /api/artifact?ticket=<id>&file=<name>` | file content (allowlisted, workdir-scoped) |
| `GET /api/health` | liveness, event-log size, worker count, policy version |
| `GET /api/checklists` | parsed checkbox completion counts from the docs (demo convenience) |

All responses are JSON. The dashboard is a single inline HTML document — no CDN, fonts, external stylesheets or scripts — so it renders in the sandboxed preview iframe as well as in a normal browser.

## 5. Event stream vocabulary

Rendered labels use domain terms, never internal status codes:

| Internal | UI |
|---|---|
| `filtered` | "Filtered — outside scope" with reason |
| `fast_path` | "Follow-up delivered to existing Ticket (no Router decision)" |
| `would_accept` | "Would accept (observe mode — no work started)" |
| `speculative_discarded` | "Quiet work discarded — nobody was interrupted" |
| `person/answer` | "Waiting for your decision" |
| `unavailable` | "Assessment could not finish" |
| `dropped` | "Reply dropped: conversation gone" |

## 6. Accessibility and honesty

- Every metric has the formula in a tooltip; no number appears without changing what a supervisor does (upstream `docs/005` principle).
- Synthetic data is labelled **"SYNTHETIC DEMO DATA"** in the header.
- The deterministic reasoning adapter is labelled **"deterministic constitution"**; if an LLM adapter is enabled the UI says so explicitly.
- Timestamps are simulation ticks, clearly distinguished from wall-clock time.
- No auto-refresh trickery: state is polled with an increasing `since` cursor.

## 7. Implementation note (2026-11-02)

The live dashboard implements this contract in one inline HTML file at [`../03-app/src/web/index.html`](../03-app/src/web/index.html), served by [`../03-app/src/web/server.js`](../03-app/src/web/server.js). The normative routes are available as `/api/state`, `/api/recall`, `/api/artifact`, `/api/health` and `/api/checklists`; `/api/snapshot`, `/api/events`, `/api/config`, `/api/inject`, `/api/control`, `/api/benchmark`, `/api/demo/run` and `/api/replay` are the concrete aliases used by the UI. All controls are wired; `switchDomain` resets the Engine and loads exactly one Source pack (`all` reloads all four in the same Engine), and `injectStall` enqueues a canonical `launch` effect with `stage: recheck` and is visibly badged **simulation**.
