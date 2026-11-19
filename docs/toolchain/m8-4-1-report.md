# StreetUI M8.4.1 — CommonJS Diagnostics & SSR Corrective Release

- Status: **Release candidate 3.1.6 prepared and fully validated; publication
  awaits explicit approval.**
- Date: 2026-11-16
- Candidate: `@streetui/cli@3.1.6` + `streetui@3.1.6` (framework stays 3.1.0).

## 1. CommonJS resolver test results

`formatForFile` now stops at the owning package's `package.json` (no `type` →
CJS). Verified by unit tests:

- ESM dep in ESM app → `esm`
- CJS-only dep in ESM (`type:module`) app → `cjs` (no longer misclassified)
- Dual ESM/CJS package → picks ESM `.mjs` branch (`esm`)
- Nested CJS package under a `type:module` parent → `cjs`
- Browser-condition exports → browser ESM entry (`esm`)

CommonJS modules are never silently served as browser ESM.

## 2. Development diagnostic results (candidate 3.1.6)

- `slugify@1.6.9` → dev server returns **500** with a diagnostic naming the
  package, the importing module, module format (`CommonJS`), reason, and
  resolution. Also broadcast over the HMR WebSocket error event; logged to
  terminal. No raw CJS in a 200 response.
- `node-fetch@2` → detected as a **Node-builtin dependency** (ESM `.mjs` entry
  importing Node builtins), reported rather than silently converted.

## 3. Production diagnostic results

`streetui build` on an unsupported CJS dependency fails (exit 1) with an
actionable diagnostic (package + importer + format + reason + resolution). No
broken output is emitted.

## 4. SSR asset-handling results

The SSR runner transforms the server graph in production mode, so client-only
CSS/asset imports are stripped from the Node graph but retained in the browser
build. Verified with `@fontsource/inter`, global CSS, SVG/image/font assets:
SSR HTML has `id="app"`, client entry injected, hydration works, and browser
assets (CSS + woff2/woff) remain in the production output.

## 5. Real npm compatibility matrix (candidate 3.1.6)

| Package | Version | Dev | Build | Chrome | Firefox | Result |
| --- | --- | --- | --- | --- | --- | --- |
| `nanoid` | 6.0.2 | ✅ | ✅ | ✅ | ✅ | Supported |
| `clsx` | 2.1.1 | ✅ | ✅ | ✅ | ✅ | Supported |
| `date-fns` | 4.4.0 | ✅ | ✅ | ✅ | ✅ | Supported |
| `@fontsource/inter` | 5.3.0 | ✅ | ✅ | ✅ | ✅ | Supported |
| `slugify` | 1.6.9 | diagnostic | — | — | — | CommonJS diagnostic |
| `node-fetch@2` | 2.7.0 | diagnostic | — | — | — | Node-builtin diagnostic |

Fixture-based vs real-registry results are kept separate in
`docs/toolchain/npm-compatibility.md`.

## 6. Chrome and Firefox results

Both engines pass dev + prod for all four supported packages (clean consoles);
probes produce the documented diagnostics on both engines.

## 7. Full regression results

- Vitest **99/99**, `tsc --noEmit` clean, ESLint clean.
- `tsup` builds (cli + streetui) succeed; 3.1.6 tarballs packed (no esbuild dep
  or runtime import).
- Offline external-install (both templates): PASS.
- Browser harness: Chromium + Firefox dev/prod all OK.
- Chromium HMR: PASS (edit interactive; syntax-error overlay; recovery).
- Security suite: PASS.
- Agent workflow: PASS.

## 8. Changed files

- `packages/cli/package.json`, `packages/streetui/package.json`,
  `packages/cli/src/index.ts` (CLI_VERSION), `public-api.stability.test.ts` →
  3.1.6.
- `packages/cli/src/diagnostics.ts` — `BuildProblem.importer`.
- `packages/cli/src/toolchain/server/dev-server.ts` — CJS diagnostic includes
  importer + format + reason + resolution; error event carries fields.
- `packages/cli/src/toolchain/build/builder.ts` — build CJS diagnostic includes
  importer.
- `packages/cli/src/toolchain/resolve/resolver.ts` — (already fixed)
  `formatForFile` owning-package boundary.
- `packages/cli/src/toolchain/server/ssr-runner.ts` — (already fixed) production
  mode transform for server graph.
- `packages/cli/src/toolchain/resolve/resolver.test.ts` — added format tests.
- `scripts/toolchain-registry-compat.mjs` — `--local` mode + diagnostic
  classification.
- `docs/toolchain/npm-compatibility.md`.

## 9. Proposed package versions

- `@streetui/cli@3.1.6`, `streetui@3.1.6`. Framework stays at 3.1.0.

## 10. Publication instructions (await approval)

```bash
# from repo root, after building cli + streetui at 3.1.6
npm publish --access public --workspace @streetui/cli
npm publish --access public --workspace streetui
# framework packages stay at 3.1.0; no dist-tag changes; no deprecation.
```

Post-publish: re-run `node scripts/toolchain-registry-e2e.mjs` (bump to
3.1.6) and the full compat matrix against the live registry.

## 11. Remaining limitations

- `create-streetui` still unpublished → `npm create streetui@latest` unavailable
  (canonical `npx @streetui/cli create` is verified).
- Node-builtin dependency detection reports via the harness/` observed at serving
  time; a dedicated runtime diagnostic for Node-builtin imports in client code
  is a candidate future enhancement.
- WebKit not run (env library missing) — recorded, not passed.
