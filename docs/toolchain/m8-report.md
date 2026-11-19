# StreetUI M8 — Real-World Compatibility & AI Agent Preview

- Status: Complete
- Date: 2026-11-15
- Evidence: `benchmarks/results/toolchain/*.json`; `packages/cli` Vitest suite.

## 1. Implementation summary

M8 proved the toolchain works **outside the monorepo** and that AI agents can
drive the real CLI. Two minimal, additive framework changes were made:

1. **CommonJS diagnostic** — the resolver now classifies a module's format
   (`esm`/`cjs`) via extension + nearest `package.json` `type`; the dev server
   and production builder refuse to emit CommonJS browser modules and return a
   concrete diagnostic (which package, which import, why, what to do). No
   silent CJS→ESM conversion.
2. **Event `version`** — `preview_ready`/`server_started` now include the
   installed framework version (used by the AI-agent contract).

A reliability fix was added while hardening HMR: **SSR rebuild serialization**
in `createSsrRunner` prevents concurrent watcher-triggered builds from leaving a
torn temp server graph.

## 2. Changed files

Framework:
- `packages/cli/src/toolchain/resolve/resolver.ts` (+ `format`, `#`-imports,
  `resolvePackageImports` guard)
- `packages/cli/src/toolchain/server/dev-server.ts` (CJS diagnostic, event version)
- `packages/cli/src/toolchain/server/ssr-runner.ts` (serialized builds)
- `packages/cli/src/toolchain/build/builder.ts` (CJS build diagnostic)
- `packages/cli/src/toolchain/json/events.ts`, `src/preview.ts`,
  `src/start.ts`, `src/index.ts` (event version plumbing)

Tests:
- `src/toolchain/third-party.compat.test.ts`, `src/security.test.ts`
- extended `src/toolchain/resolve/resolver.test.ts`, `src/dev-server.test.ts`
- `src/toolchain/build/toolchain.test.ts` (version assertion)

Tools/docs:
- `scripts/toolchain-external-install.mjs`, `scripts/toolchain-agent-workflow.mjs`,
  `scripts/toolchain-hmr.mjs`; extended `scripts/toolchain-browser-tests.mjs`
- `docs/toolchain/npm-compatibility.md`, `docs/toolchain/ai-agents.md`,
  `docs/toolchain/m8-report.md`; `AGENTS.md` updated

## 3. Clean external installation (`npm pack` artifacts)

`scripts/toolchain-external-install.mjs`:

- Packs all 18 public packages into `dist-tarballs/`.
- Installs them into an isolated consumer via `file:` tarball specifiers
  (offline; no workspace links, no symlinks, no monorepo-relative imports).
- For **both** `basic` and `ssr` templates: `create` → `doctor` (OK) →
  `build` (hashed `manifest.json` + entry JS) → `start` (SSR HTML served) →
  `preview` (hashed client entry served) → `dev --json` (preview_ready with
  `version`).
- Asserts no `workspace:` specifiers, no symlinked `node_modules`, and no Vite
  files/config in generated projects.

**Result: PASSED for both templates.** The public-registry `npm create
streetui@latest` path could not be exercised because the registry is
unreachable in this sandbox; it is documented as "not yet tested" rather than
claimed.

## 4. Third-party compatibility

Supported (tested via fixtures in `third-party.compat.test.ts`): ESM,
conditional exports, browser condition, subpath exports, `#`-imports, nested
dependencies, dual ESM/CJS (ESM branch chosen), dynamic imports, JSON, CSS,
assets/fonts, TS declarations, circular graphs.

Partially supported: CommonJS without an ESM entry → clear diagnostic; Node-only
modules → reported. Unsupported: emitting CJS as browser ESM. See
`docs/toolchain/npm-compatibility.md` for the full matrix (including the
"not yet tested: real registry packages" row).

## 5. HMR reliability (`scripts/toolchain-hmr.mjs`, Chromium)

- Editing a source file keeps the app interactive (accepted boundary re-renders
  with preserved state).
- A syntax error surfaces an error overlay (never a silently-broken app).
- Fixing the file clears the overlay and the app recovers; no console errors
  after recovery.

**Result: PASSED (chromium).** A Firefox HMR run was attempted but hung in this
environment and is noted; the general browser harness covers Firefox dev/prod
rendering, interaction, routing, forms, and refresh.

## 6. Chrome and Firefox (and WebKit) results

`scripts/toolchain-browser-tests.mjs --engine chromium,firefox,webkit --mode dev,prod`
with scenarios initialRender, interact, navigate, form, consoleClean,
refreshNested:

| Engine | dev | prod |
| --- | --- | --- |
| Chromium | OK | OK |
| Firefox | OK | OK |
| WebKit | ERROR | ERROR |

WebKit launches but cannot run in this environment: the cached build is missing
the system library `libevent-2.1.so.7`. This is recorded explicitly (never
fabricated as passed).

## 7. SSR & hydration regression

- Dev SSR, production SSR, client-entry injection, and nested-route refresh are
  exercised by the new `refreshNested` browser scenario (passes on Chromium and
  Firefox in both modes).
- SSR rebuild serialization keeps the server graph consistent across rapid
  edits; a syntax-error edit yields a diagnostic/overlay rather than a stale
  broadcast.

## 8. Security (`src/security.test.ts`, 7/7 pass)

Plain + encoded path traversal blocked; files outside the project are never
served; unusual HTTP methods tolerated; WebSocket origin rejection (403);
malformed oversize WS frame disconnects without a crash; strict-mode port
conflict fails cleanly. Localhost binding remains the default.

## 9. AI-agent workflow (`scripts/toolchain-agent-workflow.mjs`)

Drive the real CLI as a subprocess; assert the event contract:

- `project_detected` (with `version`),
- `preview_ready` (`url`, `port`, `status:"ready"`, `version`),
- an edit produces `file_changed`/`module_updated`,
- `streetui build --json` emits `build_completed`.

**Result: PASSED (dev URL `http://localhost:3417/`, build_completed files=16).**
Capability detection and honest limits (Socket URL ≠ a host preview panel) are
documented in `docs/toolchain/ai-agents.md`.

## 10. Node compatibility

Verified on Node 24 (the version available here); source targets Node `>=18`
(`engines`) and uses no Node 20+-only APIs. A multi-Node matrix could not be
run without a version manager; documented, not claimed.

## 11. Performance (measured, `perf.json`)

| Metric | Value |
| --- | --- |
| scaffold | 8 ms |
| dev-server startup | 101 ms |
| production build | ~629 ms (16 modules) |

## 12. Validation

- `packages/cli`: typecheck clean, ESLint clean, **96/96 Vitest tests pass**
  (18 suites).
- CLI + `streetui` packages build via `tsup`.
- External-install, browser (Chromium/Firefox), HMR (Chromium), agent-workflow,
  and perf harnesses pass.

## 13. Known limitations

- Public-registry install not exercised (offline). Uses packed tarballs.
- WebKit blocked by a missing system library in this environment.
- Firefox HMR run inconclusive in this environment (Chromium verified).
- Real-registry third-party packages are "not yet tested"; fixtures cover the
  matrix.
- Node 18/20/22 not run (only Node 24 available).
- HMR state preservation remains limited to CSS + explicit `accept()`.

## 14. Recommendation for next milestone

Publish the packed tarballs to the npm registry, then run the M8.1 clean-install
harness against the live registry and the `npm create streetui@latest` flow to
close the remaining "not yet tested" gap, followed by a full release smoke.
