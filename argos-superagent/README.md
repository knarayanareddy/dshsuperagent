# ARGOS-4 — a four-domain Superagent Observatory

> **Status: literal clause-for-clause conformance complete for the zero-credential showcase scope; production hardening is a separate roadmap.** Research, shared specification, four mission specifications, runnable app, live dashboard, tests, benchmark, evaluation report, delivery deck and handoff are all in this workspace. [`CHECKLISTS.md`](CHECKLISTS.md) records **180 / 180** verified checklist boxes. The resolved conformance matrix [`05-delivery/spec-compliance.md`](05-delivery/spec-compliance.md) has **0 open items**; [`05-delivery/production-hardening.md`](05-delivery/production-hardening.md) covers real-deployment work.
>
> **Honesty note:** ARGOS-4 is an independent, zero-credential showcase built *from the design patterns* published in DeepSeek's `dsh-superagent-prototype` and the accompanying Super-agent design essay. It is **not** a fork of, nor a plugin for, DeepSeek Harness. It implements the same domain concepts in a self-contained deterministic engine so the whole system can be demonstrated live, end to end, without a GitHub agent account, a model key, or a DSH install. The default reasoning adapter is a deterministic constitution; an optional OpenAI/DeepSeek-compatible prose adapter is documented but never required for decisions.

## What this is

ARGOS-4 is a sophisticated, demonstrable answer to one question:

> *What does an always-on, event-driven, attention-bounded agent system look like when it is applied beyond “fix this GitHub issue”?*

It consists of:

1. **A deep technical review** of `deepseek-ai/dsh-superagent-prototype` — architecture, domain model, authorization, execution, prompts, panel, deployment, extension points, strengths and gaps. [`00-research/01-framework-review.md`](00-research/01-framework-review.md)
2. **A comparative landscape** of similar systems (Claude Code agent teams, Codex, OpenHands, Devin, Jules, Copilot coding agent, LangGraph/Temporal, The AI Scientist, AI co-scientist, autoresearch, agentic SRE, digital twins, continuous GRC) plus an explicit **feature-adaptation matrix**: what we borrowed, why, and how we changed it. [`00-research/02-similar-projects.md`](00-research/02-similar-projects.md) · [`00-research/04-feature-adaptation-matrix.md`](00-research/04-feature-adaptation-matrix.md)
3. **Ample use-case research**: 16 candidate applications scored for novelty, feasibility, grounding and demo impact; four selected for full specs. [`00-research/03-use-case-landscape.md`](00-research/03-use-case-landscape.md)
4. **Spec-driven documents** for the shared platform and four missions, with **per-phase checklists** in every folder. [`01-spec/`](01-spec/README.md) · [`02-use-cases/`](02-use-cases/00-index.md)
5. **A runnable implementation**: deterministic Router/Worker engine, four real executable domain simulations, per-Ticket workdirs producing `evidence.json` / `input.json` / `log.jsonl` / `report.md` / `result.json`, a live dashboard, an external semantic Watchdog, an attention budget, a two-architecture benchmark harness and 33 passing tests. [`03-app/README.md`](03-app/README.md)
6. **Evaluation and delivery**: benchmark methodology/results, a scripted demo tour, an inline slide deck, and a production migration path back to the real DSH bundle. [`04-evaluation/README.md`](04-evaluation/README.md) · [`05-delivery/README.md`](05-delivery/README.md)

## The four missions

| Folder | Mission | Core novelty |
|---|---|---|
| [`02-use-cases/science-replication-lab/`](02-use-cases/science-replication-lab/README.md) | Autonomous replication / AI-science lab | Silent reproduction of claims; speaks only with executable bootstrap, seed-sweep and replay-stability evidence |
| [`02-use-cases/self-healing-infrastructure/`](02-use-cases/self-healing-infrastructure/README.md) | Self-healing infrastructure digital twin | Speculative what-if cascade simulation; risk-tiered human approval before any actuation |
| [`02-use-cases/supply-chain-immune-system/`](02-use-cases/supply-chain-immune-system/README.md) | Open-source supply-chain immune system | Execution-bound exploitability (not static SBOM matching) → VEX-style attestation + draft patch |
| [`02-use-cases/living-compliance/`](02-use-cases/living-compliance/README.md) | Living regulatory / audit agent | Continuous control testing with evidence drift, non-delegable human sign-off and hash-chained attestations |

All four run on **one engine**. Switching missions changes the Source pack, Policy rules, worker playbooks and evidence schema — not the coordination architecture. That is the central claim of the showcase.

## Quick start

```bash
cd 03-app
npm start                 # live dashboard on http://0.0.0.0:3000
npm test                  # engine, domain and benchmark invariants
npm run demo              # headless end-to-end run of all four missions
npm run benchmark         # single-session baseline vs Superagent
```

No `npm install` is required: the app is dependency-free ESM JavaScript on Node 20+. No network, secrets, GitHub account or LLM key are needed. An optional OpenAI-compatible / DeepSeek-compatible adapter can be enabled with `ARGOS_LLM_URL` and `ARGOS_LLM_KEY`; it only rewrites prose and never changes a gate, Mandate, evidence artifact or delivery decision.

The live dashboard is a single inline HTML document with no CDN, external fonts, stylesheets or scripts, so it also renders in the sandboxed workspace preview. It is labelled **SYNTHETIC DEMO DATA** and **deterministic constitution** at all times.

## Reading order

1. [`00-research/01-framework-review.md`](00-research/01-framework-review.md) — what the upstream framework actually is.
2. [`00-research/03-use-case-landscape.md`](00-research/03-use-case-landscape.md) — why these four domains.
3. [`01-spec/README.md`](01-spec/README.md) — the shared contract; then `00` → `09` in order.
4. [`02-use-cases/00-index.md`](02-use-cases/00-index.md) — pick a mission; read its `README`, `spec/`, `demo-script.md` and `CHECKLIST.md`.
5. [`CHECKLISTS.md`](CHECKLISTS.md) — master phase tracker across the whole programme.
6. [`04-evaluation/report.md`](04-evaluation/report.md), [`05-delivery/handoff.md`](05-delivery/handoff.md) and [`05-delivery/production-hardening.md`](05-delivery/production-hardening.md) — what was measured, what it does not prove, and how to migrate or harden.

## Design principle inherited from upstream

> **Take as little human attention as possible, and give as much value as possible.**

Every message, notification and approval in ARGOS-4 has to earn its place. The dashboard therefore has an *attention meter*, a *silence counter*, and a hard 100-word chat cap. A healthy system is a quiet system.
