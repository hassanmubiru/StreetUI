#!/usr/bin/env node
/**
 * Verify packed tarballs are complete and installable BEFORE publishing.
 *
 * `npm pack` will happily produce a tarball whose package.json points at files
 * that are not inside it. The 3.2.0 release shipped exactly that: 11 packages
 * referenced `index.d.ts` / `index.d.cts` that were absent (consumer-visible
 * TS7016). This script extracts every tarball and fails on:
 *
 *   1. a missing `main` / `module` / `types` / `bin` / `exports` target,
 *   2. a `workspace:` protocol string surviving in the packed manifest,
 *   3. a `file:` / `link:` / `portal:` dependency,
 *   4. a missing README.md or LICENSE,
 *   5. coordinated packages not sharing one version,
 *   6. a missing required subpath export or `files` entry.
 *
 * Run: node scripts/verify-tarballs.mjs [tarballDir]
 */
import { readdirSync, readFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import {
  PUBLIC_DIRS,
  COORDINATED_DIRS,
  packageName,
  dirForName,
  expectedLicense,
  REQUIRED_SUBPATHS,
  REQUIRED_FILES,
} from './lib/public-packages.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const tarDir = resolve(process.argv[2] ?? join(here, '..', 'dist-tarballs'));

/** Extract one tarball into a temp dir and return its `package/` root. */
function extract(tgz) {
  const dir = mkdtempSync(join(tmpdir(), 'streetui-verify-'));
  execFileSync('tar', ['-xzf', tgz, '-C', dir], { stdio: ['ignore', 'pipe', 'pipe'] });
  return { dir, pkgRoot: join(dir, 'package') };
}

function targetsOf(pkg) {
  const targets = new Set();
  for (const field of ['main', 'module', 'types', 'typings']) {
    if (typeof pkg[field] === 'string') targets.add(pkg[field]);
  }
  const walk = (value) => {
    if (typeof value === 'string') {
      if (value.startsWith('./')) targets.add(value);
      return;
    }
    if (Array.isArray(value)) {
      for (const entry of value) walk(entry);
      return;
    }
    if (value && typeof value === 'object') for (const entry of Object.values(value)) walk(entry);
  };
  if (pkg.exports !== undefined) walk(pkg.exports);
  if (typeof pkg.bin === 'string') targets.add(pkg.bin);
  else if (pkg.bin && typeof pkg.bin === 'object') {
    for (const entry of Object.values(pkg.bin)) if (typeof entry === 'string') targets.add(entry);
  }
  return [...targets];
}

const tarballs = readdirSync(tarDir).filter((f) => f.endsWith('.tgz')).sort();
if (tarballs.length === 0) {
  console.error(`No tarballs in ${tarDir}. Run: node scripts/pack-tarballs.mjs`);
  process.exit(1);
}

const problems = [];
const versions = new Map();
const seen = new Set();
const cleanup = [];

for (const file of tarballs) {
  const { dir, pkgRoot } = extract(join(tarDir, file));
  cleanup.push(dir);
  const manifestPath = join(pkgRoot, 'package.json');
  if (!existsSync(manifestPath)) {
    problems.push(`${file}: tarball has no package.json`);
    continue;
  }
  const pkg = JSON.parse(readFileSync(manifestPath, 'utf8'));
  seen.add(pkg.name);

  // 1. declared targets exist inside the tarball.
  for (const target of targetsOf(pkg)) {
    if (!existsSync(join(pkgRoot, target))) problems.push(`${pkg.name}@${pkg.version}: missing ${target} in tarball`);
  }

  // 2. no workspace: protocol survives.
  const serialised = JSON.stringify(pkg);
  if (serialised.includes('"workspace:')) problems.push(`${pkg.name}@${pkg.version}: "workspace:" protocol survived packing`);

  // 3. no local-source protocols.
  for (const field of ['dependencies', 'peerDependencies', 'optionalDependencies']) {
    for (const [dep, spec] of Object.entries(pkg[field] ?? {})) {
      if (/^(file:|link:|portal:)/.test(String(spec))) {
        problems.push(`${pkg.name}@${pkg.version}: ${dep}@${spec} is not publishable`);
      }
    }
  }

  // 4. docs.
  if (!existsSync(join(pkgRoot, 'README.md'))) problems.push(`${pkg.name}@${pkg.version}: README.md missing`);
  if (!existsSync(join(pkgRoot, 'LICENSE'))) problems.push(`${pkg.name}@${pkg.version}: LICENSE missing`);

  // 6. required subpaths / files.
  const dirName = dirForName(pkg.name);
  for (const subpath of REQUIRED_SUBPATHS[dirName] ?? []) {
    if (!pkg.exports || !(subpath in pkg.exports)) problems.push(`${pkg.name}@${pkg.version}: exports["${subpath}"] missing`);
  }
  for (const entry of REQUIRED_FILES[dirName] ?? []) {
    if (!Array.isArray(pkg.files) || !pkg.files.includes(entry)) problems.push(`${pkg.name}@${pkg.version}: files is missing "${entry}"`);
  }

  // license policy.
  const license = expectedLicense(dirName);
  if (pkg.license !== license) problems.push(`${pkg.name}@${pkg.version}: license is ${JSON.stringify(pkg.license)}, expected "${license}"`);

  if (COORDINATED_DIRS.includes(dirName)) versions.set(pkg.name, pkg.version);
}

// 5. lockstep versions.
const distinct = new Set(versions.values());
if (distinct.size > 1) {
  problems.push(`coordinated packages span versions: ${[...distinct].sort().join(', ')}`);
}

// every expected package is present.
for (const dir of PUBLIC_DIRS) {
  const name = packageName(dir);
  if (!seen.has(name)) problems.push(`${name}: no tarball found in ${tarDir}`);
}

for (const dir of cleanup) rmSync(dir, { recursive: true, force: true });

if (problems.length > 0) {
  for (const problem of problems) console.error(`  [error] ${problem}`);
  console.error(`\nTARBALL VERIFICATION FAILED — ${problems.length} problem(s)`);
  process.exit(1);
}

const version = distinct.size === 1 ? ` @ ${[...distinct][0]}` : '';
console.log(`TARBALL VERIFICATION OK — ${tarballs.length} tarballs${version}`);
console.log(`  ${[...seen].sort().join(', ')}`);
