# StreetUI M9 — Official AI Playground (Report)

- Status: **Local Playground delivered and verified end-to-end (Chromium);
  publishing gated; remote is design-only.**
- Date: 2026-11-16

## Completed

- **New package `@streetui/playground`** (StreetUI-built IDE + local
  orchestration). `streetui playground [dir]` command added to
  `@streetui/cli`, spawning the Playground server and relaying
  `preview_ready`.
- **Toolchain hook:** `createDevServer` gained an optional `beforeRequest`
  mount hook (backward-compatible) so the Playground mounts on the same dev
  server without a duplicate server/port.
- **IDE UI:** header (brand/project/Run/Build/Share), file explorer, CodeMirror
  6 editor (TypeScript), tabs + dirty tracking, responsive preview panel, and
  bottom Console/Diagnostics/Build panels. Built with StreetUI (no React/Vue).
- **Local execution:** authenticated control API (token, path-validated) for
  session/files/read/write/rename/delete/build; HMR WebSocket drives
  status/diagnostics/console; preview iframe loads the real dev server.
- **Docs:** `docs/playground/{architecture,ai-agents,remote-execution}.md`.

## Verified (Chromium + Firefox, against a generated StreetUI app)

`scripts/toolchain-playground-browser-tests.mjs` (results:
`benchmarks/results/toolchain/playground-browser.json`):

- Playground UI serves with injected token; file explorer lists project files.
- Opening `src/app.ts` loads the CodeMirror editor; typing marks it dirty;
  Ctrl+S saves (file written to disk, dirty clears).
- Build action runs the production build (`build ok — 11 files`).
- Run loads a sandboxed iframe to the real dev server; the actual app renders
  (`#app` present; HTTP 200).
- Zero console errors in both Chromium and Firefox.

Also fixed: the `streetui playground` CLI wrapper now relays the JSONL
`preview_ready` event (so machine consumers can await readiness).

## Regression

- `packages/cli`: typecheck + lint clean; Vitest still green.
- Playground package typechecks and builds (server + UI bundle).

## Changed files

- `packages/playground/**` (new): package, server, UI, tsup configs, build
  script, docs.
- `packages/cli/src/toolchain/server/dev-server.ts` — `beforeRequest` mount hook.
- `packages/cli/src/playground.ts` — new command implementation.
- `packages/cli/src/index.ts` — dispatch/help/exports for `playground`.
- `docs/playground/*`.

## Limitations / follow-ups

- `streetui playground <dir> --template <name>` now scaffolds a fresh project
  from the existing templates (and installs deps) when the target is missing or
  empty, then opens the Playground — covering project creation in local mode.
- **M9.4 follow-up delivered:** the template gallery now exposes the full
  10-template set (basic, ssr, counter, todo, form, routing, signals,
  components, data-fetching, interactive) via `templates/gallery.json`, and the
  Playground UI persists workspace state (preview mode, panel, active file) and
  caches opened files in **IndexedDB** (`streetui.playground` DB) with a
  localStorage fallback for restricted environments.
- The Playground also operates on any existing StreetUI project.
- WebKit not run here (missing system lib) — recorded, not passed.
- Remote execution is design-only (documented).
- Publishing `@streetui/playground` and shipping it in the CLI requires separate
  approval.
