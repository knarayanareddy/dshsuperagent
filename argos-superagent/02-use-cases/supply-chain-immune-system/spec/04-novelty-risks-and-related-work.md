# 04 — Novelty, related work, risks · Immune System

## 1. What is genuinely novel here

1. **Speculative exploitability reproduction.** An advisory starts a silent reachability + exploit test. Unreachable → discard silently; reachable → one short result with a VEX statement, patch and attestation.
1. **Proof-carrying 'not affected'.** The system's most valuable output is a negative result backed by a reproducible test, not a patch.
1. **AIBOM-aware provenance.** Every artifact records the policy version and a hash chain, extending SBOM-style provenance to the agent's own decision chain.
1. **Patch as a draft, not a merge.** High-impact production patching is staged for approval; the demo never pushes anywhere.
1. **Silence as noise reduction.** The headline metric is alerts *avoided*, not CVEs found.

## 2. Related work consulted

| Work | Link |
| --- | --- |
| SBOMs into Agentic AIBOMs (arXiv 2603.10057) | [link](https://arxiv.org/abs/2603.10057) |
| Execution-bound CSAF-VEX framework (F1 0.93 vs 0.78) | [link](https://www.frontiersin.org/journals/artificial-intelligence/articles/10.3389/frai.2026.1826384/full) |
| Agentic AI as a runtime supply-chain attack surface | [link](https://arxiv.org/html/2602.19555v1) |
| Semantic supply chain / skill registry risks | [link](https://failurefirst.org/research/reports/36-semantic-supply-chain-vulnerabilities/) |
| Signed tool definitions & attestation guidance | [link](https://lyrie.ai/research/research/2026-05-11-agent-defense-supply-chain-risk) |
| Upstream cookbook: adding a Source | [link](https://github.com/deepseek-ai/dsh-superagent-prototype/blob/main/docs/008-cookbook.md) |

Also see the cross-domain comparison in [`../../../00-research/02-similar-projects.md`](../../../00-research/02-similar-projects.md) and the adaptation matrix [`../../../00-research/04-feature-adaptation-matrix.md`](../../../00-research/04-feature-adaptation-matrix.md).

## 3. Risk register

| Risk | Mitigation in this mission |
| --- | --- |
| False positives from static matching | Execution-bound reachability + deterministic exploit test; two independent traversals must agree. |
| Executing exploit code unsafely | Fixture is pure deterministic JS in an isolated workdir; no network, no shell, no real package execution. |
| Unauthorized production patch | Patch is a draft; `patch-prod` is on the `approve` ladder; `external-write` is forbidden. |
| Semantic malware in skills/prompts | Prompt-injection fixture; policy never read from event text; tool definitions are code, not fetched content. |
| Attestation tampering | sha256 chain over artifacts + mandate + policy version, recorded in the append-only event log. |

## 4. Safety and governance posture

- All Trigger text is untrusted data; policy is read only from `policy.json`.
- High-impact actions are staged, never executed silently.
- Workers run in isolated workdirs with stripped env and no credentials.
- All data is synthetic and labelled in the UI; no claim of real-world validation.
- Human sign-off / approval is a separate, non-delegable record where applicable.
- The append-only event log and sha256 artifact chains provide an auditable decision chain.

## 5. What would make this groundbreaking at scale

- Binding to real OSV/GHSA feeds and real SBOMs (CycloneDX/SPDX).
- Signed tool definitions / MCP provenance for agent skills.
- Whether a `not_affected` statement should expire when the SBOM changes (currently: new snapshot triggers revalidation).

If the open questions were solved, the mission would move from "sophisticated demo" to a continuously operating system that reduces human attention by an order of magnitude while producing *more* verifiable evidence. The barrier is not model capability; it is integration trust, provenance and governance.

## 6. Open questions

1. Binding to real OSV/GHSA feeds and real SBOMs (CycloneDX/SPDX).
1. Signed tool definitions / MCP provenance for agent skills.
1. Whether a `not_affected` statement should expire when the SBOM changes (currently: new snapshot triggers revalidation).

## 7. Honest limitations

- Synthetic fixtures, deterministic reasoning, simulated tools.
- No claim about model quality, legal interpretation, clinical safety or production security.
- The benchmark measures scheduling and attention, not task correctness in the real world.
- DeepSeek's published p50/p95 figures are from their synthetic workload and are never presented as ours.
