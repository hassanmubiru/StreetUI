import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/diagnostics.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
});
