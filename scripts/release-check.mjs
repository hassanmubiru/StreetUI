#!/usr/bin/env node
/**
 * StreetUI release-readiness check + machine-readable release manifest (v0.9 §23–§25).
 *
 * This is a NON-MUTATING gate: it only reads the workspace and reports. It never
 * edits a package.json, never rewrites versions, never publishes. Its job is to
 * answer one question before a release — "is this set of packages internally
 * consistent and safe to pack/publish?" — and to emit a machine-readable
 * manifest describing exactly what would ship.
 *
 * Checks performed (per public package):
 *   1. Publish metadata present & correct — name, version, license MIT,
 *      sideEffects:false, publishConfig.access:"public", a `files` whitelist,
 *      and dual-module `exports` with per-condition types (import→.d.ts,
 *      require→.d.cts). [error]
 *   2. Internal `workspace:*` dependencies resolve to a package that actually
 *      exists in the workspace. An unresolved internal dep is uninstallable
 *      outside the monorepo. [error]
 *   3. Concrete internal dependency ranges (non-workspace) are satisfiable by the
 *      depended package's current version. [error]
 *   4. Release version alignment across the public set — divergent versions are
 *      reported so a release owner can decide intentionally. [warn]
 *   5. Build presence — whether each package's `dist/` (referenced by `exports`)
 *      exists yet. Missing dist is expected before a build; reported as info. [info]
 *
 * The manifest is an emitted ARTIFACT (default: dist-tarballs/release-manifest.json),
 * not a source edit. Exit code is non-zero iff any [error] check fails.
 *
 * Usage:  node scripts/release-check.mjs [--manifest <path>] [--quiet]
 */
import { readFileSync, existsSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PKGS = join(ROOT, 'packages');

const args = process.argv.slice(2);
const quiet = args.includes('--quiet');
const manifestIdx = args.indexOf('--manifest');
const manifestPath =
  manifestIdx >= 0 && args[manifestIdx + 1]
    ? resolve(process.cwd(), args[manifestIdx + 1])
    : join(ROOT, 'dist-tarballs', 'release-manifest.json');

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

// ── Build the manifest + run checks per public package. ─────────────────────

const manifestPackages = [];

for (const dir of readdirSync(PKGS)) {
  if (!PUBLIC.has(dir)) continue;
  const entry = byName.get(byNameKeyForDir(dir));
  const pkg = entry ? entry.pkg : JSON.parse(readFileSync(join(PKGS, dir, 'package.json'), 'utf8'));
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

  // 2/3. Internal dependency resolution + range satisfiability.
  const internalDeps = {};
  for (const field of ['dependencies', 'peerDependencies', 'optionalDependencies']) {
    const deps = pkg[field];
    if (!deps) continue;
    for (const [depName, spec] of Object.entries(deps)) {
      if (!depName.startsWith('@streetui/')) continue;
      const target = byName.get(depName);
      if (!target) {
        record('error', name, `internal dep ${depName} does not resolve to a workspace package`);
        continue;
      }
      internalDeps[depName] = { spec, resolvedVersion: target.pkg.version };
      if (!String(spec).startsWith('workspace:') && !satisfies(target.pkg.version, String(spec))) {
        record('error', name, `internal dep ${depName}@${spec} is not satisfied by ${target.pkg.version}`);
      }
    }
  }

  // 5. Build presence.
  const distExists = existsSync(join(PKGS, dir, 'dist'));
  if (!distExists) record('info', name, 'dist/ not present yet (build before packing)');

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

function byNameKeyForDir(dir) {
  // Resolve a directory to its published package name by reading it once.
  const f = join(PKGS, dir, 'package.json');
  return JSON.parse(readFileSync(f, 'utf8')).name;
}

// 4. Version alignment across the public release set.
const versions = new Set(manifestPackages.map((p) => p.version));
if (versions.size > 1) {
  record(
    'warn',
    '(release set)',
    `public packages span ${versions.size} versions: ${[...versions].sort().join(', ')} — confirm this is intentional before a coordinated release`,
  );
}

// ── Emit manifest artifact (not a source edit). ─────────────────────────────

const errors = findings.filter((f) => f.level === 'error');
const warnings = findings.filter((f) => f.level === 'warn');

const manifest = {
  generatedAt: new Date().toISOString(),
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
  console.log(`StreetUI release check — ${manifestPackages.length} public packages`);
  for (const f of findings) console.log(`  [${f.level}] ${f.pkg}: ${f.message}`);
  console.log(`\nmanifest → ${manifestPath}`);
  console.log(errors.length === 0 ? `RELEASE CHECK OK (${warnings.length} warning(s))` : `RELEASE CHECK FAILED — ${errors.length} error(s)`);
}

process.exit(errors.length === 0 ? 0 : 1);

