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

- `packages/cli` — `@streetui/cli`: `create`, `dev`, `build`, `start`,
  `preview`, `doctor`. The toolchain lives in `src/toolchain/`.
- `packages/compiler`, `dsl`, `graph`, `core`, `runtime`, `renderer`, `dom`,
  `state`, `events`, `scheduler`, `router`, `forms`, `context`, `i18n`,
  `devtools`, `testing`, `streetui` — the framework.
- `examples/`, `apps/`, `benchmarks/`, `browser/`, `scripts/`.

## Commands

Run from a package directory (the repo uses pnpm workspaces; pnpm itself may
not be on PATH, so prefer the local binaries):

```bash
./node_modules/.bin/tsc --noEmit -p tsconfig.json   # typecheck
./node_modules/.bin/vitest run                       # tests
./node_modules/.bin/tsup                             # build a package (dist/)
./node_modules/.bin/eslint packages apps examples     # lint
node scripts/toolchain-browser-tests.mjs              # Chrome/Firefox harness
node scripts/toolchain-perf.mjs                       # perf report
```

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
  routes, console cleanliness).
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
- `scripts/toolchain-perf.mjs` — startup/build timings.

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
