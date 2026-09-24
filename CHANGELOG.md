# Changelog

All notable changes to StreetUI are recorded here. The project follows
[Semantic Versioning](https://semver.org/): the version shared by every public
package is a single coordinated number, and from 1.0.0 onward the public API is
governed by the stability policy in [`docs/api-v1.0.md`](./docs/api-v1.0.md).

## 1.1.0 — Performance: keyed-list reconciler

A **minor, additive** release. No breaking changes over 1.0.0; existing code
compiles and runs unchanged. The v1.0 architecture (DSL → Compiler → Semantic
Graph → Runtime → direct DOM renderer; no virtual DOM; no second reactive
system; one public `streetui` package) is fully preserved.

### Performance (measured, happy-dom / Node, 10k-row keyed list)

- Reactive keyed lists now use a **lazy reconciliation plan** with an
  identity short-circuit (a reused row whose item reference is unchanged does
  zero work) plus a **longest-increasing-subsequence** minimal-move DOM
  reorder. Measured medians vs 1.0.0: append −45%, prepend −87%, remove −45–50%,
  reorder −89%, update-item −52%.
- **Disclosed regression:** full-list `reverse` is ~5.5% slower (its inherent
  worst case — LIS length 1 ⇒ N−1 moves). Not hidden.
- Scalar fine-grained reactivity is unchanged and remains optimal: a single
  signal update is still exactly one DOM mutation; deep-state updates touch one
  node; SSR output is byte-identical; hydration still creates zero nodes.
- Runtime bundle grew ~4% (gzip 27488 → 28680 B) — a deliberate size-for-speed
  trade on the hottest path.

### DevTools

- `inspectApplication(...).perf` gains a count-only `reactiveLists` field (the
  number of signal-driven `listOf` sites using the optimised path). No new UI.

### Not claimed

- No cross-framework performance claim is made. React/Vue/Svelte/Solid harnesses
  exist but could not run (offline, no browser); competitor results are BLOCKED,
  not faked. All performance claims are v1.1-vs-v1.0 only. See
  [`V1.1-PERFORMANCE-REPORT.md`](./V1.1-PERFORMANCE-REPORT.md).

### Version alignment

- Every public package and `CLI_VERSION`/`VERSION` move to `1.1.0`; coordinated
  stability tests updated to match.

## 1.0.0 — Stable public release

This is a **stabilization** release, not a feature release. It freezes the API
surface that grew across the 0.x series and aligns every published package on a
single version. There are **no breaking changes to the public API** relative to
0.9; existing 0.9 code compiles and runs unchanged. See
[`docs/migration-to-1.0.md`](./docs/migration-to-1.0.md).

### Version alignment

- Every public package now publishes at `1.0.0`. Internal dependency edges use
  `workspace:*` in-repo and are rewritten to the exact `1.0.0` at pack time.
- `@streetui/cli` `CLI_VERSION` is corrected from `0.6.0` to `1.0.0`, so
  `streetui --version` and the framework version stamped into scaffolded
  projects match the release.
- Project templates (`basic`, `ssr`) now pin their `@streetui/*` dependencies to
  the framework version token instead of a stale `0.1.0`, so `create` scaffolds a
  project whose dependencies resolve to the installed framework.

### API surface (frozen)

- 168 public values and 171 public types across 17 packages, all classified
  **stable** — zero `deprecated`, `experimental`, or `internal` exports leak from
  a public barrel. The machine-readable inventory is
  [`dist-tarballs/api-inventory.json`](./dist-tarballs/api-inventory.json),
  produced by `scripts/api-inventory.mjs` from the built `.d.ts` files.
- Each public package carries a `public-api.stability.test.ts` contract test that
  asserts its frozen export list is present (and, where behavior is verified,
  exercises it), so an accidental removal or rename fails CI.

### Release tooling

- `scripts/release-check.mjs` enforces, as errors: version divergence across the
  public set, missing per-package `README.md`/`LICENSE`, `file:`/`link:`/`portal:`
  internal-source protocols, and missing `dist/`. It writes an enriched release
  manifest (git commit + channel) and never mutates the tree.
- `scripts/api-inventory.mjs` generates the public API inventory used for the
  §44 report and the stability tests.

### Verified in this release

- Build 27/27 packages, typecheck 27/27, and the full test suite green
  (619 tests, up from the 0.9 baseline of 571; no test deleted, skipped, or
  weakened).
- All 17 public packages pack to tarballs at `1.0.0`; an offline consumer smoke
  test imports and server-renders through both the ESM and CJS entry points.

### Known gates NOT validated in this environment

Honesty about what could not be proven here (see
[`docs/browser-support.md`](./docs/browser-support.md)):

- **Real-browser validation is BLOCKED** — no Chromium/Chrome/Firefox/Playwright
  is available in the build sandbox. Hydration and DOM behavior are validated
  against a spec-compliant DOM (happy-dom/jsdom), not a shipped browser.
- **Registry publication is BLOCKED** — no reachable npm registry. Packaging is
  proven up to locally-built tarballs and an offline consumer install; nothing has
  been published, and no "available on npm" claim is made.

## 0.9.0 — Ecosystem: DevTools, testing, observability, docs portal

Headless DevTools (`createDevTools`, reactive inspectors, sensitive-by-default
redaction), a testing package (`render`, role/text queries, `waitFor`,
`renderServerThenHydrate`), observability sinks (`DiagnosticSink`,
`frameworkError`, hydration diagnostics — no telemetry, no network sends), a
non-mutating release check, and the documentation portal.

## 0.8.0 — Packaging & production hardening

Offline tarball consumer gate (no workspace linking), production-server security
hardening, and the full-app end-to-end example.

## 0.7.0 — Performance

Benchmark package, hot-path profiling and evidence-backed optimizations,
devtools performance surface, and bundle-size analysis.

## 0.6.0 — Platform & CLI

`@streetui/cli` (`create`/`dev`/`build`/`start`), project scaffolding and
templates, config and environment model, dev server, and production build/start.

## 0.5.0 — Forms, context, accessibility, i18n

Forms and validation, the context system, accessibility primitives, and
internationalization foundations.

## 0.4.0 — SSR & hydration

Server renderer (`renderToString`), `hydrate()` with node adoption and local
self-repair, resource dehydration, and router SSR integration.

## 0.3.0 — Resources & error boundaries

`resource()` reactive async lifecycle and `errorBoundary` in the DSL.

## 0.2.0 — Router

Route matching, navigation, and lifecycle.

## 0.1.0 — Foundations

The semantic pipeline: TypeScript DSL → compiler → semantic application graph →
runtime → DOM renderer, with the framework's own reactivity and keyed
reconciler. No virtual DOM, no React/Vue/Preact, no JSX runtime.
