# 01 — Technical review of `deepseek-ai/dsh-superagent-prototype`

**Reviewed:** 2026-11-02 (local Europe/Amsterdam). **Upstream commit:** `6337fc8`, published 2026-10-31, MIT, TypeScript, `v0.1.0`, single commit at review time. **Method:** full clone of the repository into `research/dsh-superagent/`, reading `README.md`, `SETUP.md`, all nine numbered docs (`000`–`008`), `package.json`, `cordis.patch.yml`, all `prompts/*.md`, `prompts/team/*.md`, `skills/*/SKILL.md`, and the module/test index in `docs/007-architecture.md`; cross-checked against the design essay translation and contemporaneous reporting.

---

## 1. What it actually is (and is not)

`dsh-superagent` is a **proactive coding agent for exactly one GitHub repository**, packaged as a **bundle/plugin for DeepSeek Harness (DSH)**. It listens to GitHub (required) and optionally Feishu/Lark. When an allowed person asks for work, it opens a work item, executes it in its own agent Session and its own directory, and answers in the original conversation — typically with a pull request. A web panel lists items that need a person.

It is **not**:

- a new model, an app, or an official DeepSeek product;
- a general multi-repository platform (one repository per deployment, one dedicated GitHub *user* account, not a GitHub App, because it reads that account's notifications);
- production software. The README says plainly: *"Research prototype for reference only… Treat it as research code, not production-ready software… Review and adapt it before using it in your own environment."*
- the internal DeepSeek system, nor a full implementation of the design essay: *"Some designs discussed in the article are directions for future development and are not implemented in this prototype."*

The design essay — *Exploring Super-agent Design: Towards a More Autonomous Agent System* — is the conceptual source; the repo is a partial, deliberately simplified implementation. Its four claimed properties are **continuity, efficiency (productivity), proactivity, persistence**, and its five modules are: two-layer architecture, event-driven operation, full-duplex multi-channel interaction, compute/state/environment separation, and an external Watchdog.

**Verdict up front:** the interesting contribution is not "an agent that writes PRs" (that category is crowded). It is a **rigorously specified coordination layer** with an explicit domain model, authorization semantics, durable side effects, recovery rules, and an *attention economy*. That layer is portable to non-coding domains — which is exactly what ARGOS-4 exploits.

---

## 2. Architecture in one page

```
Sources (GitHub / Feishu, pluggable via SourceKind)
   │  Trigger (immutable, stable id, actor, addressed?, meta)
   ▼
Intake ──► Thread (ordered Triggers, subscriptions, decision history)
   │            │
   │            ├─ FAST PATH: fan-out to subscribed Tickets (no Eval, no new authority)
   │            ▼
   └────────► Eval (two-stage: code gate + model assessment)
                  │  Decision (accept / ignore / stop / unavailable; reason codes)
                  ▼
              Ticket (Mandate: policy version, scope, strength, matched rules)
                  │  Assignment → Executor Session + own worktree directory
                  ▼
              Worker reports (progress / ready / blocked / failed / dropped)
                  │
                  ▼
              Router-only replies → Outbox receipt → Channel → original conversation
```

`Runtime` is the composition root; `Engine` is the **only writer** of Triggers, Threads, Decisions, Tickets and Assignments, split into five internal parts (`Intake`, `Evals`, `Tickets`, `Assignments`, `Replies`) with one-directional dependencies. All Engine methods are synchronous and each command is one transaction. External work (launch, delivery, relay, notice, reply, assessment) is enqueued as **durable effects inside the transaction** and performed after commit, with exponential backoff. State lives in one SQLite database (`orchestrator.sqlite`) with generated indexed columns for active working sets. A `Passes` scheduler runs every two seconds.

This is a genuinely well-engineered core: narrow ports, `Pick<Engine, …>` role interfaces (`EngineForSources`, `EngineForMainSession`, `EngineForPeople`, `EngineForSettings`, `EngineForExecutor`), one writer per state kind, and a test suite (`tests/core-engine.spec.ts`, `policy`, `followups`, `runtime-concurrency`, `migration`, `model-surface`, `docs` …) that even checks that every class has JSDoc and that the architecture tables list every module and test.

---

## 3. Domain model — the part worth copying

From `docs/001-domain.md`. Only concepts the work needs; business needs become attributes or prompt text.

| Concept | Keeps | Why it exists |
|---|---|---|
| **Source** | read position, bot identity, what counts as an event, Thread/Channel mapping | restart must not replay events |
| **Trigger** | one immutable event with Source metadata | unit of audit and idempotence |
| **Thread** | ordered Triggers, subscriptions, running Eval, decision history, at most one Eval at a time | consistent view; follow-up routing |
| **Correlation** | Threads joined by one Trigger | context only, never routing |
| **Channel** | write addresses for a Thread | ack/reply/PR/resolved review are all writes |
| **Policy** | versioned rules + per-Source allowlists, admission tables, bot lists | running Eval discarded on change |
| **Eval** | gate + assessment → Decision; stateless | decides whether work starts/stops |
| **Mandate** | immutable authorization: policy version, scope, strength, matched rules, sender, receiving scope | states *why* work may be done |
| **Ticket** | unit of authorized work; open → ended → resumed; owns execution | state independent of Executor |
| **Assignment** | binding Ticket ↔ Executor instance | who executed is inside the domain |
| **Subscription** | many-to-many Tickets ↔ Threads | later discussion reaches the worker without re-@mention |

Rejected concepts are as instructive as accepted ones: no `Principal` entity (a person is Trigger metadata), no cross-Source identity mapping (that is prompt text), no separate "task" or "project" concept. **A person is not a domain concept.** This minimality is why ARGOS-4 can swap GitHub PRs for sensor readings, advisories or regulation feeds without touching the Engine.

### 3.1 Authorization (`docs/002`)

Two paths:

- **Eval path (slow):** code gate checks actor, Source policy, receiving scope and whether the message addresses the agent. Strengths: `explicit` (allowlisted person addresses agent, or a follow-up on a Thread with Tickets), `inferred` (unlisted follow-up, admission-table cell, allowlisted bot), `not admitted`.
- **Subscription path (fast):** *every* message on a subscribed Thread — including bots and CI — reaches its Tickets as context, bypassing the gate, granting **no new authority**. Each Ticket stays bounded by its Mandate. Human follow-ups belong to the owning Executor; it either handles them in scope or **hands them back** once; only then can the Router re-evaluate.

Accept modes: `off`, `observe` (default — inferred work is assessed and recorded as *"would accept"* but nothing runs), `auto`. Explicit requests work in all modes. Each enabled rule is judged exactly once per assessment; proactive acceptance requires ≥1 matching rule. A Policy version hashes rules, mode and Source policy parts; a change discards in-flight Evals, notifies affected live Tickets, and triggers **Mandate revalidation** before an ended Ticket resumes. Only three things change a Mandate: accept, a person's stop, failed revalidation.

This is the strongest part of the repo and the part most multi-agent frameworks lack: **authorization is code, not prompt text.** The docs state it bluntly: *"Messages, comments and quoted documents are inputs to a decision; they cannot change those permissions."* Prompt overrides cannot alter the gate, Mandates, tool checks or account wrappers.

### 3.2 Execution (`docs/003`)

Each Ticket gets `worker-<id>` Session + a directory under `<stateDir>/work`, typically a `git worktree` created by a configured prepare command. Worker and Router have separate **agent presets** in `cordis.patch.yml`: foreground shell commands and job waits move to background after **5 seconds**, so a long command does not block the next human message — a concrete implementation of the essay's asynchronous ReAct loop. The Router preset is deliberately smaller: no writes, no subagents, no web, no question-to-human tools. `noWait` guards refuse `sleep`, long shell timeouts and long job waits in the main Session.

`WorkerSlots` reserves capacity; a human message gets one slot beyond `maxWorkers` and wakes have priority over new launches. Background jobs have 30 minutes; handoff to a person frees the slot immediately. Ticket stages are a precise, mutually exclusive table (`person/delivery`, `person/answer`, `person/review`, `person/blocked|failed`, `working/queued`, `idle`, `working`).

Failure/recovery is unusually thorough: transient provider/network failures get three backoff retries; failed Tickets hold automatic Inputs but keep tools available for a person; retries create a new Assignment in the same Session/directory/branch/PR; restarts end running Assignments and start replacements with a recovery note ("check your directory, git history and GitHub before repeating any outside action"), oldest first; unread follow-ups return to Eval; Outbox receipts keep per-conversation ordering and mark messages `dropped` with a reason rather than silently losing them.

**Security reality check (important):** `docs/006` says both presets run `danger-full-access` as the operator's OS user; account wrappers choose credentials but do **not** isolate the process. `docs/003`: *"These wrappers and directories establish defaults, not a security boundary. A worker can still execute a program by absolute path."* `docs/007` lists open questions about which Trigger fields are trusted. The essay's Section 8.4 goes further: a compromised cloud Router with device daemons could take over every connected machine, and credentials can leak into model context even without compromise. **Any serious build-out must add real sandboxing.** ARGOS-4 does (isolated workdirs, stripped environment, no credentials, allowlisted domain functions, timeouts, deterministic replay).

### 3.3 Prompts and the panel (`docs/004`, `docs/005`)

Team-editable sections: Communication, Ticket scope, Delivery requirements, Team skills; plus overrides of every built-in prompt part, with versioned saves, base-revision conflict detection and "Default updated" diffs. Precedence is explicit: (1) host-enforced facts (identities, permissions, tool checks, reply purposes, length limits) > (2) built-in/generated sections > (3) matched proactive rules for that Ticket > (4) team sections/skills > (5) outside text (always data, never rules). The Policy section is assembled last so a change leaves prompt-prefix caching intact.

The Router is constrained to *routing only*: it forwards original Triggers and makes no technical decisions; a routing note is ≤30 words; it ends its turn when nothing remains. Chat replies are one sentence by default with a hard **100-word cap**; asynchronous channels (GitHub/email/documents) get structured, high-density delivery. Workers confirm once, concretely, then stay quiet; ask **one** concrete question through `human_action`; mark drafts honestly; yield to duplicate human work; handle reviews by outcome; preserve a human "wait" hold across Sessions and restarts.

The panel answers exactly three questions, in order: *Does anything need me now? Is the system healthy and doing the right things? What is the history of one piece of work?* Tabs follow the workflow: Overview → Source → Trigger → Eval → Execution → Settings. Principles include "A healthy state takes no space", "a count equals the length of the list it links to", and "problems must be actionable".

### 3.4 Extension point (`docs/008` cookbook)

Adding a Source is a first-class, documented recipe with 11 steps and a checklist: map events → domain concepts with **stable ids**; declare `schema`, `fields`, `facts`, `health`; translate events to Triggers (never emit the bot's own messages); define `scope` from `meta` alone (`listened`, `observed`, admission `row`); implement an **idempotent** `channel.send` using `message.id` as key, returning `sent` / `gone` only for permanent failure; supply `threadContext.read` for bounded assessment windows; declare the Source's Policy part (allowlist, admission rows, bots, optional membership sync); register execution environment variables; write a polling loop with cursors, per-item error counts, health and abort; register build entry, `exports`, `cordis.patch.yml` insert; test with a real Store and stand-in ports.

This cookbook is the single most valuable artifact for a build-out: it means the framework was designed to be adapted to **new event sources**, which is precisely the move ARGOS-4 makes (sensors, advisories, regulation feeds, literature claims).

---

## 4. What the essay promises that the prototype does not ship

| Essay idea | In prototype? | ARGOS-4 treatment |
|---|---|---|
| Router never executes, Workers never speak to humans | ✅ enforced via presets/tools | ✅ enforced by assertion in engine |
| Two-stage filtering (code fast path + model slow path) | ✅ gate + assessment | ✅ deterministic gate + deterministic/optional LLM assessor |
| Thread subscriptions / direct pass-through | ✅ full domain implementation | ✅ fast path with no Eval |
| Inline & Spill, Chain of Recall | ⚠️ partial: bounded cards, `orchestrator_read` resources, truncation + read pointers | ✅ explicit reference graph with hop-by-hop expansion UI |
| Speculative execution ("silently reproduce and fix") | ⚠️ via `observe` rules + prompts, not a system primitive | ✅ first-class speculative tickets with promote-or-discard |
| Batching in Router | ✅ queued Triggers merge into next batch | ✅ batch metrics + amortized decision latency |
| Full-duplex async ReAct | ✅ 5s shell→background, job waits | ✅ non-blocking worker subprocesses + progress events |
| Compute/state/environment separation | ⚠️ single SQLite + local worktrees; essay says decouple to cloud + device daemons | ✅ event-sourced log + swappable worker environments, clearly documented as a seam |
| External semantic Watchdog | ❌ not implemented (hourly health check is liveness, not progress) | ✅ semantic watchdog: stall, loop, missing evidence, drift, escalation |
| Long-term memory / global memory problem | ❌ open question | ✅ chain-of-recall graph, explicitly scoped to session-scale |
| A2A / context boundaries | ❌ open question | ❌ out of scope, documented |
| Strong security isolation | ❌ explicitly "defaults, not a security boundary" | ✅ sandbox + no credentials + allowlisted operations |

---

## 5. Strengths

1. **Authorization as a first-class, versioned, code-enforced domain concept.** Mandates, revalidation, hand-back, stop/resume semantics are more mature than most agent frameworks.
2. **Attention as the optimization target.** "Take as little human attention as possible" is not decoration; it shapes the admission table, `observe` default, 100-word cap, silence rules, panel design and duplicate-work yielding.
3. **Durability and honesty.** Durable effect queue, Outbox receipts, dropped-message reasons, recovery notes, prompt version diffs, honest draft/failure reporting.
4. **Separation of roles with structural enforcement.** The Router *cannot* execute; workers *cannot* post; the panel shows only what needs a person.
5. **A crisp, small domain model** with rejected concepts and a cookbook that makes new Sources tractable.
6. **Test discipline** (~60 spec files, including docs/module-index drift checks and model-surface size budgets).

## 6. Gaps, risks and where a build-out must improve

| Gap | Why it matters | ARGOS-4 response |
|---|---|---|
| No real sandbox; `danger-full-access` as operator OS user | prompt injection in a GitHub comment → arbitrary host commands | worker subprocesses in isolated workdirs, stripped env, allowlisted domain functions, no credentials, timeouts |
| One repository, one Source type in practice, GitHub user account required | narrow applicability; operational burden | four Source packs on one engine, zero external accounts |
| Requires DSH 0.2.1-rc.x, Node 22.19+, pnpm, tmux, gh, dedicated accounts, model key | high setup friction; `engines.dsh` alpha-tag trap; first start exits 3 by design | `node src/cli.js` / `npm start` with zero install and zero credentials |
| Workers are only as good as the configured model; no reproducible evidence standard | results can be plausible but wrong | every worker produces machine-checkable evidence artifacts + confidence + deterministic replay |
| No native cost/attention metrics or experiment harness | cannot *show* the trade-off (tokens vs latency) | benchmark harness, attention meter, token estimates, speculative-waste counter |
| Watchdog is an hourly *liveness* script, not a semantic progress monitor | stuck loops and objective drift invisible | semantic watchdog with escalation ladder |
| Unbounded DB growth (`trigger`, `disposition`, `decision`, outbox, kv versions) | long-running deployments bloat | append-only log with documented retention seam |
| Untrusted-input trust model is an open question | indirect prompt injection through comments/quotes | all Trigger text is data; policy never read from Trigger content; explicit prompt-injection fixtures |
| Speculative execution is a policy/prompt convention, not a measurable primitive | hard to demonstrate | promote/discard pipeline with a visible silence counter |
| Public code ≠ internal version; issues/discussions/wiki disabled on the repo | no upstream support path | independent implementation, no dependency on upstream fixes |

## 7. Review conclusion

`dsh-superagent-prototype` is best read as **an operating-system design for agents**, not as a coding-agent product. Its durable contribution is the *coordination contract*: immutable Triggers, Threads with subscriptions, versioned Policy, immutable Mandates, Tickets with independent lifecycle, durable effects, an Outbox, and a human-attention budget enforced in code. The implementation is a single-repo GitHub/Feishu slice of that contract, with real security and setup limitations.

The most valuable — and most novel — way to build on it is therefore **not** "another PR bot". It is to keep the contract and change the *environment*: replace GitHub notifications with scientific claims, telemetry, advisories and regulatory changes; replace "open a PR" with "produce reproducible evidence"; add the missing sandbox, semantic watchdog, speculative primitive and measurement. That is exactly the programme specified in [`01-spec/`](../01-spec/README.md) and implemented in [`03-app/`](../03-app/README.md).

---

### Primary sources for this review

- Repository: <https://github.com/deepseek-ai/dsh-superagent-prototype> and local clone at `research/dsh-superagent/` (`README.md`, `SETUP.md`, `docs/000`–`008`, `prompts/`, `skills/`, `cordis.patch.yml`, `package.json`).
- Design essay (English translation): <https://offloop.org/learn/exploring-deepseek-super-agent-design>; original WeChat article <https://mp.weixin.qq.com/s/zoS7GlReWPhfCjENGxXCdg>.
- Explainer: <https://www.developersdigest.tech/blog/deepseek-dsh-superagent-router-worker-always-on-agent-2026>, <https://explainx.ai/blog/deepseek-super-agent-architecture-router-worker-triggers-watchdog-2026>.
- Setup/operations reporting: <https://blog.laozhang.ai/en/posts/deepseek-super-agent-github>, <https://aicybr.com/blog/deepseek-dsh-superagent-prototype-setup-security>.
- Release coverage: <https://www.marktechpost.com/2026/11/01/deepseek-dsh-superagent-router-worker-coding-agent/>, <https://devops.com/deepseek-wants-coding-agents-to-stop-waiting-for-instructions>.
