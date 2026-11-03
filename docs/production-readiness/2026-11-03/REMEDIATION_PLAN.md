# dshsuperagent — phased remediation plan

This is proposed work, not work performed. Findings refer to [the review](REVIEW.md). Every command below is planned and requires an owner-authorized isolated environment; do not use real accounts, production data or infrastructure for initial tests.

## Dependency map and phase gates

| Phase/task | Prerequisite | Exit artifact |
|---|---|---|
| P1 baseline and scope | Owner chooses target and isolation | Reproducible baseline, threat model |
| P2 ARGOS boundary | P1 | D01/D02 fixes and negative tests |
| P3 DSH authority and isolation | P1 | D03–D05 trust-boundary evidence |
| P4 automation and UX | P2 and P3 for chosen target | Independent gates and accessible flows |
| P5 operations and acceptance | P4, owner-approved environment | Observed restore and release decision |

### P1 — Baseline and product decision (preventive)

**Prerequisites:** owner names ARGOS, DSH or both; isolated host and test identities are approved. **Observed paths:** `argos-superagent/03-app/package.json`, `research/dsh-superagent/package.json`.

1. Record exact revision, Node and package-manager versions, service boundaries, simulation-only claims and approved outbound access.
2. In a disposable checkout, capture the existing ARGOS `npm test` and, separately, DSH `pnpm check` results using the scripts in their respective manifests; record failures without weakening tests. Install dependencies only after explicit environment approval.
3. Document allowed callers, untrusted source inputs, credential owners, side effects and retention; identify absent or unavailable services rather than faking them.

**Deliverable:** baseline log plus signed-off threat model. **Verification:** independently check logs name each working directory and revision and distinguish unavailable dependencies from failures. **DoD:** [ ] scope and identities approved; [ ] both selected baselines recorded or explicitly blocked; [ ] no production credentials used.

### P2 — Constrain ARGOS dashboard and artifacts (D01, D02)

**Prerequisites:** P1. **Observed path:** `argos-superagent/03-app/src/web/server.js`; **proposed path:** `argos-superagent/03-app/tests/web-security.test.js`.

1. Bind to loopback by default; for any owner-approved remote mode, implement authentication, per-action authorization, restrictive origin/CSRF handling and server-derived actor identity. Limit expensive requests and prevent unauthenticated state reads.
2. Confine artifact opens to the real work directory without following escaping links; handle missing files, symlink races and errors without disclosing stack traces or host paths. Avoid trusting path-prefix checks alone.
3. Add request-level tests for rejected anonymous control, forged actor, hostile origin, ordinary traversal and a symlink escape; add an authorized positive case and a reset-versus-tick concurrency test.

**Deliverable:** code change plus regression suite. **Verification:** exercise the actual HTTP server in an isolated harness; deliberately remove each enforcement check and confirm the corresponding negative test fails. **DoD:** [ ] anonymous and cross-origin attempts rejected; [ ] legitimate control works; [ ] symlink escape denied; [ ] race outcome bounded and documented.

### P3 — Prove DSH agent authority boundaries (D03–D05)

**Prerequisites:** P1, dedicated OS identity, test-only repository and scoped credentials approved. **Observed paths:** `research/dsh-superagent/src/app/tools/main.ts`, `src/app/tools/executor.ts`, `src/app/http.ts`, and `docs/006-deployment.md` under `research/dsh-superagent/`.

1. Trace registration from the runtime to the two tool lists, then trace `settings.save`, `savePrompts`, admission, replies and worker execution to their final authorization checks. Identify which content and actor identities enter each model context.
2. Implement or strengthen server-enforced provenance and one-shot, scoped human approval for privileged changes and external effects; never use model descriptions as the authorization gate. Isolate workers and restrict filesystem, network and credentials according to the approved threat model.
3. Test hostile GitHub/Feishu content and tool output that request settings changes, prompt rewrites, secret disclosure or unauthorized replies; test a valid authorized action, replay, wrong ticket and local management calls without authority. Preserve the existing ticket/PR atomicity checks.

**Deliverable:** trust-flow diagram, threat-model decision for local callers, implementation and integration tests. **Verification:** run through real registered tools using fake providers and a disposable repo; intentionally bypass each gate to prove tests fail. **DoD:** [ ] untrusted text cannot grant authority; [ ] approvals are scoped and non-replayable; [ ] worker isolation and local management policy verified; [ ] untested external provider hops disclosed.

### P4 — Automation, dependency and accessibility gates (preventive)

**Prerequisites:** chosen P2/P3 security work. **Observed paths:** both manifests, `research/dsh-superagent/pnpm-lock.yaml`, `research/dsh-superagent/src/client/app.tsx`; **proposed path:** `.github/workflows/`.

1. Establish reproducible dependency installation from the reviewed lockfile and compatible host versions; inspect advisories and integrity without assuming alpha peer compatibility or upgrading blindly.
2. Add CI for the selected manifests' existing checks and boundary regressions; report baseline failures and keep thresholds intact. Test the real entry-to-tool path, not only the stubbed Runtime.
3. Exercise both chosen dashboards with keyboard and assistive technology, verify accessible labels, focus, errors and responsive layout; create targeted regressions for observed defects.

**Deliverable:** reviewed CI configuration, dependency inventory and accessibility findings. **Verification:** observe a CI run on the exact proposed revision and deliberately break a boundary assertion; document manual accessibility results separately. **DoD:** [ ] lockfile and host compatibility checked; [ ] meaningful negative controls fail when broken; [ ] keyboard and screen-reader checks recorded.

### P5 — Recovery and independent acceptance (preventive)

**Prerequisites:** P4 and owner-approved release, host, backup and credential policies. **Observed paths:** `research/dsh-superagent/docs/006-deployment.md`, `argos-superagent/03-app/data/`.

1. Define state ownership, retention, encryption, log redaction, monitoring and separate backup credentials; establish release and migration inventories for each selected product.
2. Back up test state, rehearse an upgrade and restore the pre-upgrade database into an isolated older version, checking records and service behavior; test ARGOS event recovery separately.
3. Have an independent reviewer rerun attack, functional, accessibility and recovery scenarios against the exact release artifact; record unresolved gaps and obtain explicit owner approval before release.

**Deliverable:** restore evidence, release record and go/no-go decision. **Verification:** observe restored data and application behavior, not merely a backup file or a test count. **DoD:** [ ] restore and rollback demonstrated; [ ] credentials and incident contacts assigned; [ ] independent acceptance signed or release blocked.

## Release, rollback and owner approvals

Production acceptance requires P1–P5 for each selected product, real environment isolation, verified access controls, domain validation where claimed, monitored operations and an independent reviewer. Enabling remote access, issuing GitHub/Feishu credentials, changing data retention, actuation, migrations or release requires explicit owner approval. Stop processing and revoke exposed credentials on incident; restore the pre-upgrade database and matching application version rather than assuming a database downgrade works. Neither deployment nor a restore has been performed in this review.
