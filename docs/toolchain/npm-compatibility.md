# npm Dependency Compatibility

StreetUI serves browser-native ESM. This page documents what npm package shapes
the toolchain supports, what it partially supports, and what it reports as
unsupported. It reflects what is tested, not a promise of universal npm
compatibility.

## Real npm-registry matrix (M8.4 / M8.4.1)

Validated against the **candidate `@streetui/cli@3.1.6`** (corrective release) in
real Chromium + Firefox, dev + production. See
`benchmarks/results/toolchain/registry-compat.json`.

| Package | Version | Module format | Dev | Build | Chrome | Firefox | Result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `nanoid` | 6.0.2 | ESM (`type:module`, subpath `./non-secure`) | ✅ | ✅ | ✅ | ✅ | Supported |
| `clsx` | 2.1.1 | dual ESM/CJS (import→`.mjs`) | ✅ | ✅ | ✅ | ✅ | Supported |
| `date-fns` | 4.4.0 | ESM/dual conditional exports, many subpaths | ✅ | ✅ | ✅ | ✅ | Supported |
| `@fontsource/inter` | 5.3.0 | CSS + `woff2`/`woff` font assets via exports | ✅ | ✅ | ✅ | ✅ | Supported (client-entry import) |
| `slugify` | 1.6.9 | CommonJS-only (`main`, no `type`) | — | — | — | — | **CommonJS diagnostic** |
| `node-fetch@2` | 2.7.0 | ESM `.mjs` entry importing Node builtins | — | — | — | — | **Node-builtin diagnostic** |

Supported packages execute correctly and render in both browsers in dev and
production with clean consoles. Dynamic imports, CSS, fonts, and assets work.

## CommonJS / Node-builtin diagnostics (3.1.6)

- `slugify` (CommonJS-only) → the dev server and builder return a **500** (dev)
  / build failure (prod) with a diagnostic that names the package, the importing
  module, the module format (`CommonJS`), the reason, and the resolution. Raw
  CommonJS source is never served with a 200.
- `node-fetch@2` (ESM entry importing Node builtins) → detected as a
  **Node-builtin dependency** that is incompatible with the browser; it is
  reported rather than silently converted.

Supported packages execute correctly and render in both browsers in dev and
production with clean consoles. Dynamic imports, CSS, fonts, and assets work.

## Supported (tested) shapes

| Package shape | Dev | Prod | Notes |
| --- | --- | --- | --- |
| ESM (`"type":"module"`, `.mjs`) | ✅ | ✅ | served |
| Conditional exports (`exports` map) | ✅ | ✅ | `browser`/`import`/`module`/`default` |
| Browser-specific entry (`browser` condition) | ✅ | ✅ | selected for client builds |
| Subpath exports (`pkg/feature`) | ✅ | ✅ | |
| Package `#`-imports (`imports` map) | ✅ | ✅ | |
| Nested dependencies (`pkg/node_modules/...`) | ✅ | ✅ | |
| Dual ESM/CJS (import → `.mjs`, require → `.cjs`) | ✅ | ✅ | browser uses ESM branch |
| Dynamic `import()` | ✅ | ✅ | |
| JSON imports | ✅ | ✅ | ESM default export |
| CSS imports | ✅ | ✅ | dev injection / production extraction |
| SVG, image, font assets | ✅ | ✅ | dev URL / hashed emission |
| Circular module graphs | ✅ | ✅ | detected |
| TypeScript declarations alongside JS | ✅ | ✅ | |

## Unsupported / partially supported

- **CommonJS without an ESM entry** is not executed. After the repo fix it is
  reported with a clear diagnostic; the published 3.1.5 currently serves it raw
  (limitation).
- **Node-only packages** (Node builtins) cannot run in the browser and are
  reported as unsupported.

## Not yet tested

- Additional real-registry packages beyond the six above (matrix is
  representative, not exhaustive).

## How to verify

```
cd packages/cli
../../node_modules/.bin/vitest run src/toolchain/third-party.compat.test.ts
cd <repo>
node scripts/toolchain-registry-compat.mjs --engines chromium,firefox
```

WebKit is now exercised by a dedicated CI job (`browser-validation.yml`), which
installs its system dependencies with `pnpm exec playwright install --with-deps
webkit`. On a host without those libraries the engine is recorded BLOCKED, never
passed.
