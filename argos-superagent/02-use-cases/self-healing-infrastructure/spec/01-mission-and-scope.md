# 01 — Mission, scope and invariants · Amsterdam Grid Digital Twin

## 1. Problem statement

Operators of coupled infrastructure do not lack alerts — they lack *safe, timely, accountable intervention*. An anomaly on one transformer can cascade through a graph of loads that nobody has in their head. 2026 agentic-SRE practice has converged on a hard rule: agents investigate autonomously, but any action with a large or irreversible blast radius stays human-approved. Grid-sector governance research explicitly models the failure mode of an agent that misreads an investigation mandate as authorization to actuate OT configuration. The hard problem is therefore not detection; it is proving, in simulation, that a proposed mitigation is worth one human decision.

## 2. Why this is timely

A 2026 PLoS One agentic digital-twin study reports (in synthetic evaluation) mean detection latency 3,197s vs 39,374s rule-based, mitigation success 66.2% vs 45.5%, and operator workload reduction 91.7%, attributing gains mainly to multi-agent orchestration. EPRI and National Grid ESO pilots use digital twins to simulate cascading failures without touching live systems. DeepSeek's speculative execution pattern lets that simulation start while humans are still discussing the alert.

## 3. Goals

| ID | Goal | Acceptance |
|---|---|---|
| G1 | Consume environmental events under written rules | >=1 inferred `would_accept` in `observe`, zero Tickets from it |
| G2 | Authorize work with an immutable Mandate | every Ticket names a policy version, strength, scope and matched rule |
| G3 | Produce execution-grounded evidence | every `ready` Report has `evidence.json` plus the required artifacts |
| G4 | Minimize human attention | one ack, <=100-word chat messages, silence while working |
| G5 | Act ahead safely | >=1 speculative promote and >=1 speculative silent discard |
| G6 | Respect the autonomy ladder | high-impact actions never execute without a recorded approval |
| G7 | Be auditable | Trigger → Decision → Mandate → Evidence → Reply is expandable in the UI |

## 4. Non-goals

- No real-world actuation, publication, merging or signing on behalf of a person.
- No regulatory/legal interpretation, medical advice, or production security claims.
- No live external feeds; all fixtures are synthetic and labelled.
- No new Engine concepts: no domain-specific state machines or tables in `engine.js`.
- No LLM-authenticated reasoning in the default run; the constitution is deterministic.

## 5. Personas

| Persona | Needs | System owes them |
|---|---|---|
| Domain expert / on-call / security lead / auditor | correct, verifiable result | evidence, confidence, replay seed, explicit limitations |
| Supervisor | know what needs them now | one collapsed "needs me" card; no healthy-state noise |
| Reviewer / auditor | provenance | policy version, matched rule, mandate id, artifact hash |
| Demo audience | understand the architecture | visible fast path, silent discard, approval, watchdog alert, benchmark |

## 6. Scope boundaries

| In scope | Out of scope |
|---|---|
| synthetic event streams, deterministic experiments, draft artifacts, provisional attestations, approval staging, evidence chain | real integrations, real credentials, production writes, long-term memory, A2A, cloud daemons, publication |

## 7. Mission-specific invariants

- No actuation artifact exists before an approval record.
- Approval produces exactly one new narrow Mandate scope and one attention receipt.
- Forbidden action is refused with a watchdog alert and zero external writes.
- Sensor-integrity fixture reduces `topologyCompleteness` and raises a flag.
- Speculative contained dip produces zero outbound messages.
- `evidence.json` includes `rollbackPlan` for every high-impact mitigation.

Plus the ten platform invariants in [`../../../01-spec/README.md`](../../../01-spec/README.md).

## 8. Mapping to the upstream framework

| ARGOS-4 concept here | upstream counterpart |
|---|---|
| Source pack (`self-healing-infrastructure`) | `SourceKind` from `docs/008-cookbook.md` |
| Event templates | GitHub/Feishu Trigger translation |
| Rules `R-*` | Policy rules + `prompts/admission.md` assessment |
| Worker playbook | Executor Session + worktree + `AGENTS.md` |
| Evidence artifacts | pull request + Delivery requirements |
| Approval | `person/answer` + `human_action` |
| Quiet speculative work | essay §3.4 "silently reproduce and fix" (prototype: convention only) |
| Recall graph | `orchestrator_read` resources + essay Chain of Recall |
| Watchdog | essay §6 (not implemented upstream) |

## 9. Novelty claims

1. **The Mandate is the simulation/actuation boundary.** A Ticket may always simulate; it may never actuate until a separate, narrow approval scope is granted. This turns a governance rule into a domain invariant rather than a prompt.
1. **Speculative what-if.** A casual 'voltage dip in sector 3 — probably nothing' starts a silent cascade simulation; if the cascade is contained, nobody is interrupted.
1. **Mitigation search as parallel workers.** Independent strategies (reroute, add reserve, shed load) are evaluated in isolated workdirs with comparable evidence schemas; the Router compares, it does not plan.
1. **Blast-radius-aware attention.** Only a high-impact recommendation costs a human decision; reversible, low-blast-radius actions are logged and delivered without an approval.
1. **Auditability by construction.** Every recommendation carries rollback plan, topology hash and the exact events that triggered it.

## 10. Definition of done for this mission

Every P0–P7 box in [`../CHECKLIST.md`](../CHECKLIST.md) is ticked with a link to an artifact or passing test, `npm test` is green with no environment variables, and the [`demo-script.md`](../demo-script.md) tour can be completed by a first-time viewer in under three minutes.
