# StreetUI M8.4 — Real npm Ecosystem Compatibility

- Status: **Supported four real packages verified in both browsers/dev+prod;
  CommonJS-diagnostic bug found in the published CLI and fixed in-repo (pending
  next release).**
- Date: 2026-11-15
- Evidence: `benchmarks/results/toolchain/registry-compat.json`.

## 1. Real npm package compatibility matrix

| Package | Version | Format | Dev | Build | Chrome | Firefox | Result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| NaNoid | 6.0.2 | ESM | ✅ | ✅ | ✅ | ✅ | Supported |
| clsx | 2.1.1 | dual ESM/CJS | ✅ | ✅ | ✅ | ✅ | Supported |
| date-fns | 4.4.0 | ESM/dual | ✅ | ✅ | ✅ | ✅ | Supported |
| @fontsource/inter | 5.3.0 | CSS + fonts | ✅ | ✅ | ✅ | ✅ | Supported |
| slugify | 1.6.9 | CJS-only | — | — | — | — | diagnostic expected |
| node-fetch@2 | 2.7.0 | CJS+Node | — | — | — | — | diagnostic expected |

## 2. Installed dependency versions

nanoid 6.0.2, clsx 2.1.1, date-fns 4.4.0, @fontsource/inter 5.3.0,
slugify 1.6.9, node-fetch 2.7.0 (all resolved live at run time).

## 3. Development results

All four supported packages import, execute, and render in dev on both
engines with zero console errors; HMR edit path exercised.

## 4. Production results

All four build cleanly (`build_completed` + manifest), `streetui start` serves
the SSR app, and both browsers render with clean consoles. Assets emitted
(date-fns 1672 modules due to its many subpaths; clsx 22; nanoid 26; fontsource
21).

## 5. Chromium / 6. Firefox

Both engines OK for all four supported packages in dev and production.

## 7. CSS and font results

`@fontsource/inter` (client-entry import) resolves CSS + `woff2`/`woff` assets;
dev CSS served 200; production emits hashed CSS + font assets.

## 8. Unsupported package diagnostics

- Published `@streetui/cli@3.1.5` **serves CommonJS modules verbatim (200)
  without a diagnostic** — a real defect (fixed in-repo, `formatForFile`).
- With the repo fix, `slugify` and `node-fetch@2` return the documented 500
  CommonJS diagnostic.
- `slugify` (UMD/CJS) and `node-fetch@2` (CJS + Node builtins) are never
  silently converted; after the fix they are reported.

## 9. Performance observations

Consumers add dependency resolution + transformation per package; no regression
in startup/build observed. date-fns pulls many modules (expected for its
subpath surface), but it still builds and runs correctly.

## 10. Changed files

- `packages/cli/src/toolchain/resolve/resolver.ts` — `formatForFile` stops at
  the owning package's `package.json` (CJS deps in a `type:module` app no longer
  misclassified as ESM).
- `packages/cli/src/toolchain/server/ssr-runner.ts` — server graph transform uses
  production mode so CSS/asset imports are stripped (SSR with `import
  '@fontsource/inter'` in app.ts renders).
- `packages/cli/src/toolchain/resolve/resolver.test.ts` — regression test.
- `scripts/toolchain-registry-compat.mjs` (new harness).
- `benchmarks/results/toolchain/registry-compat.json`.
- `docs/toolchain/npm-compatibility.md`.

## 11. Remaining limitations

- Published 3.1.5 lacks the CommonJS diagnostic (fix pending a release).
- WebKit not run in this environment.
- Matrix covers six representative packages, not the entire npm.

## 12. Recommendation for M9

Include the `formatForFile` and `ssr-runner` fixes in the next CLI release
(3.1.6), then re-run the compat harness against the published CLI to close the
CommonJS-diagnostic row and promote the matrix to fully green.
