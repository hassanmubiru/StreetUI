#!/usr/bin/env node
/**
 * StreetUI release-readiness check + machine-readable release manifest.
 *
 * v1.0: this is the coordinated-release gate. It is still NON-MUTATING — it only
 * reads the workspace and reports; it never edits a package.json, rewrites a
 * version, or publishes. Its job is to answer one question before a release —
 * "is this set of packages internally consistent, correctly aligned, and safe to
 * pack/publish?" — and to emit a machine-readable manifest of exactly what would
 * ship.
 *
 * Checks performed (per public package) — [error] fails the gate, [warn] does not:
 *   1. Publish metadata: name, version, license MIT, sideEffects:false,
 *      publishConfig.access:"public", a `files` whitelist, and dual-module
 *      `exports` with per-condition types (import→.d.ts, require→.d.cts). [error]
 *   2. Legal/doc files present on disk: README.md and LICENSE. [error]
 *   3. Internal `@streetui/*` deps resolve to a workspace package. [error]
 *   4. Internal deps use only `workspace:*` (concretisable at pack time) or a
 *      concrete semver satisfied by the target — never a `file:`/`link:`/
 *      `portal:` internal-source reference. [error]
 *   5. `dist/` (referenced by `exports`) exists. [error unless --allow-missing-dist]
 *
 * Cross-cutting:
 *   6. Version alignment: every public package MUST share one coordinated release
 *      version. Divergence is now an [error] (was a warning through v0.9). Pass
 *      --release-version <v> to also assert the shared version equals <v>. [error]
 *
 * The manifest is an emitted ARTIFACT (default: dist-tarballs/release-manifest.json),
 * not a source edit. Exit code is non-zero iff any [error] check fails.
 *
 * Usage:
 *   node scripts/release-check.mjs [--manifest <path>] [--release-version <v>]
 *                                  [--channel <name>] [--allow-missing-dist] [--quiet]
 */
import { readFileSync, existsSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

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

/** Packages intended to be published (mirrors apply-publish-metadata / pack-tarballs). */
const PUBLIC = new Set([
  'core', 'state', 'graph', 'dsl', 'compiler', 'runtime', 'events', 'scheduler',
  'dom', 'renderer', 'router', 'forms', 'i18n', 'context', 'devtools', 'testing',
  'cli',
]);

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

// ── Build the manifest + run checks per public package. ─────────────────────

const manifestPackages = [];

for (const dir of readdirSync(PKGS)) {
  if (!PUBLIC.has(dir)) continue;
  const pkgDir = join(PKGS, dir);
  const pkg = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'));
  const name = pkg.name;

  // 1. Publish metadata.
  if (pkg.license !== 'MIT') record('error', name, `license must be "MIT" (found ${JSON.stringify(pkg.license)})`);
  if (pkg.sideEffects !== false) record('error', name, 'sideEffects must be false for tree-shaking');
  if (!pkg.publishConfig || pkg.publishConfig.access !== 'public') record('error', name, 'publishConfig.access must be "public"');
  if (!Array.isArray(pkg.files) || pkg.files.length === 0) record('error', name, 'files whitelist is missing');
  const exp = pkg.exports && pkg.exports['.'];
  const okExports =
    exp && exp.import && exp.import.types && exp.import.default && exp.require && exp.require.types && exp.require.default;
  if (!okExports) record('error', name, 'exports["."] must declare import{types,default} and require{types,default}');

  // 2. Legal/doc files present on disk.
  if (!existsSync(join(pkgDir, 'README.md'))) record('error', name, 'README.md is missing');
  if (!existsSync(join(pkgDir, 'LICENSE'))) record('error', name, 'LICENSE is missing');

  // 3/4. Internal dependency resolution + range/protocol safety.
  const internalDeps = {};
  for (const field of ['dependencies', 'peerDependencies', 'optionalDependencies']) {
    const deps = pkg[field];
    if (!deps) continue;
    for (const [depName, spec] of Object.entries(deps)) {
      const s = String(spec);
      // 4a. Forbid internal-source protocols for ANY dep — these never publish.
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

  // 5. Build presence.
  const distExists = existsSync(join(pkgDir, 'dist'));
  if (!distExists) {
    if (allowMissingDist) record('warn', name, 'dist/ not present (pass without --allow-missing-dist to require it)');
    else record('error', name, 'dist/ not present — build before release-check');
  }

  manifestPackages.push({
    name,
    version: pkg.version,
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

// 6. Version alignment across the public release set (now an ERROR).
const versions = new Set(manifestPackages.map((p) => p.version));
if (versions.size > 1) {
  record('error', '(release set)',
    `public packages span ${versions.size} versions: ${[...versions].sort().join(', ')} — a coordinated release requires one shared version`);
} else if (requiredVersion !== undefined) {
  const only = [...versions][0];
  if (only !== requiredVersion) {
    record('error', '(release set)', `public packages are ${only} but --release-version demands ${requiredVersion}`);
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
  console.log(`StreetUI release check — ${manifestPackages.length} public packages (channel: ${channel})`);
  for (const f of findings) console.log(`  [${f.level}] ${f.pkg}: ${f.message}`);
  console.log(`\nmanifest → ${manifestPath}`);
  console.log(errors.length === 0 ? `RELEASE CHECK OK (${warnings.length} warning(s))` : `RELEASE CHECK FAILED — ${errors.length} error(s)`);
}

process.exit(errors.length === 0 ? 0 : 1);

