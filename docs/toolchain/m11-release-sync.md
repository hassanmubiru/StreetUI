# M11.12 — GitHub / npm Registry / Release Synchronization Report

Date: 2026-11-19
Scope: local worktree vs public GitHub `main` vs the live npm registry.
**Final outcome: coordinated 3.2.0 committed, PR #1 opened, and all 18 public
packages published to npm at 3.2.0 (playground intentionally unpublished).**
The analysis below records the state before that release; §11 has the outcome.

## 1. Local git status

- Branch: `build-streetui-toolchain`
- HEAD: `ccccfff3d830c7d9a78aa76c1dbefad83e34d60a`
- Remote: `origin https://github.com/hassanmubiru/StreetUI.git`
- Working tree: large **uncommitted** M8–M11 change set (new `packages/playground`,
  `packages/cli/src/toolchain/`, `scripts/toolchain-*.mjs`, `docs/toolchain/`,
  `AGENTS.md`, plus modified CLI sources, READMEs, `CHANGELOG.md`, templates).

## 2. GitHub synchronization status

- `git ls-remote origin refs/heads/main` →
  `7244bf2e04635607f8beff5d3c6790eeb092288d` (≠ local HEAD).
- **No M8–M11 work has been pushed.** Everything is local/uncommitted on the
  feature branch; no history was rewritten and nothing was force-pushed.
- Main checkout `/home/error51/Downloads/StreetUI` received only documentation
  mirrors (README, CHANGELOG entries, `docs/toolchain/` M10+M11 set, and the
  version-badge fixes below); its packages are at 3.1.1.

## 3. npm version and dist-tag status (live registry, 2026-11-19)

| Package | `latest` dist-tag | `prev` | Last registry modification |
|---------|-------------------|--------|----------------------------|
| `streetui` | **3.1.6** | 2.3.0 | 2026-11-16T10:48:23Z |
| `@streetui/cli` | **3.1.6** | 2.3.0 | 2026-11-16T10:47:35Z |
| `@streetui/{core,events,scheduler,state,graph,dsl,compiler,runtime,dom,renderer,router,forms,i18n,context,devtools,testing}` (16 packages) | **3.1.0** | 2.3.0 | 2026-11-15 (per-package timestamps) |
| `@streetui/playground` | **not published (E404)** | — | — |

Published 3.1.6 tarballs were packed from this worktree
(`_from: …/neon-newspaper/dist-tarballs/…`), i.e. **before** M10/M11. Local
sub-package manifests are also 3.1.0, matching the registry; only `streetui`
and `@streetui/cli` moved to 3.1.6.

## 4. Package metadata findings (published artifacts)

`streetui@3.1.6`:

- `main`/`module`/`types`: `dist/index.cjs|js|d.ts`; `exports`: `.`,
  `./server`, `./testing`, `./package.json`, each ESM + CJS with declarations.
- `bin`: `streetui`, `create-streetui`; `dependencies`: `typescript ^5.6.3`;
  `engines.node >=18`; `sideEffects: false`; MIT; `publishConfig.access: public`.
- dist: 58 files, ~5.66 MB unpacked, sha512 integrity present.

`@streetui/cli@3.1.6`:

- `exports`: `.` (ESM+CJS); same `bin` pair; `dependencies`: `typescript ^5.6.3`;
  `sideEffects: false`; MIT.
- dist: 40 files, ~2.45 MB unpacked; templates included: **basic + ssr only**.
- `CLI_VERSION = 3.1.6`, `FRAMEWORK_VERSION = 3.1.0` — matches the published
  sub-package set, so scaffolding resolves correctly.

No unexpected runtime dependencies in either package. Playwright is not a
dependency anywhere (it is optional/dev-only).

## 5. Published tarball inspection

Downloaded from the registry into `/tmp/streetui-npm-audit`, extracted and
checked: file lists, `package.json`, README, `bin`/`exports` targets,
declarations, templates, and secret patterns.

- All declared entry points and declaration files exist.
- No private keys, embedded tokens, or env files; token-related matches are
  variable names in CLI source, not secrets.
- **Stale content, not defects**: published `streetui` README still says
  "Current version: 3.0.2"; published CLI has only `basic`/`ssr` templates and
  no `playground` command; published `streetui` has no M10/M11 agent features.
  These are expected because publication predates M10/M11.

## 6. Independent installation results (registry, not workspace)

`streetui@3.1.6` in a clean consumer project:

- ESM `import * as S from 'streetui'` → **255 exports**; `renderToString` from
  `streetui/server` renders a real heading; `streetui/testing` → 25 exports;
  CJS `require('streetui')` → 255 exports.

`@streetui/cli@3.1.6` in a clean consumer project:

- `--version` → 3.1.6; `--help` lists create/dev/build/start/preview/doctor
  (no `playground`, as expected for this published build).
- `create app --template basic` then registry `npm install` succeeds:
  `@streetui/*@3.1.0` + `@streetui/cli@3.1.6` resolve cleanly.
- `dev --json` → `preview_ready` with `version: 3.1.6`; SSR HTML and
  `/src/main.ts` served correctly.
- `build` → `dist/client/manifest.json` emitted; `doctor` → all checks OK
  (Playwright correctly reported as optional/absent).
- `preview` on this SSR template returns **404 at `/`** because no static
  `index.html` exists (documented behavior: use `start` for SSR).
  `start` serves the production SSR HTML correctly.

## 7. README and changelog status

Updated in this pass:

- Worktree root `README.md`: version badge 3.0.2 → **3.1.6**.
- Main checkout root `README.md`: badge → **3.1.1**.
- Worktree `packages/streetui/README.md`: badge → **3.1.6**.
- Main checkout `packages/streetui/README.md`: badge → **3.1.1**.

Previously: root/CLI/playground READMEs (M11), M10+M11 doc sets in both
checkouts, and `CHANGELOG.md` `Unreleased` entries for M10 and M11 in both
checkouts. Published-package READMEs will pick these up on the next release;
nothing was retroactively changed on npm.

## 8. Release readiness gate

| Check | Result |
|-------|--------|
| Typecheck (cli, playground) | PASS |
| Unit tests (cli) | PASS — 108 tests |
| Builds (cli, playground) | PASS |
| ESLint | PASS |
| M10 agent E2E / M11 visual E2E | PASS — Chromium **and** Firefox |
| M8.4 workflow, HMR hardening, playground security, playground browser (both engines) | PASS |
| External-install harness (local tarballs) | PASS |
| Registry installs of published packages | PASS (§6) |
| Tarball README inclusion (`npm pack --dry-run --json`) | PASS for cli + playground |
| Secret/private-file scan of published artifacts | CLEAN |
| `node scripts/release-check.mjs` | **FAIL** — `public packages span 2 versions: 3.1.0, 3.1.6` |

The version skew is the **only failing release gate**: a coordinated release
requires one shared version across all 18 public packages.

## 9. Remaining discrepancies and work awaiting approval

| Item | Classification |
|------|----------------|
| M10/M11 implementation (worktree, uncommitted) | `LOCAL_ONLY` |
| `streetui` / `@streetui/cli` npm content vs worktree | `PACKAGE_CONTENT_MISMATCH` (published 3.1.6 predates M10/M11) |
| Main checkout vs worktree | `DIVERGED` (3.1.1 vs 3.1.6; docs partially mirrored) |
| `@streetui/playground` on npm | `LOCAL_ONLY` (unpublished by design) |
| Release version coordination | `VERSION_MISMATCH` — release-check error until one version is chosen |

Awaiting explicit approval:

1. **Version plan** for the M10/M11 release (recommend coordinated `3.2.0`
   across all 18 packages, since the changes are large and additive; a patch
   `3.1.7` is also possible).
2. **GitHub sync**: commit M8–M11 work on `build-streetui-toolchain` and open a
   PR (recommended) or push directly to `main`.
3. **npm publish** of the coordinated release, and whether
   `@streetui/playground` should be published for the first time (recommend:
   keep it local-only until requested).

Files requiring commit: all M8–M11 changes listed in `git status` (§1), plus the
README badge fixes in §7.

## 10. Reproduction

```bash
# Registry metadata
npm view streetui dist-tags time.modified version --json
npm view @streetui/cli dist-tags time.modified version --json
npm view @streetui/playground version --json   # E404 (unpublished)

# Published artifacts
mkdir -p /tmp/streetui-npm-audit && cd /tmp/streetui-npm-audit
npm pack streetui@3.1.6 && npm pack @streetui/cli@3.1.6
tar -xzf streetui-3.1.6.tgz -C streetui && tar -xzf streetui-cli-3.1.6.tgz -C cli

# Independent consumers (no workspace links)
mkdir -p /tmp/streetui-consumer/framework && cd /tmp/streetui-consumer/framework
npm init -y && npm install streetui@3.1.6
# → import checks: streetui, streetui/server, streetui/testing, CJS require
mkdir -p /tmp/streetui-consumer/cli && cd /tmp/streetui-consumer/cli
npm init -y && npm install @streetui/cli@3.1.6
./node_modules/.bin/streetui --version
./node_modules/.bin/streetui create app --template basic
cd app && npm install
../node_modules/.bin/streetui dev --json --port 3419
../node_modules/.bin/streetui build
../node_modules/.bin/streetui start --port 3422

# Release gate
cd <worktree> && node scripts/release-check.mjs   # currently 1 version-skew error
```

## 11. Final outcome (2026-11-19)

- All 18 public packages coordinated to **3.2.0**: manifests,
  `packages/streetui/src/version.ts` `VERSION`, `CLI_VERSION`,
  `FRAMEWORK_VERSION`, stability-test assertions, and README badges updated;
  `scripts/publish-packages.mjs` release-version pin moved to 3.2.0.
- `release-check.mjs`: **OK (0 warnings)**. 108 CLI tests + 21 streetui tests
  passing; external-install verification with the 3.2.0 tarballs: PASS.
- Branch `build-streetui-toolchain` committed and pushed.
  **PR #1: https://github.com/hassanmubiru/StreetUI/pull/1**
- `node scripts/publish-packages.mjs`: **all 18 packages published to npm at
  3.2.0**. `@streetui/playground` remains intentionally unpublished.
- `CHANGELOG.md` in both checkouts now records M11 as `3.2.0` and M10 as
  included in 3.2.0; no `Unreleased` feature claims remain for these milestones.
- Registry propagation of the new dist-tag was in progress at report time;
  `npm view streetui dist-tags` initially still read 3.1.6 immediately after
  publish (npm's "being processed" notice).
