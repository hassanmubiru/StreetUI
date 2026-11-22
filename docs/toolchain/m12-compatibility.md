# M12.9 — External Compatibility Notes

Verified against published 3.2.1 packages and real consumer projects.

## Module formats and entry points

- `streetui`: ESM (`dist/index.js`) + CJS (`dist/index.cjs`) with declarations
  for both. Subpaths `./server` and `./testing` (ESM + CJS) and
  `./package.json` exist in the published `exports` map. Verified: 255 ESM
  exports, CJS `require`, SSR via `streetui/server`, 25 testing exports.
- `@streetui/cli`: ESM + CJS with declarations; `bin`: `streetui` and
  `create-streetui`. Runtime dependency is `typescript` only.
- All 16 sub-packages are ESM + CJS with declarations at 3.2.1 (the D-1
  declaration defect is fully resolved).

## TypeScript behavior

- Consumer `tsc --strict` imports pass for all 11 previously affected packages
  (`@streetui/core, events, scheduler, state, runtime, renderer, dom, forms,
  context, devtools, testing`).
- Project tsconfig: `moduleResolution: "bundler"` (recommended) or
  `node16`/`nodenext` with the published `exports` maps.
- `exactOptionalPropertyTypes: true` is used across the repo; avoid
  `any`-typed escape hatches in application code.

## Browser and Node environments

- Verified in this environment: Chromium and Firefox (real binaries) for dev
  and production SSR, HMR, interactions, and screenshots. WebKit not run.
- Node `>= 18` (repo also verifies Node 20/22/24 in CI when CI can run; CI is
  currently blocked by an account billing issue, not code).
- Browser modules are served as **browser-native ESM** by the dev server. The
  toolchain does not convert CommonJS client modules; CommonJS dependencies in
  the browser graph are reported with a clear diagnostic instead of being
  silently rewritten.

## CSS and asset handling

- `style()`/`cx()`/`createThemeTokens` generate CSS at module load; SSR inlines
  it via `renderStyles()`, the browser adopts the identities on hydration.
- `public/` assets are copied to `dist/client` and served as-is. CSS files may
  also be imported as modules in dev (`import './file.css'`) and are
  hot-updated with `hmr_applied` confirmation.

## Package resolution and unsupported patterns

- The toolchain uses its own resolver — **not** Vite/Rollup/Webpack module
  semantics. `workspace:*` is rewritten to the exact version only in packed
  artifacts, never in source.
- Not supported in v1: bundler-specific loaders/plugins, JSX, Vue/Svelte/React
  components, CSS-in-JS runtime extraction, and automatic CJS-to-ESM conversion
  in the browser. Third-party ESM works when it is valid browser ESM.
- Playwright is an optional, development-only provider for the Playground's
  automation API. It is never a runtime dependency of the CLI, the framework,
  or generated applications.
