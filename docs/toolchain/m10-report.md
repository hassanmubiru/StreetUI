# M10 Report — AI Agent-Native Development Workflow

Date: 2026-11-19
Plan: `.kilo/plans/1794840398238-m10-ai-agent-native-workflow.md`
Status: **Implemented and verified end to end** (CLI + Playground + real browsers).

## 1. Executive summary

M10 makes StreetUI operable by an AI agent without a human in the loop. Building
on M9.5.1 (playground `session_attached` + token), it adds:

1. A **stable JSONL protocol** in which every event carries `eventId` and
   `sessionId`, plus new event types for sessions, HMR outcomes, diagnostics,
   and browser capture.
2. **Browser-confirmed HMR**: `hmr_applied` / `hmr_failed` are emitted only
   after the browser reports the result, instead of broadcast-only
   `module_updated`.
3. **Browser console/error capture** with bounded ring buffers and API access.
4. An **extended Playground control API**: authenticated browser inspection
   (DOM, element, navigation, reload, screenshot negotiation), console/error
   retrieval, and session shutdown.
5. **Security hardening**: token revocation, bounded buffers, pending-request
   cleanup, structured inspection errors.
6. **Documentation and a real E2E verification script**, plus repair of two
   stale verification harnesses that had begun reporting vacuous results.

Verification: 104 unit tests passing, typecheck/lint/build clean for both
packages, the new E2E script passing against real Chromium, and all pre-existing
agent/HMR/playground harnesses passing (Chromium and Firefox where applicable).

## 2. Scope and non-goals

In scope: local agent sessions over the existing independent toolchain (no
Vite/Rollup/Webpack; no new runtime dependencies; Node builtins for servers).

Out of scope (unchanged from the plan): MCP server implementation, publishing
`@streetui/playground`, remote/multi-host execution, tree shaking/scope
hoisting/minification in the builder. WebKit was not exercised in this
environment; nothing is claimed for it.

## 3. Implementation by phase

### Phase 1–2 — Protocol foundation and threading (M10.1)

`packages/cli/src/toolchain/json/events.ts`

- `EventBase` now requires `eventId: string` and `sessionId: string`;
  `makeEventId()` wraps `crypto.randomUUID()`.
- New event types added to the `StreetUIEvent` union: `SessionReadyEvent`,
  `SessionStoppedEvent`, `HmrAppliedEvent`, `HmrFailedEvent`,
  `DiagnosticsUpdatedEvent` (+ `DiagnosticEntry`), `BuildFailedEvent`,
  `BrowserConnectedEvent`, `BrowserDisconnectedEvent`, `BrowserConsoleEvent`,
  `BrowserErrorEvent`, `PreviewInspectedEvent`.
- `EventLogger.send()` generates `eventId`/`timestamp` and applies the logger's
  default `sessionId` (overridable per call). `schemaVersion` stays `1`; the
  change is additive within the same version.

Threading: `runCli` creates one `sessionId` per invocation and passes it to
`dev`, `build`, `preview`, `start`, `playground`, and `doctor`. `DevServerOptions`,
`BuildOptions`, `PreviewOptions`, `StartOptions`, and the playground server all
accept and propagate it, and every `emit()` call site stamps a fresh `eventId`.
`packages/playground/src/server.ts` generates a per-session id (or accepts one)
and shares it between the dev server and the control API.

### Phase 3 — HMR verification (M10.5)

- `hmr/protocol.ts`: client→server `hmr_applied { updateId, ok: true }` and
  `hmr_failed { updateId, ok: false, error }`.
- `hmr/client.ts`: `applyUpdates()` confirms per module — CSS after the import
  resolves, JS after the accept callback runs. Failures report
  `runtime-error` (where applicable) **and** `hmr_failed`, then fall back to a
  full reload. Modules with no accept handler report
  `hmr_failed("no accept handler")` before reloading.
- `dev-server.ts`: `onMessage` turns these into `hmr_applied { file, accepted }`
  and `hmr_failed { file, error }` JSONL events.

Important semantic: shared **SSR modules intentionally bypass HMR**. When the
changed file belongs to the SSR graph, the dev server rebuilds SSR and
broadcasts a full `reload` (`dev-server.ts` `handleChange`), so no
`hmr_applied`/`hmr_failed` is expected for those edits. Agent guidance and the
E2E assertions therefore target the client entry (`src/main.ts`).

### Phase 4 — Console and error capture (M10.6)

- Browser `log` messages become `browser_console { level, message }` events.
- `window.onerror`/`unhandledrejection` become both `runtime_error` and
  `browser_error { message, stack? }` events.
- The dev server maintains bounded ring buffers (1000 entries each) for console
  lines and errors; oldest entries are dropped first.

### Phase 5 — Control API and browser inspection (M10.2–M10.4)

`packages/cli/src/toolchain/server/ws.ts`

- Client registry is a `Map` keyed by client id; `clientIds`, `size`.
- `sendToClient(id, data)` — fire-and-forget, `false` for unknown ids.
- `sendRequest(id, data, timeoutMs = 30000)` — assigns a `requestId`, tracks
  the pending promise, and resolves/rejects it in the frame dispatcher when the
  matching response arrives. Timeouts reject; `closeAll()` rejects all pending
  requests so nothing dangles.

`RunningDevServer` now exposes `hub: WebSocketHub`, which the playground uses
to reach the connected preview.

`hmr/client.ts` answers `inspect_dom`, `inspect_element`, `navigate`, `reload`,
`screenshot`, `get_console`, `get_errors` with
`{ type: "<cmd>_response", requestId, ok, payload? | error? }`. Screenshot
returns `E_UNSUPPORTED` because the preview iframe has no canvas/OffscreenCanvas
path (open question 1, resolved by not fabricating images).

New authenticated routes under `/__playground`:

| Route | Behavior |
|-------|----------|
| `GET /api/browser/status` | `{ connected, clients, previewUrl }` |
| `GET /api/browser/dom` | `{ ok, payload: { html } }` |
| `GET /api/browser/element?selector=` | attributes, dimensions, text, HTML; not-found is a structured failure |
| `POST /api/browser/screenshot` | `E_UNSUPPORTED` when the preview cannot render one |
| `POST /api/browser/navigate` | `{ url }` navigation |
| `POST /api/browser/reload` | acknowledged reload |
| `GET /api/browser/console` | captured `browser_console` events |
| `GET /api/browser/errors` | captured `browser_error` + `runtime_error` events |

Inspection errors are structured: `E_BROWSER_UNAVAILABLE` (503, no client),
`E_INSPECTION_FAILED`, `E_UNSUPPORTED`.

### Phase 6 — Security and session reliability (M10.8)

- `POST /api/session/shutdown` sets `revoked = true` **before** stopping the
  server; programmatic `stop()` does the same. Subsequent authenticated calls
  fail even while the socket drains.
- `session_stopped` is emitted exactly once per session (shutdown or stop) and
  is relayed by `streetui playground` to the agent's stdout.
- Playground diagnostics buffer is bounded: `PlaygroundOptions.eventsMaxSize`,
  default 1000, drop-oldest.
- Existing controls retained: localhost Host/Origin checks, 2 MiB body cap,
  1 MiB WS payload cap, path-traversal/symlink/`node_modules` protections.

### Phase 7 — Documentation (M10.9)

New: `m10-agent-protocol.md`, `m10-control-api.md`, `m10-browser-inspection.md`,
`m10-security.md`, `m10-workflow.md`. Updated: `ai-agents.md` (envelope fields,
M10 section), `AGENTS.md` (new harness + M10 notes), and the plan file's status.

### Phase 8 — End-to-end verification (M10.10)

`scripts/toolchain-agent-e2e.mjs` scaffolds a real project, wires workspace
dependencies, launches the real `streetui playground --json`, and drives the
documented workflow over HTTP with the bearer token. Browser steps use
Playwright Chromium and are reported `BLOCKED` if no browser can launch — never
as passes.

## 4. Bugs found and fixed during verification

| Bug | Fix |
|-----|-----|
| `sessionId` type mismatches (`string \| undefined` into required `string`, `exactOptionalPropertyTypes`) across builder/preview/start/dev-server | `sessionId ?? ''` at emit sites; conditional spread for the `start → build` options |
| `buildProject` wrapper dropped `sessionId` | options type + pass-through in `packages/cli/src/build.ts` |
| Playground CLI relayed an inline event type without `sessionId`; test event lacked the new envelope fields | type/test updates |
| Playground server argv treated `--session-id <uuid>` as a project directory, crashing startup | parse `--session-id` and forward it in `packages/playground/src/index.ts` |
| `sendRequest` had no response correlation, so inspection would always time out | requestId resolution in `WebSocketHub.dispatch` + cleanup on close |
| Modules without an accept handler produced no HMR outcome | `hmr_failed("no accept handler")` before reload |
| `session_stopped` was consumed by the CLI instead of reaching the agent | relay as a proper JSONL event before terminating the child |
| `toolchain-playground-security.mjs` waited for `preview_ready` (no longer emitted) and then **passed vacuously** on `{fatal:"timeout"}` | wait for `session_attached`, use its token, and require `!fatal`, non-empty results, and `pass === true` on every probe |
| `toolchain-playground-browser-tests.mjs` had the same stale ready event and opened the dev root instead of the IDE | wait for `session_attached`; open `new URL('/__playground/', url)` |
| E2E treated a closed socket (status 0) as an unmet revocation condition | accept `401` or socket-gone as proof of shutdown/revocation |

## 5. Verification results

### Static checks and unit tests

| Check | Result |
|-------|--------|
| `tsc --noEmit` (packages/cli) | clean |
| `tsc --noEmit` + `tsup` (packages/playground) | clean |
| `tsup` (packages/cli) | clean (ESM + CJS + DTS) |
| ESLint `packages/cli/src packages/playground/src` | clean |
| `vitest run` (packages/cli) | **20 files, 104 tests passed** |

New tests: `packages/cli/src/toolchain/server/ws-request.test.ts` (3) covers
response correlation against a real upgraded socket, `ok:false` rejection, and
timeout rejection, using an ephemeral port.

### End-to-end agent session (`node scripts/toolchain-agent-e2e.mjs`)

Result: `ok: true`, `browser: "passed"` on Chromium. Observed values from the
passing run:

- `session_attached` with url/port/`sessionId`; unauthenticated `/api/files`
  → 401; 12 project files discovered.
- Edit via `POST /api/file` persisted; diagnostics contained `file_changed` and
  `module_updated`.
- Browser inspection: 1 connected client, DOM snapshot 1031 bytes, `#app`
  element lookup succeeded.
- HMR confirmation on the client entry: `hmr_failed` (no accept handler →
  documented full-reload path).
- Runtime error injected in the real page appeared in `/api/browser/errors`;
  `/api/browser/console` returned 200.
- `POST /api/build` → `build_completed`, 16 files in ~0.4 s, output on disk.
- Shutdown: `session_stopped` observed on the CLI stream; token/socket no
  longer usable afterwards.

Firefox was not run for this particular script; no result is claimed for it
here. The playground browser harness below covers both engines.

### Regression harnesses

| Harness | Result |
|---------|--------|
| `scripts/toolchain-agent-workflow.mjs` | PASS — M8.4 CLI contract intact |
| `scripts/toolchain-hmr.mjs` | PASS — interactive edit, syntax-error overlay, clean recovery |
| `scripts/toolchain-playground-security.mjs` | PASS (real probes, exit 0) after harness repair |
| `scripts/toolchain-playground-browser-tests.mjs --engines chromium` | PASS — no page errors |
| `scripts/toolchain-playground-browser-tests.mjs --engines firefox` | PASS — no page errors |

Security probes verified for real: absolute/encoded traversal, symlink escape,
`node_modules` edit, unauthorized 401, bad-host 403, oversized body,
rename/delete outside the root, templates listing, and zip export. Browser
checks verified in both engines: brand, 12-file explorer, CodeMirror edit +
Ctrl+S save, `build ok`, preview iframe serving SSR HTML with `id="app"`.

Machine-readable outputs are written to `benchmarks/results/toolchain/`
(`playground-security.json`, `playground-browser.json`).

## 6. Limitations and honest boundaries

> M11 follow-up: screenshots are now real PNGs from the optional Playwright
> automation provider (no longer `E_UNSUPPORTED` by design), inspection is
> visual and structured, lifecycle events are emitted, `sessionId` is always
> non-empty, and browser operations support explicit multi-client targeting.
> See `m11-browser-automation.md` and `m11-report.md`.

- Screenshot inspection currently returns `E_UNSUPPORTED`; no image is
  fabricated from the preview iframe.
- `get_console`/`get_errors` browser commands are stubs; the supported path is
  the control API's captured-event buffers.
- `session_ready`, `browser_connected`, `browser_disconnected`, and
  `preview_inspected` are defined but reserved (not yet emitted).
- `module_updated` still means "broadcast"; only `hmr_applied` proves the
  browser applied an update, and SSR-module edits legitimately produce a full
  reload instead.
- Inspection targets the first connected browser client; multi-client routing
  is not part of this milestone.
- No host-platform preview panel integration is claimed — only a real,
  reachable URL and a working control API.

## 7. Reproduction

```bash
cd packages/cli && ../../node_modules/.bin/tsc --noEmit -p tsconfig.json \
  && ../../node_modules/.bin/vitest run && ../../node_modules/.bin/tsup
cd ../playground && ../../node_modules/.bin/tsc --noEmit -p tsconfig.json \
  && ../../node_modules/.bin/tsup
cd ../.. && node_modules/.bin/eslint packages/cli/src packages/playground/src

node scripts/toolchain-agent-e2e.mjs
node scripts/toolchain-agent-workflow.mjs
node scripts/toolchain-hmr.mjs
node scripts/toolchain-playground-security.mjs
node scripts/toolchain-playground-browser-tests.mjs --engines chromium,firefox
```
