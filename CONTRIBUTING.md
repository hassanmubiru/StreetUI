# Contributing to StreetUI

StreetUI is an independent TypeScript UI framework: its own DSL, compiler,
reactive runtime, direct DOM renderer, SSR, and an agent-native development
toolchain. There is no React, Vue, Svelte, Preact, Solid, Vite, Rollup, Webpack,
or second reactive runtime in this repository.

## Repository setup

```bash
pnpm install
pnpm build        # build all packages
pnpm test         # run the test suites
pnpm typecheck    # strict TypeScript everywhere
pnpm lint         # ESLint
```

## Package architecture

The release set is defined once in `scripts/lib/public-packages.mjs`: 18
coordinated packages plus the `create-streetui` initializer (19 total).
`@streetui/playground` is `private` and is not published.

- `packages/core` — styling system, tokens, typography, animation, diagnostics
- `packages/dsl` — semantic TypeScript DSL (authoring surface)
- `packages/compiler` — DSL → validation → graph compilation
- `packages/graph` — Semantic Application Graph
- `packages/runtime` — application mounting, lifecycle, signal/event integration
- `packages/state` — reactive signals, derived state, resources, mutations, stores
- `packages/dom` — DOM adapter abstraction (browser + server)
- `packages/renderer` — mount, patch, reconcile, SSR, hydrate
- `packages/router`, `forms`, `context`, `i18n` — application features
- `packages/cli` — `create | dev | build | start | preview | doctor | playground`
  plus the independent toolchain (resolver, transform, dev server, HMR, builder)
- `packages/create-streetui` — `npm create streetui` initializer (bin-only; no
  library export, so verify it through its bin)
- `packages/playground` — local IDE + agent control API (private, never published)
- `packages/streetui` — the public barrel (one install, one import); subpaths
  `.`, `./server`, `./testing`, `./diagnostics`, `./package.json`
- `packages/testing`, `devtools` — test renderer and graph inspectors

## Commands (per package)

```bash
cd packages/cli
../../node_modules/.bin/tsc --noEmit -p tsconfig.json
../../node_modules/.bin/vitest run
../../node_modules/.bin/tsup
```

Never invoke the ambiguous `node_modules/.bin/streetui`: the unified `streetui`
package ships a same-named bin. Use `node node_modules/@streetui/cli/dist/bin.js`.

Repo-wide checks used for milestones:

```bash
node --test scripts/lib/*.test.mjs
node scripts/ci-workflow-audit.mjs
node scripts/dependency-audit.mjs
node scripts/api-inventory.mjs
node scripts/toolchain-browser-tests.mjs --engines chromium,firefox,webkit --mode both
node scripts/toolchain-hmr.mjs
node scripts/toolchain-ssr-hydration.mjs
node scripts/toolchain-agent-e2e.mjs
node scripts/toolchain-agent-visual-e2e.mjs --engines chromium,firefox
node scripts/toolchain-template-audit.mjs
node scripts/toolchain-external-developer-e2e.mjs --engines chromium,firefox
node scripts/toolchain-external-install.mjs
node scripts/consumer-smoke.mjs
node scripts/release-check.mjs
```

Harness exit codes come from `scripts/lib/harness-status.mjs`; do not hand-roll
`process.exit` in a harness. Reports must carry `requestedEngine`,
`actualEngine`, `browserVersion`, `requestedMode`, and `actualMode`.

## Coding conventions

- Strict TypeScript (`strict`, `exactOptionalPropertyTypes`), no `any`.
- Node builtins are preferred over third-party server/bundler dependencies;
  `typescript` is the only runtime toolchain dependency. Playwright is an
  optional dev-only browser provider.
- Production output is module-preserving ESM (no tree shaking/scope hoisting in
  v1). Do not claim unmeasured optimizations.
- Browser results are recorded per engine; missing engines are `BLOCKED`,
  never fabricated as passed.
- Every declared `exports` subpath must resolve for an external strict-TypeScript
  consumer (`scripts/consumer-smoke.mjs`). Adding a subpath means adding it to
  `REQUIRED_SUBPATHS` in `scripts/lib/public-packages.mjs` too.
- Domain-specific policies (dependency/supply chain, API inventory) live in
  `scripts/dependency-audit.mjs` and `scripts/api-inventory.mjs`; change the
  policy there rather than relaxing a check ad hoc.

## Evidence labels

Never conflate evidence targets: `local-workspace`, `local-packed`,
`npm-registry`, `github-actions`. A local run is not GitHub CI evidence, and an
offline tarball install is not a registry install. State the label in any report
or PR description.

## Adding framework features

Discuss first (issue or discussion), then implement in the relevant package
with tests. Public API changes must be additive and backwards compatible;
breaking changes require an ADR and a compatibility plan. Update the package
README, the root README when behavior changes, and `CHANGELOG.md` under
`Unreleased` — never claim unpublished features are on npm.

## Adding examples

Examples live in `examples/`. Keep them real: no mock backend presented as a
real service (label demo data clearly), no second renderer, and tests that run
without a browser where possible. `examples/streetui-dashboard` is the
production-oriented reference app; its `http-e2e.test.ts` drives a real
`node:http` server over a socket, so a data-path change there needs a real-socket
test rather than a hand-stubbed `fetch`.

Server-only credentials must never reach the browser graph: the toolchain
inlines only `STREETUI_PUBLIC_*` variables into client bundles and turns other
`process.env.X` reads into `undefined`, so secrets belong in server entry points
or files that the browser module graph never imports.

## Reporting bugs

Use the bug report template in `.github/ISSUE_TEMPLATE/bug_report.md` and
include the package version (`streetui --version`), Node version, a minimal
reproduction, and the expected vs actual behavior. Do not include secrets or
session tokens.

## Proposing API changes

Open an issue describing the problem, the proposed API, and the compatibility
impact. Public API is additive by default; anything breaking needs an ADR and a
migration plan before implementation.

## Review and releases

PRs require passing verification where CI can run (CI is currently limited by
an account billing issue, not code). Releases are coordinated across all public
packages with `scripts/release-check.mjs` and published only with explicit
maintainer approval. `@streetui/playground` remains unpublished.

The release sequence is `release-build.mjs` → `release-check.mjs` →
`apply-publish-metadata.mjs --check` → `pack-tarballs.mjs` →
`verify-tarballs.mjs` → `consumer-smoke.mjs` → `publish-packages.mjs --dry-run`
before anything is published. Packing fails on a stale `dist/`, so rebuild the
affected package (`tsup`) first — the guard trips on any `src/` file newer than
`dist/`, including tests.
