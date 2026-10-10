#!/usr/bin/env node
// Standalone build script — works both locally and on Vercel.
// Uses esbuild directly so no tsup/monorepo path resolution is needed.
import { build } from 'esbuild';
import { rmSync, mkdirSync } from 'fs';

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist', { recursive: true });

// Browser bundle — streetui inlined, minified
await build({
  entryPoints: ['src/browser-entry.ts'],
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  outfile: 'dist/browser-entry.js',
  sourcemap: true,
  minify: true,
  logLevel: 'info',
});

// Server entries — streetui external (resolved from node_modules at runtime)
await build({
  entryPoints: ['src/index.ts', 'src/server-entry.ts'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'es2022',
  outdir: 'dist',
  sourcemap: true,
  external: ['node:*'],
  packages: 'bundle',
  logLevel: 'info',
});

console.log('Build complete.');
