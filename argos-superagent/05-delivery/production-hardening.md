# ARGOS-4 — production-hardening roadmap

**Scope.** This is the separate roadmap requested after literal conformance to `01-spec/00–09`. It is **not** a conformance gap list. The delivered showcase is deliberately zero-credential, dependency-free, network-free and deterministic; [`spec-compliance.md`](spec-compliance.md) records 0 open normative items. Everything below concerns a future deployment that would connect ARGOS-4 to real Sources, real tools, real models and real people. Such a deployment would intentionally introduce credentials and network access — never into the default showcase run.

## 1. Current security posture (what is already true)

- No `npm install`, no runtime dependencies, no CDN, no external fonts/scripts/images.
- No secret is read by the default app; `strippedEnv()` passes only `PATH`, `NODE_PATH` and synthetic `ARGOS_*` values to a child worker.
- Default workers are spawned with `child_process.spawn`, a per-Ticket workdir, an allowlisted environment, a 15 s wall cap and `SIGKILL` on timeout.
- Router/Worker separation, Router-only Outbox, immutable policy-versioned Mandates, text-as-data gate, `forbid`/`approve` autonomy ladder, append-only event log and replay are implemented.
- The headless benchmark uses an in-process runner to satisfy the deterministic `<1 s` budget; this is a measurement mode, not the default execution boundary.

**Important boundary:** a spawned child process is an OS process boundary, not a hostile-code security sandbox. The child still inherits the host kernel, filesystem view and `PATH`. It is not seccomp-filtered, not containerised, not network-denied by the OS and not resource-capped by cgroups. All of those are production work.

## 2. Threat model

| Asset | Adversary | Failure to prevent |
|---|---|---|
| Human attention | noisy or compromised Source | alert fatigue, prompt injection leading to an unnecessary approval |
| Mandate authority | malicious Trigger text, stale policy, confused deputy | privilege escalation, auto-merge, external write, regional failover |
| Evidence integrity | tampered worker artifact, real tool error | prose-only result, forged confidence, false attestation |
| Secrets | worker context, logs, event stream, model prompt | credential exfiltration through tool output or recall expansion |
| Availability | runaway worker, replay storm, poisoned event | slot leak, unbounded retries, state divergence |
| Audit trail | operator or upstream service | non-repudiation failure for human approvals and policy changes |

## 3. Phase P1 — isolate the worker for real

1. Replace the plain child spawn with a container/VM/microVM per Session: read-only root filesystem, no `HOME`, no host mounts except the per-Ticket workdir, dropped Linux capabilities, `seccomp` profile, cgroup CPU/memory/PID limits, non-root UID, and a wall-clock kill that survives parent failure.
2. Default egress to deny; allow only explicit per-Source hosts through a proxy that authenticates and logs every request. Worker code must never hold a credential.
3. Sign and verify the worker image; generate an SBOM; pin Node to `^22.19.0 || >=24.0.0` if the real DSH bundle is used. The showcase currently runs on Node 20.20.2.
4. Stream `log.jsonl` and progress events out of the sandbox through a one-way pipe; treat all tool output as untrusted data.
5. Add adversarial fixtures: fork bomb, disk fill, network attempt, secret-shaped environment probe, symlink escape, oversized stdout, slow drain.

**Gate:** a deliberately malicious worker cannot read a secret, reach the network, exceed its cgroup, write outside its workdir, or keep a slot alive after the wall cap. `slotLeaks()` and `killCount` are observable in production telemetry.

## 4. Phase P2 — credentials, Sources and model adapters

1. Introduce a secrets manager (Vault / cloud KMS / workload identity). Credentials are short-lived, audience-scoped, never passed into worker env or model context, and never written to `eventlog.jsonl`, `state.json`, `input.json`, `result.json` or `report.md`.
2. Replace synthetic Source packs with authenticated real adapters: signed webhooks, OAuth2/OIDC for chat APIs, mTLS or signed feeds for telemetry, registry/API tokens for advisories, SIEM/GRC connectors for controls. Verify signatures before `Trigger` creation; add replay protection and clock-skew bounds.
3. Put the optional LLM adapter behind a narrow prose-only interface with provenance: model name/version, prompt hash, temperature, token counts and output hash recorded as an Event. It must not decide gates, Mandates, autonomy class, evidence confidence or delivery.
4. Add content provenance and trust labels per Source; sanitise tool results; expand the existing prompt-injection regression suite with real adapter transcripts.
5. Keep the zero-credential synthetic adapter as the deterministic regression oracle. Every production adapter must be replayable in `observe` against a recorded, redacted trace.

**Gate:** no credential appears in any artifact, env dump, log line, model prompt or event; all real Triggers are authenticated; the deterministic oracle still passes `npm test`, `npm run demo`, `npm run benchmark`.

## 5. Phase P3 — durable state and exactly-once effects

1. Replace JSONL + `state.json` with an append-only transactional store (PostgreSQL/SQLite WAL with checksums, or an event store) and a schema migration strategy. Keep the canonical record shapes and `state.snapshot` projector as the compatibility contract.
2. Make `Effects` durable and idempotent across process restarts; use a lease per effect, a monotonic attempt counter and a dead-letter queue. Preserve canonical kinds and `[5,10,20,40]` Outbox retry semantics.
3. Add HA for the Router, Watchdog and Outbox: leader election, at-least-once event delivery, idempotent consumers, backpressure, and a replay cursor that can resume after a crash.
4. Encrypt spilled context and artifacts at rest; define retention, deletion and legal-hold policy; redact PII before recall expansion.
5. Add backup/restore drills that reconstruct canonical state from the log and compare it to the live projection hash.

**Gate:** kill -9 any component mid-effect, restart, and prove no duplicate receipt, no lost `result.sent`, no stale Mandate and identical canonical state.

## 6. Phase P4 — human authority and audit

1. Human approvals become signed, non-delegable actions with strong identity (SSO + MFA), narrow scope, expiry, ticket/thread binding and an immutable audit record. The UI must show exactly what is being approved.
2. Policy changes are reviewed like code: two-person approval, versioned diff, affected-Mandate report, automatic invalidation, rollback.
3. Keep `forbid` for `delete-data`, `rotate-secrets`, `regional-failover`, `external-write`, `publish-external`; keep `approve` for actuation, production patch, attestation signature and advisory publication.
4. Add tamper-evident hash chaining for `mandate.approved`, `policy.changed`, `result.sent` and `watchdog.flag`; export to a SIEM.
5. Define an incident runbook: stop Ticket, revoke Mandate, freeze Outbox, replay from last known-good event, notify humans.

**Gate:** no high-impact action can be taken by a worker or by an unsigned human; every authority change is attributable and replayable.

## 7. Phase P5 — observability, evaluation and rollout

1. Emit OpenTelemetry traces/metrics for intake → gate → Eval → Ticket → worker → evidence → receipt; dashboard p50/p95, attention cost, cache-read estimate, slot leaks, retries, drop reasons and policy violations.
2. Re-run the two-architecture benchmark on real, redacted traces. Report p50/p95, attention, cache-read cost and speculative waste together; keep the synthetic caveat until then.
3. Add SLOs and alerts for silence (no messages when healthy), bounded attention (`messages/trigger ≤ 0.25`), zero `policy.violation`, `artifactsProduced == tasksCompleted`, and replay equality.
4. Roll out one Source at a time in `observe`, then `auto` only for `read-only`/`reversible-local` classes. Keep high-impact classes on `approve`.
5. Run chaos and game days: Source outage, expired token, stalled worker, poisoned event, duplicate webhook, policy rollback, model outage.

**Gate:** production claims are backed by real traces, signed approvals, durable replay and an incident drill; the zero-credential showcase remains runnable unchanged.

## 8. Risk register and owners

| Risk | Likelihood / impact | Owner | Mitigation phase |
|---|---|---|---|
| Credential leaks into event log or worker context | Medium / critical | Platform security | P2 |
| Untrusted Trigger text becomes authority | Medium / critical | Policy | P2 + P4 |
| Hostile worker escapes process boundary | Low / critical | Runtime | P1 |
| Duplicate or lost effect after restart | Medium / high | State | P3 |
| Human approval phishing / confused deputy | Medium / critical | Product + Security | P4 |
| Real benchmark does not reproduce synthetic win | High / medium | Evaluation | P5 |
| Node/DSH version drift | High / medium | Release engineering | P1 |
| PII retention in recall graph | Medium / high | Data governance | P3 |
| Model prose changes evidence semantics | Medium / high | Model adapter | P2 |
| Alert fatigue from real Sources | High / medium | Attention owner | P5 |

## 9. Explicit non-goals of the default run

The default workspace must remain: zero credentials, no network calls, no `npm install`, no external assets, no real DSH install, no GitHub agent account, no Feishu, no model key, deterministic synthetic data and reproducible replay. Production work happens in a separate deployment repository with its own secret management, CI, threat model and change control. This document is a plan, not a claim that those controls are already present.
