# ARGOS-4 literal-conformance build plan (2026-11-02)

**Status: COMPLETE.** Confirmed scope was **clause-for-clause conformance to `01-spec/00–09`**, zero credentials retained, synthetic data retained, followed by a **separate production-hardening roadmap**. The resolved matrix is [`spec-compliance.md`](spec-compliance.md); the separate roadmap is [`production-hardening.md`](production-hardening.md).

## Phase A — canonical records + event-sourced projection — ✅ complete
- `src/records.js`: canonical `Trigger`, `Thread`, `Correlation`, `Decision`, `Policy`, `Mandate`, `Ticket`, `Assignment`, `Input`, `Report`, `Receipt`, `Effect`, `Event` factories and `validateCanonicalState()`.
- `src/engine.js`: canonical state around `canonicalState(this)`; computed `stage` first-match table; `open → ended → resumed` lifecycle; `activeEval`, `queued`, `decisions`, `expired`; `duplicate` disposition; `unavailable` outcome; `Correlation` for multi-thread Triggers; `Assignment`/`Input`/`Report` records.
- `src/policy.js`: `scope()`, canonical `Rule`, `observedScopes`, full revalidation matrix, `unavailable` outcome.
- `src/memory.js` + `src/records.js`: first-five + around-five thread context with 400-char truncation, `chars`, resource pointer.
- `src/projection.js`: indexed O(records) canonical projection, cached canonical Trigger records, `hydrate()` from a compact state; `replayCheck()` compares 1011/1011 events and identical state.

## Phase B — real subprocess isolation — ✅ complete
- `src/workers.js`: slot pool, `child_process.spawn(process.execPath, ['src/worker/runner.js', inputPath])`, stripped allowlisted env, `cwd = data/work/<domain>/<ticketId>/`, 15 s wall cap, `SIGKILL` on timeout, progress-event relay, slot-leak detection, recovery notes, real `activeCount`/`killCount`.
- `src/worker/runner.js`: CLI entry; reads `input.json`, runs pure experiment, writes all five mandatory artifacts plus domain extras, emits JSON progress lines, exits with structured `result.json`.
- `src/effects.js`: canonical effect kinds `launch|delivery|relay|reply|speculation|apply`, backoff, `Later`; final-tick flush turns every completed result into a literal `result.sent` with no transient `delivering` Tickets.
- `src/benchmark.js` uses an explicit `inProcess: true` runner for the deterministic sub-1 s headless budget; demo, replay and the live server use the spawned child process.

## Phase C — full Outbox, watchdog, attention — ✅ complete
- `src/outbox.js`: `answer` purpose; `channel_gone`/`source_off`/`mandate_withdrawn`/`superseded`/`conversation_gone` drops; `5→10→20→40` retry; idempotence; per-thread ordering; throttle; Router-only assertion.
- `src/watchdog.js`: stall, loop, missing evidence, objective drift, slot leak, timeout with escalation ladder.
- `src/metrics.js`: measured performance-budget assertions (`engineTickMsPer1kEvents ≤ 5`, poll `<250 KB`, worker `≤2 s`, benchmark `<1 s`) and canonical attention accounting.

## Phase D — four production-grade Source packs — ✅ complete
- Canonical pack interface: `speculationSignals`, `runExperiment`, `evidenceSchema.confidence`, `playbook.stages`, `scope`, `riskClassFor`, `summarize`.
- Each pack: ≥14 events, ≈60% noise (32/20/63%, 32/19/59%, 31/19/61%, 31/19/61%), explicit, fast path, bot/CI, speculation, injection, stop and approval cases; `atTick` spacing preserved.
- `data/work/<domain>/<ticketId>/` workdirs; `recoveryNote`; `stage: apply` for approvals; `stage: recheck` for fast paths; negative cases.

## Phase E — control plane + log rebuild — ✅ complete
- `/api/control switchDomain`: reset, load exactly one Source pack, same Engine; `all` reloads all four; UI mission selector wired to it.
- `/api/control replay`: rebuild projection from `data/eventlog.jsonl`, restart interrupted Assignments with recovery note.
- `/api/control resumeTicket`/`reevaluate`: real revalidation + same-Mandate resume + new Eval, with canonical `launch` effects.
- Performance budgets: `engineTickMsPer1kEvents 2.93 ≤ 5`, poll 130 B, worker 37 ms, `benchmarkMs 311.2 ≤ 1000`.

## Phase F — verification + docs — ✅ complete
- `tests/conformance.test.js`: explicit assertions for every closed clause; full suite is **33 / 33**.
- `npm test` 33/33, `npm run demo` 15/15, `npm run benchmark` 10/10 with nested `performance.allPass: true`; `04-evaluation/*.json` regenerated.
- [`spec-compliance.md`](spec-compliance.md) rewritten to resolved status; root README, CHECKLISTS, `01-spec/07`–`09`, `03-app` README, `04-evaluation/report.md`, `05-delivery/deck.html`, `demo-script.md` and handoff refreshed.
- [`production-hardening.md`](production-hardening.md) written as the separate real-deployment roadmap.

## Acceptance — ✅ all met
- 0 open items in the conformance matrix.
- All four missions visible end to end in one live preview.
- Zero credentials, no network, no install, no external assets.
- All tests, demo assertions, benchmark assertions and phase checklists green.
