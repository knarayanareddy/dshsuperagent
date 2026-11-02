# 05 — Delivery

| File | Purpose |
|---|---|
| [`handoff.md`](handoff.md) | Concept→DSH mapping, security gap register, fifth-Source recipe, limitations and responsible next steps. |
| [`demo-script.md`](demo-script.md) | Master 3-minute tour across all four missions with exact controls and assertions. |
| [`deck.html`](deck.html) | Self-contained inline slide deck — no CDN, fonts or external assets. |
| [`spec-compliance.md`](spec-compliance.md) | Resolved clause-for-clause conformance matrix: 0 open items. |
| [`conformance-plan.md`](conformance-plan.md) | Completed Phase A–F plan and acceptance status. |
| [`production-hardening.md`](production-hardening.md) | Separate real-deployment roadmap: sandbox, credentials, Sources, durable state, audit, rollout. |

The per-mission tours live in [`../02-use-cases/*/demo-script.md`](../02-use-cases/00-index.md). The live dashboard is started with `cd ../03-app && npm start`; the headless equivalents are `npm run demo` and `npm run benchmark`.

**Status:** P7 + literal conformance complete; separate production-hardening roadmap written. All delivery claims are backed by [`../CHECKLISTS.md`](../CHECKLISTS.md), [`../04-evaluation/report.md`](../04-evaluation/report.md) and the 33/33 passing test suite.

## Conformance audit

[`spec-compliance.md`](spec-compliance.md) records the resolved clause-by-clause comparison of the running implementation against `01-spec/00–09`; [`production-hardening.md`](production-hardening.md) is the separate plan for real credentialed deployment.
