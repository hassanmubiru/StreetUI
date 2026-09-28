# @streetui/cli

The StreetUI command-line tool. It scaffolds new projects and drives the full
application lifecycle — development, production build, and serving — on top of
the existing StreetUI pipeline (`DSL → Compiler → Graph → Runtime → Renderer`).
The CLI only *orchestrates* that pipeline; it is not a framework layer of its
own.

```
streetui create <dir>   Scaffold a new StreetUI project
streetui dev            Start the dev server with live reload
streetui build          Produce a production build (dist/client, dist/server)
streetui start          Serve the production build
```

---

## Installation

The CLI ships two binaries:

- `streetui` — the project command (`dev` / `build` / `start` / `create`)
- `create-streetui` — the `npm create` entry point

```bash
# scaffold a new app
npm create streetui@latest my-app

# …or, if the CLI is installed in a project, run commands directly
npx streetui dev
```

> **Note on this monorepo.** The `@streetui/*` packages are not yet published to
> npm. Inside this repository the generated app resolves them through the
> workspace (see *Project structure* below). `npm create streetui@latest` is the
> intended public entry point once the packages are published.

---

## Creating an app

```bash
npm create streetui@latest my-app
cd my-app
npm install
npm run dev
```

`create` scaffolds a real, working StreetUI application — no placeholder code,
no fake APIs, no React, no JSX. Two templates are available:

| Template | `--template` | What you get |
| -------- | ------------ | ------------ |
| SSR (default) | `ssr` | Server-rendered app with two views (Home / About), a counter signal, conditional rendering, a form, and client hydration. |
| Basic | `basic` | A single server-rendered page with a counter and a toggle — the smallest complete app. |

```bash
npm create streetui@latest my-app -- --template basic
```

Both templates are server-rendered and hydrate on the client, so `dev`,
`build`, and `start` all follow one uniform pipeline.

<!-- APPEND-HERE -->

---

## Development — `streetui dev`

```bash
npm run dev            # → streetui dev
streetui dev --port 4000 --host 0.0.0.0
```

`dev` builds the project once, then watches your source with esbuild's
incremental rebuild — only what changed is recompiled, not the whole project on
every keystroke. On each successful rebuild, connected browsers reload
automatically (a small live-reload script is injected into the served HTML).
Build errors are printed with real source positions and never crash the server:

```
streetui Client rebuild failed:
StreetUI build error (1 error)

src/app.ts:42:17
Expected ";" but found "const"
  | const total = count()
```

The dev server prints the URL it is listening on once it is actually ready.

## Production build — `streetui build`

```bash
npm run build          # → streetui build
```

`build` runs two esbuild passes over your real entries and writes to the output
directory (default `dist/`):

```
dist/
  client/     Browser bundle (main.js) + your public assets
  server/     Node SSR bundle (server.js)
```

The client bundle is what the browser downloads to hydrate; the server bundle
exports the `render(request)` function used for SSR. A build fails (non-zero
exit) only on real errors — third-party warnings never break the build. When
the project has no server entry, the server pass is skipped and you get a
client-only build.

## Production server — `streetui start`

```bash
npm run start          # → streetui start
streetui start --port 8080
```

`start` serves the production build using Node's standard `node:http` server —
no Express, no third-party server. Static assets under `dist/client/` are served
directly; every other request is server-rendered through your `server.js`
bundle and returned as full HTML, ready to hydrate. If no build exists yet,
`start` builds first.

---

## Configuration — `streetui.config.ts`

Configuration is optional: every field has a sensible default, so an app with no
config file still builds and runs. When you need to override something, author a
`streetui.config.ts`:

```ts
import { defineConfig } from '@streetui/cli';

export default defineConfig({
  port: 3000,               // dev/start port
  host: 'localhost',        // host to bind
  clientEntry: 'src/main.ts',   // browser entry (hydration)
  serverEntry: 'src/server.ts', // SSR entry (exports render())
  outDir: 'dist',           // build output directory
  publicDir: 'public',      // static assets copied verbatim
});
```

The config is TypeScript and is compiled on the fly with esbuild, so you do not
need a TypeScript loader registered in Node. All defaults:

| Field | Default | Purpose |
| ----- | ------- | ------- |
| `port` | `3000` | Port for `dev` / `start` |
| `host` | `localhost` | Host to bind |
| `clientEntry` | `src/main.ts` | Browser/hydration entry |
| `serverEntry` | `src/server.ts` | SSR entry exporting `render(request)` |
| `outDir` | `dist` | Build output directory |
| `publicDir` | `public` | Static assets directory |

Command-line `--port` and `--host` override the config for a single run.

---

## Environment variables

StreetUI is safe by default: **only variables whose names begin with
`STREETUI_PUBLIC_` are exposed to the browser bundle.** Everything else stays on
the server, so secrets in the process environment cannot leak into client-side
JavaScript.

```bash
# Reaches the browser (inlined at build time):
STREETUI_PUBLIC_API_URL=https://api.example.com

# Server-only — never inlined into the client bundle:
DATABASE_URL=postgres://…
SESSION_SECRET=…
```

In code, read them as compile-time constants:

```ts
const apiUrl = process.env.STREETUI_PUBLIC_API_URL;
```

`NODE_ENV` is always defined as the build mode (`development` or `production`),
so you can branch on it.

---

## SSR & hydration

Both templates render on the server and hydrate on the client:

1. **Server** — `server.ts` exports `render(request)`. It compiles the app,
   calls `renderToString(compiled)` (pure — no DOM globals), serializes the
   initial signal state into a `<script data-streetui-state>` island, and
   returns a full HTML document that links `/main.js`.
2. **Browser** — `main.ts` reads the state island, seeds the signals with the
   exact server values, recompiles the same app, and calls
   `renderer.hydrate(compiled, appContainer)`. Because the client starts from
   the same state, the server markup is adopted rather than thrown away, and
   events + signals become live.

The starter templates switch views with a signal (`when(...)`) rather than the
router, which keeps SSR + hydration identity robust for the common case. The
router remains available for apps that need URL-driven routing.

---

## Project structure

A generated project looks like this:

```
my-app/
  package.json          scripts: dev / build / start / typecheck
  tsconfig.json         strict TypeScript, bundler resolution
  streetui.config.ts    optional configuration
  public/               static assets (styles.css, favicon.svg)
  src/
    app.ts              the StreetUI app: signals + DSL + views
    server.ts           SSR entry — exports render(request)
    main.ts             browser entry — hydrates the app
  README.md
```

Inside this monorepo the generated `node_modules/@streetui/*` are linked to the
workspace packages; once the framework is published, `npm install` resolves them
from the registry.

---

## CLI reference

```
streetui <command> [options]

Commands:
  create <dir>   Scaffold a new StreetUI project
  dev            Start the development server with live reload
  build          Produce a production build (dist/client, dist/server)
  start          Serve the production build

Options:
  -h, --help          Show help
  -v, --version       Show the CLI version
  -p, --port <n>      Port for dev/start (default 3000)
      --host <host>   Host for dev/start (default localhost)
      --template <t>  Template for create (basic | ssr)
      --dir <path>    Project directory (default current directory)
```

Unknown options are rejected with a message rather than silently ignored, so a
typo never changes behaviour quietly.

### Project validation

The CLI fails with a clear, stack-trace-free message when it is run outside a
StreetUI project — for example, a missing `package.json`, a `package.json` with
no `@streetui/*` dependency, an invalid config file, or a missing build entry.


