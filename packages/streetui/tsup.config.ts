import { defineConfig } from 'tsup';

/**
 * The unified `streetui` package is a *bundling* build: every internal
 * `@streetui/*` module is inlined into this package's `dist/` so that a
 * consumer who runs `npm install streetui` gets the whole framework with no
 * transitive `@streetui/*` dependencies to install.
 *
 * - `noExternal: [/^@streetui\//]` — esbuild inlines the JS of every internal
 *   package into the emitted bundles.
 * - `dts: { resolve: [/^@streetui\//] }` — rollup-dts follows and inlines the
 *   *type* declarations of the internal packages too (plain `dts: true` would
 *   emit passthrough `export * from '@streetui/x'` re-exports and leak internal
 *   paths into the public `.d.ts`). A post-build scrub (`scripts/scrub-dts.mjs`)
 *   rewrites any remaining `@streetui/*` mentions that survive inside JSDoc
 *   comments so the shipped declarations reference only `streetui`.
 *
 * `esbuild` is the sole runtime dependency (used by the bundled CLI's build
 * command) and stays external. Node builtins are external by default.
 */
export default defineConfig({
  entry: {
    index: 'src/index.ts',
    server: 'src/server.ts',
    testing: 'src/testing.ts',
    bin: 'src/bin.ts',
    'create-bin': 'src/create-bin.ts',
  },
  format: ['esm', 'cjs'],
  dts: { resolve: [/^@streetui\//] },
  tsconfig: 'tsconfig.build.json',
  sourcemap: true,
  clean: true,
  splitting: false,
  noExternal: [/^@streetui\//],
  external: ['esbuild'],
});
