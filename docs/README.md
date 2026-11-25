# StreetUI documentation

Task-oriented documentation for StreetUI: an independent TypeScript UI
framework with its own DSL, compiler, reactive runtime, direct DOM renderer,
SSR, and agent-native development toolchain. Every example in these docs is
checked against the actual implementation (no hypothetical APIs).

## Getting started

- **Installation** — `npm install streetui`
- **Project creation** — `npx streetui create my-app` (templates: basic, ssr,
  counter, todo, form, routing, signals, components, data-fetching, interactive)
- **First application** — root `README.md` quick start and
  `packages/cli/README.md`
- **Development workflow** — `streetui dev`, `--json` events, HMR
- **Production build** — `streetui build` → `dist/client` + `dist/server`, then
  `streetui start`

## Core concepts

- **Semantic DSL** — `streetui.app`, `page.section/heading/button/input`,
  `component()`, `listOf`, `when`
- **Compiler** — DSL → immutable Application Graph (single source of truth for
  SSR, hydration, and client rendering)
- **Semantic Application Graph** — `packages/graph/`
- **Application lifecycle** — create state → compile → SSR render → hydrate
- **Components** — typed props, reactive updates without re-running setup,
  native slots, lifecycle cleanup
- **Reactivity** — `signal`, `derived`, `effect`, `batch`, `resource`
- **Renderer** — direct DOM (no virtual DOM), fine-grained updates

## Application development

- **Routing** — `createRouter`, `mountRouter`, `routerOutlet` (see
  `packages/router/` and the routing template)
- **Forms** — `createForm`, `required`, `email`, `minLength`, submitting state
- **Context** — build-time provider/consumer scoping
- **Styling** — `style`, `cx`, `styleVariants`, `createThemeTokens`, presets
  (`layout.*`, `text.*`, `form.*`, `a11y.*`, `animation.*`)
- **Resources** — `resource()` async lifecycle with `loading`/`error`/`data`
- **Mutations** — `mutation()`, `createClient`; cancellation contract
  (last-run-wins, fresh per-run `AbortController`, abort is not server rollback)
  in `packages/state/README.md` and `docs/toolchain/http-integration.md`
- **Accessibility** — `a11yIds`, `createAnnouncer`, focus utilities
- **Internationalization** — `@streetui/i18n`
- **Complete example** — `examples/streetui-dashboard` (routes, components,
  resources, real HTTP data source, forms, theming, SSR, tests)

## Server rendering

- **SSR** — `renderToString` from `streetui/server`, static-plan acceleration
- **Hydration** — zero-node adoption with `renderer.hydrate`
- **Server entry points** — `src/server.ts` exports `render(request)` (async
  supported for data resolution before serialization)
- **Client entry points** — `src/main.ts` hydrates and restores state
- **Production deployment** — `docs/toolchain/m12-deployment.md`

## Developer tools

- **CLI** — `create | dev | build | start | preview | doctor | playground`
- **Development server** — `packages/cli/src/toolchain/server/dev-server.ts`
- **HMR** — browser-confirmed `hmr_applied` / `hmr_failed`; SSR edits reload
- **Playground** — `streetui playground --json` (local IDE + agent control API)
- **Agent API** — `docs/toolchain/m10-agent-protocol.md`,
  `docs/toolchain/m10-control-api.md`
- **Browser automation** — `docs/toolchain/m11-browser-automation.md`
  (screenshots, interactions, inspection, multi-client)

## Production

- **Build output** — `dist/client/manifest.json`, hashed assets, extracted CSS,
  `dist/server` SSR bundle
- **Environment configuration** — `PORT`, `HOST`, and app `process.env` values;
  `STREETUI_PUBLIC_*` variables are inlined into the client bundle
- **Real HTTP data** — `createClient({ baseUrl })`; the dashboard example's
  `STREETUI_PUBLIC_DASHBOARD_API_URL` switches it from mock to live API.
  Server-only Bearer injection, read retry/`Retry-After`, CRUD refetch and
  multipart upload: `docs/toolchain/http-integration.md`
- **Deployment** — `docs/toolchain/m12-deployment.md` (Node, Docker, static
  limits, SSR hosting, health checks, graceful shutdown)
- **Performance** — `scripts/toolchain-perf.mjs` (`--warmup` / `--samples`,
  cold and warm phases kept separate) and `benchmarks/`
- **Verification harnesses** — `scripts/toolchain-a11y-axe.mjs` (axe-core),
  `scripts/visual-a11y-axe.mjs` (visual layer), `scripts/toolchain-node-matrix.mjs`
  (Node 18/20/22/24), `scripts/toolchain-ssr-hydration.mjs` (SSR + hydration +
  dev regeneration). All decide their exit code through
  `scripts/lib/harness-status.mjs`; `BLOCKED` fails under CI/`--require`
- **Security** — `SECURITY.md`, `docs/toolchain/m10-security.md`
- **Troubleshooting** — `streetui doctor`, `docs/toolchain/m12-onboarding-audit.md`,
  `docs/toolchain/m12-compatibility.md`
- **Production hardening results** — `docs/toolchain/m13-report.md`
  (accessibility, Node matrix, Docker, SSR/hydration, performance). WebKit runs
  locally when Playwright's own `executablePath()` is used; the older
  cache-directory fallback can be missing host libraries, in which case the run
  is `BLOCKED`, never passed
- **CI / ecosystem reliability** — `docs/toolchain/m15-report.md`; public API
  inventory and the strict consumer: `docs/toolchain/m15-api-consistency.md`
- **Releasing** — `node scripts/release-build.mjs` → `release-check.mjs` →
  `pack-tarballs.mjs` → `verify-tarballs.mjs` → `consumer-smoke.mjs` →
  `publish-packages.mjs --dry-run`. The public package set lives in one place,
  `scripts/lib/public-packages.mjs`; results and the 9 pipeline defects found are
  in `docs/toolchain/m14-report.md`
