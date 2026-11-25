#!/usr/bin/env node
/**
 * StreetUI publishing-metadata policy.
 *
 * Idempotently applies the fields every public StreetUI package must carry to be
 * safely publishable/consumable from a registry or a packed tarball:
 *
 *   - files:        whitelist what ships (dist + README + LICENSE, + templates
 *                   where the package ships them). Prevents src/tests/configs/
 *                   turbo-logs/temp files leaking into the tarball.
 *   - license:      per-package (MIT for the coordinated set, Apache-2.0 for the
 *                   `create-streetui` initializer).
 *   - sideEffects:  false — every coordinated runtime package is side-effect
 *                   free, so bundlers may tree-shake consumers.
 *   - publishConfig:{ access: "public" } — scoped packages default to restricted.
 *   - exports:      correct dual-module condition order with per-condition types
 *                   (import → .d.ts, require → .d.cts) matching what tsup emits.
 *
 * ADDITIVE BY CONTRACT: an existing subpath export (`streetui` `./server`,
 * `./testing`, `./package.json`; `@streetui/compiler` `./diagnostics`) and an
 * existing `files` entry (`templates`) are never dropped. A previous version of
 * this script replaced `exports` wholesale with only `"."`, which would have
 * silently removed published subpaths. Anything already correct is reported, not
 * rewritten.
 *
 * It does NOT touch `dependencies` (workspace:* is correct inside the monorepo);
 * the workspace:* → concrete-version rewrite happens only at pack time in
 * pack-tarballs.mjs, exactly as `pnpm publish` would do.
 *
 * Run: node scripts/apply-publish-metadata.mjs [--check]
 *   --check  Report drift and exit non-zero instead of writing.
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PUBLIC_DIRS,
  COORDINATED_DIRS,
  packageName,
  expectedLicense,
  REQUIRED_SUBPATHS,
  REQUIRED_FILES,
} from './lib/public-packages.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PKGS = join(ROOT, 'packages');
const CHECK = process.argv.includes('--check');

const LICENSE_TEXT = readFileSync(join(ROOT, 'LICENSE'), 'utf8');

const INDEX_EXPORTS = {
  import: { types: './dist/index.d.ts', default: './dist/index.js' },
  require: { types: './dist/index.d.cts', default: './dist/index.cjs' },
};

function desiredFiles(dir) {
  const files = [];
  // `dist` only applies to packages that actually build one; the
  // `create-streetui` initializer ships a single `index.js`.
  if (existsSync(join(PKGS, dir, 'dist'))) files.push('dist');
  files.push('README.md', 'LICENSE');
  for (const extra of REQUIRED_FILES[dir] ?? []) {
    if (!files.includes(extra)) files.push(extra);
  }
  return files;
}

/**
 * Merge the required index condition into an existing exports map without
 * dropping any subpath. Returns the new map plus a list of changes.
 */
function mergeExports(dir, existing) {
  const changes = [];
  const next = existing && typeof existing === 'object' ? { ...existing } : {};
  if (next['.'] === undefined) {
    next['.'] = INDEX_EXPORTS;
    changes.push('exports["."] added');
  } else {
    const current = next['.'];
    const ok =
      current &&
      current.import && current.import.types === INDEX_EXPORTS.import.types &&
      current.import.default === INDEX_EXPORTS.import.default &&
      current.require && current.require.types === INDEX_EXPORTS.require.types &&
      current.require.default === INDEX_EXPORTS.require.default;
    if (!ok) {
      next['.'] = { ...(current ?? {}), ...INDEX_EXPORTS };
      changes.push('exports["."] normalised');
    }
  }
  for (const subpath of REQUIRED_SUBPATHS[dir] ?? []) {
    if (next[subpath] === undefined) {
      // Never invent a target; a missing required subpath is a defect to report.
      changes.push(`exports["${subpath}"] is missing (add the real target by hand)`);
    }
  }
  return { next, changes };
}

/** Stable key order so repeated runs are byte-identical. */
function orderManifest(pkg) {
  const ordered = {};
  for (const key of [
    'name', 'version', 'description', 'type', 'license', 'main', 'module', 'types',
    'bin', 'exports', 'files', 'scripts', 'dependencies', 'devDependencies',
    'peerDependencies', 'optionalDependencies', 'engines', 'keywords',
    'sideEffects', 'publishConfig', 'repository', 'homepage',
  ]) {
    if (pkg[key] !== undefined) ordered[key] = pkg[key];
  }
  for (const [key, value] of Object.entries(pkg)) {
    if (ordered[key] === undefined) ordered[key] = value;
  }
  return ordered;
}

let changed = 0;
const drift = [];
for (const dir of PUBLIC_DIRS) {
  const pkgPath = join(PKGS, dir, 'package.json');
  if (!existsSync(pkgPath)) {
    drift.push(`${packageName(dir)}: package.json is missing`);
    continue;
  }
  const original = readFileSync(pkgPath, 'utf8');
  const pkg = JSON.parse(original);
  const changes = [];

  const license = expectedLicense(dir);
  if (pkg.license !== license) {
    pkg.license = license;
    changes.push(`license → ${license}`);
  }
  if (COORDINATED_DIRS.includes(dir) && pkg.sideEffects !== false) {
    pkg.sideEffects = false;
    changes.push('sideEffects → false');
  }
  if (!pkg.publishConfig || pkg.publishConfig.access !== 'public') {
    pkg.publishConfig = { ...(pkg.publishConfig ?? {}), access: 'public' };
    changes.push('publishConfig.access → public');
  }

  const files = desiredFiles(dir);
  const currentFiles = Array.isArray(pkg.files) ? pkg.files : [];
  const mergedFiles = [...currentFiles];
  for (const entry of files) if (!mergedFiles.includes(entry)) mergedFiles.push(entry);
  if (JSON.stringify(mergedFiles) !== JSON.stringify(currentFiles)) {
    pkg.files = mergedFiles;
    changes.push('files whitelist completed');
  }

  if (COORDINATED_DIRS.includes(dir)) {
    const { next, changes: exportChanges } = mergeExports(dir, pkg.exports);
    if (exportChanges.some((c) => c.includes('missing'))) {
      drift.push(`${pkg.name}: ${exportChanges.filter((c) => c.includes('missing')).join('; ')}`);
    }
    if (exportChanges.some((c) => !c.includes('missing'))) {
      pkg.exports = next;
      changes.push(...exportChanges.filter((c) => !c.includes('missing')));
    }
  }

  if (changes.length === 0) continue;
  if (CHECK) {
    drift.push(`${pkg.name}: ${changes.join('; ')}`);
    continue;
  }
  writeFileSync(pkgPath, `${JSON.stringify(orderManifest(pkg), null, 2)}\n`);
  if (!existsSync(join(PKGS, dir, 'LICENSE'))) writeFileSync(join(PKGS, dir, 'LICENSE'), LICENSE_TEXT);
  changed++;
  console.log(`updated ${pkg.name}: ${changes.join('; ')}`);
}

if (CHECK) {
  if (drift.length === 0) {
    console.log(`publish metadata is up to date across ${PUBLIC_DIRS.length} packages.`);
    process.exit(0);
  }
  for (const line of drift) console.error(`  drift: ${line}`);
  console.error(`\n${drift.length} package(s) need metadata attention.`);
  process.exit(1);
}

console.log(`\n${changed} package(s) updated.`);
