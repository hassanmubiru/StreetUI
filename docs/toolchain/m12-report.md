# M12 Report — Developer Adoption, Ecosystem and Production Readiness

Date: 2026-11-22
Branch: `m12-developer-adoption` (based on `build-streetui-toolchain`, since PR
#2 is not merged)
Scope: prove an external developer can install StreetUI from npm, build a real
application, debug it in a real browser, and deploy it with accurate docs.

## 1. Executive summary

M12 delivered: a verified 14-step onboarding journey using only published
packages; an audit of all 10 starter templates (two real defects fixed);
`examples/streetui-dashboard`, a production-oriented SaaS admin dashboard with
routes, typed components, resources, validated forms, theming, accessibility,
and populated SSR; a reorganized documentation index; representative public API
tests; deployment and compatibility guides; performance numbers; community and
contribution files; and a full external developer acceptance test that passes
**on Chromium and Firefox** with zero console/runtime errors. No new mandatory
runtime dependencies, no React/Vue/Svelte, no second toolchain.

## 2. Release closure status

| Item | Status |
|------|--------|
| PR #2 (3.2.1 corrective release) | OPEN, MERGEABLE (UNSTABLE) — **not merged without approval** |
| CI (Node 18/20/22/24 + build gates) | **BLOCKED** — "The job was not started because your account is locked due to a billing issue" (owner action, not code) |
| Vercel `streetjs-website` deployment | **FAILED** — unrelated docs-site integration; logs require Vercel auth |
| npm 3.2.1 (18 packages, dist-tags, tarballs) | **VERIFIED** — all `latest: 3.2.1`, all tarballs valid with declarations |
| D-1 declaration defect | **VERIFIED RESOLVED** — all 11 affected packages pass `tsc --strict` consumer imports at 3.2.1 |
| Docs version mismatch on `main` (README 3.2.0 vs changelog 3.2.1) | **PARTIAL** until PR #2 merges |

## 3. External onboarding results — VERIFIED

The full journey was executed against **published** `streetui@3.2.1` and
`@streetui/cli@3.2.1` only (no workspace links): install → create → install
deps → dev → structure → component → reactive state → routing → forms → data
fetching → styling → production build → production start. Details in
`docs/toolchain/m12-onboarding-audit.md`, including the `preview` vs `start`
distinction, Playwright optionality, and introductory vs production starters.

## 4. Starter template results — VERIFIED

`node scripts/toolchain-template-audit.mjs` (create → typecheck → build for
all 10 templates): **all 10 PASS**. Two genuine defects fixed:

- `todo`: missing `derived` import in `src/app.ts`.
- `interactive`: unsupported `min`/`max` input options replaced with range
  clamping in `onChange`.

Machine-readable results: `benchmarks/results/toolchain/template-audit.json`.

## 5. Complete example application — VERIFIED

`examples/streetui-dashboard` ("Acme Admin"), a production-style SaaS admin
dashboard built entirely with StreetUI public APIs:

- Routes `/`, `/users`, `/projects`, `/settings`, and a 404 fallback with shell
  navigation.
- Reusable typed components (`PageHeader`, `EmptyState`), `listOf` tables,
  `resource()` loading/error/retry, search + role + status filters, pagination,
  three validated `createForm` forms with error/success states, theme toggle
  (`data-theme`), responsive card grids, `a11yIds` labels, live regions, and
  reduced-motion handling.
- Demo data clearly labeled in `data.ts` with a documented
  `createClient({ baseUrl })` integration point and a `createAuthSession`
  integration note (no faked backend or auth).
- SSR entry awaits resources, so production HTML is fully populated
  (`of 24 users` on `/users`), plus a hydration state island.
- **13 unit/SSR tests passing**, strict typecheck clean, production build OK
  (`dist/client/manifest.json`, `dist/server`), and a multi-stage Dockerfile.

## 6. Documentation improvements — VERIFIED

- `docs/README.md` reorganized into the six required sections (getting
  started, core concepts, application development, server rendering, developer
  tools, production) with links to real documents only.
- `docs/toolchain/m12-deployment.md`: Node hosting, Docker, static-hosting
  limits, SSR hosting, health checks, env vars, assets, graceful shutdown.
- `docs/toolchain/m12-compatibility.md`: ESM/CJS behavior, TypeScript,
  browser/Node matrix, CSS/assets, unsupported patterns.
- Root `README.md` adds the dashboard example; `AGENTS.md` gains M12 notes.

## 7. TypeScript API audit — VERIFIED

`packages/streetui/src/api-experience.test.ts` (6 tests): signals with
derived/effect/batch, DSL compile + SSR ids, components with typed props,
resource loading/data states, real form validators, deduped style tokens. All
passing; no breaking API changes made. Public API is additive by convention;
breaking proposals would require an ADR.

## 8. Deployment verification — VERIFIED

`streetui build` → `streetui start` serves populated SSR HTML in production;
`/users` returns the full table. Dockerfile documented for the dashboard with a
health check and graceful shutdown. Static hosting is documented as
client-only (no SSR claims); SSR requires the Node process.

## 9. Accessibility results — VERIFIED (targeted)

The external acceptance test asserts `aria-labelledby` labeling and
keyboard-only interaction (focus + typing) on the dashboard, alongside
`role="status"`/`role="alert"` live regions, focus-visible styles, and
`prefers-reduced-motion`. **BLOCKED**: an automated axe-core audit was not run
(axe-core is not installed in this environment); no claim of a full WCAG audit.

## 10. Performance evidence — VERIFIED

`node scripts/toolchain-perf.mjs` (this environment, Node v24): create 13 ms,
dev startup 161 ms, production build 883 ms (16 files). Results in
`benchmarks/results/toolchain/perf.json`. No cross-framework performance claim
is made; these are toolchain timings only, not browser render benchmarks.

## 11. Compatibility results — VERIFIED

ESM + CJS entry points, declarations for all 11 previously affected packages,
browser-native ESM module serving, CSS/assets behavior, and explicit
unsupported patterns documented in `m12-compatibility.md`. The independent
toolchain is preserved (no bundler compatibility layer).

## 12. Community readiness — VERIFIED

Added `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`,
`.github/ISSUE_TEMPLATE/bug_report.md`, `.github/PULL_REQUEST_TEMPLATE.md`, and
`docs/ROADMAP.md` with completed/in-progress/planned/under-consideration items
and no delivery dates.

## 13. npm package verification — VERIFIED

All 18 packages at `latest: 3.2.1`; published tarballs inspected (manifest,
README, exports, declarations, integrity); independent consumer installs and
`tsc` checks pass for every affected package. No republish was performed.
`@streetui/playground` remains intentionally unpublished.

## 14. AI-agent workflow verification — VERIFIED

M10 `toolchain-agent-e2e.mjs` and M11 `toolchain-agent-visual-e2e.mjs` both pass
on this branch (M11 on **Chromium and Firefox**), confirming create/edit/
diagnose/inspect/screenshot/interact/HMR/build workflows are preserved. No MCP
server was introduced.

## 15. Chromium and Firefox results — VERIFIED

`node scripts/toolchain-external-developer-e2e.mjs --engines chromium,firefox`:

- Installs published `streetui@3.2.1` + `@streetui/cli@3.2.1`, builds the
  dashboard for production, serves SSR, and drives it in both engines.
- Steps verified per engine: overview metrics + activity, users navigation and
  populated table, search/role filters and pagination, project status filter,
  invalid-then-valid form submission, dark theme toggle, labelled inputs and
  keyboard navigation, valid PNG screenshot (signature + dimensions), 404
  fallback, and **0 console errors / 0 runtime errors**.
- Machine-readable results: `benchmarks/results/toolchain/external-developer-e2e.json`.

## 16. Remaining limitations

- PR #2 unmerged (needs approval); `main` README temporarily at 3.2.0.
- CI cannot start (GitHub billing lock, owner action); Vercel docs-site
  deployment fails (owner configuration).
- axe-core accessibility audit not run (package unavailable).
- WebKit not exercised. Dashboard data is demo data by design; real API/auth
  integration points are documented but not implemented (no backend exists).

## 17. GitHub synchronization

- Branch `m12-developer-adoption` created from `build-streetui-toolchain`
  (PR #2 intentionally unmerged).
- Work committed and pushed on this branch with a PR to `main`.
- No history rewrite, no force-push, no merge without approval, no publish.

## 18. Reproduction commands

```bash
# Release + template verification
node scripts/toolchain-template-audit.mjs
node scripts/release-check.mjs

# Dashboard unit/SSR tests, typecheck, build
cd examples/streetui-dashboard
../../node_modules/.bin/tsc --noEmit -p tsconfig.json
../../node_modules/.bin/vitest run
../../packages/cli/dist/bin.js build
../../packages/cli/dist/bin.js start --port 3000

# API experience + performance
cd ../../packages/streetui && ../../node_modules/.bin/vitest run src/api-experience.test.ts
cd ../.. && node scripts/toolchain-perf.mjs

# Acceptance + preservation suites
node scripts/toolchain-external-developer-e2e.mjs --engines chromium,firefox
node scripts/toolchain-agent-e2e.mjs
node scripts/toolchain-agent-visual-e2e.mjs --engines chromium,firefox
node scripts/toolchain-external-install.mjs
```
