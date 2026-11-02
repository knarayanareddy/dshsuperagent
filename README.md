# dshsuperagent

> **An exploration of always-on, event-driven, attention-bounded super-agents.**
>
> *"Take as little human attention as possible, and give as much value as possible."*

This repository brings together the research prototype of DeepSeek's superagent design and an extended multi-domain observatory:

1. **[`argos-superagent/`](argos-superagent/)** — **ARGOS-4**: A zero-credential, four-domain Superagent Observatory extending the coordination contract beyond coding issues to Autonomous Scientific Replication, Self-Healing Infrastructure, Supply-Chain Immunity, and Living Compliance. Includes runnable Node.js engine, live web dashboard, benchmark harness, and formal specifications.
2. **[`research/dsh-superagent/`](research/dsh-superagent/)** — The original **DeepSeek Harness (DSH) Superagent prototype** (`deepseek-ai/dsh-superagent-prototype`), implementing an autonomous proactive agent for a single GitHub repository using the Cordis plugin architecture, React web panel, and DSH Session orchestrator.

---

## Quick Start (ARGOS-4 Observatory)

The runnable observatory in `argos-superagent/03-app` requires **Node.js 20+** and has **zero external npm dependencies** (no `npm install` needed, zero network requests, zero API keys):

```bash
cd argos-superagent/03-app

# Run all 33 automated tests
npm test

# Run the four-domain headless demo tour
npm run demo

# Run the benchmark comparing Superagent vs Single-Session Baseline
npm run benchmark

# Start the live interactive web dashboard
npm start
# -> Open http://localhost:3000 in your browser
```

---

## Repository Structure

```
dshsuperagent/
├── argos-superagent/                # ARGOS-4 Multi-Domain Superagent Observatory
│   ├── 00-research/                 # Upstream analysis, comparator survey, adaptation matrix
│   ├── 01-spec/                     # Shared specifications (Charter, Domain Model, Policy, Event Contracts)
│   ├── 02-use-cases/                # Four domain missions (Science, Infrastructure, Supply Chain, Audit)
│   ├── 03-app/                      # Runnable zero-dependency Node.js ESM engine & web dashboard
│   ├── 04-evaluation/               # Benchmark methodology, SVG charts, and evaluation report
│   ├── 05-delivery/                 # Hand-off guide, deck.html presentation, production roadmap
│   ├── CHECKLISTS.md                # 180 / 180 verified checklist gates
│   └── README.md                    # ARGOS-4 charter and guide
│
└── research/
    └── dsh-superagent/              # Upstream DeepSeek Harness Superagent Prototype
        ├── docs/                    # 9 numbered design documents (000 Philosophy -> 008 Cookbook)
        ├── prompts/                 # Orchestrator, worker, admission, and team prompts
        ├── skills/                  # DSH GitHub and Feishu skills
        ├── src/                     # TypeScript core engine, sources, and React web panel
        ├── tests/                   # 60+ Vitest test suites
        └── cordis.patch.yml         # Cordis plugin manifest
```

---

## The Four ARGOS-4 Missions

All four domains run on **one shared coordination engine** (`argos-superagent/03-app/src/engine.js`) without domain conditionals:

| Mission | Folder | Novelty | Primary Artifacts | Approval Required? |
|---|---|---|---|---|
| **Helios Replication Lab** | [`02-use-cases/science-replication-lab/`](argos-superagent/02-use-cases/science-replication-lab/) | Speculative falsification of claims | `evidence.json`, `seed-runs.csv` | No (silent if replicated) |
| **Amsterdam Grid Digital Twin** | [`02-use-cases/self-healing-infrastructure/`](argos-superagent/02-use-cases/self-healing-infrastructure/) | Mandate as simulation/actuation boundary | `topology.json`, `mitigations.json` | **Yes** (actuation) |
| **Supply-Chain Immune System** | [`02-use-cases/supply-chain-immune-system/`](argos-superagent/02-use-cases/supply-chain-immune-system/) | Execution-bound exploitability testing | `vex.json`, `patch.diff` | No (draft patch only) |
| **Living Regulatory / Audit Agent** | [`02-use-cases/living-compliance/`](argos-superagent/02-use-cases/living-compliance/) | Continuous control testing & drift audit | `control-matrix.csv`, `attestation.json` | **Yes** (sign-off) |

---

## Verification & Status

- **Automated Tests**: 33 / 33 passing in `argos-superagent/03-app/tests/`
- **Benchmark Suite**: 10 / 10 acceptance thresholds met (p50: 8 vs 170 ticks; p95: 12 vs 248.9 ticks; attention cost: 68.63 vs 446.6)
- **Four-Domain Demo**: 15 / 15 assertions pass, 208 evidence artifacts generated, 0 policy violations
- **Replay Verification**: 1011 / 1011 events produce byte-identical event logs across independent runs
- **Checklists**: 180 / 180 checklist items verified in [`argos-superagent/CHECKLISTS.md`](argos-superagent/CHECKLISTS.md)

---

## License

MIT
