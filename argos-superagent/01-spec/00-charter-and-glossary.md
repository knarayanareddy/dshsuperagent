# 00 — Charter, goals, non-goals, invariants, glossary

## 1. Charter

**ARGOS-4** is a self-contained, zero-credential, deterministic showcase of the *Super-agent coordination contract* published by the DeepSeek Harness team, applied simultaneously to four non-coding-adjacent environments. Its purpose is to be **shown end to end**: events arrive, work is authorized, isolated workers execute real computations, evidence is produced, a watchdog supervises, and the system speaks only when a human can act on or use the result.

**Name:** ARGOS = *Autonomous Router-Governed Observatory System*; `-4` for the four missions. (Argus: the all-seeing, always-awake watcher — a fitting metaphor for an event-driven agent that stays quiet unless something matters.)

## 2. Goals

| ID | Goal | Measure |
|---|---|---|
| G1 | Demonstrate that the upstream domain model is environment-independent | four Source packs, one unchanged Engine, zero domain conditionals in `engine.js` |
| G2 | Make human attention a *measured* resource | attention meter, messages/triggers ratio, word cost, approvals, silence savings |
| G3 | Make proactivity observable and safe | speculative promote/discard ledger with confidence threshold; `observe` default |
| G4 | Make results verifiable | machine-checkable evidence artifacts + deterministic replay per Ticket |
| G5 | Show the latency/token trade-off honestly | single-session vs Superagent benchmark on the identical event stream |
| G6 | Show supervision | semantic watchdog with a visible escalation ladder |
| G7 | Be showcaseable in a browser with no setup | `npm start`, no install, no network, no keys |
| G8 | Provide a credible production path | concept-by-concept migration map to a real `dsh-superagent` Source |

## 3. Non-goals

- Not a DeepSeek Harness plugin, fork, or official DeepSeek artifact.
- Not a general-purpose agent framework or a workflow DSL.
- Not an LLM benchmark, nor a claim that deterministic reasoning equals model reasoning.
- Not a production security product: no real actuation, no real advisories, no real regulations, no live patient/infrastructure data. All domain data is synthetic and labelled as such in the UI.
- No cloud control plane, device daemons, A2A protocol, or long-term vector memory.
- No auto-merge, no real PRs, no real credentials.

## 4. System invariants

See [`01-spec/README.md`](README.md) for the ten non-negotiables. Two additional architectural invariants:

- **I11 — One writer per state kind.** Triggers/Threads/Decisions/Tickets/Assignments are written only by `Engine`; receipts only by `Outbox`; effects only by `Effects`; events only by `EventStore`; artifacts only by worker subprocesses.
- **I12 — Determinism.** Given the same event log, policy version and seed, a replay produces byte-identical decisions and evidence (with timestamps normalized). No `Math.random()` in engine logic; domain fixtures use seeded generators.

## 5. Glossary (upstream terms kept, new terms marked ✦)

| Term | Definition |
|---|---|
| **Source** | A stream of events. A Source *kind* is an implementation; an *instance* is a configuration. Holds read position and scope. |
| **Trigger** | One immutable event with Source metadata, actor, `addressed` flag, text and `meta`. Unit of idempotence and audit. |
| **Thread** | Ordered Triggers sharing a stable key (a claim, an asset, an advisory, an obligation). Holds subscriptions and decision history. |
| **Correlation** | Two Threads joined by one Trigger; context only, never routing. |
| **Channel** | Where a reply to a Thread goes. May be chat-like (100-word cap) or document-like (structured). |
| **Policy** ✦ | Versioned constitution: rules, accept mode, allowlists, bot list, speculation, autonomy ladder, attention limits. |
| **Gate** | Deterministic code check producing a *strength*: `explicit`, `inferred`, `not_admitted`. |
| **Eval** | The judgement on a batch of Triggers: gate + assessment → Decision. Stateless; at most one active per Thread. |
| **Decision** | `accept`, `would_accept`, `ignore`, `stop`, `unavailable` with reason codes, per-rule judgements, evidence and policy version. |
| **Mandate** | Immutable authorization: policy version, scope, strength, matched rules, actor, receiving scope, speculation flag. |
| **Ticket** | Unit of authorized work. Owns Inputs, Assignments, Channels, Subscriptions and Reports. `open → ended → resumed`. |
| **Assignment** | Binding of a Ticket to one worker instance in one workdir. |
| **Subscription** | Many-to-many Ticket ↔ Thread. Human follow-ups on an *own* Thread belong to the Ticket; *context* subscriptions grant no authority. |
| **Input** | A Trigger delivered to a live Ticket (fast path), a note, or a policy-change notice. |
| **Report** ✦ | A worker's structured outcome: `progress`, `ready`, `dropped`, `blocked`, `failed`, `speculative_confirmed`, `speculative_discarded`. |
| **Evidence** ✦ | Machine-checkable output of a worker (`evidence.json`, `report.md`, `log.jsonl`, `result.json`) with a confidence score. |
| **Speculative Ticket** ✦ | Silent work started from an environmental signal. Promoted on sufficient evidence, otherwise discarded with zero outbound messages. |
| **Silence saving** ✦ | An attention credit for speculative work discarded and for noise filtered without a message. |
| **Approval** ✦ | A non-delegable human Channel write that grants a new, narrow scope for a high-impact action. |
| **Watchdog** ✦ | External control loop checking *semantic progress*, not just liveness. |
| **Chain of Recall** ✦ | Hop-by-hop expansion of the reference graph: Trigger → Thread → Ticket → Assignment → Evidence → Reply. |
| **Attention budget** ✦ | Metered cost of every outbound message, question and approval, with a hard 100-word chat cap. |

## 6. Stakeholders and attention contract

| Role | Wants | What the system owes them |
|---|---|---|
| **Operator / supervisor** | know what needs them now | one collapsed "needs me" panel; no healthy-state noise |
| **Domain expert** | trustworthy results | evidence artifact, confidence, replay, explicit limits |
| **Reviewer / auditor** | provenance | policy version, matched rule, mandate id, decision reason, artifact hash |
| **Demo audience** | understand the architecture | a visible fast path, a visible speculative discard, a visible approval, a visible watchdog alert, a benchmark comparison |

## 7. Definition of "showcased end to end"

A run is complete when all of the following are visible *in one session*, without editing code:

1. ≥1 Trigger filtered by the code gate with a reason code.
2. ≥1 `observe` decision recorded as `would_accept`, with no Ticket.
3. ≥1 explicit request producing a Ticket + Mandate + acknowledgement.
4. ≥1 fast-path follow-up delivered to the existing Ticket with no new Eval.
5. ≥1 worker producing real files in its own workdir.
6. ≥1 speculative run discarded silently (and one promoted, if the scenario contains a falsified claim).
7. ≥1 high-impact action staged for human approval, then approved/denied via the UI.
8. ≥1 watchdog alert (injected stall) with an escalation action.
9. ≥1 outbox receipt with ordering/drop semantics visible.
10. A benchmark run showing p50/p95, router decisions, tokens and attention spend for both architectures.
11. Chain-of-Recall expansion from a Trigger to an evidence artifact.
12. A reset/replay that rebuilds identical state.
