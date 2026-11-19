# StreetUI M8.2 — Release Report (3.1.0)

- Status: **Preparation complete — publication NOT executed (approval gate).**
- Date: 2026-11-15

## 1. Packages to publish (version 3.1.0)

| # | Package | Order |
| --- | --- | --- |
| 1 | `@streetui/core`, `state`, `events`, `scheduler`, `dom`, `context` | A (leaves) |
| 2 | `@streetui/graph`, `forms`, `i18n` | B |
| 3 | `@streetui/dsl` | C |
| 4 | `@streetui/compiler` | D |
| 5 | `@streetui/runtime` | E |
| 6 | `@streetui/renderer`, `devtools` | F |
| 7 | `@streetui/router`, `testing` | G |
| 8 | `@streetui/cli` | H |
| 9 | `streetui` | H |
| 10 | `create-streetui` | I |

## 2. Tarball validation

- `node scripts/pack-tarballs.mjs` → **19 tarballs @ 3.1.0**.
- Packed manifests: internal `@streetui/*` runtime deps are **exact `3.1.0`**;
  no `workspace:` in `dependencies`; `publishConfig.access: "public"` on every
  scoped package.
- `npm pack --dry-run` equivalent contents verified: `dist/*` (ESM+CJS+maps),
  `dist/index.d.ts`/`.d.cts`, `bin.js`/`create-bin.js`, templates
  (cli/streetui), `README.md`, `LICENSE`.

## 3. Offline install (release candidates)

`node scripts/toolchain-external-install.mjs` → **PASSED** for both `basic` and
`ssr` templates (create → doctor → build → start → preview → dev), outside the
monorepo, no symlinks.

## 4. Build & test results

- Typecheck (`tsc --noEmit`) clean; ESLint clean.
- Vitest **96/96** (18 suites).
- `tsup` builds: `@streetui/cli` ✓, `streetui` ✓.
- M8 regressions (browser Chromium+Firefox dev/prod, HMR Chromium, security,
  agent-workflow, perf) green on the current toolchain.

## 5. Auth / registry

- `npm whoami` → **`error51`**.
- `npm publish --dry-run` for `create-streetui@3.1.0` → OK (public access).
- Registry reachable; package names not conflicting.

## 6. Risks

- `devDependencies` in packed manifests still list `workspace:*` — harmless
  (consumers never install a dependency's devDependencies), but could be
  rewritten for tidiness.
- Version 3.0.2 on the registry is stale; must not be republished. Consumers
  upgrading will receive 3.1.0 via `latest`.

## 7. Exact publication commands

See `docs/toolchain/m8-2-release-plan.md` for the ordered `npm publish --access
public` commands, tags, and rollback guidance. All scoped packages use
`--access public`; `create-streetui` publishes with default public access.

## 9. Post-publication verification (snapshot after "streetui published")

| Package | Registry now | Notes |
| --- | --- | --- |
| `streetui` | 3.1.0 | **still declares `esbuild@0.24.2`** — does not match repo |
| `@streetui/cli` | 3.0.2 | stale (esbuild) |
| `@streetui/*` (framework) | 3.0.2 | stale |
| `create-streetui` | not published | `npm create` still 404 |

The published `streetui@3.1.0` does **not** represent the independent toolchain
(repo manifest is `typescript`-only). The release is therefore **incomplete and
inconsistent**: only one package bumped, framework/cli still stale, and the
initializer missing. Do not declare the toolchain published until a corrected,
full publish (all 19 at 3.1.0, no esbuild) is performed from the repository
build and the registry smoke passes.

## 10. Approval gate

**STOP.** No further publish, dist-tag change, or deprecation will be executed
without explicit user authorization. Corrective action requires republishing
from the current repository build.
