import { defineConfig } from 'tsup';

export default defineConfig({
  // Browser entry (client hydration) and server entry (SSR) are built separately;
  // never averaged, never bundled into one artifact.
  entry: ['src/index.ts', 'src/browser-entry.ts', 'src/server-entry.ts'],
  format: ['esm'],
  // The browser entry is loaded directly by index.html, so the published
  // framework must be bundled into the client artifact rather than left as a
  // bare `streetui` import that only a Node/package-aware bundler can resolve.
  noExternal: ['streetui'],
  dts: false,
  sourcemap: true,
  clean: true,
  splitting: false,
});
