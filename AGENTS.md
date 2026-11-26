# AGENTS.md

Guide for coding agents working in the StreetUI monorepo.

## What this repo is

StreetUI is a complete TypeScript UI framework with its own DSL, compiler,
Semantic Application Graph, runtime, DOM renderer, router, forms, SSR,
hydration, DevTools, and — since the Independent Toolchain work — its own dev
server, module resolver, HMR, production builder, preview server, and CLI. The
application toolchain does **not** depend on Vite, Rollup, Webpack, Parcel,
Rspack, or Turbopack.

## Packages

The release set is defined once in `scripts/lib/public-packages.mjs`:
**18 coordinated packages plus the `create-streetui` initializer (19 total)**.
`@streetui/playground` is `private` and is not published.

- `packages/cli` — `@streetui/cli`: `create`, `dev`, `build`, `start`,
  `preview`, `playground`, `doctor`. The toolchain lives in `src/toolchain/`.
- `packages/compiler`, `dsl`, `graph`, `core`, `runtime`, `renderer`, `dom`,
  `state`, `events`, `scheduler`, `router`, `forms`, `context`, `i18n`,
  `devtools`, `testing`, `streetui` — the framework.
- `packages/create-streetui` (`create-streetui`) — the `npm create streetui`
  initializer. Bin-only: it has no library export, so verify it through its bin.
- `packages/playground` (`@streetui/playground`) — the dev IDE + control API.
  Private, dev-only, never published.
- `examples/` (incl. `examples/streetui-dashboard`, the production reference),
  `apps/` (incl. `apps/playground`), `benchmarks/`, `browser/`, `scripts/`.

`streetui` subpaths: `.`, `./server`, `./testing`, `./diagnostics`,
`./package.json`. `@streetui/compiler` also exposes `./diagnostics`. The unified
`streetui/diagnostics` entry is unreleased source and is not in npm 3.2.2. Every
declared subpath must resolve for an external strict-TypeScript consumer; this is
enforced by `scripts/consumer-smoke.mjs`.

## Commands

Run from a package directory (the repo uses pnpm workspaces; pnpm itself may
not be on PATH, so prefer the local binaries or `corepack pnpm@9.15.4`):

```bash
./node_modules/.bin/tsc --noEmit -p tsconfig.json   # typecheck
./node_modules/.bin/vitest run                       # tests
./node_modules/.bin/tsup                             # build a package (dist/)
./node_modules/.bin/eslint packages apps examples    # lint
node --test scripts/lib/*.test.mjs                   # shared-lib unit tests
node scripts/ci-workflow-audit.mjs                   # CI workflow assertions
node scripts/dependency-audit.mjs                    # dependency/supply chain
node scripts/api-inventory.mjs                       # public API inventory
```

Named-bin collision: `node_modules/.bin/streetui` is ambiguous because the
unified `streetui` package ships a same-named bin. Always invoke
`node_modules/@streetui/cli/dist/bin.js` (or `node <cli>/dist/bin.js`) when the
test means the CLI.

The CLI package is the core of the toolchain. When changes span the toolchain,
run its typecheck + tests first:

```bash
cd packages/cli
../../node_modules/.bin/tsc --noEmit -p tsconfig.json
../../node_modules/.bin/vitest run
```

## Tools (M8)

- `scripts/toolchain-browser-tests.mjs` — Chromium/Firefox/WebKit dev+prod
  scenarios (rendering, interaction, routing, forms, CSS, refresh on nested
  routes, console cleanliness). Usage: `--engines chromium,firefox,webkit
  --mode both`. All three engines run locally; a missing engine is `BLOCKED`.
- `scripts/toolchain-hmr.mjs` — HMR reliability (edit keeps app interactive;
  syntax error shows an overlay; recovery is clean).
- `scripts/toolchain-agent-workflow.mjs` — drives the real CLI `--json`
  contract (project_detected → preview_ready → file_changed/module_updated →
  build_completed).
- `scripts/toolchain-agent-e2e.mjs` — full M10 agent session against the real
  Playground control API (session_attached → edit → diagnostics → browser
  inspection → HMR outcome → error capture → build → shutdown → token
  revocation). Browser steps use Playwright Chromium; without a browser they
  are `BLOCKED`, never fabricated as passed.
- `scripts/toolchain-agent-visual-e2e.mjs` — M11 visual acceptance run
  (automation connect → inspection → real PNG signature/IHDR checks →
  interactions → `hmr_applied`/`hmr_failed` → SSR reload semantics → runtime
  error capture/recovery → multi-client → build → shutdown → revocation →
  screenshot cleanup), per-engine VERIFIED/BLOCKED results written to
  `benchmarks/results/toolchain/agent-visual-e2e.json`.
- `scripts/toolchain-external-install.mjs` — packs all public packages and
  verifies them as an external npm install (offline tarballs; `doctor`,
  `create`, `build`, `start`, `preview`, `dev`) for both templates.
- `scripts/toolchain-perf.mjs` — startup/build timings (`--warmup`,
  `--samples`; cold and warm phases kept separate).
- `scripts/visual-a11y-axe.mjs` — visual-layer axe scan (colour contrast,
  focus-visible, focus indicator) over a real rendered app in dev and prod.
  Writes `benchmarks/results/v2.5/visual-a11y.json`.
- `scripts/toolchain-a11y-axe.mjs` — full-page axe audit; `BLOCKED` when
  `@axe-core/playwright` is not installed (never fabricated as a pass).
- `scripts/toolchain-ssr-hydration.mjs`, `scripts/toolchain-node-matrix.mjs`,
  `scripts/toolchain-registry-{e2e,smoke,compat}.mjs`,
  `scripts/toolchain-playground-browser-tests.mjs`,
  `scripts/toolchain-external-developer-e2e.mjs`.
- `scripts/browser-harness.mjs`, `scripts/browser-harness-firefox.mjs`,
  `scripts/website-perf-axe.mjs`, `scripts/at-orca-driver.mjs` — legacy
  performance/axe/assistive-technology harnesses (now on the real dev server).

### Harness exit semantics

Every harness above decides its exit code through `scripts/lib/harness-status.mjs`:

- `FAIL`/`ERROR`/unknown/mismatch → exit 1;
- a requested engine/mode with **no record at all** → exit 1;
- `BLOCKED`-only coverage → exit 0 locally, exit 1 under `CI` or `--require`.

Reports must carry `requestedEngine`, `actualEngine`, `browserVersion`,
`requestedMode`, and `actualMode` — including on blocked/failed runs, where the
actual values may be `null`. Actual mode/engine come from the launch/server, never
from copying the requested string.

### Evidence labels

Never conflate evidence targets: `local-workspace`, `local-packed`,
`npm-registry`, `github-actions`. Local results are not GitHub CI evidence, and an
offline tarball install is not a registry install.

## M8 compatibility notes

- The toolchain serves browser-native ESM. CommonJS client modules are reported
  with a clear diagnostic; they are never silently converted.
- Third-party compatibility is covered by
  `packages/cli/src/toolchain/third-party.compat.test.ts` and the matrix in
  `docs/toolchain/npm-compatibility.md`.
- Security checks live in `packages/cli/src/security.test.ts` (traversal, origin
  validation, malformed WebSocket frames, port conflicts).
- Runtime dependencies: `typescript` only. `engines` is `>=18`; verified on the
  Node versions available in the environment.

## Conventions

- No React, Vue, Svelte, Preact, Solid, or JSX inside StreetUI code.
- Do not replace the renderer, compiler, or runtime; do not create a second
  reactive runtime.
- The toolchain reuses the framework's compiler at runtime; its own job is
  module resolution + TS→JS + dev server/HMR/build.
- Node builtins are preferred over third-party server/bundler dependencies.
- `typescript` is the only runtime toolchain dependency. Playwright is an
  optional dev-only tool for the browser harness.
- Production output is module-preserving ESM (no tree shaking/scope hoisting in
  v1). Do not claim optimizations that are not measured.
- Browser results are recorded per engine; a missing engine is `BLOCKED`, never
  fabricated as passed.

## Toolchain internals

- Resolver: `packages/cli/src/toolchain/resolve/resolver.ts`
- Module graph: `packages/cli/src/toolchain/graph/`
- Transform: `packages/cli/src/toolchain/transform/typescript.ts`
- Dev server: `packages/cli/src/toolchain/server/dev-server.ts`
- HMR: `packages/cli/src/toolchain/hmr/`
- Builder: `packages/cli/src/toolchain/build/builder.ts`
- Preview: `packages/cli/src/preview.ts`
- Doctor: `packages/cli/src/toolchain/doctor/doctor.ts`
- JSON events: `packages/cli/src/toolchain/json/events.ts`

Docs: `docs/toolchain/adr-0001-independent-toolchain.md` and
`docs/toolchain/architecture.md`.

M10 (agent-native workflow): every JSONL event carries `eventId` + `sessionId`;
HMR outcomes are browser-confirmed (`hmr_applied`/`hmr_failed`); the Playground
control API adds authenticated browser inspection and `session/shutdown` (token
revocation, bounded event buffers). Docs: `docs/toolchain/m10-agent-protocol.md`,
`m10-control-api.md`, `m10-browser-inspection.md`, `m10-security.md`,
`m10-workflow.md`, plus `docs/toolchain/ai-agents.md`. Implementation and
verification report: `docs/toolchain/m10-report.md`.

M11 (visual verification + automation): an optional, dev-only Playwright
provider (`packages/playground/src/automation.ts`) adds real PNG screenshots
(IHDR-verified dimensions, id-only retrieval, per-session cleanup), browser
interactions (`/api/browser/interact`, incl. `evaluate`), structured visual
inspection (`/api/browser/inspect`), and multi-client targeting
(`E_CLIENT_REQUIRED`/`E_CLIENT_NOT_FOUND`). `sessionId` is always non-empty;
`session_ready`, `browser_connected`/`browser_disconnected`, and
`preview_inspected` are emitted for real events only. Docs:
`docs/toolchain/m11-browser-automation.md`, `m11-visual-qa-workflow.md`, and
`m11-report.md`.

M12 (developer adoption): `examples/streetui-dashboard` is the production
reference app (routes/components/resources/forms/theming/populated SSR + tests
+ Dockerfile). New harnesses: `scripts/toolchain-template-audit.mjs` (all 10
templates) and `scripts/toolchain-external-developer-e2e.mjs` (published-package
acceptance in Chromium, Firefox and WebKit). Docs: `docs/README.md` task index,
`docs/toolchain/m12-onboarding-audit.md`, `m12-deployment.md`,
`m12-compatibility.md`, and `m12-report.md`. Contribution files:
`CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, `docs/ROADMAP.md`.

M13 (production hardening): the SSR runner emits dependency `package.json`
files into the SSR cache (Node 18 has no ESM syntax detection) and reports a
CommonJS dependency as a build problem instead of writing an unloadable cache.
Harnesses: `scripts/toolchain-a11y-axe.mjs`, `scripts/toolchain-node-matrix.mjs`,
`scripts/toolchain-ssr-hydration.mjs`. Report: `docs/toolchain/m13-report.md`.

M14 (release integrity): the public package set is defined once in
`scripts/lib/public-packages.mjs` (18 coordinated + `create-streetui` = 19). The
release sequence is `release-build.mjs` → `release-check.mjs` →
`apply-publish-metadata.mjs --check` → `pack-tarballs.mjs` →
`verify-tarballs.mjs` → `consumer-smoke.mjs` → `publish-packages.mjs` (`--dry-run`
first). Packing fails on stale `dist/`; `release-check` fails when a declared
target is missing from disk or the root manifest disagrees with the coordinated
version. `pnpm install --frozen-lockfile` and `turbo` must both work before
touching release scripts — a duplicate workspace package name breaks the whole
graph. Report: `docs/toolchain/m14-report.md`.

M15 (CI/ecosystem reliability): `scripts/lib/harness-status.mjs` is the single
source of truth for harness exit codes; `scripts/lib/perf-stats.mjs` holds the
statistics used by the sampled performance harnesses; `scripts/dependency-audit.mjs`
is the dependency/supply-chain gate; `scripts/api-inventory.mjs` inventories all
19 packages and their subpaths, and `scripts/consumer-smoke.mjs` compiles a
strict NodeNext consumer against the packed tarballs. `packages/state` documents
the `mutation` cancellation contract (last-run-wins, per-run signal, transport
abort ≠ server rollback). The dashboard example gained real-socket HTTP tests,
server-only Bearer injection, read retry/`Retry-After`, and multipart upload.
Docs: `docs/toolchain/http-integration.md`, `m15-api-consistency.md`,
`m15-report.md`, and the controlled integration/release-preparation record in
`m15-12-report.md`.
