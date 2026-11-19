# @streetui/cli

The StreetUI command-line tool. It scaffolds new projects and drives the full
application lifecycle — development, production build, preview, and serving —
on top of the existing StreetUI pipeline (`DSL → Compiler → Graph → Runtime →
Renderer`). The CLI orchestrates that pipeline; it is not a framework layer of
its own.

```
streetui create <dir>   Scaffold a new StreetUI project
streetui dev            Start StreetUI's own development server
streetui build          Produce a production build (dist/client, dist/server)
streetui start          Serve the production build (SSR)
streetui preview        Serve dist/client statically
streetui doctor         Diagnose the project and toolchain
```

The toolchain is independent: no Vite, Rollup, Webpack, Parcel, Rspack, or
Turbopack. `typescript` is the only runtime dependency.

---

## Development — `streetui dev`

```bash
streetui dev --port 4000 --host 0.0.0.0
```

Starts StreetUI's own dev server. It serves real SSR HTML, transforms
TypeScript/JavaScript on demand through StreetUI's resolver, and speaks
StreetUI's own HMR protocol over a WebSocket. CSS edits hot-update in place;
modules that call `import.meta.hot.accept()` preserve state; everything else
falls back to a full reload. Build errors are printed with real source positions
(and shown as an overlay in the browser) and never crash the server.

```bash
streetui dev --json   # JSONL events for AI/coding agents
```

Every event carries `schemaVersion`, `eventId`, `sessionId`, `framework`, and
`timestamp`. Emits `project_detected`, `environment_checked`,
`compilation_started`, `server_started`, `preview_ready`, `file_changed`,
`module_updated`, `hmr_applied` / `hmr_failed` (browser-confirmed HMR),
`browser_console`, `browser_error`, `browser_connected` /
`browser_disconnected`, `runtime_error`, `server_stopped`. `sessionId` is always
non-empty and shared by one session.

## Production build — `streetui build`

```bash
streetui build
```

Builds the client graph from the entry and emits module-preserving ESM with
hashed filenames, extracted CSS, assets, source maps, and `manifest.json`:

```
dist/
  client/
    assets/
      app-<hash>.js
      styles-<hash>.css
      logo-<hash>.svg
    manifest.json
  server/
    server.js
    src/app.js
```

The server build keeps bare `@streetui/*` imports external (resolved by Node
from the installed dependencies). When the project has no server entry, a
client-only `dist/client/index.html` is emitted.

## Production server — `streetui start` / `streetui preview`

- `start` serves the production build with SSR via `dist/server/server.js`.
- `preview` serves `dist/client` statically (no compiler, no HMR) with SPA
  fallback when `index.html` is present.

## `streetui doctor`

Checks Node version, project/package detection, config, entries, TypeScript
resolution, port availability, and optional browser binaries. Use
`streetui doctor --json` for the structured report.

## Configuration — `streetui.config.ts`

```ts
import { defineConfig } from '@streetui/cli';

export default defineConfig({
  port: 3000,
  host: 'localhost',
  clientEntry: 'src/main.ts',
  serverEntry: 'src/server.ts',
  outDir: 'dist',
  publicDir: 'public',
  alias: { '@/*': 'src/*' },   // optional tsconfig-style aliases
  extensions: ['.ts', '.tsx', '.js'], // optional
});
```

All fields are optional; every field has a sensible default. Config files are
transpiled with the TypeScript compiler API (no host loader needed).

## Environment variables

Only `STREETUI_PUBLIC_*` variables (plus `NODE_ENV`) reach the browser. All
other env vars stay server-side. Server secrets never leak into client code.

---

## CLI reference

```
streetui <command> [options]

Commands:
  create <dir>   Scaffold a new StreetUI project
  dev            Start StreetUI's own development server
  build          Produce a production build (dist/client, dist/server)
  start          Serve the production build (SSR)
  preview        Serve dist/client statically
  doctor         Diagnose the project and toolchain environment
  playground     Local IDE + authenticated agent control API

Options:
  -h, --help          Show help
  -v, --version       Show the CLI version
  -p, --port <n>      Port for dev/start/preview (default 3000)
      --host <host>   Host for dev/start/preview (default localhost)
      --template <t>  Template for create (basic | ssr)
      --dir <path>    Project directory (default current directory)
      --json          Machine-readable JSONL events
```

Unknown options are rejected rather than silently ignored. The CLI fails with a
clear, stack-trace-free message when run outside a StreetUI project.

## Playground and AI agent automation

`streetui playground --json` starts the local IDE plus an authenticated control
API. After `session_attached` (bearer `token`, `sessionId`), agents can:

- list/read/write project files, run builds, and read the diagnostics buffer;
- inspect DOM/elements over the HMR socket and read per-client console errors;
- get browser-confirmed HMR outcomes (`hmr_applied` / `hmr_failed`) — SSR-graph
  edits intentionally reload instead;
- use the optional Playwright provider for real visual work:
  `POST /__playground/api/browser/automation/connect` (engine, viewport), real
  PNG screenshots with metadata and id-based retrieval
  (`POST /api/browser/screenshot`, `GET /api/browser/screenshot/<id>`),
  interactions (`POST /api/browser/interact`: click, type, fill, select, press,
  submit, scroll, navigate, reload, resize, waits, `evaluate`), and structured
  visual inspection (`GET /api/browser/inspect`) with viewport/document
  dimensions, positioned elements, and coded diagnostics;
- target a specific browser with `GET /api/browser/clients` + `clientId`
  (ambiguous calls fail with `E_CLIENT_REQUIRED`), and shut everything down with
  `POST /api/session/shutdown` (token revoked, browser closed, screenshots
  cleaned up).

Playwright is optional and development-only — never a runtime dependency of the
CLI or of applications. Without it, automation returns
`E_AUTOMATION_UNAVAILABLE`; everything else keeps working.

Full protocol/API references (GitHub):
[agent protocol](https://github.com/hassanmubiru/StreetUI/blob/main/docs/toolchain/m10-agent-protocol.md) ·
[control API](https://github.com/hassanmubiru/StreetUI/blob/main/docs/toolchain/m10-control-api.md) ·
[browser automation](https://github.com/hassanmubiru/StreetUI/blob/main/docs/toolchain/m11-browser-automation.md) ·
[visual QA workflow](https://github.com/hassanmubiru/StreetUI/blob/main/docs/toolchain/m11-visual-qa-workflow.md)

See `docs/toolchain/architecture.md` and `docs/toolchain/adr-0001-independent-toolchain.md`.
