#!/usr/bin/env node
/**
 * StreetUI 1.0.0 — publish all 17 public packages to npm.
 *
 * Publishes the pre-packed tarballs from dist-tarballs/ in dependency order
 * so downstream packages can resolve their @streetui/* peers from the registry
 * immediately. All packages are at the same coordinated version (1.0.0), so
 * the ordering is only about registry propagation latency — we still publish
 * leaves first.
 *
 * Pre-conditions (enforced before any publish):
 *   1. npm whoami succeeds  — you are logged in
 *   2. dist-tarballs/ exists with all 17 tarballs
 *   3. release-check passes (0 errors, 0 warnings)
 *
 * Usage:
 *   node scripts/publish-packages.mjs [--dry-run] [--tag <dist-tag>]
 *
 *   --dry-run  Runs all pre-checks and prints what would publish but does not
 *              actually call `npm publish`.
 *   --tag      npm dist-tag (default: latest)
 *
 * Exit code 0 = all packages published (or dry-run passed).
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, execSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TARBALL_DIR = join(ROOT, 'dist-tarballs');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const tagIdx = args.indexOf('--tag');
const DIST_TAG = tagIdx >= 0 && args[tagIdx + 1] ? args[tagIdx + 1] : 'latest';

console.log('📦 StreetUI 1.4.0 — npm publish');
console.log('================================');
if (DRY_RUN) console.log('⚠️  DRY RUN — no packages will be published\n');

// ── Publish order: leaves → dependents → CLI last, unified streetui last ────
// Core primitives first, then compilers/renderers, then integrations, then CLI,
// then the unified streetui package which bundles everything.
const PUBLISH_ORDER = [
  // Tier 1 — zero internal deps
  '@streetui/core',
  '@streetui/events',
  '@streetui/scheduler',
  // Tier 2 — depend only on tier 1
  '@streetui/state',
  '@streetui/graph',
  // Tier 3 — depend on tiers 1-2
  '@streetui/dsl',
  '@streetui/compiler',
  '@streetui/runtime',
  // Tier 4 — depend on tiers 1-3
  '@streetui/dom',
  '@streetui/renderer',
  // Tier 5 — integrations / extensions
  '@streetui/router',
  '@streetui/forms',
  '@streetui/i18n',
  '@streetui/context',
  '@streetui/devtools',
  '@streetui/testing',
  // CLI (native binary dep via esbuild)
  '@streetui/cli',
  // Unified single-package consumer entry (bundles everything above)
  'streetui',
];

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
if (!existsSync(TARBALL_DIR)) {
  console.error(`❌ dist-tarballs/ not found. Run: node scripts/pack-tarballs.mjs`);
  process.exit(1);
}

// Build name → tarball path map
const tarballMap = new Map();
for (const file of readdirSync(TARBALL_DIR)) {
  if (!file.endsWith('.tgz')) continue;
  const tgzPath = join(TARBALL_DIR, file);
  // Special case: unified package is streetui-1.0.0.tgz (no sub-pkg segment)
  if (/^streetui-\d+\.\d+\.\d+\.tgz$/.test(file)) {
    tarballMap.set('streetui', tgzPath);
    continue;
  }
  // All others: streetui-<pkg>-1.0.0.tgz → @streetui/<pkg>
  const match = /^streetui-(.+)-[\d.]+\.tgz$/.exec(file);
  if (!match) continue;
  const shortName = match[1];
  tarballMap.set(`@streetui/${shortName}`, tgzPath);
}

const missing = PUBLISH_ORDER.filter(n => !tarballMap.has(n));
if (missing.length > 0) {
  console.error(`❌ Missing tarballs for: ${missing.join(', ')}`);
  console.error('   Run: node scripts/pack-tarballs.mjs');
  process.exit(1);
}
console.log(`✅ All ${tarballMap.size} tarballs present\n`);

// ── Pre-check 3: release-check ───────────────────────────────────────────────
console.log('🔍 Running release check...');
try {
  execFileSync(
    'node',
    ['scripts/release-check.mjs', '--release-version', '1.4.0', '--channel', 'stable', '--manifest'],
    { cwd: ROOT, stdio: 'inherit' },
  );
  console.log('');
} catch {
  console.error('❌ Release check failed. Fix errors before publishing.');
  process.exit(1);
}

// ── Confirm intent ───────────────────────────────────────────────────────────
if (!DRY_RUN) {
  console.log(`🚀 Publishing ${PUBLISH_ORDER.length} packages to npm (dist-tag: ${DIST_TAG})`);
  console.log('   Packages: ' + PUBLISH_ORDER.map(n => n.replace('@streetui/', '')).join(', '));
  console.log('');
}

// ── Publish ──────────────────────────────────────────────────────────────────
const results = [];
let failed = 0;

for (const pkgName of PUBLISH_ORDER) {
  const tgz = tarballMap.get(pkgName);
  const shortName = pkgName.replace('@streetui/', '');

  if (DRY_RUN) {
    console.log(`  [dry-run] would publish ${pkgName}@1.4.0 from ${tgz}`);
    results.push({ name: pkgName, status: 'dry-run' });
    continue;
  }

  process.stdout.write(`  publishing ${pkgName}@1.4.0 ... `);
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
    // E403/E409 already-published is not a fatal error — package is on registry
    if (msg.includes('E403') || msg.includes('cannot publish over') || msg.includes('409')) {
      console.log('⚠️  already published (skip)');
      results.push({ name: pkgName, status: 'already-published' });
    } else {
      console.log(`❌ FAILED`);
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
  console.log(`\n✅ PUBLISH COMPLETE — ${results.filter(r => r.status === 'published').length} packages published to npm`);
  console.log(`   Verify: https://www.npmjs.com/package/@streetui/core`);
} else {
  console.error(`\n❌ PUBLISH INCOMPLETE — ${failed} package(s) failed`);
  process.exit(1);
}
