# 04 — Feature adaptation matrix

Every non-trivial feature in ARGOS-4 is listed with its origin, the exact adaptation, and the acceptance test that proves it works. This is the audit trail for "look at similar projects for inspiration and adapt features from them if good".

Legend: **↑** = adopted largely as-is · **↺** = adapted/recombined · **＋** = newly added because upstream or comparators left a gap.

| # | Feature | Origin | Move | What ARGOS-4 does | Proven by |
|---|---|---|---|---|---|
| F01 | Router / Worker separation | DeepSeek essay §2 + prototype presets | ↑ | Router only gates, assesses, dispatches and replies; it has no execution capability. Workers never write to channels. | `tests/engine.test.js` → "router cannot execute / worker cannot reply" |
| F02 | Trigger / Thread / Correlation | upstream `docs/001` | ↑ | Immutable triggers with stable ids; threads hold ordered triggers, subscriptions and decision history; a trigger may join two threads for correlation context. | `trigger`, `thread` records in `/api/state` |
| F03 | Fast-path subscription fan-out | upstream `Evals`/`Intake`, essay §3.2 | ↑ | Follow-ups on subscribed threads become Inputs with no Eval and no new authority; human follow-ups can resume an ended Ticket. | benchmark: −30% router decisions with fast path enabled |
| F04 | Two-stage policy gate | essay §3.1, upstream `src/policy.ts` | ↑ | Deterministic code gate (source, scope, allowlist, addressed, bot list) before any semantic assessment. Trigger text can never alter policy. | prompt-injection fixture test |
| F05 | Versioned Policy + immutable Mandate | upstream `docs/002` | ↑ | Policy hash covers rules, mode, allowlists, bot list, speculation and attention settings. Mandates record policy version, strength, scope, matched rules, actor, receiving scope. | `policy-change` test: in-flight eval invalidated, live mandate revalidated on resume |
| F06 | `off` / `observe` / `auto` accept modes | upstream `docs/002` | ↑ | `observe` default records `would_accept` decisions without launching work. Dashboard shows the observe ledger. | `observe-mode` test |
| F07 | Matched-rule assessment with per-rule judgement | upstream `prompts/admission.md` | ↺ | Deterministic assessor returns one judgement per enabled rule, three intent facts, evidence quotes, and a design-ambiguity veto. Optional LLM adapter can replace it. | `assessment` tests, `data/decisions.jsonl` |
| F08 | Hand-back / attach / stop / resume / re-evaluate | upstream `docs/002`, `docs/007` | ↺ | Worker may hand back an out-of-scope Input once; Router then re-evaluates. Person's stop withdraws a Mandate; resume revalidates it. | `handback-and-resume` test |
| F09 | Ticket stages | upstream `docs/003` | ↺ | `queued → working → person/answer → person/review → ended`, plus `person/failed`; mutually exclusive first-match table. | `stage` test |
| F10 | Durable effect queue + backoff | upstream `Effects`, Temporal/Inngest | ↺ | Launch/delivery/relay/reply/speculation effects are appended in the same transaction as the state change, then executed with exponential backoff; `Later` defers without counting a failure. | `effects` test, `data/effects.jsonl` |
| F11 | Outbox receipts, ordering, dropped reasons | upstream `docs/003`/`007` | ↑ | Only the Router enqueues replies. Receipts have `pending/sent/dropped`, per-ticket-per-thread ordering, attempts and drop reasons. | `outbox-ordering` test |
| F12 | 100-word chat cap / one ack / silence while working | upstream `docs/000`, `docs/004` | ↑ | Hard word limit enforced in code on chat replies; one acknowledgement per Ticket; worker progress stays out of channels. | `attention` test, attention meter |
| F13 | Panel answering three questions | upstream `docs/005` | ↺ | Dashboard order: *needs me now* (approval + attention) → *system health* (watchdog/load) → *history* (timeline/evidence/recall). Healthy widgets collapse. | UI spec [`01-spec/07-observability-ui.md`](../01-spec/07-observability-ui.md) |
| F14 | Inline & Spill + Chain of Recall | essay §3.3, upstream resource cards | ↺ | Every object has a compact card with a truncated preview and typed reference ids; `/api/recall?id=&hops=` expands hop by hop into a visible graph. | recall test + UI graph |
| F15 | Speculative execution as a primitive | essay §3.4 (upstream: convention only) | ＋ | Signals can spawn **silent speculative tickets**. Evidence + confidence threshold decides promote (one result message) or discard (zero messages, counted as saved attention). | `speculation` test, silence counter |
| F16 | Router batching metrics | essay §7.2 | ↺ | Queued triggers merge into one Router decision batch; UI shows batch size and amortized decision cost. | benchmark output |
| F17 | Async full-duplex ReAct | essay §4.1, upstream 5s shell→background | ↺ | Worker subprocesses are non-blocking; progress events stream to the UI while the Router keeps accepting triggers. | live dashboard during a run |
| F18 | External semantic Watchdog | essay §6 (not in prototype); OpenHands stuck detection | ＋ | Independent loop detects stalled workers, repeated identical steps, missing evidence, expired evals, outbox backlog and policy drift, with a flag → retry → stop+escalate ladder. | `watchdog` test, UI alerts |
| F19 | Event-sourced replayable state | OpenHands SDK, Temporal, LangGraph checkpoints | ↺ | Append-only `data/eventlog.jsonl`; `reset` and `replay` rebuild state from the log; every artifact links back to trigger/decision/mandate ids. | `replay` test |
| F20 | Execution-grounded evidence | `autoresearch`, ScientistOne CoE, AI Scientist failure analysis | ＋ | Every worker writes `input.json`, `evidence.json`, `report.md`, `log.jsonl` and `result.json` into its own workdir; no prose-only results. | domain tests + artifact viewer |
| F21 | Tiered autonomy / approval gate | agentic SRE governance, EU AI Act oversight, upstream `person/answer` | ＋ | `riskClass` on an artifact determines `auto` (reversible, low blast radius), `approve` (staged, human decision) or `forbid`. Approvals are counted attention events. | approval flow in infra/compliance demos |
| F22 | Isolated worker sandbox | gap: upstream explicitly says wrappers "are defaults, not a security boundary" | ＋ | Separate workdir, stripped environment (no keys/secrets), allowlisted domain functions only, subprocess timeout, no credentials ever in model context. | `sandbox` test, `data/work/<domain>/<ticket>/` |
| F23 | Attention meter + token/waste accounting | upstream philosophy, essay §7 | ＋ | Measures outbound word cost, messages, approvals, speculative discards, router decisions and estimated cache-read tokens. | benchmark + dashboard |
| F24 | Deterministic constitution, optional LLM | `program.md` (autoresearch), upstream versioned prompts | ↺ | `policy.json` + rule text are versioned and inspectable; default reasoning is deterministic; `ARGOS_LLM_URL`/`ARGOS_LLM_KEY` switch the assessor narrative only, with graceful fallback. | `npm test` with no env vars |
| F25 | Pluggable Source packs | upstream `docs/008` cookbook | ↑ | Each domain is a self-contained Source pack: event catalog, scope, admission rows, rules, worker playbook, evidence schema. Adding a fifth requires no Engine change. | `domains.test.js` |
| F26 | Single-session baseline benchmark | essay §7.1 | ↺ | Same event stream executed twice: sequential single-session with interruption penalty vs Router/Worker with slots, fast path and speculation. Reports p50/p95, tokens, attention. | `npm run benchmark`, [`04-evaluation/`](../04-evaluation/README.md) |
| F27 | Honest production migration path | upstream cookbook + security gaps | ＋ | [`05-delivery/handoff.md`](../05-delivery/handoff.md) maps each ARGOS-4 concept to a concrete `SourceKind`, rule, prompt override, prepare command, env var and test in the real DSH bundle. | document review |

## Rejected adaptations (and why)

| Candidate | Rejected because |
|---|---|
| Multi-agent debate / critique rounds (AutoGen, CrewAI, co-scientist) | Multiplies token cost and violates attention budget; our workers share context through Threads only |
| Generic DAG workflow DSL (LangGraph, Temporal as control flow) | Would replace the small upstream domain model with a larger one; the showcase is about one Ticket lifecycle across four environments |
| Autonomous auto-merge / real PR creation | Requires a GitHub agent account and credentials; conflicts with zero-credential constraint |
| Cloud device daemons / A2A protocol | Essay lists as future work with unresolved security/privacy questions |
| Fully LLM-driven default reasoning | Non-reproducible, untestable, and hides the coordination logic the showcase is meant to expose |
| Blockchain-anchored audit (PLoS One digital twin) | Adds an external dependency; sha256-chained local attestations provide the same demo property |
