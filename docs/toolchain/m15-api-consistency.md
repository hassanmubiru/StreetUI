# M15 — API consistency report

Public API inventory and consumer-verification results for the StreetUI release
set. Companion to [`m15-report.md`](./m15-report.md).

Published registry baseline: **3.2.2** (18 coordinated packages plus the
`create-streetui` initializer, 19 total). The local candidate deliberately keeps
that same workspace version for dry-run verification; it is **not** the published
3.2.2 artifact and includes unreleased M15 changes. `@streetui/playground` is
private and outside the release set. Nothing was published, and no version was
bumped, while producing this report.

## Method

Two independent checks, both non-mutating against sources:

1. **Declaration inventory** — `node scripts/api-inventory.mjs`
   reads the built declaration entry for every declared `exports` subpath of
   every package in `scripts/lib/public-packages.mjs` (the release-set SSOT) and
   enumerates exported values and types. It resolves the `types` target each
   subpath advertises and records whether that file exists on disk. Bin-only
   packages are classified explicitly.
   Artifact: `dist-tarballs/api-inventory.json`.

2. **Strict external consumer** — `node scripts/consumer-smoke.mjs`
   installs the 19 packed tarballs offline into a throwaway project (no workspace
   links, no symlinks, no registry) and then compiles a generated `consumer.ts`
   under `module: NodeNext`, `moduleResolution: NodeNext`, `strict: true`,
   `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `skipLibCheck:
   false`. The file imports **every** package and every declared subpath, plus
    named imports of the documented subpath surfaces (`streetui/server`,
    `streetui/diagnostics`, `@streetui/compiler`,
    `@streetui/compiler/diagnostics`). `create-streetui` is verified through its
    declared `bin` target instead of an invented root export. The ESM and CJS
    phases also execute the documented diagnostics example against a real graph.

Both are run by the M15 acceptance sequence; the consumer smoke is the gate that
fails if a declaration entry is missing, mis-declared, or unloadable.

## Inventory result — VERIFIED

| Package | Version | Subpaths | Values | Types |
|---|---|---|---|---|
| `@streetui/core` | 3.2.2 | `.` | 83 | 54 |
| `@streetui/events` | 3.2.2 | `.` | 5 | 4 |
| `@streetui/scheduler` | 3.2.2 | `.` | 5 | 3 |
| `@streetui/state` | 3.2.2 | `.` | 17 | 25 |
| `@streetui/graph` | 3.2.2 | `.` | 2 | 9 |
| `@streetui/dsl` | 3.2.2 | `.` | 17 | 52 |
| `@streetui/compiler` | 3.2.2 | `.`, `./diagnostics` | 7 | 7 |
| `@streetui/runtime` | 3.2.2 | `.` | 3 | 5 |
| `@streetui/dom` | 3.2.2 | `.` | 26 | 5 |
| `@streetui/renderer` | 3.2.2 | `.` | 46 | 19 |
| `@streetui/router` | 3.2.2 | `.` | 11 | 14 |
| `@streetui/forms` | 3.2.2 | `.` | 7 | 7 |
| `@streetui/i18n` | 3.2.2 | `.` | 2 | 4 |
| `@streetui/context` | 3.2.2 | `.` | 1 | 1 |
| `@streetui/devtools` | 3.2.2 | `.` | 25 | 47 |
| `@streetui/testing` | 3.2.2 | `.` | 21 | 7 |
| `@streetui/cli` | 3.2.2 | `.` | 28 | 22 |
| `streetui` | 3.2.2 | `.`, `./server`, `./testing`, `./diagnostics`, `./package.json` | 376 | 175 |
| `create-streetui` | 3.2.2 | bin-only (`create-streetui`) | — | — |

Totals: **682 values, 461 types, 23 declared subpaths across 19 packages**
(1 bin-only). `missingDeclarationFiles: 0`, `nameMismatches: 0`.

## Defects reproduced and fixed

### D-1 — `streetui/testing` referenced an undeclared `streetui/diagnostics`

**Reproduced.** The strict consumer failed with:

```
../node_modules/streetui/dist/testing.d.ts(4,15): error TS2307:
Cannot find module 'streetui/diagnostics' or its corresponding type declarations.
```

`packages/streetui/src/testing.ts` re-exports `@streetui/compiler/diagnostics`,
which the declaration bundler emitted as `export * from 'streetui/diagnostics'`.
The `streetui` manifest declared only `.`, `./server`, `./testing` and
`./package.json` — so any consumer importing `streetui/testing` hit an
unresolvable module. The defect was invisible inside the monorepo because the
workspace resolution falls back to `@streetui/compiler`.

**Fix.** Declared the subpath end-to-end rather than suppressing the reference:

- `packages/streetui/src/diagnostics.ts` — new entry that re-exports
  `@streetui/compiler/diagnostics`;
- `packages/streetui/tsup.config.ts` — builds it as its own entry;
- `packages/streetui/tsconfig.build.json` — maps
  `@streetui/compiler/diagnostics` to its source so rollup-dts **inlines** the
  declarations instead of emitting a bare re-export (the previous behaviour that
  produced the dangling specifier);
- `packages/streetui/package.json` — adds `./diagnostics` with both `import` and
  `require` conditions;
- `scripts/lib/public-packages.mjs` — `REQUIRED_SUBPATHS.streetui` now pins
  `./diagnostics` so it cannot be dropped again;
- `scripts/consumer-smoke.mjs` — the strict TS phase is the regression gate.

Verified: the rebuilt declarations are self-contained
(`dist/diagnostics.d.ts` imports only `./graph-*.js`), and the strict consumer
passes.

### D-2 — `api-inventory.mjs` covered only 17 packages and no subpaths

**Reproduced.** The script had a hardcoded 17-name list, read only
`dist/index.d.ts`, and therefore could not see `./server`, `./testing`,
`./diagnostics`, or the bin-only initializer.

**Fix.** Rewritten to derive its package list from `PUBLISH_ORDER`, walk every
declared `exports` subpath, resolve each `types` target (including nested
`import`/`require` conditions), classify bin-only packages explicitly, and exit
non-zero on a missing declaration target or a package-name mismatch against the
release inventory.

## ADR-only proposals (not implemented in M15)

These are recorded for a future major, not changed here — M15 forbids breaking
renames or removals.

1. **`streetui/testing` duplicates `@streetui/compiler/diagnostics`.** With the
   new `streetui/diagnostics` subpath, the diagnostics re-export from
   `streetui/testing` is redundant. Removing it would be a (minor) surface
   reduction and is deferred.
2. **`RenderResult` name collision.** `streetui/testing` and the CLI both export
   a `RenderResult`; the testing one is reachable only from the subpath by
   design. Consolidating the names would be a breaking rename.
3. **`@streetui/cli` declares a Node-targeted surface.** Its declarations
   reference `node:http` and `NodeJS`, so an external strict consumer needs
   `@types/node`. That is normal for a Node package, but the requirement is
   undocumented in the CLI README; a note would help. The smoke test models the
   real install by copying `@types/node` (never linking).

## Consumer verification result — VERIFIED (local-packed)

`node scripts/consumer-smoke.mjs` against freshly packed tarballs:

```
ESM-SSR-OK
ESM-DIAGNOSTICS-OK
CJS-SSR-OK
CJS-DIAGNOSTICS-OK
CLI version: 3.2.2
dev SSR OK — 1053 bytes, <div id="app"> present
strict TS consumer OK — every declared package/subpath resolves under NodeNext + strict
CONSUMER SMOKE TEST PASSED — tarballs installed and executed (ESM, CJS, CLI flow, strict TS).
```

Evidence target: `local-packed` (offline tarball install). This is **not**
`npm-registry` evidence (no publication occurred) and **not** `github-actions`
evidence (CI remains billing-blocked).

## Reproduction

```bash
node scripts/api-inventory.mjs
node scripts/release-build.mjs
node scripts/pack-tarballs.mjs
node scripts/consumer-smoke.mjs
```
