#!/usr/bin/env node
/**
 * Pack every public StreetUI package into a real npm tarball, exactly as
 * `pnpm publish` would — including the `workspace:*` → concrete-version rewrite
 * that pnpm performs at publish time. The published/packed form must NOT contain
 * any `workspace:` protocol string, or it is uninstallable outside the monorepo.
 *
 * For each package we stage ONLY what its `files` field ships plus a rewritten
 * package.json, then run `npm pack` against that staging directory. The real
 * source tree is never mutated. Tarballs land in <out>/ (default:
 * ./dist-tarballs).
 *
 * STALENESS GUARD: packing does not build. This script fails when a package's
 * `dist/` is older than any file under `src/`, because that is exactly how the
 * 3.2.0 release shipped declaration-less tarballs (D-1). Build first:
 *
 *   node scripts/release-build.mjs && node scripts/pack-tarballs.mjs
 *
 * Run: node scripts/pack-tarballs.mjs [outDir] [--allow-stale]
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync, rmSync, cpSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { PUBLIC_DIRS, packageName } from './lib/public-packages.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PKGS = join(ROOT, 'packages');
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const ALLOW_STALE = process.argv.includes('--allow-stale');
const OUT = args[0] ? resolve(process.cwd(), args[0]) : join(ROOT, 'dist-tarballs');
const STAGE = join(OUT, '.staging');

// 1. Build the name → version map from the source packages.
const versions = new Map();
for (const dir of readdirSync(PKGS)) {
  const f = join(PKGS, dir, 'package.json');
  if (!existsSync(f)) continue;
  const p = JSON.parse(readFileSync(f, 'utf8'));
  versions.set(p.name, p.version);
}

/** Rewrite one `workspace:` specifier to a concrete registry range. */
function concretise(name, spec) {
  const v = versions.get(name);
  if (v === undefined) throw new Error(`No version known for workspace dep ${name}`);
  // workspace:* / workspace:~ / workspace:^  → pin to the exact current version.
  // (Packing a self-consistent set, exact is safest for offline install.)
  if (spec === 'workspace:*' || spec === 'workspace:~' || spec === 'workspace:^') return v;
  // workspace:^1.2.3 etc → keep the range operator, drop the protocol.
  const m = /^workspace:([~^]?)(.+)$/.exec(spec);
  if (m) return `${m[1]}${m[2]}`;
  return v;
}

function rewriteDeps(deps) {
  if (!deps) return deps;
  const out = {};
  for (const [name, spec] of Object.entries(deps)) {
    out[name] = String(spec).startsWith('workspace:') ? concretise(name, spec) : spec;
  }
  return out;
}

/** Newest mtime under `dir`, or 0 when it does not exist. */
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

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
mkdirSync(STAGE, { recursive: true });

const tarballs = [];
const entries = [];
for (const dir of PUBLIC_DIRS) {
  const srcDir = join(PKGS, dir);
  const pkg = JSON.parse(readFileSync(join(srcDir, 'package.json'), 'utf8'));

  const distDir = join(srcDir, 'dist');
  const needsDist = !Array.isArray(pkg.files) || pkg.files.includes('dist');
  if (needsDist && !existsSync(distDir)) {
    throw new Error(`${pkg.name} is not built (no dist/). Build first.`);
  }

  if (needsDist && !ALLOW_STALE) {
    const distMtime = newestMtime(distDir);
    const srcMtime = newestMtime(join(srcDir, 'src'));
    if (srcMtime > distMtime) {
      throw new Error(
        `${pkg.name}: dist/ is older than src/ — rebuild before packing ` +
          '(stale output is how the 3.2.0 declaration defect shipped).',
      );
    }
  }

  // Rewrite workspace deps → concrete versions. devDependencies are rewritten
  // too: a packed manifest must never contain a `workspace:` specifier, and
  // `pnpm publish` normalises every dependency field.
  pkg.dependencies = rewriteDeps(pkg.dependencies);
  pkg.devDependencies = rewriteDeps(pkg.devDependencies);
  pkg.peerDependencies = rewriteDeps(pkg.peerDependencies);
  pkg.optionalDependencies = rewriteDeps(pkg.optionalDependencies);

  // Stage exactly what `files` ships.
  const stage = join(STAGE, dir);
  rmSync(stage, { recursive: true, force: true });
  mkdirSync(stage, { recursive: true });
  for (const entry of pkg.files ?? ['dist']) {
    const from = join(srcDir, entry);
    if (existsSync(from)) cpSync(from, join(stage, entry), { recursive: true });
  }
  writeFileSync(join(stage, 'package.json'), JSON.stringify(pkg, null, 2) + '\n');

  // npm pack the staging dir → OUT.
  const out = execFileSync('npm', ['pack', '--pack-destination', OUT], {
    cwd: stage,
    encoding: 'utf8',
  });
  const tgz = out.trim().split('\n').pop().trim();
  tarballs.push(tgz);
  entries.push({ name: pkg.name, version: pkg.version, pkgDir: dir, tarball: tgz });
  console.log(`packed ${pkg.name}@${pkg.version} → ${tgz}`);
}

rmSync(STAGE, { recursive: true, force: true });
writeFileSync(join(OUT, 'tarballs.json'), JSON.stringify(entries, null, 2) + '\n');
console.log(`\n${tarballs.length} tarballs written to ${OUT}`);
