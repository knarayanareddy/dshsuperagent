# 01 — Mission, scope and invariants · Living Audit

## 1. Problem statement

Compliance was designed for a slower world: controls documented, evidence gathered, risk assessed at fixed points in time. That model assumes systems behave predictably between reviews. 2026 GRC practice is moving to continuous control monitoring, regulatory change mapping and audit evidence generated as a byproduct of governed interactions — but interpretation, risk acceptance and final sign-off remain human responsibilities. The EU AI Act's post-market monitoring expectations make this a live requirement, and 2026 governance guidance is beginning to treat delegation chains and HITL gates as binding controls.

## 2. Why this is timely

Agentic GRC sources report 50–65% reductions in manual evidence collection and 75% reductions in audit preparation time for mature deployments, while consistently warning that agents must not make regulatory interpretations or final sign-offs. DeepSeek's versioned Policy and immutable Mandate are almost purpose-built for this: an attestation can name the exact policy version, matched rule and control set that authorized it.

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

- No `signOff` value exists before a human approval record.
- Policy version change produces an invalidation event and a revalidation record.
- Speculative no-gap analysis produces zero outbound messages.
- `attestation.json` hash chain validates over `control-tests.json` and `gaps.json`.
- Report contains an explicit 'no legal interpretation' limitation.
- Injection fixture does not change `policy.version` or `signOff`.

Plus the ten platform invariants in [`../../../01-spec/README.md`](../../../01-spec/README.md).

## 8. Mapping to the upstream framework

| ARGOS-4 concept here | upstream counterpart |
|---|---|
| Source pack (`living-compliance`) | `SourceKind` from `docs/008-cookbook.md` |
| Event templates | GitHub/Feishu Trigger translation |
| Rules `R-*` | Policy rules + `prompts/admission.md` assessment |
| Worker playbook | Executor Session + worktree + `AGENTS.md` |
| Evidence artifacts | pull request + Delivery requirements |
| Approval | `person/answer` + `human_action` |
| Quiet speculative work | essay §3.4 "silently reproduce and fix" (prototype: convention only) |
| Recall graph | `orchestrator_read` resources + essay Chain of Recall |
| Watchdog | essay §6 (not implemented upstream) |

## 9. Novelty claims

1. **The Mandate becomes an auditable authorization object.** An attestation names policy version, matched rule, requester, control set and evidence hash — the agent's own decision chain is part of the evidence.
1. **Continuous, not point-in-time.** Control telemetry drift is an event like any other Trigger; a gap creates a Ticket, a passing control produces silence.
1. **Speculative gap mapping.** A hint of upcoming guidance starts a silent gap analysis; if no controls are affected, nobody is interrupted.
1. **Non-delegable sign-off.** `sign-attestation` is always on the approval ladder and creates a separate human-authored Channel write.
1. **Policy-version revalidation as a feature.** A new policy version intentionally invalidates in-flight Evals; the demo shows the exact upstream behaviour instead of hiding it.

## 10. Definition of done for this mission

Every P0–P7 box in [`../CHECKLIST.md`](../CHECKLIST.md) is ticked with a link to an artifact or passing test, `npm test` is green with no environment variables, and the [`demo-script.md`](../demo-script.md) tour can be completed by a first-time viewer in under three minutes.
