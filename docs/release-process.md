# Release process

This is the operational checklist for cutting a StreetUI release. It describes
the scripts under `scripts/`, the gates each one enforces, and the order to run
them. Every script here is **non-mutating with respect to your source tree**
unless explicitly noted; they read, verify, and emit artifacts under
`dist-tarballs/`.

## Principles

A release is a single coordinated version across all public packages. The
release set is defined **once** in `scripts/lib/public-packages.mjs`: 18
coordinated packages plus the `create-streetui` initializer (19 total).
`@streetui/playground` is `private` and is never part of a release.
`create-streetui` is bin-only — it declares no library export, so it is verified
through its bin, not an import.

Internal dependency edges are written as `workspace:*` in the repository and
rewritten to the exact version at pack time, so a published package never carries
a `workspace:` protocol. No gate is ever satisfied by a fabricated result: if the
environment cannot prove something (a real browser, a reachable registry), the
gate is reported BLOCKED, not passed.

## Steps

### 1. Align versions

Every public package must share one version. The release check treats divergence
as an error, so confirm the whole set matches the intended release version before
anything else. `@streetui/cli`'s `CLI_VERSION` and the project templates'
dependency pins must match too, or scaffolded projects will disagree with the
framework.

### 2. Generate per-package metadata

`scripts/generate-readmes.mjs` ensures each package has the `README.md` and
`LICENSE` a published package needs, and `scripts/apply-publish-metadata.mjs`
writes `publishConfig`/`exports`. Run it with `--check` in verification mode: it
fails rather than rewrites when the metadata is stale. The release check errors on
a missing `README.md` or `LICENSE`.

### 3. Build and produce the API inventory

Build all packages so each has a `dist/` with its declarations, then run
`scripts/api-inventory.mjs`. It derives its package list from the release-set
SSOT, walks **every declared `exports` subpath** (nested `import`/`require`
conditions included), splits value from type exports, classifies bin-only
packages, resolves each `types` target on disk, and fails on a missing target or a
package-name mismatch. It writes `dist-tarballs/api-inventory.json`. Current
result: 19 packages, 23 subpaths, 0 missing targets, 0 name mismatches. Method and
the defects it found: [`toolchain/m15-api-consistency.md`](./toolchain/m15-api-consistency.md).

### 4. Run the release check

```
node scripts/release-check.mjs --release-version <v> --channel stable --manifest
```

It fails the release (exit non-zero) on: version divergence across the public
set, a declared target missing from disk, a missing per-package `README.md` or
`LICENSE`, a `file:`/`link:`/`portal:` internal-source protocol in any manifest,
or a missing `dist/` (unless `--allow-missing-dist` is passed for a pre-build dry
run). With `--manifest` it writes an enriched release manifest including the git
commit and channel. Flags: `--release-version <v>`, `--channel <name>` (default
`stable`), `--manifest`, `--allow-missing-dist`, `--quiet`.

### 5. Verify the API contract tests

Each public package ships a `public-api.stability.test.ts` asserting its frozen
export list. Run the full suite; a removed or renamed public export fails here
before it can reach a registry.

### 6. Pack tarballs

`scripts/pack-tarballs.mjs` packs every public package to a tarball under
`dist-tarballs/`, rewriting `workspace:*` to the exact release version so the
tarballs are installable without the workspace. Packing **fails on a stale
`dist/`**: any file under a package's `src/` (tests included) newer than its
`dist/` aborts the pack, so rebuild the affected package first.

`scripts/verify-tarballs.mjs` then inspects each tarball: manifest version,
presence of declarations, no `workspace:` leak, and the declared entry files.

### 7. Verify a clean external consumer

`scripts/consumer-smoke.mjs` installs the packed tarballs into a throwaway
project **with no workspace linking**, then:

1. imports and server-renders through the ESM entry points;
2. the same through the CJS entry points;
3. drives the real CLI bin (`create` → `build` → `dev` with SSR);
4. compiles a strict NodeNext TypeScript consumer that imports every package and
   every declared subpath, with `skipLibCheck: false`,
   `noUncheckedIndexedAccess`, and `exactOptionalPropertyTypes`.

This proves the artifacts a real user would download actually resolve and
typecheck, independent of the monorepo. `@types/node` is copied from the
workspace rather than linked, so the check models a real install.

### 8. Publish

Publishing to a registry (`npm publish` of each tarball) is the final step and
requires explicit maintainer approval. `scripts/publish-packages.mjs --dry-run`
must be run first; it prints every target version without publishing.

## Gate status in this environment

Evidence is labelled by target, and the labels are not interchangeable:

| Target | Meaning |
|---|---|
| `local-workspace` | Run against the working tree / workspace links |
| `local-packed` | Run against tarballs packed by `pack-tarballs.mjs` |
| `npm-registry` | Read from the real registry |
| `github-actions` | Produced by GitHub Actions |

- **Build, typecheck, tests, and contract tests — PASS.** Recorded per package.
- **Real-browser validation — PASS for Chromium, Firefox, and WebKit** (`local-workspace`).
  `toolchain-browser-tests.mjs` covers dev and prod for all three engines;
  Chromium reports 153.x, Firefox 159.0, WebKit 26.6. WebKit requires
  Playwright's own `executablePath()`; the older cache-directory fallback can be
  missing host libraries, in which case the run is BLOCKED, never passed. See
  [`browser-support.md`](./browser-support.md).
- **Accessibility — PARTIAL.** `visual-a11y-axe.mjs` passes on Chromium dev and
  prod (`benchmarks/results/v2.5/visual-a11y.json`). The full-page
  `toolchain-a11y-axe.mjs` audit is **BLOCKED** where `@axe-core/playwright` is
  not installed; it reports BLOCKED (exit 0 locally, exit 1 under `CI` or
  `--require`), never a fabricated pass.
- **Packed consumer — PASS** (`local-packed`): ESM SSR, CJS SSR, CLI
  create/build/dev with SSR, and the strict NodeNext consumer.
- **GitHub Actions — BLOCKED.** The account is billing-locked, so jobs do not
  start (`The job was not started because your account is locked due to a billing
  issue`). Owner action is required; this is not a code defect, and no local run
  is reported as GitHub CI evidence.
- **Registry publication — BLOCKED.** Publication needs explicit maintainer
  approval and a reachable registry from the release machine. Packaging is proven
  up to local tarballs and the offline consumer smoke test. Nothing is published
  from this environment, and no "available on npm" claim is made beyond the
  already-published `3.2.2`.

## Related

- [Publishing](./publishing.md) — packaging metadata detail.
- [`api-v1.0.md`](./api-v1.0.md) — the frozen API surface and semver policy.
- [`toolchain/m15-report.md`](./toolchain/m15-report.md) — M15 verification results.
- [Changelog](../CHANGELOG.md).
