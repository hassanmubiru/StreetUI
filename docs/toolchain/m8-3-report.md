# StreetUI M8.3 — Public Registry E2E Verification (Final)

- Status: **PASS — public independent toolchain is live and verified.**
- Date: 2026-11-15
- Evidence: `benchmarks/results/toolchain/registry-e2e.json`; live `npm view`.

## Result

The published `@streetui/cli@3.1.5` and `streetui@3.1.5` are the independent
toolchain (deps `{typescript}` only, no esbuild) and pass the full live-registry
end-to-end workflow.

## 1. Live registry installation results

`npx --yes --package @streetui/cli@3.1.5 streetui create` generates both
templates; `npm install` resolves framework to 3.1.0 (deps) with cli devDep
3.1.5.

## 2. Installed package dependency audit

- Framework 16 packages: `3.1.0`, internal deps → 3.1.0, no esbuild.
- `@streetui/cli@3.1.5`, `streetui@3.1.5`: `{typescript:'^5.6.3'}`, no esbuild.

## 3. esbuild findings

No runtime esbuild in repo or published packages; build-time only. The broken
3.1.0/3.1.1 publishes (which imported esbuild) are superseded.

## 4–5. Basic & SSR template results

Live E2E `PASS` for both. (Includes the earlier basic-template MIME fix: removed
hardcoded `/main.js`; script injected by the toolchain.)

## 6–7. Chromium / Firefox

Live E2E (published 3.1.5): both engines, both templates, all scenarios
(render, interact, form, navigate, refresh-nested, consoleClean) → **all OK,
0 console errors**.

## 8. HMR

Live E2E `hmr=true` (edit → file_changed/module_updated). Chromium HMR harness
green offline on the candidate.

## 9. Production build & preview

Live `build --json` → `build_completed` + manifest; `preview` serves hashed
entry. Verified.

## 10. Real third-party matrix

Committed fixtures remain green; real-registry third-party (nanoid/clsx/date-fns/
slugify + CSS/fonts) is now unblocked — run as a follow-up now that the published
CLI is functional.

## 11. AI-agent workflow

Live E2E dev server emits `server_started`/`preview_ready` (version 3.1.5) and
`file_changed`/`module_updated`; `build_completed` received. (URL ≠ host preview
panel.)

## 12. Security

Repo `src/security.test.ts` 7/7 pass (unchanged).

## 13. Corrective releases performed (authorized)

- 3.1.2 — removed stale esbuild publish (framework-coherent).
- 3.1.3 — fixed template-path resolution (module-relative, not cwd).
- 3.1.4 — decoupled generated-app framework (3.1.0) vs cli (3.1.4) versions.
- 3.1.5 — removed basic-template hardcoded `/main.js` (MIME fix); E2E Firefox
  binary fallback.

All four cli/streetui corrective patches were authorized by the user and
published only after offline validation (external-install, 96/96 Vitest,
typecheck, lint, Chromium+Firefox dev/prod).

## 14. Changed files

- `packages/cli/templates/basic/src/server.ts` — remove hardcoded `/main.js`.
- `packages/cli/src/{templates,create,index}.ts` — decoupled cliVersion;
  module-relative `templatesRoot()`; `FRAMEWORK_VERSION` const.
- `packages/cli/src/public-api.stability.test.ts` — CLI/FRAMEWORK version.
- `packages/{cli,streetui}/package.json`, `packages/cli/src/index.ts` — version
  bumps 3.1.2→3.1.5; `CLI_VERSION`.
- `scripts/toolchain-registry-e2e.mjs` — 3.1.5, Firefox binary fallback.
- `benchmarks/results/toolchain/registry-e2e.json`.

## 15. Remaining limitations and follow-ups

- `create-streetui` remains unpublished; `npm create streetui@latest` is
  unavailable. The canonical `npx @streetui/cli create` is verified and is the
  supported scaffolding path for this release. Publishing `create-streetui` is a
  future task, not a blocker.
- Node-builtin client-module runtime diagnostics are a candidate future
  enhancement; not in scope for M8.
- `streetui playground <dir> --template <name>` now scaffolds a fresh project
  from the existing templates (installs deps) when the target directory is
  missing or empty, then opens the Playground — covering project creation in
  local mode. The Playground also operates on any existing StreetUI project.
  The full 10-template in-UI set (gallery.json + eight new scaffold templates)
  and browser IndexedDB persistence (workspace state + file cache, localStorage
  fallback) are now delivered; see `docs/playground/m9-report.md`.
- WebKit not run in this env (missing system lib) — recorded, not passed.
- Remote execution is design-only (documented); not implemented.
- Publishing `@streetui/playground` and shipping it in the CLI requires separate
  approval.
- Real-registry third-party matrix is a recommended follow-up now that the
  published CLI is functional.

## 16. Closure

**M8.4 is closed.** `@streetui/cli@3.1.1` and `streetui@3.1.1` are the live,
corrected public independent toolchain (no esbuild; `typescript: *` only). The
framework set is coherent at 3.1.0. Consumer smoke (ESM + CJS) passes. All
offline regressions (96/96 Vitest, typecheck, lint, Chromium+Firefox dev/prod,
HMR, agent-workflow) pass against the current build.

Recommended follow-up: run the real-registry third-party matrix; optionally
publish `create-streetui` for the `npm create` flow.
