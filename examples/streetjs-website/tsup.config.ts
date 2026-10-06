import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/server-entry.ts', 'src/browser-entry.ts'],
  format: ['esm'],
  target: 'es2022',
  outDir: 'dist',
  clean: true,
  minify: true,
  sourcemap: false,
  splitting: false,
  dts: false,
  external: ['streetui'],
});
