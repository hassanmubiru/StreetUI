# CLI

```
npm install streetui
```

The `streetui` package ships a command-line interface for scaffolding,
developing, building, previewing, and diagnosing apps. It is dispatched by
`runCli` and exposes six commands.

```
streetui <command> [options]

Commands:
  create <dir>   Scaffold a new StreetUI project
  dev            Start StreetUI's own development server
  build          Produce a production build (dist/client, dist/server)
  start          Serve the production build (SSR)
  preview        Serve dist/client statically
  doctor         Diagnose the project and toolchain environment

Options:
  -h, --help          Show this help
  -v, --version       Show the CLI version
  -p, --port <n>      Port for dev/start/preview (default 3000)
      --host <host>   Host for dev/start/preview (default localhost)
      --template <t>  Template for create (basic | ssr)
      --dir <path>    Project directory (default current directory)
      --json          Machine-readable JSONL events (AI agents)
```

Unknown flags are rejected before anything runs, and expected errors map to an
exit code and a logged message rather than a thrown stack.

## Scaffold a project

```
npm create streetui@latest my-app
# or, with the CLI already installed:
streetui create my-app --template basic
```

Templates are `basic` and `ssr`. Generated projects pin their `@streetui/*`
dependencies to the exact framework version and contain no unresolved
placeholders.

## Develop

```
streetui dev --port 4000
```

Starts StreetUI's own development server (no Vite). It serves real SSR HTML,
transforms TypeScript on demand, and hot-updates CSS and accepted modules. On a
source change, either a module is updated in place or the browser reloads; build
errors appear in an overlay.

### Machine-readable events

```
streetui dev --json
```

Emits JSONL on stdout: `project_detected`, `environment_checked`,
`compilation_started`, `server_started`, `preview_ready`, `file_changed`,
`module_updated`, `runtime_error`, `server_stopped`. Every event carries
`schemaVersion: 1`, `framework: "streetui"`, and `timestamp`.

## Build & serve

```
streetui build          # → dist/client (hashed assets + manifest.json), dist/server
streetui start          # serve the production build (SSR)
streetui preview        # serve dist/client statically (no SSR/HMR)
streetui doctor         # environment/project diagnostics
```

The production builder uses the same resolver and transform as the dev server.
Output is module-preserving ESM with hashed filenames, extracted CSS, assets,
source maps, and `manifest.json`. `start` renders via `dist/server/server.js`;
`preview` is independent of the compiler/HMR.

## Programmatic API

`runCli`, `createProject`, `buildProject`, `runDev`, `runStart`, `startPreview`,
`startServer` / `ReloadHub`, and `createDevServer` are exported for scripting and
tests. These live in the CLI/tooling entry and are not part of the client
runtime.

See also: [Getting started](getting-started.md), [Toolchain architecture](toolchain/architecture.md), and [ADR 0001](toolchain/adr-0001-independent-toolchain.md).
