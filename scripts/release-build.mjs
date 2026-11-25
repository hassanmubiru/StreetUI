#!/usr/bin/env node
/**
 * Release build — clean, build, and scrub declarations for every public package
 * in dependency order, then assert the declaration files the manifests reference
 * actually exist.
 *
 * This exists because `pack-tarballs.mjs` deliberately does not build (it packs
 * what is on disk), and the 3.2.0 release packed stale `dist/` output that was
 * missing `index.d.ts`/`index.d.cts` for 11 packages.
 *
 * Run: node scripts/release-build.mjs [--force]
 *   --force  Rebuild even when dist/ already looks newer than src/.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { PUBLIC_DIRS } from './lib/public-packages.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PKGS = join(ROOT, 'packages');
const FORCE = process.argv.includes('--force');

// `node_modules/.bin/tsup` is a shell wrapper, not a JS file; resolve the real
// CLI entry so it can be spawned with the current Node binary.
const requireFromRoot = createRequire(join(ROOT, 'package.json'));
const TSUP_ENTRY = join(dirname(requireFromRoot.resolve('tsup/package.json')), 'dist', 'cli-default.js');

function newestMtime(dir) {
  let newest = 0;
  if (!existsSync(dir)) return newest;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) newest = Math.max(newest, newestMtime(full));
    else if (entry.isFile()) newest = Math.max(newest, statSync(full).mtimeMs);
  }
  return newest;
}

/** Every declaration file the manifest points at. */
function declaredDeclarations(pkg) {
  const declared = [];
  const walk = (value) => {
    if (typeof value === 'string') {
      if (value.endsWith('.d.ts') || value.endsWith('.d.cts')) declared.push(value);
      return;
    }
    if (Array.isArray(value)) {
      for (const entry of value) walk(entry);
      return;
    }
    if (value && typeof value === 'object') for (const entry of Object.values(value)) walk(entry);
  };
  if (pkg.types !== undefined) walk(pkg.types);
  if (pkg.exports !== undefined) walk(pkg.exports);
  return [...new Set(declared)];
}

const failures = [];
for (const dir of PUBLIC_DIRS) {
  const pkgDir = join(PKGS, dir);
  const pkg = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'));
  const needsDist = !Array.isArray(pkg.files) || pkg.files.includes('dist');
  if (!needsDist) continue;

  const distMtime = newestMtime(join(pkgDir, 'dist'));
  const srcMtime = newestMtime(join(pkgDir, 'src'));
  if (!FORCE && distMtime > srcMtime) {
    console.log(`skip   ${pkg.name} (dist is current)`);
    continue;
  }

  console.log(`build  ${pkg.name}`);
  try {
    execFileSync(process.execPath, [TSUP_ENTRY], { cwd: pkgDir, stdio: 'inherit' });
  } catch (error) {
    failures.push(`${pkg.name}: build failed (${error instanceof Error ? error.message.split('\n')[0] : String(error)})`);
    continue;
  }

  const missing = declaredDeclarations(pkg).filter((target) => !existsSync(join(pkgDir, target)));
  for (const target of missing) failures.push(`${pkg.name}: declared declaration ${target} was not emitted`);
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`  [error] ${failure}`);
  console.error(`\nRELEASE BUILD FAILED — ${failures.length} problem(s)`);
  process.exit(1);
}
console.log('\nRELEASE BUILD OK — every declared declaration exists.');
