# Demo script · Helios Replication Lab

**Length:** ~3 minutes at 2× speed (or use **Inject event** to jump to a tick). **Prerequisites:** `cd ../../03-app && npm start`, then select **Helios Replication Lab** in the mission selector. No credentials, no network.

> Every step below is *observable* in the live dashboard. SYNTHETIC DEMO DATA; reasoning adapter = deterministic constitution. In the headless `npm run demo` the human clicks are replayed as recorded control events.

| Tick | Action | Expected UI state |
|---|---|---|
| 0 | Select **Helios Replication Lab**. Confirm header: SYNTHETIC DEMO DATA, policy `observe`, speculation on. | Panel is quiet; zero messages. |
| 2 | Watch `claim-42` arrive from the literature feed. | Batched Eval → `would_accept` in observe mode. Observe ledger +1, no Ticket. |
| 7 | Explicit `@argos replicate claim-42`. | Ticket + immutable Mandate + one acknowledgement; worker slot 1 starts. |
| 9 | Open the worker tile; inspect `load-dataset → recompute → bootstrap → seed-sweep → verdict`. | Progress is internal — no Channel messages. |
| 12 | Fast-path follow-up about seed sensitivity. | Event says “Follow-up delivered to existing Ticket (no Router decision)”; `routerDecisionsAvoided++`. |
| 15 | Speculative chat claim “looks 9% better”. | Silent Ticket appears in Quiet Work; no ack, no progress message. |
| 18 | Claim-42 result delivered. | One short chat message ≤100 words plus `report.md` pointer; `evidence.json` shows effect ≈3.1 points vs 12 claimed. |
| 19 | Prompt-injection fixture from an unlisted actor. | `source.rejected` + `policy.violation`: `untrusted_content_ignored`; policy version unchanged. |
| 22 | Second feed claim `claim-43` arrives. | `would_accept` in observe mode; still no Ticket from the feed alone. |
| 24 | Open **Artifacts** for claim-42; then explicit `@argos check claim-43`. | `evidence.json`, `bootstrap.json`, `seed-runs.csv`, `input.json`, `log.jsonl`, `report.md`, `result.json` are all viewable. Claim-43 creates a Ticket at t25. |
| 26 | Human **Policy → v3** control (recorded). | `policy.changed`; the in-flight claim-43 Mandate is invalidated; results already computed before the change remain deliverable. |
| 33 | Stop request goes through Eval. | No in-flight Ticket remains; completed work is left intact and a new Mandate would be required to resume. |
| 40 | Click a Trigger in the timeline → **Recall** with 4 hops. | Graph: Trigger → Thread → Decision → Ticket → Assignment → Evidence → Receipt. |
| 45 | Run **Benchmark**. | p50/p95, Router decisions avoided, cache-read estimate (higher) and attention cost (lower) for both architectures. |

## Assertions to call out while presenting

- ≥1 `would_accept` in observe mode with zero Tickets created from it.
- Exactly one acknowledgement for the explicit Ticket.
- Fast-path follow-up produces no new semantic Decision record.
- Speculative claim-77 produces zero outbound messages; its Ticket is discarded at t24.
- Claim-42 result has `evidence.json`, `bootstrap.json`, `seed-runs.csv`, `input.json`, `log.jsonl`, `report.md`, `result.json`.
- Prompt-injection fixture does not change `policy.version`.
- `messagesSent / triggersIngested ≤ 0.25` in the benchmark workload.

## Closing the tour

1. Open **Recall** from the first Trigger and expand 4–5 hops until an artifact appears.
2. Open the **Benchmark** panel: p50/p95, Router decisions avoided, cache-read estimate (higher for the Superagent — the honest trade-off), attention cost (lower).
3. Point at **Quiet Work**: work that happened without interrupting anyone.
4. Press **Reset → Replay** and show the state rebuilding identically from the event log.
5. Switch mission and repeat one step to prove the Engine did not change.

## Fallback if the live clock is too slow

Use **Inject event** to inject `chat-mention`, `chat-followup`, `chat-spec`, `chat-inject` and `chat-stop` in sequence; set speed to 4×. All assertions still hold.
