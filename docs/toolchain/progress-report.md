# StreetUI Toolchain — Implementation Progress Report

- Status: **Complete (M0–M7)**
- Date: 2026-11-15
- Worktree: `.kilo/worktrees/neon-newspaper`
- Plan: `.kilo/plans/1794722516286-streetui-toolchain.md`

## 1. Executive summary

StreetUI now owns its complete developer experience. The official toolchain
(`@streetui/cli` / `streetui`) implements an independent development server,
module resolver, dependency graph, TypeScript transform, HMR protocol + client,
production builder, preview server, and doctor — with **no Vite, Rollup,
Webpack, Parcel, Rspack, Turbopack, or esbuild in the application runtime**.
`typescript` is the only runtime dependency.

All **79** CLI unit/integration tests pass; typecheck and lint are clean; both
packages build with `tsup`; and **real-browser verification passes in Chromium
and Firefox, for both dev and production modes**. A generated app runs via
`streetui dev`, `streetui build`, `streetui start`, and `streetui preview`.
`streetui dev --json` emits a stable JSONL event stream for AI agents.

## 2. Milestones

| Milestone | Scope | Status |
| --- | --- | --- |
| M0 | Architecture decision record + audit | Done |
| M1 | CLI, JSON events, first dev server | Done |
| M2 | Complete module system, CSS/assets | Done |
| M3 | HMR (WebSocket, client, runtime, fallback) | Done |
| M4 | Production builder (hashed ESM, CSS, manifest) | Done |
| M5 | Preview server | Done |
| M6 | Agent integration (`--json`, doctor, docs) | Done |
| M7 | Browser verification + reliability/perf harnesses | Done |

## 3. Architecture decisions (see `docs/toolchain/adr-0001-independent-toolchain.md`)

1. **Module-preserving production build** — every reachable module emitted as
   ESM with rewritten relative specifiers, hashed filenames, extracted CSS,
   assets, source maps, `manifest.json`; no bundling/tree-shaking/minification
   in v1 (documented limitation).
2. **TypeScript compiler API only** — `ts.transpileModule` + custom AST
   transformer for dev/build/config; esbuild removed from the CLI runtime;
   type checking stays separate (`tsc --noEmit`).
3. **Own low-level utilities** — resolver, graph, dev server, RFC 6455
   WebSocket, watcher, builder, preview implemented in-repo on Node builtins.
4. **Unbundled ESM dev serving** — on-demand transform, content-hash caching,
   package `exports` condition resolution, `/@streetui/pkg/...` URLs.
5. **HMR guarantees** — CSS hot-swap; explicit `import.meta.hot.accept()`
   boundaries preserve state; everything else falls back to a verified reload;
   error overlay never leaves the app silently broken.
6. **CLI surface** — `create dev build start preview doctor` + `--json`.
7. **Output layout preserved** — `dist/client/` + `dist/server/`.

## 4. Changed / new files

New (framework source):

```
packages/cli/src/toolchain/
  json/events.ts
  resolve/paths.ts  resolve/resolver.ts
  graph/graph.ts  graph/crawl.ts
  transform/typescript.ts  transform/css.ts
  cache/transform-cache.ts
  server/static.ts  server/ws.ts  server/ssr-runner.ts  server/dev-server.ts
  watch/watcher.ts
  hmr/protocol.ts  hmr/client.ts  hmr/runtime.ts
  build/builder.ts  build/manifest.ts
  doctor/doctor.ts
packages/cli/src/preview.ts
packages/cli/src/dev-server.test.ts
packages/cli/src/preview.test.ts
packages/cli/src/toolchain/**/*.test.ts
scripts/toolchain-browser-tests.mjs
scripts/toolchain-perf.mjs
AGENTS.md
docs/toolchain/adr-0001-independent-toolchain.md
docs/toolchain/architecture.md
```

Modified:

```
packages/cli/src/{index,args,config,dev,build,start,serve}.ts
packages/cli/src/e2e.test.ts
packages/cli/package.json  packages/cli/tsup.config.ts
packages/streetui/package.json  packages/streetui/tsup.config.ts
packages/cli/templates/basic|ssr/{_package.json,README.md}
packages/cli/templates/ssr/src/{main.ts,server.ts}
packages/cli/templates/{basic,ssr}/AGENTS.md
packages/cli/templates/{basic,ssr}/src/streetui-env.d.ts
docs/cli.md  packages/cli/README.md  .gitignore
```

## 5. Commands executed

```
cd packages/cli
../../node_modules/.bin/tsc --noEmit -p tsconfig.json   # typecheck: clean
../../node_modules/.bin/vitest run                       # 79/79 pass
../../node_modules/.bin/eslint src                       # lint: clean
../../node_modules/.bin/tsup                             # CLI bundle: OK

cd packages/streetui
../../node_modules/.bin/tsup                             # framework bundle: OK

node scripts/toolchain-perf.mjs
node scripts/toolchain-browser-tests.mjs --engine chromium,firefox --mode dev,prod
```

## 6. Test results

### Unit / integration (Vitest) — `packages/cli`

| Suite | Tests | Result |
| --- | --- | --- |
| args | 10 | pass |
| diagnostics | 7 | pass |
| env | 5 | pass |
| config/templates | 8 + 8 | pass |
| create | 6 | pass |
| cli | 5 | pass |
| public-api stability | 3 | pass |
| serve | 8 | pass |
| preview | 1 | pass |
| dev-server (integration) | 1 | pass |
| e2e (create→build→start→request) | 1 | pass |
| toolchain resolver | 7 | pass |
| toolchain graph | 3 | pass |
| toolchain transform | 6 | pass |
| toolchain ws (frame codec) | 5 | pass |
| toolchain build/manifest + json events | 3 | pass |

**Total: 79 passed, 0 failed.**

Key integration coverage:

- Dev server serves real SSR HTML (`id="app"`, brand, state island) and the HMR
  client; `/src/main.ts` is transformed with rewritten package imports; public
  `/styles.css` served.
- e2e: scaffold → `streetui build` → `manifest.json` + hashed `assets/app-*.js`
  + `styles.css` → `streetui start` serves SSR HTML including the injected client
  entry; `/main.js`? no — the manifest entry `/assets/app-*.js` is injected;
  `/about` route renders different SSR HTML.

### Browser verification — Chromium & Firefox

Shared scenarios per engine/mode: initial render, interaction (counter), client
navigation, form (greeting), clean console.

| Engine | Mode | Status |
| --- | --- | --- |
| Chromium | dev | **OK** |
| Chromium | prod | **OK** |
| Firefox | dev | **OK** |
| Firefox | prod | **OK** |

All four runs reported zero console errors and all five scenarios passed
(e.g. form → `Hello, Ada!`). Chrome 0 errors, Firefox 0 errors.

## 7. Performance (measured, `benchmarks/results/toolchain/perf.json`)

| Metric | Value |
| --- | --- |
| `create` scaffold | 8 ms |
| Dev-server startup (to listening) | 91 ms |
| Production build | 545 ms |
| Emitted modules/files | 16 |
| Build (internal timer) | 545 ms |

These are wall-clock measurements on this machine; no optimization claims are made.

## 8. Known limitations (documented)

- Production output is module-preserving ESM: no minification, scope hoisting,
  tree shaking, or advanced chunk splitting in v1.
- HMR preserves state only for CSS and explicit `import.meta.hot.accept()`
  boundaries; all other JS changes trigger a full reload.
- The TypeScript API transform is slower than esbuild; acceptable and measured.
- Dev SSR rebuilds the server graph into a fresh `.streetui-cache/ssr/<id>/`
  directory per change; not tuned for very large server graphs.
- Node 18 is the minimum; no Node 20-only APIs are required.

## 9. Remaining work / next steps

- Optional: add a transform disk cache layer (currently in-memory) keyed by
  content hash under `.streetui-cache/`.
- Optional: browser WebKit (Safari) verification where an environment provides it.
- Optional: production minification via a low-level, documented step, and a
  `--stats` report for agent-consumable build telemetry.
- Keep `docs/toolchain/architecture.md` in sync as the HMR/builder surface grows.

## 10. How to reproduce

```bash
# toolchain tests
cd packages/cli
../../node_modules/.bin/tsc --noEmit -p tsconfig.json
../../node_modules/.bin/vitest run

# browser + perf harnesses (from repo root)
node scripts/toolchain-browser-tests.mjs --engine chromium,firefox --mode dev,prod
node scripts/toolchain-perf.mjs

# manual smoke
npm create streetui@latest my-app
cd my-app && npm install
npm run dev
npm run build
npm run preview
```
