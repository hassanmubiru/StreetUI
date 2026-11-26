#!/usr/bin/env node
/**
 * StreetUI release-readiness check + machine-readable release manifest.
 *
 * This is the coordinated-release gate. It is NON-MUTATING — it only reads the
 * workspace and reports; it never edits a package.json, rewrites a version, or
 * publishes. Its job is to answer one question before a release — "is this set
 * of packages internally consistent, correctly aligned, and safe to
 * pack/publish?" — and to emit a machine-readable manifest of exactly what would
 * ship.
 *
 * Checks performed per package — [error] fails the gate, [warn] does not:
 *   1. Publish metadata: license, sideEffects:false, publishConfig.access:"public",
 *      a `files` whitelist, and (for the coordinated set) dual-module `exports`
 *      with per-condition types (import→.d.ts, require→.d.cts). [error]
 *   2. Every declared target actually exists on disk: `main`, `module`, `types`,
 *      every `exports` condition target, and every `bin` entry. This is what
 *      caught nothing in 3.2.0 — a declaration-less dist/ passed the old gate. [error]
 *   3. Required subpaths and `files` entries are preserved (e.g. `streetui`
 *      `./server`, `./testing`, `templates`). [error]
 *   4. Legal/doc files present on disk: README.md and LICENSE. [error]
 *   5. Internal `@streetui/*` deps resolve to a workspace package. [error]
 *   6. Internal deps use only `workspace:*` (concretisable at pack time) or a
 *      concrete semver satisfied by the target — never a `file:`/`link:`/
 *      `portal:` internal-source reference. [error]
 *   7. `dist/` (referenced by `exports`) exists. [error unless --allow-missing-dist]
 *
 * Cross-cutting:
 *   8. Version alignment: every coordinated package MUST share one release
 *      version. Divergence is an [error]. Pass --release-version <v> to also
 *      assert the shared version equals <v>. [error]
 *   9. The root (private) package.json version equals the coordinated release
 *      version, so the CI gate's `--release-version` can never disagree with
 *      the artifacts it is checking. [error]
 *
 * Usage:
 *   node scripts/release-check.mjs [--manifest <path>] [--release-version <v>]
 *                                  [--channel <name>] [--allow-missing-dist] [--quiet]
 */
import { readFileSync, existsSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
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

const args = process.argv.slice(2);
const quiet = args.includes('--quiet');
const allowMissingDist = args.includes('--allow-missing-dist');
function flag(name) {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : undefined;
}
const manifestPath = flag('--manifest')
  ? resolve(process.cwd(), flag('--manifest'))
  : join(ROOT, 'dist-tarballs', 'release-manifest.json');
const requiredVersion = flag('--release-version');
const channel = flag('--channel') ?? 'stable';

// ── Load every workspace package (public + private) into a name→pkg map. ──────

const byName = new Map(); // name → { dir, pkg }
for (const dir of readdirSync(PKGS)) {
  const f = join(PKGS, dir, 'package.json');
  if (!existsSync(f)) continue;
  const pkg = JSON.parse(readFileSync(f, 'utf8'));
  byName.set(pkg.name, { dir, pkg });
}

// ── Findings ──────────────────────────────────────────────────────────────

const findings = []; // { level: 'error'|'warn'|'info', pkg, message }
const record = (level, pkg, message) => findings.push({ level, pkg, message });

/** Minimal, dependency-free check that `version` satisfies a simple `range`. */
function satisfies(version, range) {
  if (range === '*' || range === 'latest' || range === '') return true;
  const m = /^([~^]?)(\d+)\.(\d+)\.(\d+)$/.exec(range.trim());
  if (!m) return true; // unknown/complex range — don't flag (out of scope)
  const [, op, MA, MI] = m;
  const v = /^(\d+)\.(\d+)\.(\d+)$/.exec(version.trim());
  if (!v) return false;
  if (op === '') return version.trim() === `${MA}.${MI}.${m[4]}`;
  if (op === '^') return v[1] === MA && (Number(v[2]) > Number(MI) || (v[2] === MI && Number(v[3]) >= Number(m[4])));
  if (op === '~') return v[1] === MA && v[2] === MI && Number(v[3]) >= Number(m[4]);
  return true;
}

/** Discover the current git commit, or null when unavailable. */
function gitCommit() {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString().trim();
  } catch {
    return null;
  }
}

/** Collect every file path a manifest declares as a shipped target. */
function declaredTargets(pkg) {
  const targets = new Set();
  for (const field of ['main', 'module', 'types', 'typings']) {
    if (typeof pkg[field] === 'string') targets.add(pkg[field]);
  }
  const walkExports = (value) => {
    if (typeof value === 'string') {
      if (value.startsWith('./')) targets.add(value);
      return;
    }
    if (Array.isArray(value)) {
      for (const entry of value) walkExports(entry);
      return;
    }
    if (value && typeof value === 'object') {
      for (const entry of Object.values(value)) walkExports(entry);
    }
  };
  if (pkg.exports !== undefined) walkExports(pkg.exports);
  if (pkg.bin !== undefined) {
    if (typeof pkg.bin === 'string') targets.add(pkg.bin);
    else if (pkg.bin && typeof pkg.bin === 'object') {
      for (const entry of Object.values(pkg.bin)) {
        if (typeof entry === 'string') targets.add(entry);
      }
    }
  }
  return [...targets];
}

// ── Build the manifest + run checks per public package. ─────────────────────

const manifestPackages = [];

for (const dir of PUBLIC_DIRS) {
  const pkgDir = join(PKGS, dir);
  const manifestFile = join(pkgDir, 'package.json');
  if (!existsSync(manifestFile)) {
    record('error', packageName(dir), 'package directory or package.json is missing');
    continue;
  }
  const pkg = JSON.parse(readFileSync(manifestFile, 'utf8'));
  const name = pkg.name;
  const coordinated = COORDINATED_DIRS.includes(dir);

  // 1. Publish metadata.
  const license = expectedLicense(dir);
  if (pkg.license !== license) record('error', name, `license must be "${license}" (found ${JSON.stringify(pkg.license)})`);
  if (coordinated && pkg.sideEffects !== false) record('error', name, 'sideEffects must be false for tree-shaking');
  if (!pkg.publishConfig || pkg.publishConfig.access !== 'public') record('error', name, 'publishConfig.access must be "public"');
  if (!Array.isArray(pkg.files) || pkg.files.length === 0) record('error', name, 'files whitelist is missing');
  if (coordinated) {
    const exp = pkg.exports && pkg.exports['.'];
    const okExports =
      exp && exp.import && exp.import.types && exp.import.default && exp.require && exp.require.types && exp.require.default;
    if (!okExports) record('error', name, 'exports["."] must declare import{types,default} and require{types,default}');
  } else if (!pkg.exports && !pkg.bin) {
    record('error', name, 'a package must declare exports or bin');
  }

  // 2. Declared targets must exist (this is the D-1 guard).
  const missingTargets = declaredTargets(pkg).filter((target) => !existsSync(join(pkgDir, target)));
  for (const target of missingTargets) {
    record('error', name, `declared file ${target} is missing on disk — rebuild before packing`);
  }

  // 3. Required subpaths / files survive metadata rewriting.
  for (const subpath of REQUIRED_SUBPATHS[dir] ?? []) {
    if (!pkg.exports || !(subpath in pkg.exports)) {
      record('error', name, `exports must keep the "${subpath}" subpath`);
    }
  }
  for (const entry of REQUIRED_FILES[dir] ?? []) {
    if (!Array.isArray(pkg.files) || !pkg.files.includes(entry)) {
      record('error', name, `files must keep "${entry}"`);
    }
  }

  // 4. Legal/doc files present on disk.
  if (!existsSync(join(pkgDir, 'README.md'))) record('error', name, 'README.md is missing');
  if (!existsSync(join(pkgDir, 'LICENSE'))) record('error', name, 'LICENSE is missing');

  // 5/6. Internal dependency resolution + range/protocol safety.
  const internalDeps = {};
  for (const field of ['dependencies', 'peerDependencies', 'optionalDependencies']) {
    const deps = pkg[field];
    if (!deps) continue;
    for (const [depName, spec] of Object.entries(deps)) {
      const s = String(spec);
      // 6a. Forbid internal-source protocols for ANY dep — these never publish.
      if (/^(file:|link:|portal:)/.test(s)) {
        record('error', name, `dependency ${depName}@${s} uses an internal-source protocol — not publishable`);
      }
      if (!depName.startsWith('@streetui/')) continue;
      const target = byName.get(depName);
      if (!target) {
        record('error', name, `internal dep ${depName} does not resolve to a workspace package`);
        continue;
      }
      internalDeps[depName] = { spec: s, resolvedVersion: target.pkg.version };
      if (s.startsWith('workspace:')) {
        // Concretisable at pack time — nothing more to check.
      } else if (!satisfies(target.pkg.version, s)) {
        record('error', name, `internal dep ${depName}@${s} is not satisfied by ${target.pkg.version}`);
      }
    }
  }

  // 7. Build presence.
  const distExists = existsSync(join(pkgDir, 'dist'));
  const needsDist = Array.isArray(pkg.files) ? pkg.files.includes('dist') : true;
  if (needsDist) {
    if (!distExists) {
      if (allowMissingDist) record('warn', name, 'dist/ not present (pass without --allow-missing-dist to require it)');
      else record('error', name, 'dist/ not present — build before release-check');
    }
  }

  manifestPackages.push({
    name,
    dir,
    version: pkg.version,
    coordinated,
    private: pkg.private === true,
    files: pkg.files ?? [],
    exports: pkg.exports ?? null,
    internalDependencies: internalDeps,
    externalDependencies: Object.fromEntries(
      Object.entries(pkg.dependencies ?? {}).filter(([d]) => !d.startsWith('@streetui/')),
    ),
    distPresent: distExists,
  });
}

// 8. Version alignment across the coordinated release set.
const coordinated = manifestPackages.filter((p) => p.coordinated);
const versions = new Set(coordinated.map((p) => p.version));
if (versions.size > 1) {
  record('error', '(release set)',
    `coordinated packages span ${versions.size} versions: ${[...versions].sort().join(', ')} — a coordinated release requires one shared version`);
} else if (requiredVersion !== undefined) {
  const only = [...versions][0];
  if (only !== requiredVersion) {
    record('error', '(release set)', `coordinated packages are ${only} but --release-version demands ${requiredVersion}`);
  }
}

// The extra artifacts must not be ahead of the coordinated version.
if (versions.size === 1) {
  const coordinatedVersion = [...versions][0];
  for (const pkg of manifestPackages.filter((p) => !p.coordinated)) {
    if (pkg.version !== coordinatedVersion) {
      record('warn', pkg.name, `version ${pkg.version} differs from the coordinated ${coordinatedVersion}`);
    }
  }

  // 9. The root (private) manifest must track the release too. The 3.2.0 gate
  // read the release version from this file, so a stale root turned the gate
  // into a guaranteed failure — and nobody noticed because the mismatch looked
  // like a code defect. Keep the two aligned and fail loudly on drift.
  const rootManifest = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  if (rootManifest.version !== coordinatedVersion) {
    record('error', '(root)', `package.json is ${rootManifest.version} but the coordinated release is ${coordinatedVersion}`);
  }
}

// ── Emit manifest artifact (not a source edit). ─────────────────────────────

const errors = findings.filter((f) => f.level === 'error');
const warnings = findings.filter((f) => f.level === 'warn');

const manifest = {
  generatedAt: new Date().toISOString(),
  gitCommit: gitCommit(),
  channel,
  packageCount: manifestPackages.length,
  coordinatedCount: coordinated.length,
  versions: [...versions].sort(),
  ok: errors.length === 0,
  errorCount: errors.length,
  warningCount: warnings.length,
  findings,
  packages: manifestPackages.sort((a, b) => a.name.localeCompare(b.name)),
};

mkdirSync(dirname(manifestPath), { recursive: true });
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

if (!quiet) {
  console.log(`StreetUI release check — ${manifestPackages.length} packages (${coordinated.length} coordinated, channel: ${channel})`);
  for (const f of findings) console.log(`  [${f.level}] ${f.pkg}: ${f.message}`);
  console.log(`\nmanifest → ${manifestPath}`);
  console.log(errors.length === 0 ? `RELEASE CHECK OK (${warnings.length} warning(s))` : `RELEASE CHECK FAILED — ${errors.length} error(s)`);
}

process.exit(errors.length === 0 ? 0 : 1);
