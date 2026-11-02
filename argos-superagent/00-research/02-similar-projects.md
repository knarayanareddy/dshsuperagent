# 02 — Similar projects and what we borrowed

**Purpose:** establish the design space around `dsh-superagent-prototype`, then make every adaptation decision explicit. Companion: [`04-feature-adaptation-matrix.md`](04-feature-adaptation-matrix.md).

---

## 1. The three families of related work

### A. Coding agents and their orchestration layers (closest competitors)

| System | Coordination model | What starts work | Notable idea |
|---|---|---|---|
| **Claude Code** | main session delegates to subagents; experimental **agent teams** are separate instances sharing a task list and direct messages; `/batch` fans migrations into worktree agents | terminal, web, routines (schedule/API/GitHub events) | isolation by worktree/subagent context; hooks, skills, MCP; 100-word-style brevity is not enforced structurally |
| **OpenAI Codex** | main agent spawns parallel subagents; cloud tasks run in isolated containers | CLI/IDE/app, GitHub/GitLab/Linear/Slack | explicit worktree + cloud task boundary; reviewable diffs/PRs |
| **Google Jules / GitHub Copilot coding agent / Devin / Cursor Cloud** | one async task per cloud VM/workspace | issue assignment, Slack, schedule | disposable sandbox, diff-before-PR, full reasoning log |
| **OpenHands (V1 SDK)** | **event-sourced state**: append-only `EventLog`, immutable Agent/Tool/LLM, `ConversationState` as single source of truth, deterministic replay; Agent Canvas / ACP drives Claude Code, Codex, Gemini CLI | GUI, CLI, SDK, Slack, Jira | replay, stuck detection, risk-aware confirmation policy, budget controls, local↔remote workspace swap |
| **Replicas / Warp Oz / Orca / Vibe Kanban / Sculptor / Intent** | control plane over *other* agents, one VM/worktree per task | Slack, Linear, GitHub, webhooks, CI failures, API | "bring your own harness", living spec, parallel board |
| **Factory Droids** | specialized Reliability / Knowledge / Product Droids alongside Code Droid | enterprise workflows | domain-specialized agents beyond coding — conceptually close to ARGOS-4's four missions |

**Comparison sources:** [replicas.dev orchestration survey](https://replicas.dev/resources/agent-orchestration), [OpenHands 2026 ranking](https://www.openhands.dev/blog/best-coding-agents), [OpenHands SDK paper](https://arxiv.org/html/2511.03690v1), [Claude Code design-space paper](https://arxiv.org/html/2604.14228v1), [harness comparison](https://htek.dev/articles/all-agent-harnesses-live-comparison), [offloop comparison of DeepSeek/Claude Code/Codex](https://offloop.org/learn/deepseek-super-agent-design).

### B. Durable workflow / multi-agent frameworks (the engineering substrate)

- **LangGraph 1.0**: typed state, synchronous checkpointing per node, durable execution, streaming, human-in-the-loop, memory. Graph-shaped control flow.
- **Temporal / Restate / DBOS / Inngest**: event history replay, step retries, sagas, exactly-once-ish side effects. Increasingly used as the *outer* durability layer with LangGraph as the inner agent loop.
- **AutoGen / CrewAI / MetaGPT / CAMEL**: role-based or conversational multi-agent patterns (debate, critique, SOP-driven assembly).
- **OpenHands event sourcing** (above) is the clearest bridge: *every action/observation is a typed event; state mutation is only append*. ARGOS-4 adopts this directly.

**Sources:** [durable execution patterns](https://zylos.ai/research/2026-02-17-durable-execution-ai-agents/), [graph orchestration landscape 2026](https://zylos.ai/research/2026-04-14-graph-based-agent-workflow-orchestration-production/), [durable execution in production](https://agentmarketcap.ai/blog/2026/04/10/durable-agent-execution-production-temporal-modal-event-sourced), [OpenHands deep dive](https://dev.to/truongpx396/openhands-deep-dive-build-your-own-guide-1al0).

### C. Autonomous science, SRE, digital twins and GRC (the application frontier)

- **The AI Scientist (Sakana AI / Oxford / UBC / Vector)**: end-to-end idea → code → experiments → plots → manuscript → automated review; v2 uses progressive agentic tree search; the first fully AI-generated paper accepted at an ICLR 2025 workshop; methodology published in *Nature* in March 2026. Independent evaluation found 42% of experiments failed with coding errors and manuscripts had weak citations/hallucinated numbers — a warning that **execution-grounded evidence** matters more than fluent manuscripts. [Nature methodology](https://www.nature.com/articles/d41586-026-00899-w), [arXiv 2502.14297 evaluation](https://arxiv.org/abs/2502.14297), [project summary](https://rywalker.com/research/ai-scientist).
- **Google AI co-scientist / ScientistOne / Robin / Virtual Lab / ChemAgents / PharmAgents / STELLA / Coscientist**: multi-agent hypothesis generation with specialized Generation/Reflection/Ranking/Evolution/Meta-review agents, and — in ScientistOne — a **Chain-of-Evidence** integrity audit that binds claims to raw lab logs. [Nature review on drug-discovery agents](https://www.nature.com/articles/s44386-026-00075-0), [ScientistOne CoE guide](https://explainx.ai/blog/google-ai-scientist-scientistone-icml-2026-chain-of-evidence), [autonomous research 2026 survey](https://agentmarketcap.ai/blog/2026/04/07/ai-agents-scientific-research-2026-autonomous-discovery).
- **Karpathy `autoresearch`**: ~630-line minimal loop — modify `train.py`, run a fixed 5-minute experiment, keep if `val_bpb` improves, else `git reset`, repeat; `program.md` is the human-written constitution. Radical constraint (one file, one metric, five minutes) beats maximalism. [guide](https://o-mega.ai/articles/karpathy-autoresearch-complete-2026-guide), [analysis](https://arunbaby.com/ai-agents/0063-karpathys-autoresearch-ai-agent-runs-100-experiments-while-you-sleep/).
- **Agentic SRE** (Resolve.ai, Sherlocks, incident.io, Datadog Bits AI, Rootly, Sentry Seer, autoheal, FluidifyAI): parallel hypothesis testing, evidence-backed RCA, production context graphs, **tiered autonomy ladder** — read-only investigate → suggest → execute-with-approval → auto-execute only for reversible low-blast-radius actions. [SRE tools 2026](https://www.sherlocks.ai/blog/top-ai-sre-tools-in-2026), [governance of autonomous remediation](https://devsecops.ae/agentic-sre-governance-autonomous-remediation-2026/), [2026 field comparison](https://fluidify.ai/blog/ai-sre-tools-2026), [supervised remediation](https://luminabyte.de/en/blog/ai-agents-sre-incident-response).
- **Agentic digital twins for critical infrastructure**: PLoS One 2026 framework for smart-city civil infrastructure pairs a continuously updated digital twin with multi-agent orchestration and a blockchain-anchored audit trail; synthetic evaluation reports detection latency 3,197s vs 39,374s rule-based, mitigation success 66.2% vs 45.5%, operator workload −91.7%. A grid-sector governance framework explicitly models **unauthorized OT action execution** and silent model drift as failure modes. [PLoS One](https://pubmed.ncbi.nlm.nih.gov/42467653/), [AAIGF-E](https://doi.org/10.3390/smartcities9100161), [urban infrastructure digital twins](https://www.sciencedirect.com/science/article/pii/S2667259624000080).
- **Continuous GRC / compliance agents**: regulatory change monitoring, control-to-framework cross-mapping, continuous evidence collection, drift detection, policy-as-code governance agents, human sign-off for interpretation and risk acceptance. The EU AI Act Art. 72 post-market monitoring push is frequently cited as the regulatory driver. [agentic compliance tasks](https://www.surecloud.com/blog-hub/agentic-ai-compliance-tasks), [AI in GRC 2026](https://feeds.trussed.ai/blog/ai-governance-risk-compliance), [continuous audit readiness](https://www.cisogenie.com/blogs/continuous-audit-readiness-guide/), [agent governance becoming binding](https://aigovernance.com/news/agent-governance-is-becoming-binding-what-the-august-2026-landscape-means).
- **Execution-bound supply-chain assurance**: 2026 work extends SBOMs into agentic AIBOMs with runtime telemetry, exploitability from *activation paths*, signed CSAF-VEX advisories and deterministic replay; one study reports F1 0.93 vs 0.78 for static SBOM–CVE matching and 37–42% fewer false positives. Agent-runtime supply chains also introduce *semantic* malware in skills/prompts. [arXiv 2603.10057](https://arxiv.org/abs/2603.10057), [CSAF-VEX framework](https://www.frontiersin.org/journals/artificial-intelligence/articles/10.3389/frai.2026.1826384/full), [runtime supply-chain threats](https://arxiv.org/html/2602.19555v1), [semantic supply chain report](https://failurefirst.org/research/reports/36-semantic-supply-chain-vulnerabilities/).

---

## 2. What makes `dsh-superagent` different

The offloop comparison frames it well: Claude Code and Codex are *products* with delegation features; DeepSeek's prototype exposes the **explicit Router / Worker / Thread contract** and the authorization rules that govern when work may begin. Its distinguishing properties:

1. **Work starts from environmental events under written rules**, not a typed prompt. Proactive work begins in `observe` mode (record-only).
2. **Continuity is a system property**, not a user habit: a task continues across IM and GitHub; follow-ups route to the owning worker via subscriptions.
3. **Authorization is code**: immutable Mandates, policy versions, revalidation, hand-back, stop/resume.
4. **Attention is the scarce resource**: 100-word chat cap, one ack, silence while working, panel that hides healthy state.
5. **Durable, ordered, honest output**: Outbox receipts, dropped reasons, recovery notes, prompt version diffs.

Most competing systems optimize *task success*. This one optimizes *human attention per unit of value*. That is the axis ARGOS-4 keeps and makes measurable.

---

## 3. Design decisions we made after the comparison

| Decision | Inspired by | Rationale |
|---|---|---|
| **One engine, four Source packs** | upstream `SourceKind` cookbook; Factory's domain Droids; Replicas' "orchestrate agents you already have" | proves the coordination contract is domain-independent — the strongest showcase claim |
| **Append-only event log + replayable state** | OpenHands SDK, Temporal, durable-execution literature | makes every decision auditable, every artifact traceable, and the demo resettable/time-travellable |
| **Executable evidence artifacts instead of prose results** | `autoresearch` (one metric, keep/discard), ScientistOne Chain-of-Evidence, AI Scientist's 42% coding-error failure | a claim without a machine-checkable artifact is not a result |
| **Chain-of-Evidence graph** | ScientistOne CoE, DeepSeek Chain of Recall | one mechanism serves both memory recall and provenance/audit |
| **Tiered autonomy + approval queue** | agentic SRE governance, upstream `person/answer` stages, EU AI Act oversight expectations | high-impact actions never auto-execute; the approval is itself an attention event we count |
| **Speculative promote-or-discard primitive** | DeepSeek essay §3.4, Sherlock's speculative verification, autoresearch's keep/discard | turns "proactivity" into something observable and measurable (including waste) |
| **Semantic watchdog** | DeepSeek essay §6 (unimplemented upstream), OpenHands stuck detection | liveness is insufficient; detect loops, missing evidence, objective drift |
| **Benchmark with token/attention trade-off** | DeepSeek essay §7 (p50 12.4 vs 20.4 min; 23.2M vs 6.1–10.8M cache-read tokens), LangGraph checkpointing | reproduce the *shape* of the trade-off in our own simulation instead of quoting numbers |
| **Zero-credential deterministic default, optional LLM adapter** | upstream setup friction (DSH version pin, dedicated account, exit code 3), `autoresearch`'s `program.md` constitution | demo must run anywhere; the constitution is versioned, inspectable text, not a hidden model |
| **Real sandboxing** | upstream's explicit "not a security boundary" disclaimer; runtime supply-chain threat literature | non-negotiable for any always-on event-driven system reading untrusted feeds |

---

## 4. What we deliberately did **not** copy

- **Multi-agent debate/critique loops** (AutoGen/CrewAI style): they multiply token cost and human noise. Our workers do not talk to each other; they share a Thread only via subscriptions, exactly as the essay recommends.
- **A graph-shaped workflow DSL**: the upstream domain model is small on purpose. Adding a generic DAG would dilute the demonstration that *one* Ticket lifecycle covers four very different domains.
- **Cloud control plane / device daemons / A2A**: the essay lists these as future work and as open security questions. ARGOS-4 documents the seam but keeps execution local and inspectable.
- **Auto-merge / real PR creation**: no external credentials by design. Our "delivery" is an evidence artifact plus a short, structured reply in the originating Thread.
- **Full LLM autonomy in the default run**: a deterministic constitution makes the demo reproducible, testable and honest. The optional adapter is clearly labelled.

---

## 5. Where ARGOS-4 is genuinely novel (claims, not hype)

1. **Attention-as-a-metered-resource across domains.** The upstream philosophy is made computational: every outbound message has a word cost, an attention cost, and a reason code; speculative silence is counted as a *saving*.
2. **Evidence-gated proactivity.** Speculative workers run before anyone asks, but delivery is gated by executable evidence and a confidence threshold — combining DeepSeek's "silently reproduce and fix" with `autoresearch`'s keep/discard and ScientistOne's chain-of-evidence.
3. **One authorization contract, four radically different environments.** Shows that Mandates/Threads/Tickets are not "GitHub concepts" — they are coordination concepts.
4. **Semantic watchdog + measurable trade-off in one loop.** The system watches its own progress and reports p50/p95, router decisions, cache-read estimates, speculative waste and attention spend side by side.
5. **A complete, honest production path.** [`05-delivery/`](../05-delivery/README.md) maps every ARGOS-4 concept back to a concrete `dsh-superagent` extension (`SourceKind`, rules, prompts, prepare command, environment variables, tests), including the security work upstream explicitly leaves undone.
