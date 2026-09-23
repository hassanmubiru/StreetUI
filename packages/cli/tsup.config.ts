import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/bin.ts', 'src/create-bin.ts'],
  format: ['esm', 'cjs'],
  dts: { entry: 'src/index.ts' },
  sourcemap: true,
  clean: true,
  splitting: false,
  // esbuild is the only runtime dependency and stays external (resolved from
  // node_modules at run time); Node builtins are external by default.
  external: ['esbuild'],
});
