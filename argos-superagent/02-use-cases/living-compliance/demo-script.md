# Demo script · Living Audit

**Length:** ~3 minutes at 2× speed. **Prerequisites:** `cd ../../03-app && npm start`, then select **Living Audit**. No credentials, no network.

> Every step below is *observable*. SYNTHETIC DEMO DATA; the agent performs control tests only and never gives legal or regulatory interpretation. Human sign-off is non-delegable.

| Tick | Action | Expected UI state |
|---|---|---|
| 0 | Select **Living Audit**; note `sign-attestation` is on the approve ladder. | Policy card shows `forbid: publish-external`. |
| 2 | Article 72 regulatory change arrives. | `would_accept` in observe mode; no Ticket. |
| 4 | Control-telemetry drift: log retention 21 days vs 90 required. | `would_accept` in observe mode; no Ticket. |
| 7 | Explicit `@argos map change A72`. | Ticket + ack; worker loads obligations and control tests. |
| 12 | Fast-path follow-up adds SOC 2 evidence. | No new Eval; `control-matrix.csv` gains the SOC 2 row. |
| 18 | Speculative “new logging guidance is coming”. | Silent gap analysis; no affected controls → discarded at t25 with zero messages. |
| 22 | Injection fixture asks the agent to self-sign. | Rejected at intake; `signOff` remains null; policy unchanged. |
| 26 | Human **Policy → v3** control (recorded). | `policy.changed`; in-flight Mandates across the shared Engine are invalidated; completed results remain deliverable. |
| 30 | Explicit `@argos prepare the attestation for A72`. | Provisional attestation with hash chain; **NEEDS ME NOW** sign-off question at t32. |
| 34 | Click **Approve / Sign**. | Human identity + tick recorded; `sign-approval` stage re-seals the chain; one short result at t37. |
| 39 | Stop request goes through Eval. | No in-flight Ticket remains; completed work is left intact. |
| 44 | Run Benchmark + Recall to `attestation.json`. | Provenance graph includes policy version and approval record. |

## Assertions to call out while presenting

- No `signOff` value exists before a human approval record.
- Policy version change produces an invalidation event and a revalidation rule.
- Speculative no-gap analysis produces zero outbound messages.
- `attestation.json` hash chain validates over `control-tests.json` and `gaps.json`.
- `report.md` contains an explicit “no legal interpretation” limitation.
- Injection fixture does not change `policy.version` or `signOff`.

## Closing the tour

1. Open **Recall** from the first Trigger and expand 4–5 hops until an artifact appears.
2. Open the **Benchmark** panel: p50/p95, Router decisions avoided, cache-read estimate (higher), attention cost (lower).
3. Point at **Quiet Work**: the discarded guidance gap analysis.
4. Press **Reset → Replay** and show the state rebuilding identically from the event log.
5. Switch mission and repeat one step to prove the Engine did not change.

## Fallback if the live clock is too slow

Use **Inject event** to inject `chat-mention`, `chat-followup`, `chat-spec`, `chat-inject` and `chat-stop` in sequence; set speed to 4×. All assertions still hold.
