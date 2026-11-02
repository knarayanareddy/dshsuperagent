# 04 — Novelty, related work, risks · Helios Replication Lab

## 1. What is genuinely novel here

1. **Speculative falsification.** A chat claim starts a silent reproduction before anyone asks. Reproduces → say nothing; fails → deliver one short, evidence-linked result. The default output of a research agent becomes silence.
1. **Attention-bounded science.** The 100-word cap, one-ack rule and `observe` mode are applied to scientific discussion, where paper-length outputs would be actively harmful.
1. **Replication as an authorization problem.** A Mandate records exactly which dataset version, policy version and matched rule authorized a recomputation — so a later 'that used v2, not v3' dispute is answerable by inspection.
1. **Evidence before prose.** A result cannot be reported without `evidence.json` containing bootstrap CI, seed runs and a replay seed; this inverts the AI Scientist failure mode.

## 2. Related work consulted

| Work | Link |
| --- | --- |
| The AI Scientist (Sakana AI, Nature 2026) | [link](https://www.nature.com/articles/d41586-026-00899-w) |
| Independent evaluation: 42% experiment coding errors | [link](https://arxiv.org/abs/2502.14297) |
| ScientistOne / Chain-of-Evidence integrity audit | [link](https://explainx.ai/blog/google-ai-scientist-scientistone-icml-2026-chain-of-evidence) |
| Karpathy autoresearch: one file, one metric, five minutes | [link](https://arunbaby.com/ai-agents/0063-karpathys-autoresearch-ai-agent-runs-100-experiments-while-you-sleep/) |
| Google AI co-scientist / drug-discovery agent review | [link](https://www.nature.com/articles/s44386-026-00075-0) |
| Robin, Virtual Lab, ChemAgents, Osprey in the 2026 survey | [link](https://www.researchgate.net/publication/416596288_Agentic_AI_systems_for_scientific_discovery) |

Also see the cross-domain comparison in [`../../../00-research/02-similar-projects.md`](../../../00-research/02-similar-projects.md) and the adaptation matrix [`../../../00-research/04-feature-adaptation-matrix.md`](../../../00-research/04-feature-adaptation-matrix.md).

## 3. Risk register

| Risk | Mitigation in this mission |
| --- | --- |
| Misleading p-values / seed sensitivity | Bootstrap CI + 12-seed sweep + explicit limitations section; never claim significance without all checks. |
| Metric gaming / p-hacking by an LLM | Deterministic constitution pins the metric and dataset; no model may choose the test. |
| Hallucinated citations | No literature synthesis in scope; every number comes from `evidence.json`. |
| Prompt injection in a preprint abstract | Text is data; policy read only from `policy.json`; fixture asserts no mutation. |
| Research credit / authorship | Human signs off on any external communication; system never publishes. |

## 4. Safety and governance posture

- All Trigger text is untrusted data; policy is read only from `policy.json`.
- High-impact actions are staged, never executed silently.
- Workers run in isolated workdirs with stripped env and no credentials.
- All data is synthetic and labelled in the UI; no claim of real-world validation.
- Human sign-off / approval is a separate, non-delegable record where applicable.
- The append-only event log and sha256 artifact chains provide an auditable decision chain.

## 5. What would make this groundbreaking at scale

- How to connect a real dataset registry and pin versions cryptographically.
- Whether a falsification should create a new Ticket or resume the claim Thread (currently: promote the speculative Ticket, keep the Thread).
- Long-term memory across months of claims — upstream essay §8.1 calls this the scaling bottleneck.

If the open questions were solved, the mission would move from "sophisticated demo" to a continuously operating system that reduces human attention by an order of magnitude while producing *more* verifiable evidence. The barrier is not model capability; it is integration trust, provenance and governance.

## 6. Open questions

1. How to connect a real dataset registry and pin versions cryptographically.
1. Whether a falsification should create a new Ticket or resume the claim Thread (currently: promote the speculative Ticket, keep the Thread).
1. Long-term memory across months of claims — upstream essay §8.1 calls this the scaling bottleneck.

## 7. Honest limitations

- Synthetic fixtures, deterministic reasoning, simulated tools.
- No claim about model quality, legal interpretation, clinical safety or production security.
- The benchmark measures scheduling and attention, not task correctness in the real world.
- DeepSeek's published p50/p95 figures are from their synthetic workload and are never presented as ours.
