# StreetUI for AI Coding Agents

StreetUI exposes a stable, machine-readable interface so AI coding agents can
scaffold, run, edit, and build real applications. This document defines the
contract and, importantly, what StreetUI does **not** claim.

## The CLI contract

Use `--json` for JSONL on stdout (human logs are suppressed):

```bash
streetui dev --json
streetui build --json
streetui preview --json
streetui doctor --json
```

Every event carries `schemaVersion: 1`, `framework: "streetui"`, `timestamp`,
`event`, `eventId`, and `sessionId`. `eventId` uniquely identifies one event;
`sessionId` correlates every event of a single agent session.

## M10 — agent-native development

`streetui playground --json` adds a full control surface on top of the JSONL
stream: `session_attached` returns a bearer `token` plus `sessionId`, and the
authenticated `/__playground/api/*` routes cover file editing, builds,
diagnostics, browser inspection, and shutdown. HMR now has **browser-confirmed
outcomes** (`hmr_applied` / `hmr_failed`) instead of broadcast-only
`module_updated`.

Reference documentation:

- `m10-agent-protocol.md` — event envelope and every event type
- `m10-control-api.md` — endpoint table, authentication, error codes
- `m10-browser-inspection.md` — DOM/element inspection over the HMR socket
- `m10-security.md` — token revocation, path rules, buffer limits
- `m10-workflow.md` — start → edit → HMR confirm → inspect → build → stop

The full session is exercised end to end by:

```
node scripts/toolchain-agent-e2e.mjs
```

Browser-dependent assertions require a locally installed Playwright browser;
when no browser is available they are reported as `BLOCKED`, never as passed.

## M11 — visual verification and automation

M11 adds an optional Playwright automation provider: real PNG screenshots with
IHDR-verified dimensions and id-based retrieval, browser interactions
(click/fill/select/press/scroll/resize/waits/`evaluate`), structured visual
inspection (viewport/document geometry, positioned elements, coded error and
warning diagnostics), and multi-client targeting with explicit `clientId`.
Lifecycle events (`session_ready`, `browser_connected`/`browser_disconnected`,
`preview_inspected`) are emitted for real events only, and `sessionId` is always
non-empty.

Docs: `m11-browser-automation.md`, `m11-visual-qa-workflow.md`, and
`m11-report.md`. Acceptance run (VERIFIED on Chromium and Firefox here):

```
node scripts/toolchain-agent-visual-e2e.mjs --engines chromium,firefox
```

## Agent workflow (verified)

1. **Detect** a project → `project_detected` (includes `version`).
2. **Start** dev → `compilation_started` → `server_started` → `preview_ready`
   (includes `url`, `port`, `status: "ready"`, `version`).
3. **Open/verify** — fetch the `url`.
4. **Edit** → `file_changed` / `module_updated`.
5. **Diagnose** → `compilation_completed`, `runtime_error` (browser errors
   reported back), and `environment_checked`.
6. **Build** → `build_completed` (includes `outDir`, `files`, `durationMs`).
7. **Stop** → `server_stopped`.

The real workflow is exercised by:

```
node scripts/toolchain-agent-workflow.mjs
```

## Capability detection & honest limits

- A `preview_ready` event proves the dev server is listening and reachable on
  the reported URL. It does **not** prove that any AI platform has rendered or
  displayed that URL in a preview panel.
- StreetUI's responsibility is to provide a reliable URL and diagnostics. The
  **host platform** is responsible for exposing its preview UI and opening the
  URL. We do not claim integration with any specific platform's preview panel
  unless that platform has actually been tested.
- If your sandbox cannot start or expose a local server, `streetui dev` will not
  work in place; use `streetui build` + `streetui preview` (static files) or the
  production `streetui start`, and open the result with whatever browser access
  the environment provides. Never attempt to bypass a platform sandbox.

## Preview integration contract

Expected JSON for the server-ready event:

```json
{
  "event": "preview_ready",
  "framework": "streetui",
  "version": "3.x",
  "url": "http://localhost:3000/",
  "port": 3000,
  "status": "ready"
}
```

Responsibilities:

- **StreetUI CLI** — exposes `url`, `port`, `status`, `version`, and event
  stream.
- **AI agent** — reads events, opens/fetches the URL, performs edits, and reads
  diagnostics.
- **AI platform** — renders the URL in its preview surface if it supports it.
- **Browser/preview environment** — executes the application.

## Troubleshooting

- Run `streetui doctor --json` first; it reports Node, project, entry, public
  dir, TypeScript resolution, port, and browser availability.
- Not every module format is executable in the browser; see
  `npm-compatibility.md` for supported shapes and CommonJS guidance.
- `preview_ready` may not appear if the port is occupied; choose a free port or
  run `streetui dev --port 0` (OS-assigned) and read the assigned port from the
  event.
