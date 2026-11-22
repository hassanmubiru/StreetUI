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
- `packages/playground` — local IDE + agent control API (intentionally
  unpublished on npm)
- `packages/streetui` — the public barrel (one install, one import)
- `packages/testing`, `devtools` — test renderer and graph inspectors

## Commands (per package)

```bash
cd packages/cli
../../node_modules/.bin/tsc --noEmit -p tsconfig.json
../../node_modules/.bin/vitest run
../../node_modules/.bin/tsup
```

Repo-wide checks used for milestones: `node scripts/toolchain-hmr.mjs`,
`node scripts/toolchain-agent-e2e.mjs`,
`node scripts/toolchain-agent-visual-e2e.mjs --engines chromium,firefox`,
`node scripts/toolchain-template-audit.mjs`,
`node scripts/toolchain-external-developer-e2e.mjs --engines chromium,firefox`,
`node scripts/toolchain-external-install.mjs`, and `node scripts/release-check.mjs`.

## Coding conventions

- Strict TypeScript (`strict`, `exactOptionalPropertyTypes`), no `any`.
- Node builtins are preferred over third-party server/bundler dependencies;
  `typescript` is the only runtime toolchain dependency. Playwright is an
  optional dev-only browser provider.
- Production output is module-preserving ESM (no tree shaking/scope hoisting in
  v1). Do not claim unmeasured optimizations.
- Browser results are recorded per engine; missing engines are `BLOCKED`,
  never fabricated as passed.

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
production-oriented reference app.

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
