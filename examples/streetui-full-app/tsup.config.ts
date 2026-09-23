import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/browser-entry.ts', 'src/routed.ts'],
  format: ['esm'],
  dts: false,
  sourcemap: true,
  clean: true,
  splitting: false,
});
