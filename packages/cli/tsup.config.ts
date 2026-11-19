import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/bin.ts', 'src/create-bin.ts'],
  format: ['esm', 'cjs'],
  dts: { entry: 'src/index.ts' },
  sourcemap: true,
  clean: true,
  splitting: false,
  // TypeScript is the only required runtime dependency and stays external
// (resolved from the project or this package's node_modules at run time). The
// framework's own package build still uses tsup's internal esbuild, but the
// application toolchain does not. Playwright is an optional dev-only tool used
// by `streetui doctor`; it is never a runtime dependency and stays external.
  external: ['typescript', 'playwright', 'playwright-core'],
});
