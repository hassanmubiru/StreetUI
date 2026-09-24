# StreetUI 1.0 — Public API statement, report & policy

This document is the authoritative statement of the StreetUI 1.0 public API: the
promise the project makes about it, the full inventory of what it contains, how
stability is classified, and what comes after 1.0. It is generated from and kept
consistent with the machine-readable inventory at
[`dist-tarballs/api-inventory.json`](../dist-tarballs/api-inventory.json),
produced by `scripts/api-inventory.mjs` directly from the built `.d.ts` files.

## The promise

As of 1.0.0 the public API is **frozen and governed by semantic versioning**.
The public API is exactly what each package re-exports from its public entry
point (`exports["."]`, i.e. `dist/index.js` and its `.d.ts`). Anything not
exported from that barrel is internal and may change at any time.

- **Major** (`2.0.0`) — any breaking change to a stable public export: removal,
  rename, signature change, or a behavioral change that could break a correct
  consumer. Also required to raise the minimum Node version or the browser
  baseline.
- **Minor** (`1.1.0`) — backward-compatible additions: new exports, new optional
  parameters, new capabilities.
- **Patch** (`1.0.1`) — backward-compatible bug fixes.

Every public package shares one version. Mixing versions across `@streetui/*`
packages is unsupported and is flagged by the release check.

## Stability classification

Each export in the inventory is classified:

- **stable** — part of the frozen 1.0 surface, covered by the promise above.
- **deprecated** — still exported and working, scheduled for removal in a future
  major; would be JSDoc-tagged `@deprecated` at source.
- **experimental** — exported but explicitly outside the semver promise; would be
  JSDoc-tagged `@experimental`.
- **internal** — leaked implementation detail; a leading `_` or an `Internal`
  marker. Not part of the API.

For 1.0.0 the surface is clean: **every one of the 339 public exports (168
values, 171 types) is stable.** There are zero deprecated, experimental, or
internal exports in any public barrel.

## Public API report — per package

All 17 public packages publish at `1.0.0`, each with its `dist/index.d.ts` types
entry present and verified on disk.

| Package | Values | Types | Types entry |
|---|---:|---:|---|
| @streetui/core | 23 | 15 | present |
| @streetui/state | 12 | 12 | present |
| @streetui/graph | 2 | 9 | present |
| @streetui/dsl | 10 | 34 | present |
| @streetui/compiler | 4 | 2 | present |
| @streetui/runtime | 3 | 5 | present |
| @streetui/events | 5 | 4 | present |
| @streetui/scheduler | 5 | 3 | present |
| @streetui/dom | 16 | 4 | present |
| @streetui/renderer | 28 | 8 | present |
| @streetui/router | 10 | 14 | present |
| @streetui/forms | 7 | 7 | present |
| @streetui/i18n | 2 | 4 | present |
| @streetui/context | 1 | 1 | present |
| @streetui/devtools | 14 | 32 | present |
| @streetui/testing | 8 | 5 | present |
| @streetui/cli | 18 | 12 | present |
| **Total** | **168** | **171** | **17/17** |

`benchmarks` is private and not published; it is excluded from the public API.

## How the surface is enforced

The inventory alone is a snapshot. To keep the surface from drifting, every
public package ships a `public-api.stability.test.ts` that asserts its frozen
list of value exports is present — and, where a signature has been verified,
exercises the behavior (for example: `state` signal get/set/derived/effect/batch;
`renderer` SSR + hydration node-adoption + tag-mismatch repair; `router`
`matchPattern`/`matchRoutes`; `i18n` `interpolate`; `forms` validators;
`context` provide/consume). A removed or renamed public export fails these tests
before it can ship. The `cli` contract test additionally pins `CLI_VERSION` to
`1.0.0` to guard the version-alignment fix from regressing.

## Post-1.0 roadmap

The following are explicitly **not** in 1.0 and are candidates for future minor
releases (additive, backward compatible) unless noted:

- **Real-browser CI validation.** Close the browser gate by running the
  DOM-dependent suites in actual Chromium/Firefox/WebKit via a browser-mode test
  runner, replacing the happy-dom-only validation described in
  [`browser-support.md`](./browser-support.md). This is tooling, not an API
  change.
- **Registry publication pipeline.** Wire the packed, verified tarballs to an
  actual `npm publish` from an environment with registry access. Also tooling.
- **Streaming SSR.** Deliberately out of scope for 1.0; the SSR renderer builds a
  complete document. A streaming renderer, if added, would be additive.
- **Broader DSL surface and additional built-in validators / i18n formatters** —
  additive minors as real needs are proven by the example applications.

Anything requiring a breaking change to a stable export is deferred to a future
major and will be listed here with a migration note when scheduled.

## See also

- [Migration to 1.0](./migration-to-1.0.md) — why there is nothing to migrate.
- [Release process](./release-process.md) — how a release is cut and gated.
- [Browser & runtime support](./browser-support.md) — targets and validated
  environments.
- [Changelog](../CHANGELOG.md).
