#!/usr/bin/env node
/**
 * StreetUI publishing-metadata policy (v0.8).
 *
 * Idempotently applies the fields every PUBLIC StreetUI package must carry to be
 * safely publishable/consumable from a registry or a packed tarball:
 *
 *   - files:        whitelist what ships (dist + README + LICENSE, + templates
 *                   for the CLI). Prevents src/tests/configs/turbo-logs/temp
 *                   files leaking into the tarball.
 *   - license:      "MIT" (+ a copied LICENSE file per package).
 *   - sideEffects:  false — every runtime package is side-effect free, so
 *                   bundlers may tree-shake consumers.
 *   - publishConfig:{ access: "public" } — scoped packages default to restricted.
 *   - exports:      correct dual-module condition order with per-condition types
 *                   (import → .d.ts, require → .d.cts) matching what tsup emits.
 *
 * It does NOT touch `dependencies` (workspace:* is correct inside the monorepo);
 * the workspace:* → concrete-version rewrite happens only at pack time in
 * pack-tarballs.mjs, exactly as `pnpm publish` would do.
 *
 * Run: node scripts/apply-publish-metadata.mjs
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PKGS = join(ROOT, 'packages');

// Packages that are intended to be published. `benchmarks` is private (perf
// harness), and examples/apps are private applications — none are listed here.
const PUBLIC = new Set([
  'core', 'state', 'graph', 'dsl', 'compiler', 'runtime', 'events', 'scheduler',
  'dom', 'renderer', 'router', 'forms', 'i18n', 'context', 'devtools', 'testing',
  'cli',
]);

const LICENSE_TEXT = readFileSync(join(ROOT, 'LICENSE'), 'utf8');

let changed = 0;
for (const dir of readdirSync(PKGS)) {
  if (!PUBLIC.has(dir)) continue;
  const pkgPath = join(PKGS, dir, 'package.json');
  if (!existsSync(pkgPath)) continue;
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));

  pkg.license = 'MIT';
  pkg.sideEffects = false;
  pkg.publishConfig = { access: 'public' };

  const files = ['dist', 'README.md', 'LICENSE'];
  if (dir === 'cli') files.push('templates');
  pkg.files = files;

  // Dual-module exports with per-condition types. tsup emits index.d.ts (ESM)
  // and index.d.cts (CJS).
  pkg.exports = {
    '.': {
      import: { types: './dist/index.d.ts', default: './dist/index.js' },
      require: { types: './dist/index.d.cts', default: './dist/index.cjs' },
    },
  };

  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

  // Ship a LICENSE with every package.
  const lic = join(PKGS, dir, 'LICENSE');
  if (!existsSync(lic)) writeFileSync(lic, LICENSE_TEXT);

  changed++;
  console.log(`updated ${pkg.name}`);
}
console.log(`\n${changed} public packages updated.`);
