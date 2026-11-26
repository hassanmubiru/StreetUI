# M14 — Node 18 Compatibility and Release Integrity Report

**Status:** complete. `3.2.2` is **published on npm** (19 packages,
`latest: 3.2.2`) after explicit approval, and verified from the real registry on
Node 18, 20, 22 and 24. Every result below was produced by running the real
script; nothing is inferred.

- **Branch:** `m13-production-hardening` (worktree `neon-newspaper`)
- **Date:** 2026-11-24
- **Node used for local verification:** v24.18.0 (matrix covers 18/20/22/24)
- **Platform:** linux-x64
- **Published:** `3.2.2`, all 19 packages, `latest` dist-tag.

## Summary

| Task | Result | Evidence |
|------|--------|----------|
| M14.1 Baseline + defect ledger | ✅ 9 pipeline defects + 3 workspace defects | this report |
| M14.2 SSR runner hardening | ✅ CJS dependency diagnostic + manifest assertion | `ssr-runner.ts` |
| M14.3 SSR regression tests | ✅ 111 CLI tests (was 109) | `dev-server.test.ts` |
| M14.4 Node matrix v2 | ✅ 18/20/22/24 PASS on packed artifacts | `node-matrix.json` |
| M14.5 Release pipeline refactor | ✅ shared list, build, verify, smoke | `scripts/lib/public-packages.mjs` |
| M14.6 Packed consumer verification | ✅ 19 tarballs, ESM+CJS+CLI flow | this report |
| M14.7 Version `3.2.2` | ✅ 19 manifests + constants + assertions | this report |
| M14.8 CI gate fix | ✅ gate no longer self-defeating; matrix job added | `.github/workflows/ci.yml` |
| M14.9 Workspace integrity | ✅ frozen lockfile + turbo graph | this report |
| M14.10 Documentation | ✅ CHANGELOG, README, this report | — |
| M14.11 WebKit unblocked | ✅ dev/prod, a11y, SSR/hydration | `webkit-*.json` |
| M14.12 Preservation harnesses | ✅ HMR, security, perf, 3-engine browser | this report |
| M14.13 Publish `3.2.2` | ✅ 19 packages, `latest` | registry dist-tags |
| M14.14 Registry verification | ✅ Node 18/20/22/24 install from npm | `node-matrix-npm.json` |

## M14.1 — The release pipeline could not have shipped a correct release

The 3.2.1 npm defect (Node 18 SSR) was not one bug; it was the visible symptom
of a release pipeline with no working gates. Each defect below was reproduced by
running the script.

| # | Defect | Why it mattered |
|---|--------|-----------------|
| 1 | CI passed `--release-version "$(node -p require('./package.json').version)"` while the root manifest was `3.1.0` and packages were `3.2.1` | The release gate failed on **every** run, for a reason unrelated to the code, so its output was noise and nobody acted on real failures. |
| 2 | `apply-publish-metadata.mjs` replaced `exports` wholesale with only `"."` | Publishing would have dropped `streetui` `./server`, `./testing`, `./package.json` and `@streetui/compiler` `./diagnostics`, and dropped `templates` from `files`. |
| 3 | Five divergent public-package lists (18/19/17/18/18) across scripts | No two scripts agreed on the release set, so "verified" never meant the same thing twice. |
| 4 | `create-streetui` packed but never published | Its tarball name could not match the `/^streetui-(.+)-[\d.]+\.tgz$/` regex and it was absent from the publish order, so `npm create streetui@latest` could not work. |
| 5 | `pack-tarballs.mjs` never built | Stale `dist/` shipped as-is — exactly how 3.2.0 shipped declaration-less tarballs. |
| 6 | `release-check.mjs` never checked that declared targets exist | A manifest could advertise `types`/`exports` that were not in `dist/` and still pass. |
| 7 | `3.2.1` hardcoded in four scripts | A version bump silently desynchronised the gates. |
| 8 | `consumer-smoke.mjs` excluded the CLI | The Node 18 defect was **structurally undetectable** by the smoke test. |
| 9 | SSR runner ignored `ResolvedImport.format` | CommonJS dependencies were emitted as ESM into a `type: module` cache, producing `Named export 'compile' not found` on Node 18. |

Three further workspace defects made CI unable to run at all:

| # | Defect | Effect |
|---|--------|--------|
| 10 | `apps/playground` and `packages/playground` both declared `@streetui/playground` | `turbo` aborted with `Failed to add workspace ... it already exists`, so `pnpm build`, `pnpm test` and `pnpm typecheck` never ran. |
| 11 | `pnpm-lock.yaml` missing the `examples/streetui-dashboard` and `packages/playground` importers, and stale after the version bump | `pnpm install --frozen-lockfile` (CI's first step) failed. |
| 12 | `packages/playground` declared `@codemirror/lang-typescript` (404 on npm) and imported the undeclared `@codemirror/lang-javascript` | The lockfile could not resolve. |

## M14.2 — SSR runner

`packages/cli/src/toolchain/server/ssr-runner.ts`:

- Dependency package manifests are emitted at their mirrored cache paths, so
  Node 18 (which has no ESM syntax detection) loads CommonJS dependencies
  correctly.
- `isDependencyFile()` and a `formats` map record each resolved import's format
  during the graph crawl. A CommonJS dependency is now reported as an explicit
  `BuildProblem` — `Cannot server-render CommonJS dependency "<rel>": the SSR
  cache is an ES module tree. Use an ESM build of this package.` — instead of
  being silently emitted as ESM.
- A post-build assertion throws `SSR cache is missing package manifests for: …`
  if any emitted dependency directory lacks a `package.json`. This is the
  invariant that was violated in 3.2.1, now enforced rather than assumed.

## M14.3 — Regression tests

`packages/cli/src/dev-server.test.ts` gained `packageDirsMissingManifest()`,
which walks the emitted cache, resolves each dependency root, and asserts a
manifest exists. Two new tests:

- `keeps exactly one SSR build directory across repeated reloads`
- `reports a CommonJS dependency instead of emitting an unloadable cache module`

CLI suite: **111 tests passing** (was 109). `tsc --noEmit` clean.

## M14.4 — Node matrix

`scripts/toolchain-node-matrix.mjs` was rewritten (`streetui-node-matrix/v2`):
`--versions`, `--target npm|packed`, `--version` (defaults to the workspace
version), and it records `artifactVersion`, `requestedVersions` and `target`.
Per version it checks: node version, install, CLI `--version` (via
`dist/bin.js`), scaffold, build (manifest present), doctor, dev SSR, SSR
regeneration after a source edit, production `start`, and SIGTERM cleanup. An
unavailable Node version is recorded **BLOCKED**, never PASS.

Result on packed `3.2.2` tarballs (`benchmarks/results/toolchain/node-matrix.json`):

| Node | install | CLI version | scaffold | build | doctor | dev SSR | SSR regen | start |
|------|---------|-------------|----------|-------|--------|---------|-----------|-------|
| 18.20.8 | ✅ | 3.2.2 | ✅ | ✅ | ✅ | ✅ 1035 B | ✅ | ✅ 984 B |
| 20.20.2 | ✅ | 3.2.2 | ✅ | ✅ | ✅ | ✅ 1035 B | ✅ | ✅ 984 B |
| 22.23.5 | ✅ | 3.2.2 | ✅ | ✅ | ✅ | ✅ 1035 B | ✅ | ✅ 984 B |
| 24.18.0 | ✅ | 3.2.2 | ✅ | ✅ | ✅ | ✅ 1035 B | ✅ | ✅ 984 B |

Node 18 is the version that failed in 3.2.1; it now renders SSR, regenerates the
cache after an edit, and serves the production build.

## M14.5 — Release pipeline

- **`scripts/lib/public-packages.mjs`** (new) is the single source of truth:
  `COORDINATED` (18), `EXTRA` (`create-streetui`), `PUBLISH_ORDER` (19),
  `REQUIRED_SUBPATHS` (`streetui`: `./server`, `./testing`, `./package.json`;
  `compiler`: `./diagnostics`), `REQUIRED_FILES` (`streetui`, `cli`: `templates`).
- **`release-check.mjs`** now verifies every declared target on disk (`main`,
  `module`, `types`, `typings`, all `exports` conditions, all `bin`), required
  subpaths and files, per-package license, internal dependency resolution and
  protocol, dist presence, lockstep versions, and that the root manifest matches
  the coordinated release.
- **`apply-publish-metadata.mjs`** is additive with a `--check` mode: it merges
  `exports["."]`, never removes a subpath, only adds `dist` when it exists, and
  preserves `templates`.
- **`release-build.mjs`** (new) builds each package through the resolved `tsup`
  entry and asserts every declared `.d.ts`/`.d.cts` exists.
- **`pack-tarballs.mjs`** fails when `dist/` is older than `src/`, rewrites
  `workspace:` in every dependency field, stages only declared `files`, and
  writes `tarballs.json`.
- **`verify-tarballs.mjs`** (new) extracts all 19 tarballs and verifies declared
  targets, absent `workspace:`/`file:`/`link:`/`portal:` protocols, required
  subpaths and files, license policy, and lockstep versions.
- **`publish-packages.mjs`** derives the version from the workspace, reads
  `tarballs.json`, pre-checks `npm whoami` and the version, and publishes in
  `PUBLISH_ORDER` including `create-streetui`.
- **`consumer-smoke.mjs`** installs all 19 tarballs offline and drives the
  installed CLI: `--version` → `create smoke-app --template ssr` → `build` →
  `dev --json` → HTML contains `id="app"`.
- `toolchain-external-install.mjs`, `toolchain-external-developer-e2e.mjs` and
  `toolchain-template-audit.mjs` were de-hardcoded and now read the workspace
  version.

## M14.6 — Packed consumer verification

```
RELEASE CHECK OK (0 warning(s))            # 19 packages, 18 coordinated
TARBALL VERIFICATION OK — 19 tarballs @ 3.2.2
CONSUMER SMOKE TEST PASSED — tarballs installed and executed (ESM, CJS, CLI flow)
```

The smoke test installs from `dist-tarballs/` with no workspace links. Phases:
ESM SSR (46 B document), CJS SSR (40 B), and the installed CLI flow (created app,
11 client modules built, dev SSR 1053 B with `<div id="app">`).

## M14.7 — Version 3.2.2

Bumped in 19 package manifests, the root manifest, `packages/streetui/src/version.ts`,
`packages/cli/src/index.ts` (`CLI_VERSION`, `FRAMEWORK_VERSION`), and both public
API assertions. `packages/create-streetui` depends on `@streetui/cli` via
`workspace:*` so packing resolves it.

## M14.8 — CI

`.github/workflows/ci.yml` no longer derives the release version from the root
manifest (the root-vs-packages agreement is now an explicit `release-check`
error). The build job runs `release:meta:check`, `release-check`, `release:pack`,
`release:verify` and `release:smoke`. A new `node-matrix` job packs the workspace
and runs `toolchain-node-matrix.mjs --target packed` on Node 18, 20, 22 and 24,
uploading each report.

**CI status is not claimed as green.** The latest GitHub Actions runs on this
repository fail in ~4 seconds, which is consistent with an account billing lock
rather than a code defect. The workflow changes are verified locally only.

## M14.9 — Workspace integrity

- `apps/playground` renamed to `@streetui/playground-demo`; the real Playground
  (`packages/playground`, the one `packages/cli/src/playground.ts` resolves)
  keeps the name. `turbo` now builds a graph over 35 packages.
- `pnpm-lock.yaml` regenerated with the `packages/playground` and
  `examples/streetui-dashboard` importers; `pnpm install --frozen-lockfile`
  reports "Lockfile is up to date".
- `packages/playground` now declares `@codemirror/lang-javascript` (the package
  it imports) and the `@streetui/*` modules its UI bundle resolves, and no
  longer declares the non-existent `@codemirror/lang-typescript`.

Local gate results:

| Gate | Result |
|------|--------|
| `pnpm install --frozen-lockfile` | ✅ Lockfile is up to date |
| `turbo run typecheck` | ✅ 52/52 tasks |
| `turbo run build` | ✅ 34/34 tasks |
| `eslint packages apps examples` | ✅ clean |
| Per-package `vitest run` | ✅ 31 packages, 1,260 tests, 0 failures |
| `packages/cli` | ✅ typecheck + 111 tests |
| `packages/playground` | ✅ build + typecheck |

One latent typecheck error was fixed on the way: `api-experience.test.ts` passed
an `onSubmit` callback returning a value where the signature allows
`void | Promise<void>`.

## Preservation harnesses

| Harness | Result |
|---------|--------|
| `toolchain-browser-tests` Chromium/Firefox/WebKit × dev/prod | ✅ 6/6 OK |
| `toolchain-hmr.mjs` | ✅ edit keeps app interactive, syntax error overlaid, recovery clean |
| `packages/cli/src/security.test.ts` | ✅ 7/7 |
| `toolchain-a11y-axe` Chromium/Firefox/WebKit | ✅ 0 violations × 7 routes per engine |
| `toolchain-ssr-hydration` Chromium/Firefox/WebKit | ✅ PASS + dev regeneration |
| `toolchain-perf.mjs` | ✅ dev startup 856 ms, HMR median 61.3 ms, build 497 ms |

Perf against the M13 baseline (601 ms dev startup, ~61 ms HMR, 393 ms build):
startup and build are slower on this run, HMR is unchanged. These are single
machine samples recorded as a regression baseline, not a claim of improvement —
M14 changed release scripts and dependency declarations, not the compiler,
renderer or runtime.

## M14.13 — Publish and registry verification

Published after explicit approval (`publish-packages.mjs --tag latest`): 19/19
packages reported `published`. The first dist-tag read showed `3.2.1` because the
registry had not propagated yet; once it had,
`streetui`, `@streetui/cli`, `create-streetui`, `@streetui/core`,
`@streetui/renderer` and `@streetui/testing` all report `latest: 3.2.2`, and
`https://registry.npmjs.org/streetui/-/streetui-3.2.2.tgz` returns 200.

The decisive check is the matrix against the **registry**, not the tarballs
(`node-matrix-npm.json`):

| Node | CLI version | build | dev SSR | SSR regen | start |
|------|-------------|-------|---------|-----------|-------|
| 18.20.8 | 3.2.2 | ✅ | ✅ | ✅ | ✅ |
| 20.20.2 | 3.2.2 | ✅ | ✅ | ✅ | ✅ |
| 22.23.5 | 3.2.2 | ✅ | ✅ | ✅ | ✅ |
| 24.18.0 | 3.2.2 | ✅ | ✅ | ✅ | ✅ |

Node 18 — the version broken in 3.2.1 — installs `streetui@3.2.2` and
`@streetui/cli@3.2.2` from npm, scaffolds, builds, server-renders, regenerates the
SSR cache after an edit, and serves the production build.

Independent end-to-end check by hand (outside the matrix): `npm create
streetui@latest app -- --template ssr` scaffolds, `npm install` resolves all
`@streetui/*` from the registry, `streetui build` emits 11 client modules and a
manifest, and `streetui start` serves populated SSR markup (`<div id="app">` with
real content). `create-streetui` — never actually published before this release —
now works through the `npm create` path.

A defect in the matrix script itself was found and fixed here: the packed-target
dependency rewrite was applied to `--target npm` too, which stripped the real
registry specs and made every version fail with "Could not resolve
@streetui/renderer". The rewrite is now gated on `target === 'packed'`.

## Limitations

- **CI is unverifiable** from this environment: `gh run view` on the latest
  failed runs reports "The job was not started because your account is locked
  due to a billing issue", so no code conclusion can be drawn from CI status.
  All gates above are local results, plus the registry installs in M14.14.

## WebKit — unblocked and verified

WebKit was previously BLOCKED on host libraries. The missing libraries
(`libevent-2.1.so.7`, `libavif.so.16`, `libmanette-0.2.so.0`, `libyuv.so.0`,
`libgav1.so.2`, `libhidapi-hidraw.so.0`) were fetched as `.deb` packages and
extracted into the Playwright WebKit bundle's own `sys/lib`, which the bundle
wrapper already puts on `LD_LIBRARY_PATH`. No system packages were installed and
no sudo was used.

WebKit 26.6 now runs, and the same harnesses used for Chromium/Firefox pass:

| Harness | WebKit result | Artifact |
|---------|---------------|----------|
| `toolchain-browser-tests --engine webkit --mode both` | ✅ dev OK, prod OK (initial render, interact, navigate, form, console clean, refresh on nested route) | `webkit-dev.json`, `webkit-prod.json` |
| `toolchain-a11y-axe --engines webkit` | ✅ 0 violations / 7 routes | `a11y-axe.json` |
| `toolchain-ssr-hydration --engines webkit` | ✅ PASS + dev SSR regeneration | `ssr-hydration.json` |

While doing this, two harness defects were fixed:

- `--mode both` was documented but not implemented — it silently ran prod only.
  It now expands to `dev` and `prod`, so the per-mode reports above are real.
- `toolchain-a11y-axe.mjs` hard-coded `firefox ? firefox : chromium`, so
  `--engines webkit` would have silently audited Chromium. Engine selection is
  now a lookup table with a WebKit executable path.
- `browser-validation.yml` gained a `webkit` job that installs the engine with
  `--with-deps` on CI and uploads the three artifacts.
