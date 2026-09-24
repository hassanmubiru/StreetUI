# Publishing & package validation

StreetUI's public packages are built to be consumed from a registry like any
other npm dependency — installed with plain `npm install`, no workspace linking,
no build step in the consumer. This document describes how that is produced and
verified.

## What ships in every public package

`scripts/apply-publish-metadata.mjs` normalizes the `package.json` of each
public package so that all of them share the same publishable shape:

- `license: "MIT"` and a copied per-package `LICENSE`
- `sideEffects: false` so bundlers can tree-shake aggressively
- `publishConfig: { access: "public" }`
- `files: ["dist", "README.md", "LICENSE"]` (plus `templates` for the CLI)
- a dual `exports` map:

  ```jsonc
  {
    ".": {
      "import":  { "types": "./dist/index.d.ts",  "default": "./dist/index.js"  },
      "require": { "types": "./dist/index.d.cts", "default": "./dist/index.cjs" }
    }
  }
  ```

The script is idempotent and never touches `dependencies`.
`scripts/generate-readmes.mjs` guarantees every package has a README, generating
one from the package name and description only when it is missing.

## Packing

`scripts/pack-tarballs.mjs` builds a `name → version` map across the workspace,
then for each public package rewrites every internal `workspace:*` / `workspace:^`
range to the concrete version, stages exactly the declared `files`, and runs
`npm pack`. The result is a directory of `.tgz` tarballs that reference each
other by real semver — no `workspace:` protocol survives into a shipped package.

You can confirm this on any tarball:

```bash
tar -xzOf dist-tarballs/streetui-renderer-*.tgz package/package.json | grep workspace:
# (no output = clean)
```

## The package-quality gate: external consumer smoke test

`scripts/consumer-smoke.mjs` is the authoritative gate. It:

1. creates a temporary project **outside** the monorepo,
2. installs all packed tarballs together with
   `npm install --offline --no-audit --no-fund --no-package-lock`,
3. writes an ESM consumer and a CJS consumer that each import
   `@streetui/dsl`, `@streetui/state`, `@streetui/compiler`, and
   `@streetui/renderer`, build a page, and call `renderToString(compile(app))`,
4. runs both with Node and asserts the rendered HTML,
5. cleans up.

Because the install is offline with no `workspace:` ranges and no symlinks, a
pass proves the packages are genuinely self-describing and inter-resolvable —
the same way a registry install would behave. Installing all tarballs in one
command lets npm satisfy the inter-package dependencies from the local set.

The CLI package is intentionally excluded from the consumer framework test: it
depends on `esbuild`, a native binary that is fetched from the registry at
install time. Its packaging metadata is still validated by the steps above.

## Current limitations

- **No registry publish was performed.** This environment cannot reach a
  package registry, so nothing was pushed and no "install from registry" claim
  is made. The offline tarball consumption is the strongest achievable proof and
  it passes.
- **Coordinated version.** All public packages publish at a single coordinated
  version (`1.0.0` for the stable release); see
  [`release-process.md`](./release-process.md) and
  [`api-v1.0.md`](./api-v1.0.md). There are no breaking changes to the public API
  in the 1.0 stabilization.
