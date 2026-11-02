# 03 — Use-case landscape: 16 candidates, scored

**Research question:** given a Router/Worker/Thread/Mandate engine optimized for *human attention*, which applications are innovative, novel and potentially groundbreaking — and which can be demonstrated end to end without credentials?

**Method:** landscape review of autonomous science, agentic SRE, digital twins, supply-chain assurance, continuous GRC, agent governance, durable agent execution and multi-agent research (sources in [`05-sources.md`](05-sources.md)); then scoring against a fixed rubric. Scores are 1–5.

**Rubric**

| Axis | Meaning |
|---|---|
| **Novelty** | How far beyond "issue → PR bot" / chatbot wrapper |
| **Fit** | How naturally the upstream Trigger→Thread→Eval→Mandate→Ticket→Outbox contract applies |
| **Evidence** | Can a worker produce machine-checkable, reproducible evidence? (Critical: avoids the AI Scientist's 42% coding-error failure mode) |
| **Demo** | Can it be shown end to end, visually, with zero credentials and real execution? |
| **Impact** | Potential value if it worked at scale |
| **Risk** | 5 = highest safety/governance risk; mitigated by tiered autonomy in the spec |

---

## 1. Scorecard

| # | Use case | Novelty | Fit | Evidence | Demo | Impact | Risk | Total /30 |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| 1 | **Autonomous replication / AI-science lab** | 5 | 5 | 5 | 5 | 5 | 3 | **28** ✅ selected |
| 2 | **Self-healing infrastructure digital twin** | 5 | 5 | 5 | 5 | 5 | 4 | **29** ✅ selected |
| 3 | **Supply-chain immune system (execution-bound VEX)** | 4 | 5 | 5 | 5 | 5 | 3 | **27** ✅ selected |
| 4 | **Living regulatory / audit agent** | 4 | 5 | 5 | 4 | 5 | 4 | **27** ✅ selected |
| 5 | Cross-channel "institutional memory" agent for an engineering org | 4 | 5 | 4 | 4 | 4 | 2 | 23 |
| 6 | Autonomous accessibility / UX conformance agent with before-after evidence | 4 | 4 | 5 | 4 | 4 | 2 | 23 |
| 7 | Climate / grid resilience "what-if" swarm with public data | 5 | 4 | 4 | 4 | 5 | 4 | 26 |
| 8 | Continuous model-evaluation & red-team agent for deployed LLMs | 4 | 5 | 5 | 4 | 5 | 3 | 26 |
| 9 | Clinical evidence synthesis with provenance (read-only, no advice) | 5 | 4 | 5 | 3 | 5 | 5 | 27 |
| 10 | DAO / treasury governance watchdog with on-chain simulation | 5 | 4 | 5 | 4 | 4 | 5 | 27 |
| 11 | Agentic scientific-facility control room (Osprey-style, safety-critical) | 5 | 5 | 5 | 2 | 5 | 5 | 27 |
| 12 | Personal "attention firewall" across email/chat/calendar | 4 | 5 | 3 | 4 | 4 | 3 | 23 |
| 13 | Open-source maintainer swarm: triage, repro, reviewer routing | 3 | 5 | 5 | 5 | 4 | 2 | 24 |
| 14 | Autonomous data-contract / schema-drift negotiator between teams | 4 | 5 | 5 | 4 | 4 | 2 | 24 |
| 15 | Adversarial "red agent" that speculatively attacks your own agent system | 5 | 4 | 5 | 4 | 5 | 5 | 28 |
| 16 | Public-interest policy simulator: legislation → executable microsimulation | 5 | 3 | 4 | 3 | 5 | 4 | 24 |

**Why the four selected:** they are mutually *different* environments (claim+data, telemetry+topology, dependency graph+advisory, regulation+control set) but share the same authorization and attention contract. Together they demonstrate that the architecture generalizes, while each has a real, executable evidence artifact. #2 scores highest; #1 is the most "groundbreaking" narratively; #3 is closest to the upstream coding domain; #4 is the most enterprise-relevant. #15 scored high but was deliberately deferred: it needs a hardened outer sandbox before it is responsible to demo.

---

## 2. Deep dives on the four selected domains

### 2.1 Autonomous replication / AI-science lab

**Signal:** literature/paper claims, dataset uploads, chat claims, reviewer comments, CI of an analysis pipeline.
**Work:** recompute statistics from a pinned dataset, run seed-sensitivity sweeps, check effect-size claims, write a replication report.
**Grounding:** The AI Scientist showed the full loop is possible but also that 42% of experiments failed with coding errors and manuscripts contained weak/fabricated numbers; ScientistOne's Chain-of-Evidence audit binds claims to raw logs; `autoresearch` proved a *narrow, metric-bound* loop beats maximalism; Google's co-scientist validated biomedical hypotheses in wet lab while keeping humans in the execution loop. See [Nature methodology feature](https://www.nature.com/articles/d41586-026-00899-w), [independent AI Scientist evaluation](https://arxiv.org/abs/2502.14297), [ScientistOne CoE](https://explainx.ai/blog/google-ai-scientist-scientistone-icml-2026-chain-of-evidence), [autoresearch guide](https://o-mega.ai/articles/karpathy-autoresearch-complete-2026-guide), [drug-discovery agent review](https://www.nature.com/articles/s44386-026-00075-0).
**Novel move:** *speculative falsification*. A claim in chat starts a silent reproduction. If it reproduces, the agent says nothing (attention saved). If it fails, it delivers a short, evidence-linked "not reproducible" result. The agent's default output is silence.
**Groundbreaking potential:** an always-on, adversarial-but-quiet replication layer attached to every internal research discussion — a "replication immune system" for science.

### 2.2 Self-healing infrastructure digital twin

**Signal:** sensor telemetry, deploy events, alerts, chat speculation about a voltage dip, config snapshots.
**Work:** simulate cascading failure on a graph; compare mitigation strategies; classify blast radius; stage high-risk mitigations for human approval.
**Grounding:** a 2026 PLoS One agentic digital-twin study reports large synthetic gains in detection latency, mitigation success and operator workload; grid governance work explicitly models unauthorized OT actuation and silent model drift; agentic SRE practice has converged on a **tiered autonomy ladder** (read-only → suggest → approve → auto-execute only reversible low-risk actions). See [PLoS One](https://pubmed.ncbi.nlm.nih.gov/42467653/), [AAIGF-E](https://doi.org/10.3390/smartcities9100161), [autonomous remediation governance](https://devsecops.ae/agentic-sre-governance-autonomous-remediation-2026/), [AI SRE comparison](https://fluidify.ai/blog/ai-sre-tools-2026), [grid digital twins](https://orbitaltoday.com/2026/05/27/ai-driven-grid-resilience-and-critical-infrastructure-protection/).
**Novel move:** the *mandate scope* is the boundary between simulation and actuation. A Ticket may always simulate; it may never actuate without a new approval-granted scope. Speculative what-if runs happen while humans are still discussing.
**Groundbreaking potential:** an agent that reduces operator attention by 90% in simulation *without ever silently touching production* — the governance pattern that makes autonomy acceptable in critical infrastructure.

### 2.3 Supply-chain immune system

**Signal:** advisories (OSV/GHSA), dependency-bot PRs, SBOM snapshots, CI, "are we affected?" chat.
**Work:** determine reachability/activation path, run a deterministic exploitability test, produce a VEX-style statement, patch and a signed attestation.
**Grounding:** 2026 research moves from static SBOM–CVE correlation to **execution-bound** exploitability with runtime telemetry and deterministic replay (F1 0.93 vs 0.78; 37–42% fewer false positives); agent-runtime supply chains add semantic/prompt-level malware, so skill and tool provenance also needs attestation. See [arXiv 2603.10057](https://arxiv.org/abs/2603.10057), [CSAF-VEX framework](https://www.frontiersin.org/journals/artificial-intelligence/articles/10.3389/frai.2026.1826384/full), [runtime supply-chain threats](https://arxiv.org/html/2602.19555v1), [semantic supply chain](https://failurefirst.org/research/reports/36-semantic-supply-chain-vulnerabilities/).
**Novel move:** speculative reproduction of an advisory *before* anyone asks; drops the work silently if the vulnerable function is unreachable, delivering a "not affected, with proof" VEX only when useful.
**Groundbreaking potential:** replacing vulnerability-notification fatigue with proof-carrying, continuously regenerated "not affected" statements.

### 2.4 Living regulatory / audit agent

**Signal:** regulation feeds, control telemetry, policy versions, evidence drift, auditor questions.
**Work:** map changed obligations to controls, run control tests against fixtures, compute gaps, produce a tamper-evident attestation pending human sign-off.
**Grounding:** continuous compliance is replacing point-in-time audits; agentic GRC automates evidence collection, continuous control monitoring and regulatory change mapping, while human judgement remains required for interpretation, risk acceptance and final sign-off; EU AI Act Art. 72 post-market monitoring is a live driver; 2026 governance guidance is becoming binding on delegation chains and HITL gates. See [agentic compliance tasks](https://www.surecloud.com/blog-hub/agentic-ai-compliance-tasks), [AI in GRC 2026](https://feeds.trussed.ai/blog/ai-governance-risk-compliance), [continuous audit readiness](https://www.cisogenie.com/blogs/continuous-audit-readiness-guide/), [agent governance landscape](https://aigovernance.com/news/agent-governance-is-becoming-binding-what-the-august-2026-landscape-means), [compliance redefinition](https://aijourn.com/why-2026-will-be-the-year-ai-agents-redefine-compliance-and-risk/).
**Novel move:** the **Mandate** becomes an auditable authorization object: which policy version, which control set, which matched rule authorized this attestation — and a human sign-off is a separate, non-delegable Channel write.
**Groundbreaking potential:** "audit readiness" becomes a continuously measured property rather than a quarterly scramble; the agent's own decision chain becomes part of the evidence.

---

## 3. The eight additional concepts, briefly

5. **Institutional memory agent** — one persistent Router for an org's Slack/GitHub/docs; answers "where was decision X made?" via Chain of Recall. Low risk, high fit; less visually dramatic.
6. **Accessibility conformance agent** — speculatively renders UI states, compares before/after screenshots and WCAG checks; upstream prompts explicitly warn about visual feedback without a settled target, so a specification is required first.
7. **Climate/grid what-if swarm** — same digital twin as #2 but with public climate datasets and longer horizons; higher data/engineering cost.
8. **Continuous model-eval & red-team agent** — speculatively generates adversarial eval suites whenever a model/prompt changes; very strong evidence story; deferred because it overlaps #15.
9. **Clinical evidence synthesis** — read-only provenance-bound summaries with explicit "no advice" scope; enormous impact, highest regulatory risk.
10. **DAO/treasury watchdog** — simulate governance proposals on-chain before voting; novel, but crypto-specific and high-risk.
11. **Scientific-facility control room** — Osprey-style safety-critical orchestration; the purest fit for Mandates, but cannot be demoed responsibly in a sandbox without hardware.
12. **Personal attention firewall** — the original personal-agent use case; applies the 100-word/observe-mode discipline to email/chat/calendar.
13. **Open-source maintainer swarm** — triage, repro, reviewer routing; closest to upstream, lowest novelty.
14. **Data-contract negotiator** — detect schema drift, speculatively generate compatible migrations, hand back when a product decision is needed; excellent fit for "hand back" semantics.
15. **Adversarial red agent** — an always-on agent that speculatively attacks your own agent system and only speaks when it finds a real exploit. Highest novelty/impact, highest safety burden; see [`05-delivery/handoff.md`](../05-delivery/handoff.md) for the hardening gate required before building it.
16. **Policy microsimulation** — legislation → executable model → distributional impact; groundbreaking civic potential, weaker event-stream fit.

---

## 4. Cross-cutting research findings that shaped the specs

1. **Human attention is the stated bottleneck.** The essay estimates a person can track 3–5 active sessions; its synthetic experiment improved p50 from 20.4 → 12.4 min and p95 from 29.5 → 15.7 min, at ~2–4× cache-read tokens. ARGOS-4 reproduces the *trade-off shape* with its own benchmark rather than quoting these figures as truth. [essay §7](https://offloop.org/learn/exploring-deepseek-super-agent-design), [MarkTechPost](https://www.marktechpost.com/2026/11/01/deepseek-dsh-superagent-router-worker-coding-agent/).
2. **Execution grounding beats fluency.** AI Scientist's 42% experiment-coding failures and ScientistOne's integrity audit both point the same way: artifact > prose.
3. **Autonomy must be tiered by reversibility and blast radius.** Every 2026 SRE/governance source converges on this; ARGOS-4 encodes it as a Policy field, not a prompt.
4. **Event sourcing is the standard reliability substrate.** OpenHands, Temporal and LangGraph all converge on append-only logs/checkpoints; ARGOS-4 uses an event log as the single source of truth.
5. **Proactivity without silence is spam.** `observe` mode, the 100-word cap and "speak only when a person must act or can use a result" are the upstream answer; ARGOS-4 adds a quantified silence counter.
6. **Untrusted event streams are the largest unsolved risk.** Prompt injection through comments, quotes, advisories and skills is documented across the runtime supply-chain literature. All four specs treat Trigger text as data and keep policy in code.

---

## 5. Selection decision

Build **#1, #2, #3, #4** as four Source packs over one engine. Compute the other twelve as scored concepts in this document, with #15 explicitly queued behind a security-hardening gate. This satisfies "all 4 if possible" while still doing ample research on the broader frontier.

Next: [`01-spec/`](../01-spec/README.md) defines the shared contract; each domain folder in [`02-use-cases/`](../02-use-cases/00-index.md) then specializes it with its own spec set and per-phase checklist.
