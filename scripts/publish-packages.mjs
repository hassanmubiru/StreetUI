#!/usr/bin/env node
/**
 * Publish all StreetUI packages to npm.
 *
 * Publishes the pre-packed tarballs from dist-tarballs/ in dependency order so
 * downstream packages can resolve their @streetui/* peers from the registry
 * immediately. Every package is at the same coordinated version, so ordering is
 * only about registry propagation latency — leaves still go first.
 *
 * The tarball list comes from `dist-tarballs/tarballs.json`, which
 * `pack-tarballs.mjs` writes from the shared package list. No version, package
 * name, or tarball filename is hardcoded here.
 *
 * Pre-conditions (enforced before any publish):
 *   1. npm whoami succeeds — you are logged in.
 *   2. dist-tarballs/tarballs.json lists a tarball for every release package.
 *   3. release-check passes for the coordinated version.
 *
 * Usage:
 *   node scripts/publish-packages.mjs [--dry-run] [--tag <dist-tag>]
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { PUBLIC_DIRS, COORDINATED_DIRS, packageName } from './lib/public-packages.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TARBALL_DIR = join(ROOT, 'dist-tarballs');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const tagIdx = args.indexOf('--tag');
const DIST_TAG = tagIdx >= 0 && args[tagIdx + 1] ? args[tagIdx + 1] : 'latest';

// ── Resolve the coordinated version from the workspace (never hardcoded). ────
const versions = new Map();
for (const dir of PUBLIC_DIRS) {
  const manifest = join(ROOT, 'packages', dir, 'package.json');
  if (!existsSync(manifest)) continue;
  const pkg = JSON.parse(readFileSync(manifest, 'utf8'));
  versions.set(pkg.name, pkg.version);
}
const coordinatedVersions = new Set(
  COORDINATED_DIRS.map((dir) => versions.get(packageName(dir))).filter((v) => v !== undefined),
);
const version = coordinatedVersions.size === 1 ? [...coordinatedVersions][0] : undefined;
if (version === undefined) {
  console.error(`❌ Coordinated packages span multiple versions: ${[...coordinatedVersions].join(', ')}`);
  process.exit(1);
}

console.log(`📦 StreetUI ${version} — npm publish`);
console.log('================================');
if (DRY_RUN) console.log('⚠️  DRY RUN — no packages will be published\n');

// ── Pre-check 1: npm auth ────────────────────────────────────────────────────
console.log('🔐 Checking npm authentication...');
try {
  const user = execFileSync('npm', ['whoami'], { encoding: 'utf8' }).trim();
  console.log(`✅ Logged in as: ${user}\n`);
} catch {
  console.error('❌ Not logged in to npm. Run: npm login');
  process.exit(1);
}

// ── Pre-check 2: tarballs present ───────────────────────────────────────────
console.log('📁 Checking tarballs...');
const indexFile = join(TARBALL_DIR, 'tarballs.json');
if (!existsSync(indexFile)) {
  console.error(`❌ ${indexFile} not found. Run: node scripts/pack-tarballs.mjs`);
  process.exit(1);
}
const entries = JSON.parse(readFileSync(indexFile, 'utf8'));
const tarballMap = new Map(entries.map((entry) => [entry.name, join(TARBALL_DIR, entry.tarball)]));

const missing = PUBLIC_DIRS.map(packageName).filter((name) => !tarballMap.has(name));
if (missing.length > 0) {
  console.error(`❌ Missing tarballs for: ${missing.join(', ')}`);
  console.error('   Run: node scripts/pack-tarballs.mjs');
  process.exit(1);
}
const mismatched = entries.filter((entry) => versions.get(entry.name) !== entry.version);
if (mismatched.length > 0) {
  console.error(`❌ Tarball versions do not match the workspace: ${mismatched.map((e) => `${e.name}@${e.version}`).join(', ')}`);
  console.error('   Re-run: node scripts/pack-tarballs.mjs');
  process.exit(1);
}
console.log(`✅ All ${tarballMap.size} tarballs present (${version})\n`);

// ── Pre-check 3: release-check ───────────────────────────────────────────────
console.log('🔍 Running release check...');
try {
  execFileSync(
    'node',
    ['scripts/release-check.mjs', '--release-version', version, '--channel', 'stable'],
    { cwd: ROOT, stdio: 'inherit' },
  );
  console.log('');
} catch {
  console.error('❌ Release check failed. Fix errors before publishing.');
  process.exit(1);
}

// ── Confirm intent ───────────────────────────────────────────────────────────
const order = PUBLIC_DIRS.map(packageName);
if (!DRY_RUN) {
  console.log(`🚀 Publishing ${order.length} packages to npm (dist-tag: ${DIST_TAG})`);
  console.log('   Packages: ' + order.map((n) => n.replace('@streetui/', '')).join(', '));
  console.log('');
}

// ── Publish ──────────────────────────────────────────────────────────────────
const results = [];
let failed = 0;

for (const pkgName of order) {
  const tgz = tarballMap.get(pkgName);

  if (DRY_RUN) {
    console.log(`  [dry-run] would publish ${pkgName}@${version} from ${tgz}`);
    results.push({ name: pkgName, status: 'dry-run' });
    continue;
  }

  process.stdout.write(`  publishing ${pkgName}@${version} ... `);
  try {
    execFileSync(
      'npm',
      ['publish', tgz, '--access', 'public', '--tag', DIST_TAG, '--no-audit'],
      { cwd: ROOT, encoding: 'utf8' },
    );
    console.log('✅');
    results.push({ name: pkgName, status: 'published' });
  } catch (err) {
    const msg = err.stderr?.toString().trim() ?? err.message;
    // E403/E409 already-published is not a fatal error — package is on registry.
    if (msg.includes('E403') || msg.includes('cannot publish over') || msg.includes('409')) {
      console.log('⚠️  already published (skip)');
      results.push({ name: pkgName, status: 'already-published' });
    } else {
      console.log('❌ FAILED');
      console.error(`     ${msg}`);
      results.push({ name: pkgName, status: 'failed', error: msg });
      failed++;
    }
  }
}

// ── Summary ──────────────────────────────────────────────────────────────────
console.log('\n📊 Publish Summary');
console.log('==================');
for (const r of results) {
  const icon = r.status === 'published' ? '✅' :
               r.status === 'already-published' ? '⚠️ ' :
               r.status === 'dry-run' ? '🔵' : '❌';
  console.log(`  ${icon} ${r.name} — ${r.status}`);
}

if (DRY_RUN) {
  console.log(`\n✅ Dry run complete — ${results.length} packages ready to publish`);
  console.log('   Run without --dry-run to publish for real.');
} else if (failed === 0) {
  console.log(`\n✅ PUBLISH COMPLETE — ${results.filter((r) => r.status === 'published').length} packages published to npm`);
  console.log('   Verify: https://www.npmjs.com/package/@streetui/core');
} else {
  console.error(`\n❌ PUBLISH INCOMPLETE — ${failed} package(s) failed`);
  process.exit(1);
}
