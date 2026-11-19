# StreetUI Toolchain Architecture

The toolchain lives in `packages/cli/src/toolchain/` and is bundled into the
`streetui` package. It is a single, coherent system shared by the dev server,
production builder, and preview server.

## Pipeline

```text
Semantic TypeScript DSL
        |
        v
  Resolver  ── package exports, aliases, extensions, CSS/assets
        |
        v
  Module Graph ── dependency edges, importers, cycle detection, invalidation
        |
        v
  TypeScript transform ── ts.transpileModule + specifier/env/hot rewriting
        |
        v
  Dev server (ESM)  /  Production builder (hashed ESM + CSS + assets + manifest)
        |
        v
      Browser
```

The framework's own compiler (`compile()` → SAG → runtime → renderer) is **not**
duplicated; it runs in the browser exactly as before.

## Module identity

- Module id = canonical absolute source path.
- Browser URL:
  - project file → `/src/...`
  - package file → `/@streetui/pkg/<pkg>/<subpath>`
  - CSS import → `/src/x.css?streetui=js`
  - asset import → `/src/x.svg?streetui=url`

## Development server (`createDevServer`)

- Node `http` server; requests are routed to SSR render, transformed modules, or
  static assets.
- `SsrRunner` transpiles the server graph to `.streetui-cache/ssr/<id>/`,
  imports the entry, and re-imports on server-file changes.
- A recursive `fs.watch` watcher invalidates the graph on change.
- `WebSocketHub` implements RFC 6455 for HMR; the browser side is
  `hmr/client.ts` with `hmr/runtime.ts`.
- `import.meta.hot` in application code is rewritten to a per-module hot context
  (`createHotContext`), so `accept()`/`dispose()` register callbacks.

## HMR protocol

Server → client: `connected`, `update`, `reload`, `error`, `runtime-error`, `ping`.
Client → server: `connected`, `pong`, `runtime-error`.

Guarantees:

- CSS updates apply in place.
- An accepted module is re-fetched (cache-busted) and its callback runs; state
  outside it survives.
- Anything else falls back to `location.reload()`.
- Errors appear in an overlay; the last good app stays; fixing recovers.

## Production builder (`buildProject`)

1. Crawl the client graph from `clientEntry`.
2. Assign hashed output names (`app-<hash>.js`, `styles-<hash>.css`,
   `<name>-<hash>.<ext>`).
3. Transform every JS/TS/JSON module; rewrite imports to output-relative paths;
   inline `process.env.NODE_ENV` and `STREETUI_PUBLIC_*`; remove dev HMR.
4. Concatenate CSS in import order; copy assets; write `.map` files.
5. Write `dist/client/manifest.json`.
6. If there is no `serverEntry`, emit `dist/client/index.html` (client-only).
7. Build the server graph to `dist/server/` (ESM, bare packages resolved by Node).
8. Copy `public/`.

## Preview server (`startPreview`)

Serves `dist/client` statically with SPA fallback to `index.html` when present.
No compiler, resolver, graph, or WebSocket.

## JSON events

`--json` writes JSONL to stdout. Every event has
`schemaVersion: 1`, `framework: "streetui"`, `timestamp`, and `event`. Key
events: `project_detected`, `environment_checked`, `compilation_started`,
`compilation_completed`, `server_started`, `preview_ready`, `file_changed`,
`module_updated`, `runtime_error`, `build_completed`, `server_stopped`.

## Security

- Bound to `localhost` by default; `--host 0.0.0.0` is explicit opt-in.
- Path traversal guarded by `path.relative` containment; malformed encoding and
  null bytes rejected.
- Only project files and resolved package files are served.
- WebSocket `Origin` must match the host/loopback.
- Only `STREETUI_PUBLIC_*` + `NODE_ENV` reach client code.
- Production error responses stay generic.

## Tooling

- `scripts/toolchain-browser-tests.mjs` runs real Chromium/Firefox scenarios and
  writes `benchmarks/results/toolchain/<engine>-<mode>.json`; missing binaries
  are recorded `BLOCKED`.
- `scripts/toolchain-perf.mjs` records startup, graph, and build timings to
  `benchmarks/results/toolchain/perf.json`.
