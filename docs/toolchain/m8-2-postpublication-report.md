# StreetUI M8.2 / M8.3 — Consolidated Public Registry Report

- Status: **COMPLETE — all 18 packages published; corrective 3.1.1 live for cli/streetui.**
- Date: 2026-11-15 (final update post 3.1.1 corrective publish)
- Method: live `registry.npmjs.org` queries (`curl` + `npm view`) + `node scripts/consumer-smoke.mjs` + repo inspection.

---

## 1. Published-package matrix (live registry, 2026-11-15 final)

| Package | Registry | latest | Notes |
| --- | --- | --- | --- |
| `@streetui/core` | 3.1.0 | 3.1.0 | ✅ |
| `@streetui/events` | 3.1.0 | 3.1.0 | ✅ |
| `@streetui/scheduler` | 3.1.0 | 3.1.0 | ✅ |
| `@streetui/state` | 3.1.0 | 3.1.0 | ✅ |
| `@streetui/graph` | 3.1.0 | 3.1.0 | ✅ |
| `@streetui/dsl` | 3.1.0 | 3.1.0 | ✅ |
| `@streetui/compiler` | 3.1.0 | 3.1.0 | ✅ |
| `@streetui/runtime` | 3.1.0 | 3.1.0 | ✅ |
| `@streetui/dom` | 3.1.0 | 3.1.0 | ✅ |
| `@streetui/renderer` | 3.1.0 | 3.1.0 | ✅ — internal deps pinned to 3.1.0 |
| `@streetui/router` | 3.1.0 | 3.1.0 | ✅ |
| `@streetui/forms` | 3.1.0 | 3.1.0 | ✅ |
| `@streetui/i18n` | 3.1.0 | 3.1.0 | ✅ |
| `@streetui/context` | 3.1.0 | 3.1.0 | ✅ |
| `@streetui/devtools` | 3.1.0 | 3.1.0 | ✅ |
| `@streetui/testing` | 3.1.0 | 3.1.0 | ✅ |
| `@streetui/cli` | **3.1.1** | **3.1.1** | ✅ — corrective; esbuild removed, `typescript: *` only |
| `streetui` | **3.1.1** | **3.1.1** | ✅ — corrective; esbuild removed, `typescript: *` only |
| `create-streetui` | not published | — | n/a — package does not exist in repo |

The `3.1.0` versions of `@streetui/cli` and `streetui` remain on the registry
(immutable) but are superseded by `3.1.1` as `latest`. Consumers installing
`@streetui/cli` or `streetui` without a pinned version will receive `3.1.1`.

---

## 2. esbuild audit

Confirmed by source inspection: zero `esbuild` imports in `cli/src/` or
`packages/streetui/src/`; zero esbuild references in built `dist/*.js`;
`tsup`/esbuild is build-time only. The `esbuild@0.24.2` entry in `3.1.0` was a
packaging defect — a stale `dependencies` field not cleaned before publish.
`3.1.1` carries `{"typescript":"*"}` as its only runtime dependency, confirmed
against the live registry.

---

## 3. Consumer smoke test results

Ran `node scripts/consumer-smoke.mjs` twice — once after the 3.1.0 publish, once
after the 3.1.1 corrective publish. Both passed:

```
CONSUMER SMOKE TEST PASSED — packaged framework consumed from tarballs (ESM + CJS).
ESM-SSR-OK len=46
CJS-SSR-OK len=40
```

---

## 4. `npm create streetui@latest`

`create-streetui` is not in the registry and does not exist as a package in this
repo. `npm create streetui@latest` returns 404. Users scaffold via
`npx @streetui/cli create` instead. This is not a blocker for this release.

---

## 5. Browser, HMR, agent, and third-party regressions

Not yet run against the live registry. Pending explicit authorization.

---

## 6. Release readiness summary

| Check | Status |
| --- | --- |
| 16 framework packages at 3.1.0 | ✅ |
| `@streetui/cli` at 3.1.1 (no esbuild) | ✅ |
| `streetui` at 3.1.1 (no esbuild) | ✅ |
| `latest` tag points to 3.1.1 for cli/streetui | ✅ |
| Internal framework deps coherent (renderer → 3.1.0) | ✅ |
| Consumer smoke (ESM + CJS) | ✅ |
| `create-streetui` | n/a |
| Browser/HMR/agent regressions vs live registry | ⏳ pending authorization |

---

## 7. Commands executed (full session)

```
# Version bumps — 3.1.0 round
sed -i 's/"version": "3.0.2"/"version": "3.1.0"/' packages/*/package.json

# Pack + publish — 3.1.0 round
node scripts/pack-tarballs.mjs                         # 18 tarballs @ 3.1.0
node scripts/publish-packages.mjs                      # 17 published; streetui already-staged

# Verification — 3.1.0
curl https://registry.npmjs.org/streetui/3.1.0         # esbuild dep found — packaging defect
curl https://registry.npmjs.org/@streetui%2Fcli/3.1.0  # esbuild dep found — packaging defect
curl https://registry.npmjs.org/@streetui%2Frenderer/3.1.0  # internal deps → 3.1.0 ✅
node scripts/consumer-smoke.mjs                        # PASSED
node scripts/release-check.mjs --release-version 3.1.0 --channel stable  # PASSED

# Corrective 3.1.1 — cli + streetui only
#   - removed esbuild from dependencies in both package.json files
#   - bumped version to 3.1.1 in package.json + src/version.ts + cli/src/index.ts
#   - rebuilt both packages (tsup)
npm pack → dist-tarballs/streetui-cli-3.1.1.tgz        # deps: {"typescript":"*"} ✅
npm pack → dist-tarballs/streetui-3.1.1.tgz            # deps: {"typescript":"*"} ✅
npm publish streetui-cli-3.1.1.tgz                     # + @streetui/cli@3.1.1
npm publish streetui-3.1.1.tgz                         # + streetui@3.1.1

# Final verification
curl https://registry.npmjs.org/streetui/3.1.1         # deps: {"typescript":"*"} ✅
curl https://registry.npmjs.org/@streetui%2Fcli/3.1.1  # deps: {"typescript":"*"} ✅
node scripts/consumer-smoke.mjs                        # PASSED
```

---

## 8. Known stale versions

`streetui@3.1.0` and `@streetui/cli@3.1.0` remain on the registry with the
`esbuild` packaging defect. They are not tagged `latest` and will not be
installed by default. No deprecation has been applied; that decision is deferred
to the maintainer.
