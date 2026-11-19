# M11 Report — Visual Browser Verification and Agent Automation

Date: 2026-11-19
Plan: `.kilo/plans/1794840398238-m11-visual-browser-verification.md`
Status: **Implemented and verified end to end on Chromium and Firefox.**

## 1. Executive summary

M11 turns M10's agent workflow into a **visual** one. An AI agent can now open a
real StreetUI application in a real browser, inspect what actually rendered,
capture real PNG screenshots, click and fill elements, evaluate expressions,
detect runtime/network/visual problems, fix the source, and verify the outcome —
all through StreetUI's own tooling, with no new mandatory runtime dependency.

The central design decision: screenshots and interactions are **not** faked into
the HMR preview iframe. A provider-based automation manager drives a real
browser (Playwright, optional and development-only) against the dev server's
preview URL, alongside the untouched M10 HMR-client inspection.

Verification: the M11 acceptance E2E passes **all 22 steps on both Chromium and
Firefox**, including PNG signature/IHDR validation, `hmr_applied` with visible
CSS and preserved state, `hmr_failed` reload, SSR reload semantics, runtime
error capture and recovery, multi-client targeting, production build, shutdown,
token revocation, and screenshot cleanup. 108 unit tests, all M10/M8.4/HMR/
playground harnesses, and the external-install packaging harness also pass.

## 2. Repository changes

New files:

- `packages/playground/src/automation.ts` — provider, screenshots, interactions,
  inspection, diagnostics, lifecycle events, storage, serialization, cleanup.
- `scripts/toolchain-agent-visual-e2e.mjs` — M11 acceptance harness.
- `packages/cli/src/toolchain/json/events.test.ts` — session identity tests.
- `docs/toolchain/m11-browser-automation.md`, `m11-visual-qa-workflow.md`,
  `m11-report.md` (this file).
- `packages/playground/README.md` (new; required by that package's `files`).
- `.kilo/plans/1794840398238-m11-visual-browser-verification.md`.

Modified:

- `packages/playground/src/server.ts` — automation wiring, screenshot/interact/
  inspect/clients/disconnect routes, multi-client `resolveBrowserTarget`,
  per-client console/errors, `session_ready`, shutdown cleanup, header-safe
  `json()` and guarded error paths.
- `packages/playground/src/index.ts` — `--session-id` parsing (M10 fix).
- `packages/cli/src/toolchain/server/ws.ts` — `disconnect(clientId)`, pending
  request correlation/cleanup.
- `packages/cli/src/toolchain/server/dev-server.ts` — non-empty session IDs,
  HMR connect/disconnect events, `clientId` on console/error events, 500-handler
  header guard.
- `packages/cli/src/toolchain/json/events.ts` — `clientId` fields, non-empty
  default session IDs.
- `packages/cli/src/toolchain/{build/builder.ts,server/dev-server.ts}`,
  `packages/cli/src/{preview.ts,start.ts}` — session ID resolution.
- `packages/cli/src/toolchain/server/ws-request.test.ts` — disconnect test.
- `scripts/toolchain-playground-{security,browser-tests}.mjs` — repaired stale
  ready-event waits and the vacuous-PASS condition.
- Docs: `m10-*` updates, `ai-agents.md`, root `README.md`,
  `packages/cli/README.md`, `CHANGELOG.md`, `AGENTS.md`.

## 3. Architecture decisions

- **Provider, not iframe hacks.** `AutomationManager` (one per playground
  session) owns a Playwright browser/context/page. The M10 HMR-client protocol
  is preserved for human-opened preview tabs.
- **Optional dependency.** `await import('playwright')` behind a structural
  typed facade (no `any`). Missing provider or binaries →
  `E_AUTOMATION_UNAVAILABLE` with install guidance; nothing is simulated. A
  cache fallback uses only real executables from `~/.cache/ms-playwright`.
- **Evidence over assertion.** PNG dimensions are read from the image's IHDR
  chunk, not from the request. Retrieval is by generated UUID only.
- **Explicit targeting.** With several connected targets, omitting `clientId`
  is an error (`E_CLIENT_REQUIRED`), never an arbitrary choice. Single-target
  M10 behavior is unchanged.
- **Session boundary identity.** Every producer resolves
  `options.sessionId ?? makeEventId()`; empty session IDs are impossible.
- **Crash-proof control API.** JSON is serialized before headers are written,
  error paths respect `headersSent`, and `evaluate` results are sanitized.

## 4. New browser automation capabilities

| Capability | Status |
|------------|--------|
| M11.1 Real screenshots (viewport, full-page, custom size, PNG, metadata, safe storage/retrieval) | **VERIFIED** |
| M11.2 Interaction API (click/type/fill/select/press/submit/scroll/navigate/reload/resize/waits/evaluate) | **VERIFIED** (click/fill/scroll/press/waits/navigate/reload/resize/evaluate exercised; type/select/submit implemented, not separately asserted) |
| M11.3 Structured visual inspection | **VERIFIED** |
| M11.4 Complete HMR verification (success, failure, SSR) | **VERIFIED** |
| M11.5 Event protocol completion + non-empty session IDs | **VERIFIED** |
| M11.6 Multi-client sessions | **VERIFIED** |
| M11.7 Diagnostics and visual failure detection | **VERIFIED** (exceptions, rejections via `pageerror`, failed requests, console errors, empty root, broken images, off-viewport warnings, missing elements, failed interactions/navigation) |
| M11.8 Security and resource management | **VERIFIED** (see §8) |
| M11.9 Documented visual QA workflow | **VERIFIED** (`m11-visual-qa-workflow.md`) |
| M11.10 Real E2E acceptance | **VERIFIED** (Chromium + Firefox) |
| M11.11 README/changelog maintenance | **VERIFIED** (§14–17) |
| Automated visual *design judgment* (aesthetics scoring) | **NOT IMPLEMENTED** (no measurable mechanism; intentionally not claimed) |

## 5. Screenshot verification evidence

Per engine, the acceptance run captures and checks real images:

- Viewport capture at 900×600: `format: "png"`, `width: 900`, `height: 600`.
  The binary is fetched from the returned id URL and validated:
  signature `89504e470d0a1a0a`, IHDR width/height equal to metadata, and byte
  length equal to `bytes`.
- Full-page capture at a custom viewport of 800×500: `width: 800`,
  `height: 500` (full-page height is ≥ viewport).
- `GET /api/browser/screenshot/not-a-real-id` → 404 `E_NOT_FOUND`.
- `POST /api/browser/screenshot` before connecting → 503
  `E_AUTOMATION_UNAVAILABLE`; HMR-only clients get `E_UNSUPPORTED`.
- After shutdown, `.streetui-cache/screenshots/<sessionId>/` no longer exists.

## 6. HMR success and failure evidence

- **Success**: a CSS module imported by the client entry is edited. A *new*
  `hmr_applied` for that file is required (the file-creation event does not
  count). Computed style then reads `rgb(1, 2, 3)` and the counter state set
  after the previous reload is preserved (`Count: 2`).
- **Failure**: editing `src/main.ts` (no accept handler) produces
  `hmr_failed`, a full reload, and the documented state reset (`Count: 0`).
- **SSR**: a window marker is set, then `src/app.ts` (SSR graph) is edited. The
  marker disappears (real reload), and **no** `hmr_applied` for `app.ts` is
  recorded — an SSR rebuild is never misreported as client HMR.
- **Recovery**: after a real uncaught `agent-visual-boom` exception is captured
  (`E_PAGE_ERROR`, `runtimeErrorCount ≥ 1`), a further CSS edit produces another
  `hmr_applied` and the new computed style `rgb(4, 5, 6)`.

## 7. Multi-client test results

A second preview tab is opened, producing 3 targets (2 HMR + automation):

- `GET /api/browser/clients` lists all three.
- `GET /api/browser/dom` without a target → 400 `E_CLIENT_REQUIRED`.
- `clientId=c999` → 404 `E_CLIENT_NOT_FOUND`.
- Explicit `clientId` returns that client's DOM and echoes the id; per-client
  console retrieval returns an array scoped to that client.
- `POST /api/browser/disconnect { clientId }` expires the second HMR client and
  emits `browser_disconnected` with the same id.

## 8. Security review

Preserved: localhost binding, Host/Origin validation, bearer auth, token
revocation, project-root restrictions, traversal/symlink/`node_modules`
protection, request-size limits, bounded buffers. The playground security
harness passes all real probes (exit 0).

Added/verified in M11: screenshots only under
`.streetui-cache/screenshots/<sessionId>/` with id-only retrieval (malformed ids
rejected), 24-image cap, deletion on shutdown; automation operations serialized
and capped at 30 s; browser/context closed on disconnect and on both shutdown
paths; pending WS requests rejected on hub close; disconnected clients emit a
single disconnect event; no new runtime dependencies; no unrestricted remote
execution surface (operations are fixed, parameters bounded, `evaluate` runs
only inside the session's own local preview page).

## 9. Chromium results

**VERIFIED** — all 22 acceptance steps pass (`ok: true`), with real screenshots,
interactions, HMR success/failure/SSR, error capture/recovery, multi-client,
build, shutdown, revocation, and cleanup. Playground browser harness: PASS with
zero page errors.

## 10. Firefox results

**VERIFIED** — the same 22 steps pass. Firefox initially failed to launch
because Playwright's expected build was absent; the provider's real-binary
cache fallback (no fabrication) launched the installed Firefox and the full
suite passed. Playground browser harness on Firefox: PASS, zero page errors.

## 11. WebKit status

**BLOCKED / not run** — WebKit was not exercised in this environment. The
provider accepts `engine: "webkit"` and would use a real binary if installed,
but no result is claimed.

## 12. Unit test results

`vitest run` (packages/cli): **21 files, 108 tests passing**. New in M11:
session-identity tests (non-empty generated IDs, stable provided IDs, unique
UUID event IDs) and a hub `disconnect` test, alongside the M10 WS
request/response tests.

## 13. Build and typecheck results

- `tsc --noEmit` clean for `packages/cli` and `packages/playground`.
- `tsup` builds clean for both (CLI ESM/CJS/DTS; playground server + UI).
- ESLint clean for `packages/cli/src` and `packages/playground/src`.
- Regression harnesses: M8.4 workflow PASS, HMR hardening PASS, M10 agent E2E
  PASS, playground security PASS (real probes), playground browser PASS on both
  engines, external-install verification PASS (packed artifacts work outside
  the monorepo). Results are written to `benchmarks/results/toolchain/`
  (`agent-visual-e2e.json`, `playground-security.json`,
  `playground-browser.json`).

## 14. GitHub README update status

**Updated.** Root `README.md` now lists `create | dev | build | start | preview
| doctor | playground` (plus `--json`) and adds an "AI agents: browser-verified
development" section describing the control API, browser-confirmed HMR,
optional visual automation, session lifecycle, and links to the M10/M11 docs.

## 15. npm package README update status

- `packages/cli/README.md`: updated event list (event/session IDs,
  HMR/browser/lifecycle events), `playground` command, and a full
  "Playground and AI agent automation" section with endpoints and the optional
  Playwright rule, linking to the GitHub protocol/automation docs.
- `packages/playground/README.md`: created — standalone package documentation
  (run instructions, API surface, optional automation, security, doc links).
- Other published packages are unaffected by M11 and were left unchanged.

## 16. npm package tarball README verification

`npm pack --dry-run --json` confirms:

- `@streetui/cli@3.1.6` — `README.md` present (6,766 bytes; 137 files total,
  including per-template READMEs).
- `@streetui/playground@0.1.0` — `README.md` present (3,549 bytes).

No packages were published. The external-install harness additionally verified
that packed artifacts install and work outside the monorepo (`doctor`, `build`,
both templates), and correctly reports Playwright as optional/absent there.

## 17. Changelog update status

`CHANGELOG.md` has a new `Unreleased — M11` entry (Added / Changed / Fixed /
Security / Verified) and a companion `Unreleased — M10` entry, since M10 had not
been recorded. No release numbers were invented and no publish is claimed.
`AGENTS.md`, `ai-agents.md`, and the M10 protocol/API/security docs were updated
for the behavior M11 changed.

## 18. Known limitations

- Automated **visual design judgment** is not implemented; inspection reports
  measurable facts (geometry, visibility, errors) only.
- `type`, `select`, and `submit` are implemented but not individually asserted
  in the acceptance run (the counter template has no matching controls);
  `waitForNavigation` is covered by navigation steps rather than a dedicated
  assertion.
- Screenshot format is PNG only; no JPEG/WebP, video, or cross-session image
  diffing.
- One automation browser per playground session (HMR preview tabs are
  additional targets). Cross-session client sharing is intentionally impossible.
- WebKit unverified (§11). The pre-existing HMR harness still logs an SSR
  cache-path warning during its intentional error phase; the harness passes and
  this is unrelated to M11.

## 19. Reproduction

```bash
cd packages/cli && ../../node_modules/.bin/tsc --noEmit -p tsconfig.json \
  && ../../node_modules/.bin/vitest run && ../../node_modules/.bin/tsup
cd ../playground && ../../node_modules/.bin/tsc --noEmit -p tsconfig.json \
  && ../../node_modules/.bin/tsup
cd ../.. && node_modules/.bin/eslint packages/cli/src packages/playground/src

# M11 acceptance (real browsers)
node scripts/toolchain-agent-visual-e2e.mjs --engines chromium,firefox

# Regression + packaging
node scripts/toolchain-agent-e2e.mjs
node scripts/toolchain-agent-workflow.mjs
node scripts/toolchain-hmr.mjs
node scripts/toolchain-playground-security.mjs
node scripts/toolchain-playground-browser-tests.mjs --engines chromium,firefox
node scripts/toolchain-external-install.mjs
(cd packages/cli && npm pack --dry-run --json)
(cd packages/playground && npm pack --dry-run --json)
```
