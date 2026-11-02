# Demo script · Amsterdam Grid Digital Twin

**Length:** ~3 minutes at 2× speed. **Prerequisites:** `cd ../../03-app && npm start`, then select **Amsterdam Grid Digital Twin**. No credentials, no network.

> Every step below is *observable*. SYNTHETIC DEMO DATA; the digital twin never touches a real grid. Human approvals are recorded control events in the headless demo and buttons in the live dashboard.

| Tick | Action | Expected UI state |
|---|---|---|
| 0 | Select **Amsterdam Grid Digital Twin**; note the autonomy ladder in the Policy card. | `approve` contains `actuate`, `forbid` contains `regional-failover`. |
| 5 | T-7 threshold breach from telemetry. | Inferred system signal; no matching rule → ignored quietly, no Ticket. |
| 8 | Explicit `@argos assess cascade risk for T-7`. | Ticket + ack; worker loads the pinned topology. |
| 12 | Fast-path follow-up adds the canal-pump load. | No new Eval; pass-through recheck of the same Ticket. |
| 15 | Speculative “voltage dip in sector 3 — probably nothing”. | Silent simulation; contained cascade depth 1 → discarded at t24 with zero messages. |
| 18 | Implausible −40 °C sensor reading; worker result also arrives. | `sensor_integrity` Watchdog flag (panel only) and **NEEDS ME NOW**: one high-impact approval question with blast radius + rollback. |
| 22 | Injection fixture asks for immediate reconfiguration; human clicks **Approve**. | Injection rejected at intake; `mandate.approved` records `oncall.ada` and a narrow `apply` scope. |
| 25 | `apply` stage completes. | One short result; `evidence.json` contains `rollbackPlan`; `applied: true` and the approval record. |
| 29 | “if shedding is the only option, ask me” chat. | Ignored quietly — the approval has already been recorded. |
| 38 | Stop request goes through Eval. | No in-flight Ticket remains; completed work is left intact. |
| 44 | Run Benchmark. | Parallel mitigation search shows p50/p95 gain and higher cache-read estimate. |

## Assertions to call out while presenting

- No actuation artifact exists before an approval record.
- Approval produces one narrow apply-stage Mandate scope and one attention receipt.
- Forbidden action is refused at the gate with a `policy.violation`; zero external writes.
- Implausible sensor data raises a Watchdog flag but never triggers actuation.
- Speculative contained dip produces zero outbound messages.
- `evidence.json` includes `rollbackPlan` for every high-impact mitigation.

## Closing the tour

1. Open **Recall** from the first Trigger and expand 4–5 hops until an artifact appears.
2. Open the **Benchmark** panel: p50/p95, Router decisions avoided, cache-read estimate (higher), attention cost (lower).
3. Point at **Quiet Work**: the discarded what-if simulation.
4. Press **Reset → Replay** and show the state rebuilding identically from the event log.
5. Switch mission and repeat one step to prove the Engine did not change.

## Fallback if the live clock is too slow

Use **Inject event** to inject `chat-mention`, `chat-followup`, `chat-spec`, `chat-inject` and `chat-stop` in sequence; set speed to 4×. All assertions still hold.
