# 04 — Novelty, related work, risks · Amsterdam Grid Digital Twin

## 1. What is genuinely novel here

1. **The Mandate is the simulation/actuation boundary.** A Ticket may always simulate; it may never actuate until a separate, narrow approval scope is granted. This turns a governance rule into a domain invariant rather than a prompt.
1. **Speculative what-if.** A casual 'voltage dip in sector 3 — probably nothing' starts a silent cascade simulation; if the cascade is contained, nobody is interrupted.
1. **Mitigation search as parallel workers.** Independent strategies (reroute, add reserve, shed load) are evaluated in isolated workdirs with comparable evidence schemas; the Router compares, it does not plan.
1. **Blast-radius-aware attention.** Only a high-impact recommendation costs a human decision; reversible, low-blast-radius actions are logged and delivered without an approval.
1. **Auditability by construction.** Every recommendation carries rollback plan, topology hash and the exact events that triggered it.

## 2. Related work consulted

| Work | Link |
| --- | --- |
| Agentic AI-enhanced digital twins for smart-city infrastructure (PLoS One 2026) | [link](https://pubmed.ncbi.nlm.nih.gov/42467653/) |
| AAIGF-E: unauthorized OT action execution & silent drift | [link](https://doi.org/10.3390/smartcities9100161) |
| Agentic SRE governance: reversibility / blast-radius ladder | [link](https://devsecops.ae/agentic-sre-governance-autonomous-remediation-2026/) |
| AI SRE field comparison 2026 | [link](https://fluidify.ai/blog/ai-sre-tools-2026) |
| Grid digital twins for attack/cascade simulation | [link](https://orbitaltoday.com/2026/05/27/ai-driven-grid-resilience-and-critical-infrastructure-protection/) |
| Socio-technical digital twins & cascading interdependencies | [link](https://www.sciencedirect.com/science/article/pii/S2667259624000080) |

Also see the cross-domain comparison in [`../../../00-research/02-similar-projects.md`](../../../00-research/02-similar-projects.md) and the adaptation matrix [`../../../00-research/04-feature-adaptation-matrix.md`](../../../00-research/04-feature-adaptation-matrix.md).

## 3. Risk register

| Risk | Mitigation in this mission |
| --- | --- |
| Unauthorized actuation | Hard separation: simulation is always allowed; actuation requires a new approval Mandate; forbidden actions are refused and alerted. |
| Sensor spoofing / implausible telemetry | Integrity fixture flags implausible values; watchdog escalates; evidence marks data completeness down. |
| Silent model drift | Topology hash + snapshot pinned in every artifact; drift event triggers revalidation, not silent updates. |
| Wrong mitigation causing outage | Rollback plan required; only reversible-local actions auto-deliver; human decides high-impact. |
| Over-trusting synthetic gains | UI labels all data SYNTHETIC; report states that no real-world validation is claimed. |

## 4. Safety and governance posture

- All Trigger text is untrusted data; policy is read only from `policy.json`.
- High-impact actions are staged, never executed silently.
- Workers run in isolated workdirs with stripped env and no credentials.
- All data is synthetic and labelled in the UI; no claim of real-world validation.
- Human sign-off / approval is a separate, non-delegable record where applicable.
- The append-only event log and sha256 artifact chains provide an auditable decision chain.

## 5. What would make this groundbreaking at scale

- How to bind a real digital twin / SCADA read-only API without exposing credentials.
- Whether parallel mitigation workers should share a Thread for conflict detection (upstream many-to-many subscriptions).
- Formal verification of the flow model before any production use.

If the open questions were solved, the mission would move from "sophisticated demo" to a continuously operating system that reduces human attention by an order of magnitude while producing *more* verifiable evidence. The barrier is not model capability; it is integration trust, provenance and governance.

## 6. Open questions

1. How to bind a real digital twin / SCADA read-only API without exposing credentials.
1. Whether parallel mitigation workers should share a Thread for conflict detection (upstream many-to-many subscriptions).
1. Formal verification of the flow model before any production use.

## 7. Honest limitations

- Synthetic fixtures, deterministic reasoning, simulated tools.
- No claim about model quality, legal interpretation, clinical safety or production security.
- The benchmark measures scheduling and attention, not task correctness in the real world.
- DeepSeek's published p50/p95 figures are from their synthetic workload and are never presented as ours.
