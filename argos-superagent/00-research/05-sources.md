# 05 — Source bibliography

All web sources consulted during the research pass (2026-11-02). Primary sources first. Rankings, vendor blogs and aggregators are used for landscape/context only, never as the sole basis for a technical claim about the upstream repository — those claims come from the cloned repository's own docs and code.

## Primary

| ID | Source | Used for |
|---|---|---|
| P1 | <https://github.com/deepseek-ai/dsh-superagent-prototype> (clone: `research/dsh-superagent/`, commit `6337fc8`) | all framework claims; README, SETUP, docs 000–008, prompts, skills, `package.json`, `cordis.patch.yml` |
| P2 | <https://offloop.org/learn/exploring-deepseek-super-agent-design> (full English translation of the WeChat essay; original <https://mp.weixin.qq.com/s/zoS7GlReWPhfCjENGxXCdg>) | two-layer architecture, filtering, subscriptions, Inline & Spill, Chain of Recall, speculation, async ReAct, compute/state separation, Watchdog, experiments, open questions |
| P3 | <https://www.deepseek.com/en/harness/> | what DSH is |
| P4 | <https://arxiv.org/html/2511.03690v1> — *The OpenHands Software Agent SDK* | event-sourced state, deterministic replay, immutable components, security/confirmation |
| P5 | <https://www.nature.com/articles/d41586-026-00899-w> — *How to build an AI scientist* | AI Scientist peer-reviewed methodology, limitations |
| P6 | <https://arxiv.org/abs/2502.14297> — *Evaluating Sakana's AI Scientist* | 42% experiment coding failures, weak citations, speed/cost |
| P7 | <https://www.nature.com/articles/s44386-026-00075-0> — agentic AI in drug discovery | Virtual Lab, ChemAgents, PharmAgents, STELLA, multi-agent decomposition |
| P8 | <https://pubmed.ncbi.nlm.nih.gov/42467653/> — Agentic AI-enhanced digital twins for smart-city infrastructure (PLoS One 2026) | detection latency, mitigation success, operator workload, auditability |
| P9 | <https://doi.org/10.3390/smartcities9100161> — AAIGF-E | unauthorized OT action execution, silent model drift, prompt-injection pathway |
| P10 | <https://arxiv.org/abs/2603.10057> — *SBOMs into Agentic AIBOMs* | runtime provenance, exploitability context, reproducibility |
| P11 | <https://www.frontiersin.org/journals/artificial-intelligence/articles/10.3389/frai.2026.1826384/full> — execution-bound CSAF-VEX framework | F1 0.93 vs 0.78, 37–42% fewer false positives, signed advisories, deterministic replay |
| P12 | <https://arxiv.org/html/2602.19555v1> — agentic AI as a cybersecurity attack surface | dynamic runtime supply chain, semantic malware, prompt injection, viral agent loop |
| P13 | <https://www.sciencedirect.com/science/article/pii/S2667259624000080> — socio-technical digital twins | cascading interdependencies, demand synchronization |
| P14 | <https://arxiv.org/html/2604.14228v1> — *Dive into Claude Code* | subagent delegation axes, isolation architecture |

## Secondary — framework / orchestration landscape

| ID | Source | Used for |
|---|---|---|
| S1 | <https://www.developersdigest.tech/blog/deepseek-dsh-superagent-router-worker-always-on-agent-2026> | router/worker summary, security caveat, batching numbers |
| S2 | <https://explainx.ai/blog/deepseek-super-agent-architecture-router-worker-triggers-watchdog-2026> | essay section map, p50/p95, copy-this-today table |
| S3 | <https://blog.laozhang.ai/en/posts/deepseek-super-agent-github> | setup checklist, DSH version pin, exit code 3, disabled issue tracker |
| S4 | <https://aicybr.com/blog/deepseek-dsh-superagent-prototype-setup-security> | prerequisites, version, evaluation/execution settings |
| S5 | <https://www.marktechpost.com/2026/11/01/deepseek-dsh-superagent-router-worker-coding-agent/> | release facts, synthetic-only benchmark caveat, isolation warning |
| S6 | <https://devops.com/deepseek-wants-coding-agents-to-stop-waiting-for-instructions> | DevOps framing, permissions/observability/verification challenges |
| S7 | <https://offloop.org/learn/deepseek-super-agent-design> | comparison tables: DeepSeek vs Claude Code vs Codex; personal agents |
| S8 | <https://replicas.dev/resources/agent-orchestration> | 9 orchestration platforms, work starters, worktree/VM isolation |
| S9 | <https://www.openhands.dev/blog/best-coding-agents> | autonomy tiers, Agent Canvas, ACP |
| S10 | <https://htek.dev/articles/all-agent-harnesses-live-comparison> | harness categories, multi-agent features, governance |
| S11 | <https://zylos.ai/research/2026-02-17-durable-execution-ai-agents/> | event sourcing, checkpointing, step retries, speculative verification (Sherlock) |
| S12 | <https://zylos.ai/research/2026-04-14-graph-based-agent-workflow-orchestration-production/> | typed state, checkpointing, Temporal/LangGraph hybrid backbone |
| S13 | <https://agentmarketcap.ai/blog/2026/04/10/durable-agent-execution-production-temporal-modal-event-sourced> | event-history replay, partial completion, dual persistence |
| S14 | <https://dev.to/truongpx396/openhands-deep-dive-build-your-own-guide-1al0> | event stream as single source of truth, stuck detection, budget controls |
| S15 | <https://www.alphaxiv.org/abs/2511.03690> | OpenHands replay latency, stateless agent, immutable config |
| S16 | <https://resources.rework.com/tools/ai-agents/best-ai-coding-agents-2026> | autonomy ladder, sandboxes, review workflows |
| S17 | <https://futureagi.com/blog/best-agent-harness/> | harness shortlist, event-stream architecture |
| S18 | <https://www.augmentcode.com/tools/best-ai-coding-agent-desktop-apps> | coordinator/specialist/verifier, living spec, parallel sandboxes |
| S19 | <https://mem0.ai/library/coding-agents/openai-codex-vs-claude-code-which-ai-coding-agent-wins-in-2026> | worktree vs subagent isolation, agent teams |
| S20 | <https://ai-tldr.dev/releases/deepseek-dsh-superagent/> | Sources, Ticket, SQLite, outbox, panel summary |
| S21 | <https://dev.to/paullovelace/deepseek-super-agent-a-proactive-open-source-coding-agent-prototype-what-it-actually-is-and-438a> | "what it is / is not yet" framing |

## Secondary — domain frontier

| ID | Source | Used for |
|---|---|---|
| D1 | <https://rywalker.com/research/ai-scientist> | AI Scientist v2 milestones, license, GPU cost |
| D2 | <https://o-mega.ai/articles/karpathy-autoresearch-complete-2026-guide> | autoresearch loop, AI co-scientist, comparative limitations |
| D3 | <https://arunbaby.com/ai-agents/0063-karpathys-autoresearch-ai-agent-runs-100-experiments-while-you-sleep/> | `program.md`, one-file/one-metric/five-minute constraint |
| D4 | <https://explainx.ai/blog/google-ai-scientist-scientistone-icml-2026-chain-of-evidence> | Chain-of-Evidence integrity audit, ScientistOne |
| D5 | <https://agentmarketcap.ai/blog/2026/04/07/ai-agents-scientific-research-2026-autonomous-discovery> | self-driving labs, literature synthesis pitfalls, human verification |
| D6 | <https://www.scispot.com/blog/ai-powered-self-driving-labs-accelerating-life-science-r-d> | closed-loop lab workflow |
| D7 | <https://www.alphaxiv.org/abs/2606.15497> | end-to-end automation of AI research abstract |
| D8 | <https://jiongan.mu/notes/may-2026-ai-agent-paper-dump.html> | POISE, CORAL, EvoScientist, SASAV, governance-by-construction |
| D9 | <https://www.researchgate.net/publication/416596288_Agentic_AI_systems_for_scientific_discovery> | Robin, Coscientist, Osprey, El Agente, Agentomics |
| D10 | <https://www.sherlocks.ai/blog/top-ai-sre-tools-in-2026> | institutional memory, checklists, approval-gated remediation |
| D11 | <https://devsecops.ae/agentic-sre-governance-autonomous-remediation-2026/> | reversibility/blast-radius autonomy ladder, audit logging |
| D12 | <https://fluidify.ai/blog/ai-sre-tools-2026> | confidence-scored hypotheses, parallel RCA, HITL |
| D13 | <https://autoheal.ai/learn/what-is-agentic-sre-ai-agents-replace-manual-investigation> | Triager/Hypothesizer/Verifier, production context graphs |
| D14 | <https://luminabyte.de/en/blog/ai-agents-sre-incident-response> | proposal-and-approval pattern, staged rollout plan |
| D15 | <https://orbitaltoday.com/2026/05/27/ai-driven-grid-resilience-and-critical-infrastructure-protection/> | grid digital twins for attack/cascade simulation, edge AI |
| D16 | <https://link.springer.com/chapter/10.1007/978-981-95-7105-5_25> | urban infrastructure resilience simulation |
| D17 | <https://failurefirst.org/research/reports/36-semantic-supply-chain-vulnerabilities/> | ClawdHub/skill registries, AI-BOM, signed prompts |
| D18 | <https://lyrie.ai/research/research/2026-05-11-agent-defense-supply-chain-risk> | signed tool definitions, attestation, behavioral auditing |
| D19 | <https://www.surecloud.com/blog-hub/agentic-ai-compliance-tasks> | five automatable compliance tasks and what stays human |
| D20 | <https://feeds.trussed.ai/blog/ai-governance-risk-compliance> | continuous evidence streams, EU AI Act Art. 72 |
| D21 | <https://www.cisogenie.com/blogs/continuous-audit-readiness-guide/> | control cross-mapping, evidence automation, tamper-proof trails |
| D22 | <https://aigovernance.com/news/agent-governance-is-becoming-binding-what-the-august-2026-landscape-means> | binding delegation-chain/HITL expectations |
| D23 | <https://aijourn.com/why-2026-will-be-the-year-ai-agents-redefine-compliance-and-risk/> | point-in-time vs continuous assurance |
| D24 | <https://aiandsons.com/blog/agentic-ai-breakthrough-2026> | intent-based computing, agentic observability, governance-by-design |
| D25 | <https://time.news/deepseek-releases-dsh-superagent-experimental-coding-prototype/> | internal usage: bug reproduction, code review, framework iteration |
| D26 | <https://fourweekmba.com/ai-deepseek-releases-agent-that-works-github-issues-in-parallel/> | "attention as bottleneck" business framing |

## Citation policy

In chat responses, claims derived from web searches are cited as the numeric search-result id together with its URL. In these workspace documents, sources are cited by descriptive markdown links or by the IDs above. Benchmark figures attributed to DeepSeek's essay are always labelled *synthetic / preliminary* and are never presented as ARGOS-4 measurements.
