import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/browser-entry.ts',
    'src/routed.ts',
    'src/server-entry.ts',
    'src/bench-support.ts',
  ],
  format: ['esm'],
  dts: false,
  sourcemap: true,
  clean: true,
  splitting: false,
});
