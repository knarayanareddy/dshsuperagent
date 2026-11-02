# 01 — Domain model and state machines

## 1. Record shapes (canonical JSON)

All ids are stable strings derived from inputs via `key(...)`; all times are simulated ISO strings plus a monotonic `tick`. Every record carries `refs` for Chain of Recall.

```jsonc
Trigger {
  id, source, at, tick,
  threads: [threadKey, ...],          // first is primary, owns Eval
  actor: { id, type: "human"|"bot"|"system" },
  human: boolean,
  addressed: "mention"|"direct"|null,
  text, meta, channel: { thread, address, kind: "chat"|"document" },
  disposition: { filtered?, reachedTickets: [], handedBack: [], decisions: [] }
}

Thread {
  key, source, label, url, triggers: [triggerId],
  subscriptions: [{ ticketId, own: boolean, contextOnly: boolean }],
  queued: [triggerId], decisions: [decisionId],
  activeEval: { evalId, triggerIds, startedTick, deadlineTick } | null,
  expired: number, meta
}

Decision {
  id, threadKey, triggerIds, evalId, policyVersion,
  strength, outcome, reasonCodes: [], ruleJudgements: [{ruleId, matched, reason}],
  intentEvidence: { implementationRequested, targetBasis, designDecisionOpen, quotes: [] },
  at, tick, dismissed?
}

Policy {
  version, mode: "off"|"observe"|"auto", rules: [Rule],
  sources: { [sourceId]: { allowed: [id], bots: [id], observedScopes: [id] } },
  speculation: { enabled, confidenceThreshold, maxPerTick },
  autonomy: { auto: [], approve: [], forbid: [] },
  attention: { chatWordLimit: 100, oneAckPerTicket: true, maxMessagesPerTick: 3 },
  workers: { maxWorkers: 4, timeoutTicks: 40 },
  watchdog: { stallTicks: 12, loopThreshold: 3 }
}

Rule { id, name, instruction, signals: [string], requiresEvidence: boolean, silent?: boolean }

Mandate {
  id, policyVersion, ticketId, strength, scope, matchedRules: [ruleId],
  actorId, source, receivingScope, via: "addressed"|"followup"|"admission"|"bot"|"speculation",
  speculative: boolean, createdTick, stopped?: { by, at, reason }
}

Ticket {
  id, title, domain, mandateId, state: "open"|"ended", stage,
  stageReason, channels: [{thread, address, kind}], inputs: [Input],
  assignments: [assignmentId], subscriptions: [{thread, own, contextOnly}],
  reports: [Report], artifacts: [path], speculative: boolean,
  createdTick, endedTick?, outcome?, attention: { acks, messages, approvals }
}

Assignment { id, ticketId, workerId, workdir, state: "pending"|"running"|"ended", startedTick, endedTick?, exitCode?, recoveryNote? }

Input { id, ticketId, triggerId?, kind: "fast_path"|"note"|"policy_change"|"approval", text, deliveredTick, readTick? }

Report { id, assignmentId, state, summary, confidence, evidenceRefs: [], needsApproval?, riskClass?, at, tick }

Receipt { id, ticketId?, threadKey, purpose: "acknowledgement"|"answer"|"result"|"attention",
          text, words, status: "pending"|"sent"|"dropped", attempts, dropReason?, createdTick, sentTick? }

Effect { id, kind: "launch"|"delivery"|"relay"|"reply"|"speculation"|"apply", key, payload,
         state: "due"|"running"|"done"|"failed", attempts, dueTick, lastError? }

Event { seq, tick, at, type, actor, payload, refs: [id] }   // append-only, single source of truth
```

## 2. State machines

### Ticket

```
             accept / speculative start
                     │
                     ▼
   ┌────────────── queued ──────────────┐
   │                                    │ launch
   ▼                                    ▼
 working ◄──── fast-path Input ──── person/answer (approval / question)
   │                                    │
   │ ready (no approval needed)         │ approved → apply → ready
   ▼                                    │ denied → ended(stopped)
 person/review ────────────────────────┘
   │
   ▼
 ended (completed | merged-equivalent | dropped | stopped | failed)
   │
   └── human message on own Thread + successful mandate revalidation → resumed (same mandate)
```

`stage` is computed by a first-match table, never stored as authoritative:

| Stage | Condition |
|---|---|
| `person/delivery` | an Input failed to deliver |
| `person/answer` | an open approval or question exists |
| `person/review` | latest Report is `ready` and an artifact awaits acceptance |
| `person/failed` | latest Report is `failed`/`blocked` and no human message since |
| `working/queued` | no running Assignment |
| `idle` | latest Report is `waiting` |
| `working` | otherwise |

### Eval

```
queued triggers on Thread ──► activeEval (batched)
   ├─ gate: not_admitted ─────────────────────────────► Decision(ignore)
   ├─ gate: explicit ──────────────────────────────────► Decision(accept) → Ticket
   ├─ gate: inferred + assessment positive + mode=auto ► Decision(accept) → Ticket
   ├─ gate: inferred + assessment positive + mode=observe ► Decision(would_accept), no Ticket
   ├─ gate: inferred + assessment positive + mode=off ► Decision(ignore)
   ├─ policy version changed mid-flight ───────────────► requeue under new version
   └─ deadline exceeded 3× / assessor failure ─────────► Decision(unavailable) + watchdog alert
```

### Receipt

```
pending ──► sent        (Channel accepted)
    ├─────► dropped     (Thread gone / Source off / unlistened destination; reason retained)
    └─────► pending     (retry with 5s doubling to 300s equivalent; ordered behind earlier receipt)
```

## 3. Identity and idempotence rules

- `Trigger.id = key(source, externalId)`; re-reading an event returns `duplicate` and never creates work. Edits must change `externalId`.
- `Thread.key = "<source>:<stable-thread-id>"`; a Trigger's first Thread is primary.
- `Mandate.id = key(ticketId, policyVersion, triggerIds)`.
- `Receipt.id` is the idempotency key used by `channel.send`.
- `Event.seq` is monotonic and is the replay cursor.
- `Policy.version = sha256(canonical policy without volatile fields)`; volatile fields (clock speed, pause) do not change it.

## 4. Authority rules (normative)

1. A Trigger's `text`, `meta` and any quoted content **cannot** add an allowlist entry, enable a rule, widen a scope, or grant approval.
2. Fast-path delivery grants **no new authority**; a Ticket remains bounded by its Mandate.
3. A human follow-up on an own Thread belongs to the Ticket's worker; the Router may act on it only to stop work, unless the worker hands it back once.
4. Ended Tickets keep subscriptions; a human message can resume them **only after revalidation**.
5. A person's `stop` is a command that withdraws the Mandate. The word "stop" inside event text is *data* and goes through Eval.
6. Speculative Tickets have `via: "speculation"` and `silent: true`: no acknowledgement, no progress messages; only a promoted result may reply.
7. An Approval creates a new narrow Mandate scope for one action; it is never inherited by subsequent Tickets.

## 5. Domain independence clause

`engine.js` contains **no** reference to claims, sensors, advisories, controls, patches, statistics, grids or regulations. All domain-specific behaviour is reached through a Source pack interface:

```js
{
  id, name, tagline, color,
  sources: [{ id, kind: "chat"|"feed"|"telemetry"|"ci", observed: boolean, scopeId }],
  actors: { allowed: [...], bots: [...] },
  rules: [Rule],
  eventCatalog: [TriggerTemplate],
  speculationSignals: [ { match, ruleId, playbook } ],
  playbook: { stages: [...], riskClassFor(evidence), summarize(evidence) },
  runExperiment(input) -> Evidence,        // pure, deterministic, executed in sandbox
  evidenceSchema: { required: [...], confidence: (evidence) => number }
}
```

Acceptance: adding a fifth Source pack must not require editing `engine.js`, `policy.js`, `outbox.js`, `effects.js`, `watchdog.js` or `metrics.js`.
