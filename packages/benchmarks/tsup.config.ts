import { defineConfig } from 'tsup';

/**
 * The benchmark package is an internal, runnable tool — not a published library.
 * It compiles to ESM only and emits no `.d.ts` (nothing imports its build output;
 * type-checking is done separately via `tsc --noEmit`). `@streetui/*` workspace
 * deps and `happy-dom` stay external and resolve from node_modules at run time.
 */
export default defineConfig({
  entry: ['src/run.ts', 'src/index.ts'],
  format: ['esm'],
  target: 'node20',
  platform: 'node',
  dts: false,
  sourcemap: true,
  clean: true,
  splitting: false,
  // happy-dom is a CommonJS package that does dynamic `require()` of Node
  // built-ins; bundling it into ESM breaks at load. Keep it (and the workspace
  // @streetui deps) external so they resolve from node_modules at run time.
  external: ['happy-dom'],
});
