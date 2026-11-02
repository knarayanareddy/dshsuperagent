# 04 — Novelty, related work, risks · Living Audit

## 1. What is genuinely novel here

1. **The Mandate becomes an auditable authorization object.** An attestation names policy version, matched rule, requester, control set and evidence hash — the agent's own decision chain is part of the evidence.
1. **Continuous, not point-in-time.** Control telemetry drift is an event like any other Trigger; a gap creates a Ticket, a passing control produces silence.
1. **Speculative gap mapping.** A hint of upcoming guidance starts a silent gap analysis; if no controls are affected, nobody is interrupted.
1. **Non-delegable sign-off.** `sign-attestation` is always on the approval ladder and creates a separate human-authored Channel write.
1. **Policy-version revalidation as a feature.** A new policy version intentionally invalidates in-flight Evals; the demo shows the exact upstream behaviour instead of hiding it.

## 2. Related work consulted

| Work | Link |
| --- | --- |
| 5 agentic AI compliance tasks that work in 2026 | [link](https://www.surecloud.com/blog-hub/agentic-ai-compliance-tasks) |
| AI in GRC 2026 / EU AI Act Art. 72 | [link](https://feeds.trussed.ai/blog/ai-governance-risk-compliance) |
| Continuous audit readiness guide | [link](https://www.cisogenie.com/blogs/continuous-audit-readiness-guide/) |
| Agent governance becoming binding (Aug 2026) | [link](https://aigovernance.com/news/agent-governance-is-becoming-binding-what-the-august-2026-landscape-means) |
| Why 2026 redefines compliance and risk | [link](https://aijourn.com/why-2026-will-be-the-year-ai-agents-redefine-compliance-and-risk/) |
| Governance-by-construction / policy-as-code agents | [link](https://jiongan.mu/notes/may-2026-ai-agent-paper-dump.html) |

Also see the cross-domain comparison in [`../../../00-research/02-similar-projects.md`](../../../00-research/02-similar-projects.md) and the adaptation matrix [`../../../00-research/04-feature-adaptation-matrix.md`](../../../00-research/04-feature-adaptation-matrix.md).

## 3. Risk register

| Risk | Mitigation in this mission |
| --- | --- |
| Agent makes a regulatory interpretation | Explicitly out of scope; rules only map and test; report states 'no legal interpretation'. |
| Self-signed attestation | `signOff` must be null until a separate human approval record exists; injection fixture asserts this. |
| Stale evidence | `evidenceFreshness` from telemetry ticks; stale evidence lowers confidence below threshold. |
| Policy drift silently widening authority | Policy version change invalidates in-flight Evals and forces Mandate revalidation on resume. |
| Audit tampering | Append-only event log + sha256 chain + non-delegable sign-off record. |

## 4. Safety and governance posture

- All Trigger text is untrusted data; policy is read only from `policy.json`.
- High-impact actions are staged, never executed silently.
- Workers run in isolated workdirs with stripped env and no credentials.
- All data is synthetic and labelled in the UI; no claim of real-world validation.
- Human sign-off / approval is a separate, non-delegable record where applicable.
- The append-only event log and sha256 artifact chains provide an auditable decision chain.

## 5. What would make this groundbreaking at scale

- Connecting to real control registries and evidence stores (IAM, SIEM, HRIS).
- Legal review workflow for obligation interpretation.
- Retention/expiry semantics for attestations across policy versions.

If the open questions were solved, the mission would move from "sophisticated demo" to a continuously operating system that reduces human attention by an order of magnitude while producing *more* verifiable evidence. The barrier is not model capability; it is integration trust, provenance and governance.

## 6. Open questions

1. Connecting to real control registries and evidence stores (IAM, SIEM, HRIS).
1. Legal review workflow for obligation interpretation.
1. Retention/expiry semantics for attestations across policy versions.

## 7. Honest limitations

- Synthetic fixtures, deterministic reasoning, simulated tools.
- No claim about model quality, legal interpretation, clinical safety or production security.
- The benchmark measures scheduling and attention, not task correctness in the real world.
- DeepSeek's published p50/p95 figures are from their synthetic workload and are never presented as ours.
