# 01 — Mission, scope and invariants · Helios Replication Lab

## 1. Problem statement

Research teams discuss dozens of claims a week — preprints, internal benchmarks, "this looks 9% better" chat messages. Almost none are independently recomputed, and the ones that are get checked manually weeks later. Fully autonomous "AI Scientist" systems try to do the entire research lifecycle but pay for it: an independent evaluation found 42% of their experiments failed with coding errors and manuscripts contained weak or hallucinated numbers. The missing layer is not another paper generator; it is a narrow, metric-bound, evidence-first replication loop attached to the conversation where claims are made.

## 2. Why this is timely

Karpathy's `autoresearch` showed that one file, one metric and a fixed five-minute budget can produce hundreds of real experiments overnight; Google's ScientistOne added a Chain-of-Evidence audit that binds claims to raw logs; DeepSeek's essay §3.4 describes "silently reproduce and fix" as a speculative policy. Combining the three gives a system whose default output is silence and whose only output is a falsification or a verified result.

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

- ≥1 `would_accept` in observe mode with zero Tickets created from it.
- Exactly one acknowledgement for the explicit Ticket.
- Fast-path follow-up produces no new Decision record.
- Speculative claim-77 produces zero outbound messages.
- Claim-42 result has `evidence.json`, `bootstrap.json`, `seed-runs.csv`, `report.md`, `result.json`.
- Prompt-injection fixture does not change `policy.version`.
- `messagesSent / triggersIngested ≤ 0.25`.

Plus the ten platform invariants in [`../../../01-spec/README.md`](../../../01-spec/README.md).

## 8. Mapping to the upstream framework

| ARGOS-4 concept here | upstream counterpart |
|---|---|
| Source pack (`science-replication-lab`) | `SourceKind` from `docs/008-cookbook.md` |
| Event templates | GitHub/Feishu Trigger translation |
| Rules `R-*` | Policy rules + `prompts/admission.md` assessment |
| Worker playbook | Executor Session + worktree + `AGENTS.md` |
| Evidence artifacts | pull request + Delivery requirements |
| Approval | `person/answer` + `human_action` |
| Quiet speculative work | essay §3.4 "silently reproduce and fix" (prototype: convention only) |
| Recall graph | `orchestrator_read` resources + essay Chain of Recall |
| Watchdog | essay §6 (not implemented upstream) |

## 9. Novelty claims

1. **Speculative falsification.** A chat claim starts a silent reproduction before anyone asks. Reproduces → say nothing; fails → deliver one short, evidence-linked result. The default output of a research agent becomes silence.
1. **Attention-bounded science.** The 100-word cap, one-ack rule and `observe` mode are applied to scientific discussion, where paper-length outputs would be actively harmful.
1. **Replication as an authorization problem.** A Mandate records exactly which dataset version, policy version and matched rule authorized a recomputation — so a later 'that used v2, not v3' dispute is answerable by inspection.
1. **Evidence before prose.** A result cannot be reported without `evidence.json` containing bootstrap CI, seed runs and a replay seed; this inverts the AI Scientist failure mode.

## 10. Definition of done for this mission

Every P0–P7 box in [`../CHECKLIST.md`](../CHECKLIST.md) is ticked with a link to an artifact or passing test, `npm test` is green with no environment variables, and the [`demo-script.md`](../demo-script.md) tour can be completed by a first-time viewer in under three minutes.
