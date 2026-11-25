# M13 — Production Hardening Report

**Status:** complete — every task either verified on this host or recorded as
BLOCKED with a concrete reason. No result in this report is inferred; each one
points at a machine-readable artifact in `benchmarks/results/toolchain/`.

- **Branch:** `m13-production-hardening` (base `6ab3670c`, M12 close)
- **Date:** 2026-11-23
- **Node used for local verification:** v24.18.0 (matrix covers 18/20/22/24)
- **Platform:** linux-x64
- **No packages were published by this milestone.**

## Summary

| Task | Result | Evidence |
|------|--------|----------|
| M13.1 Baseline audit | ✅ | this report, git log |
| M13.2 axe-core a11y (Chromium) | ✅ 0 violations / 7 routes | `a11y-axe.json` |
| M13.2 axe-core a11y (Firefox) | ✅ 0 violations / 7 routes | `a11y-axe.json` |
| M13.3 WebKit | ⛔ BLOCKED at M13 — ✅ resolved in M14 (see `m14-report.md`) | `webkit-dev.json` |
| M13.4 Node 18/20/22/24 | ✅ all PASS | `node-matrix.json` |
| M13.5 Docker production | ✅ build/health/routes/graceful stop | this report |
| M13.6 Real HTTP integration | ✅ 32 dashboard tests + live API SSR | `src/http-*.test.ts` |
| M13.7 Preservation | ✅ typecheck, lint, 109 CLI tests, harnesses | this report |
| M13.8 SSR + hydration | ✅ Chromium + Firefox + dev regeneration | `ssr-hydration.json` |
| M13.9 Security | ✅ 7/7 | `packages/cli/src/security.test.ts` |
| M13.10 Performance baseline | ✅ measured | `perf.json` |

## M13.2 — Accessibility (axe-core)

Production build served by `streetui start`, audited with axe-core through
`@axe-core/playwright` (a dev-only, isolated install — never a framework
dependency). Routes: `/`, `/users`, `/projects`, `/settings`,
`/settings` with validation errors rendered, `/` with the dark theme applied,
and `/does-not-exist`.

| Engine | Routes | Violations |
|--------|--------|-----------|
| Chromium | 7 | 0 |
| Firefox | 7 | 0 |

Harness: `scripts/toolchain-a11y-axe.mjs`. A missing engine is recorded as
BLOCKED, never PASS.

## M13.3 — Browser matrix / WebKit

| Engine | dev | prod |
|--------|-----|------|
| Chromium | ✅ | ✅ |
| Firefox | ✅ | ✅ |
| WebKit | ⛔ BLOCKED at M13 (host libs) — ✅ verified in M14 | ✅ verified in M14 |

WebKit cannot launch on this host: `MiniBrowser: error while loading shared
libraries: libevent-2.1.so.7`. Installing the missing system packages requires
`sudo` (`npx playwright install-deps`), which is outside this environment. The
harness now classifies a missing OS library as `BLOCKED` rather than `ERROR`,
and records the exact library in `benchmarks/results/toolchain/webkit-dev.json`.
WebKit is **not** claimed as passing.

## M13.4 — Node compatibility matrix

Harness: `scripts/toolchain-node-matrix.mjs` — packs the worktree CLI into a
tarball, installs it into a temp project, then checks install, `--version`,
scaffold, production build, `doctor`, and a real dev-server HTTP response.

| Node | install | scaffold | build | doctor | dev server |
|------|---------|----------|-------|--------|-----------|
| 18 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 20 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 22 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 24 | ✅ | ✅ | ✅ | ✅ | ✅ |

Target: `local-worktree-tarball` (the fix below is not yet in a published
package).

### Fixed: Node 18 SSR

**Symptom.** On Node 18 the SSR dev server never responded;
`SyntaxError: Named export 'compile' not found. The requested module
'../node_modules/@streetui/compiler/dist/index.js' is a CommonJS module`.

**Root cause.** The SSR runner copies dependency `.js` files into its cache
directory but did not copy the dependency's `package.json`. Node 20+ detects ESM
syntax in an ambiguous `.js` file; Node 18 does not, so it fell back to
CommonJS and failed to link the named exports.

**Fix** (`packages/cli/src/toolchain/server/ssr-runner.ts`): the crawl records
each resolved dependency's package directory, and the build copies that
`package.json` into the cache at the mirrored relative path — using
`join(outDir, relative(root, source))` rather than the module-output helper,
because that helper rewrites every extension to `.js` (which had been turning
`package.json` into `package.js`).

**Regression test** (`packages/cli/src/dev-server.test.ts`): asserts the SSR
cache contains `node_modules/@streetui/compiler/package.json` with
`"type": "module"`.

### Also fixed: SSR rebuild diagnostics

A module that fails to transform is skipped, which previously surfaced as
`Cannot find module '<cache>/src/app.js'` — an error that describes the symptom,
not the cause. The runner now reports the first real diagnostic
(`SSR build failed in src/app.ts: ',' expected.`) and the dev server logs it.

## M13.5 — Docker production verification

Image built from `examples/streetui-dashboard/Dockerfile`
(`node:22-alpine`, multi-stage, healthcheck, `streetui start`).

| Check | Result |
|-------|--------|
| `docker build` | ✅ |
| Container health | `healthy` |
| `/`, `/users`, `/projects`, `/settings`, `/does-not-exist` | 200 |
| `/styles.css` | 200 `text/css; charset=utf-8` |
| `docker stop -t 10` | exit code 0, `OOMKilled=false` |

## M13.6 — Real HTTP integration + resource reliability

The dashboard previously only had mock data with a comment describing the
production integration point. That path is now implemented and tested.

**Added** `examples/streetui-dashboard/src/http-data.ts`:
- `DataSource` is now an explicit contract in `data.ts`, implemented by both
  `createMockDataSource()` and `createHttpDataSource({ baseUrl })`.
- `createHttpDataSource` uses `createClient` from `streetui` (the framework's
  own optional HTTP client — no new dependency).
- Non-2xx responses surface as the framework's typed `HttpError`; payloads that
  do not match the shapes the UI dereferences are rejected with a descriptive
  error instead of a `TypeError` inside the renderer.
- Selection is one public environment variable,
  `STREETUI_PUBLIC_DASHBOARD_API_URL`, resolved identically by SSR and the
  client bundle (the toolchain inlines `process.env.STREETUI_PUBLIC_*`). Unset
  means the mock source, so tests and the demo need no backend.

**Reliability guarantees now covered by tests** (`src/http-data.test.ts`, 14
tests):
- request mapping (endpoint, query string, JSON shape) per method;
- abort signal forwarded to `fetch`;
- `HttpError` on non-2xx, with status;
- malformed payload rejection for all three endpoints;
- mock loader rejects with `AbortError` mid-flight and when already aborted;
- resource reaches `success` and exposes `loading` → settled;
- error surfaces, then retry recovers to `success`;
- a refetch keeps the previous data visible (`isRefetching`);
- a stale response that resolves after a newer request never overwrites it;
- `dispose()` aborts in-flight work;
- an injected HTTP client drives all three resources end to end.

**Live end-to-end** (`src/http-e2e.test.ts`, 5 tests, Node environment): a real
`node:http` server serves the three endpoints; the tests fetch them over real
HTTP, assert a real 404 becomes `HttpError(404)`, and render the SSR entry with
`STREETUI_PUBLIC_DASHBOARD_API_URL` pointing at that server — the HTML then
contains the live API's data. With the variable unset, the same render falls
back to the mock data.

**Production check:** `streetui build` with the variable set inlines the base
URL into the client bundle; `streetui start` against a live API returned
`200` with the API's metrics, users, and projects in the SSR HTML.

## M13.7 — Preservation suite

| Check | Result |
|-------|--------|
| `packages/cli` typecheck | ✅ |
| `packages/cli` vitest | ✅ 109 tests / 21 files |
| dashboard typecheck | ✅ |
| dashboard vitest | ✅ 32 tests / 3 files |
| eslint `packages scripts examples` | ✅ clean |
| browser harness (Chromium + Firefox, dev + prod) | ✅ all OK |
| HMR harness | ✅ PASS (edit stays interactive, overlay on syntax error, clean recovery) |
| Node matrix | ✅ 18/20/22/24 |
| axe-core | ✅ 0 violations both engines |

The dashboard's uncommitted `role="banner"` / `role="main"` landmarks are
retained: they make the shell explicit for assistive technology (and axe-core
still reports 0 violations with them).

## M13.8 — SSR + hydration verification

Harness: `scripts/toolchain-ssr-hydration.mjs` → `ssr-hydration.json`.

**Server rendering (JavaScript disabled in the browser context).** `/users`
returns 200 with the heading, the search input, `of 24 users`, the first user,
`Page 1 of 3`, and 8 keyed rows — the content is real markup, not a client
render.

**Hydration (client entry deliberately delayed).** Before the entry executes,
four server nodes are tagged with a probe attribute. After hydration:

| Check | Chromium | Firefox |
|-------|----------|---------|
| Server DOM nodes adopted (probe preserved on all 4) | ✅ | ✅ |
| No duplicated tree (`106` elements before and after) | ✅ | ✅ |
| Interactive after hydration (theme toggle flips `<html data-theme>`) | ✅ | ✅ |
| State island matches the rendered route (`view: "users"`) | ✅ | ✅ |
| Console clean | ✅ | ✅ |

**Dev SSR cache regeneration.** Editing `src/app.ts` in a running dev server is
reflected by the next HTTP response, and reverting restores the original output
(`devSsrRegeneration.ok = true`). This is the same path that produced the
diagnostics fix above.

## M13.9 — Security

`packages/cli/src/security.test.ts`: **7/7 pass** — plain and encoded path
traversal blocked, no file served outside the project, same-host WebSocket
origin accepted, malformed frames disconnect the client. The M10 hardening
(bounded event buffers, `eventsMaxSize` default 1000, session revocation) is
unchanged by this milestone; no code in it was modified.

## M13.10 — Performance baseline

Harness: `scripts/toolchain-perf.mjs` → `perf.json`. Fresh `ssr` template on
Node 24 / linux-x64:

| Measurement | Value |
|-------------|-------|
| Project creation | 9 ms |
| Dev server cold start (to first SSR response) | 601 ms |
| First response size | 1,035 bytes |
| HMR update broadcast (3 samples) | 60.4 / 60.9 / 62 ms (median 60.9 ms) |
| Production build | 393 ms |
| Build output | 16 files |

HMR timing is measured server-side: the interval from writing the source file
to the dev server emitting `module_updated`. Browser apply time is measured
separately by the HMR harness, which asserts the app stays interactive rather
than reporting a number. The HMR figures cluster at ~61 ms because the watcher
debounces at 60 ms (`watcher.ts` `debounceMs`); this is the floor, not a
regression.

## Changed files

**Toolchain**
- `packages/cli/src/toolchain/server/ssr-runner.ts` — dependency
  `package.json` preservation (Node 18 ESM) and real SSR diagnostics.
- `packages/cli/src/dev-server.test.ts` — SSR cache `package.json` regression
  test; SSR rebuild + broken-module diagnostic test.

**Dashboard example**
- `src/data.ts` — `DataSource` contract, `DataRequestOptions`, abort-aware mock
  loaders, `createMockDataSource()`.
- `src/http-data.ts` (new) — real HTTP source over `createClient`, payload
  validation, `HttpError` detection.
- `src/state.ts` — `createDataSource()`, injectable source in `createState`.
- `src/http-data.test.ts` (new) — 14 HTTP + resource reliability tests.
- `src/http-e2e.test.ts` (new) — 5 live-HTTP SSR tests.
- `src/app.ts` — `role="banner"` / `role="main"` landmarks.
- `package.json` — pinned `streetui` / `@streetui/cli` to `3.2.1`.
- `README.md` — real HTTP integration section.

**Scripts**
- `scripts/toolchain-a11y-axe.mjs` (new) — axe-core audit.
- `scripts/toolchain-node-matrix.mjs` (new) — Node 18/20/22/24 matrix.
- `scripts/toolchain-ssr-hydration.mjs` (new) — SSR/hydration/regeneration.
- `scripts/toolchain-perf.mjs` — extended with cold start, first response, HMR
  timing, environment metadata.
- `scripts/toolchain-browser-tests.mjs` — missing OS library now `BLOCKED`.

**Artifacts** — `benchmarks/results/toolchain/`: `a11y-axe.json`,
`node-matrix.json`, `ssr-hydration.json`, `perf.json`, `webkit-dev.json`,
`chromium-{dev,prod}.json`, `firefox-{dev,prod}.json`.

## Limitations

1. **WebKit was unverified at M13.** Missing host libraries
   (`libevent-2.1.so.7` and others) recorded the engine as BLOCKED. **Resolved in
   M14**: the libraries are extracted into the Playwright bundle and WebKit 26.6
   passes the browser, a11y and SSR/hydration harnesses (`m14-report.md`).
2. **The Node 18 fix is not published.** `@streetui/cli@3.2.1` on npm still
   fails Node 18 SSR; the matrix passes only against the worktree tarball.
   Publishing requires explicit approval.
3. **Browser verification at M13 covered Chromium and Firefox only.** WebKit was
   added and verified in M14.
4. **Perf numbers are one machine.** They are a baseline for regression
   comparison, not a cross-hardware claim.
5. **Repository-wide `tsc --noEmit` has pre-existing errors** in
   `apps/playground/src/main.ts` and `examples/streetjs-website/vitest.config.ts`.
   They are unrelated to M13 (no M13 file appears in them) and were left
   untouched; the packages and the dashboard example typecheck cleanly.
