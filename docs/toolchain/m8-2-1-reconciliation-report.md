# StreetUI M8.2.1 — Registry Reconciliation

- Status: **Reconciliation complete; corrective 3.1.2 candidate prepared + validated (not published).**
- Date: 2026-11-15
- Method: live `npm` metadata + downloaded published tarballs + repo audit.

## 1. Authoritative live registry matrix

Source: `benchmarks/results/toolchain/repo-vs-registry.json`.

| Package | Repo | Registry latest | Published 3.1.0 | Published 3.1.1 | Matches repo? |
| --- | --- | --- | --- | --- | --- |
| 16 framework `@streetui/*` | 3.1.0 | 3.1.0 | yes | no | **YES** (no esbuild; deps → 3.1.0) |
| `@streetui/cli` | 3.1.2 | 3.1.1 | yes (stale) | yes (broken) | **NO** (3.1.1 imports esbuild) |
| `streetui` | 3.1.2 | 3.1.1 | yes (stale) | yes (broken) | **NO** (3.1.1 imports esbuild) |
| `create-streetui` | 3.1.0 | unpublished | — | — | unpublished |

Publication timestamps: framework 2026-11-15 ~09:06–09:11Z; `@streetui/cli`/`streetui` 3.1.1 at 12:20/12:21Z.

## 2. Repository-versus-registry comparison

- **Framework (16)**: repository 3.1.0 == registry 3.1.0; internal deps resolve to
  3.1.0; published tarballs contain zero esbuild references. **Coherent and correct.**
- **cli / streetui**: repository now 3.1.2; registry has 3.1.0 (stale) and
  3.1.1 (broken). Neither matches the repository build.

## 3. Published tarball inspection

Downloaded + unpacked (`published-tarball-inspection.json`):

- `@streetui/cli@3.1.1`: templates present, bins present, types present; deps
  `{typescript:'*'}`; **but** `dist/bin.js` contains runtime
  `import { build } from "esbuild"` and `import { context } from "esbuild"`.
- `streetui@3.1.1`: same esbuild runtime imports.
- `@streetui/renderer@3.1.0` / `@streetui/core@3.1.0`: deps resolve to 3.1.0;
  **zero** esbuild references.

**Execution check:** `npx --yes --package @streetui/cli@3.1.1 streetui --version`
fails immediately: `ERR_MODULE_NOT_FOUND: Cannot find package 'esbuild'`. The
published cli/streetui 3.1.1 are **not executable**.

## 4. esbuild usage audit (repo)

- No `esbuild` in any public `packages/*/package.json`.
- `packages/cli/src` / `packages/streetui/src`: no esbuild imports (comments only).
- `packages/cli/dist/bin.js|index.js`, `packages/streetui/dist/bin.js`: **0**
  esbuild references in the current 3.1.2 build.
- `tsup` (uses esbuild internally) is build-time only; `scripts/*.mjs` use it as
  a measurement harness.

**Conclusion:** esbuild is **not required at runtime**. The published cli/streetui
3.1.1 (which do import esbuild) were built from an older, esbuild-era tree.

## 5. Initializer (create-streetui) decision

- `packages/create-streetui/` exists (3.1.0, bin wrapper over `@streetui/cli`;
  unpublished). Its `files` reference README/LICENSE (present); deps
  `@streetui/cli@^3.1.0`.
- Canonical command is `npx @streetui/cli create my-app`; `create-streetui` is
  an optional convenience, **not on the critical path**. It may be published
  later if desired, but is not required for this reconciliation. Decision:
  **leave out of the publication plan** (no demonstrated need).

## 6. Corrective package version plan

- Framework (16): retain 3.1.0 (already correct). No new release.
- `@streetui/cli` + `streetui`: next **unpublished** version is **3.1.2**
  (3.1.0 and 3.1.1 are taken/immutable). Prepared candidate built from the
  current repository (no esbuild).

## 7. Internal dependency graph

Framework deps resolve to 3.1.0 and are published; cli/streetui depend only on
`typescript` (runtime) and bundle the framework at build time. No internal range
mismatch remains (cli/streetui now at 3.1.2).

## 8. Release tarball validation

`pack-tarballs.mjs` → **19 tarballs** (cli/streetui @ 3.1.2). Packed cli
3.1.2 manifest: `version: 3.1.2`, deps `{typescript:'^5.6.3'}`, no esbuild;
`dist/bin.js` has zero esbuild references. Templates/bin/types included.

## 9. External installation results

`node scripts/toolchain-external-install.mjs` → **PASSED** for both `basic` and
`ssr` (create → doctor → build → start → preview → dev), outside the monorepo.

## 10. Browser test results

Offline 3.1.2 candidate: **Chromium dev/prod OK**, **Firefox dev/prod OK**
(render, interact, form, navigate, refresh-nested, clean console).

## 11. Exact publication commands (for authorized release)

```bash
# from repo root, after building cli + streetui at 3.1.2
npm publish --access public --workspace @streetui/cli
npm publish --access public --workspace streetui
# framework packages stay at 3.1.0 (no republish)
# create-streetui optional, not required
```

After publishing, re-run `node scripts/toolchain-registry-e2e.mjs` + full
browser/HMR/agent/third-party matrix against the live registry.

## 12. Remaining risks

- Published 3.1.0/3.1.1 cannot be overwritten (immutable); consumers pinning
  `@streetui/cli@3.1.1` will hit the esbuild crash until 3.1.2 is published and
  becomes `latest`.
- If `latest` stays on 3.1.1 until the 3.1.2 publish, `npx @streetui/cli`
  (bare) resolves to the broken 3.1.1. The 3.1.2 publish will set `latest` to a
  working version.
- `create-streetui` remains unpublished; `npm create` flow remains unavailable
  (canonical `npx` flow is unaffected).

## Strict compliance

No `npm publish`, `npm unpublish`, `npm dist-tag add`, or `npm deprecate` was
executed. No registry state changed. No credentials exposed.
