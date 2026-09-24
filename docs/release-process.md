# Release process

This is the operational checklist for cutting a StreetUI release. It describes
the scripts under `scripts/`, the gates each one enforces, and the order to run
them. Every script here is **non-mutating with respect to your source tree**
unless explicitly noted; they read, verify, and emit artifacts under
`dist-tarballs/`.

## Principles

A release is a single coordinated version across all public packages. Internal
dependency edges are written as `workspace:*` in the repository and rewritten to
the exact version at pack time, so a published package never carries a
`workspace:` protocol. No gate is ever satisfied by a fabricated result: if the
environment cannot prove something (a real browser, a reachable registry), the
gate is reported BLOCKED, not passed.

## Steps

### 1. Align versions

Every `@streetui/*` public package must share one version. The release check
treats divergence as an error, so confirm the whole set matches the intended
release version before anything else. `@streetui/cli`'s `CLI_VERSION` and the
project templates' dependency pins must match too, or scaffolded projects will
disagree with the framework.

### 2. Generate per-package metadata

`scripts/generate-readmes.mjs` and `scripts/apply-publish-metadata.mjs` ensure
each package has the `README.md`, `LICENSE`, and `publishConfig`/`exports`
metadata a published package needs. The release check errors on a missing
`README.md` or `LICENSE`.

### 3. Build and produce the API inventory

Build all packages so each has a `dist/` with its `index.d.ts`, then run
`scripts/api-inventory.mjs`. It parses the built type declarations, splits value
from type exports, classifies each as stable/deprecated/experimental/internal,
verifies the `exports["."].import.types` entry exists on disk, and writes
`dist-tarballs/api-inventory.json`. For 1.0.0 this reports 168 values and 171
types across 17 packages, all stable, every types entry present.

### 4. Run the release check

```
node scripts/release-check.mjs --release-version <v> --channel stable --manifest
```

It fails the release (exit non-zero) on: version divergence across the public
set, a missing per-package `README.md` or `LICENSE`, a `file:`/`link:`/`portal:`
internal-source protocol in any manifest, or a missing `dist/` (unless
`--allow-missing-dist` is passed for a pre-build dry run). With `--manifest` it
writes an enriched release manifest including the git commit and channel. Flags:
`--release-version <v>`, `--channel <name>` (default `stable`), `--manifest`,
`--allow-missing-dist`, `--quiet`.

### 5. Verify the API contract tests

Each public package ships a `public-api.stability.test.ts` asserting its frozen
export list. Run the full suite; a removed or renamed public export fails here
before it can reach a registry.

### 6. Pack tarballs

`scripts/pack-tarballs.mjs` packs every public package to a tarball under
`dist-tarballs/`, rewriting `workspace:*` to the exact release version so the
tarballs are installable without the workspace.

### 7. Verify a clean external consumer

`scripts/consumer-smoke.mjs` installs the packed tarballs into a throwaway
project **with no workspace linking**, then imports and server-renders through
both the ESM and CJS entry points. This proves the artifacts a real user would
download actually resolve and run, independent of the monorepo.

### 8. Publish

Publishing to a registry (`npm publish` of each tarball) is the final step. It
is intentionally separate from everything above, because it is the one
irreversible action and the one this build environment cannot perform — see
below.

## Gate status in this environment

Two gates cannot be executed in the sandbox this release was built in, and are
reported honestly rather than assumed:

- **Real-browser validation — BLOCKED.** No browser or headless driver is
  available; DOM behavior is validated against happy-dom. See
  [`browser-support.md`](./browser-support.md).
- **Registry publication — BLOCKED.** No reachable npm registry. Packaging is
  proven up to locally-built tarballs and the offline consumer smoke test.
  Nothing has been published from here, and no "available on npm" claim is made.

All other gates — version alignment, metadata presence, API inventory and
contract tests, build/typecheck, full test suite, packing, and offline consumer
install — pass with recorded evidence.

## Related

- [Publishing](./publishing.md) — packaging metadata detail.
- [`api-v1.0.md`](./api-v1.0.md) — the frozen API surface and semver policy.
- [Changelog](../CHANGELOG.md).
