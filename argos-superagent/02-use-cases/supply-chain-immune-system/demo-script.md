# Demo script · Immune System

**Length:** ~3 minutes at 2× speed. **Prerequisites:** `cd ../../03-app && npm start`, then select **Immune System**. No credentials, no network.

> Every step below is *observable*. SYNTHETIC DEMO DATA; no package registry, repository or production patch is contacted.

| Tick | Action | Expected UI state |
|---|---|---|
| 0 | Select **Immune System**; inspect the VEX + attestation artifact list. | Policy shows `patch-prod` on the approve ladder. |
| 2 | Advisory GHSA-2026-4412 arrives. | `would_accept` in observe mode; no Ticket. |
| 8 | Explicit `@argos verify advisory`. | Ticket + ack; worker resolves the dependency graph. |
| 12 | Fast-path follow-up adds the worker service. | No new Eval; `dependencyPath` for worker appears in the recheck. |
| 18 | Speculative “we might be affected by that new advisory”. | Silent Ticket created at t19; reachable path + deterministic exploit test → **promoted** at t23 with `vex.json`, `patch.diff`, `attestation.json`. |
| 22 | Injection fixture asks for a push to main. | `source.rejected` + `policy.violation`; policy unchanged; zero external writes. |
| 24 | Promoted result delivered. | One short message with the artifact pointer; Quiet Work shows the promotion. |
| 29 | Explicit `@argos give me the VEX statement`. | New Ticket reuses the same execution-bound evidence; result at t36 with `attestationSha`. |
| 33 | Open **Artifacts** → `vex.json`, `patch.diff`, `attestation.json`, `evidence.json`. | Hash chain verifiable from the UI; `patch.diff` exists but no external write event exists. |
| 34 | Second advisory GHSA-2026-4499 for an unused dev dependency. | Speculative `not_affected` VEX: activation path absent, promoted at t41 and delivered at t42 **without a human request**. |
| 37 | Stop request goes through Eval. | No in-flight Ticket remains; completed work is left intact. |
| 44 | Run Benchmark. | Alerts avoided vs compute spent is visible in Quiet Work. |

## Assertions to call out while presenting

- `vexStatus` is derived from `reachability` and `exploit-test`, never from prose.
- Unreachable advisory speculation produces a proactive `not_affected` VEX after proof, not a blind alert.
- `patch.diff` exists but no external write event exists.
- `attestation.json` sha256 chain validates over all listed artifacts.
- Injection fixture does not change `policy.version`.
- Fast-path follow-up produces no new semantic Decision record.

## Closing the tour

1. Open **Recall** from the first Trigger and expand 4–5 hops until an artifact appears.
2. Open the **Benchmark** panel: p50/p95, Router decisions avoided, cache-read estimate (higher), attention cost (lower).
3. Point at **Quiet Work**: both speculative promotions and the discards from other missions.
4. Press **Reset → Replay** and show the state rebuilding identically from the event log.
5. Switch mission and repeat one step to prove the Engine did not change.

## Fallback if the live clock is too slow

Use **Inject event** to inject `chat-mention`, `chat-followup`, `chat-spec`, `chat-inject` and `chat-stop` in sequence; set speed to 4×. All assertions still hold.
