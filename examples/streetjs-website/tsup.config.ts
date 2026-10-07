import { defineConfig } from 'tsup';

// Browser bundle is self-contained (streetui inlined). The server entry and the
// barrel keep `streetui` external and resolve it from node_modules at run time.
export default defineConfig([
  {
    entry: ['src/browser-entry.ts'],
    format: ['esm'],
    platform: 'browser',
    target: 'es2022',
    dts: false,
    sourcemap: true,
    clean: true,
    splitting: false,
    noExternal: ['streetui'],
    minify: true,
  },
  {
    entry: ['src/index.ts', 'src/server-entry.ts'],
    format: ['esm'],
    platform: 'node',
    target: 'es2022',
    dts: false,
    sourcemap: true,
    clean: false,
    splitting: false,
  },
]);
