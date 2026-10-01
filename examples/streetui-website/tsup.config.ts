import { defineConfig } from 'tsup';

export default defineConfig({
  // Browser entry (client hydration) and server entry (SSR) are built separately;
  // never averaged, never bundled into one artifact.
  entry: ['src/index.ts', 'src/browser-entry.ts', 'src/server-entry.ts'],
  format: ['esm'],
  dts: false,
  sourcemap: true,
  clean: true,
  splitting: false,
});
