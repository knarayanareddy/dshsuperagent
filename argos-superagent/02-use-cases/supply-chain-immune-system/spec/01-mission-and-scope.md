# 01 — Mission, scope and invariants · Immune System

## 1. Problem statement

Static SBOM matching produces a flood of alerts for vulnerable packages that are installed but never reachable. 2026 research on execution-bound exploitability reports F1 0.93 vs 0.78 for static matching and 37–42% fewer false positives when runtime activation evidence, KEV/EPSS signals and deterministic replay are combined. Meanwhile agent runtimes add a new *semantic* supply chain: skills and prompts can themselves carry injection payloads, and agent frameworks have accumulated CVEs of their own. What teams need is not more alerts but a continuously regenerated, signed answer to 'are we actually affected, and can you prove it?'

## 2. Why this is timely

The AIBOM / CSAF-VEX work extends SBOMs into active provenance artifacts with signed, replayable advisories. DeepSeek's speculative execution gives a natural pattern: reproduce an advisory in the background before anyone asks, then stay quiet if the activation path is unreachable. Upstream's GitHub Source and `git worktree` execution model is the closest domain to this mission, making it the best bridge back to a real DSH deployment.

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

- `vexStatus` is derived from `reachability` and `exploit-test`, never from prose.
- Unreachable advisory speculation produces zero outbound messages.
- `patch.diff` exists but no external write event exists.
- `attestation.json` sha256 chain validates over all listed artifacts.
- Injection fixture does not change `policy.version`.
- Fast-path follow-up produces no new Decision record.

Plus the ten platform invariants in [`../../../01-spec/README.md`](../../../01-spec/README.md).

## 8. Mapping to the upstream framework

| ARGOS-4 concept here | upstream counterpart |
|---|---|
| Source pack (`supply-chain-immune-system`) | `SourceKind` from `docs/008-cookbook.md` |
| Event templates | GitHub/Feishu Trigger translation |
| Rules `R-*` | Policy rules + `prompts/admission.md` assessment |
| Worker playbook | Executor Session + worktree + `AGENTS.md` |
| Evidence artifacts | pull request + Delivery requirements |
| Approval | `person/answer` + `human_action` |
| Quiet speculative work | essay §3.4 "silently reproduce and fix" (prototype: convention only) |
| Recall graph | `orchestrator_read` resources + essay Chain of Recall |
| Watchdog | essay §6 (not implemented upstream) |

## 9. Novelty claims

1. **Speculative exploitability reproduction.** An advisory starts a silent reachability + exploit test. Unreachable → discard silently; reachable → one short result with a VEX statement, patch and attestation.
1. **Proof-carrying 'not affected'.** The system's most valuable output is a negative result backed by a reproducible test, not a patch.
1. **AIBOM-aware provenance.** Every artifact records the policy version and a hash chain, extending SBOM-style provenance to the agent's own decision chain.
1. **Patch as a draft, not a merge.** High-impact production patching is staged for approval; the demo never pushes anywhere.
1. **Silence as noise reduction.** The headline metric is alerts *avoided*, not CVEs found.

## 10. Definition of done for this mission

Every P0–P7 box in [`../CHECKLIST.md`](../CHECKLIST.md) is ticked with a link to an artifact or passing test, `npm test` is green with no environment variables, and the [`demo-script.md`](../demo-script.md) tour can be completed by a first-time viewer in under three minutes.
