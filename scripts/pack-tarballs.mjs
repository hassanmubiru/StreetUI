#!/usr/bin/env node
/**
 * Pack every PUBLIC StreetUI package into a real npm tarball, exactly as
 * `pnpm publish` would — including the `workspace:*` → concrete-version rewrite
 * that pnpm performs at publish time. The published/packed form must NOT contain
 * any `workspace:` protocol string, or it is uninstallable outside the monorepo.
 *
 * For each package we stage ONLY what its `files` field ships (dist + README +
 * LICENSE, + templates for the cli) plus a rewritten package.json, then run
 * `npm pack` against that staging directory. The real source tree is never
 * mutated. Tarballs land in <out>/ (default: ./dist-tarballs).
 *
 * Run (after a full build):  node scripts/pack-tarballs.mjs [outDir]
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync, rmSync, cpSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PKGS = join(ROOT, 'packages');
const OUT = process.argv[2] ? join(process.cwd(), process.argv[2]) : join(ROOT, 'dist-tarballs');
const STAGE = join(OUT, '.staging');

const PUBLIC = new Set([
  'core', 'state', 'graph', 'dsl', 'compiler', 'runtime', 'events', 'scheduler',
  'dom', 'renderer', 'router', 'forms', 'i18n', 'context', 'devtools', 'testing',
  'cli',
  // Unified single-package consumer entry.
  'streetui',
]);

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

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
mkdirSync(STAGE, { recursive: true });

const tarballs = [];
for (const dir of readdirSync(PKGS)) {
  if (!PUBLIC.has(dir)) continue;
  const srcDir = join(PKGS, dir);
  const pkg = JSON.parse(readFileSync(join(srcDir, 'package.json'), 'utf8'));

  const distDir = join(srcDir, 'dist');
  if (!existsSync(distDir)) throw new Error(`${pkg.name} is not built (no dist/). Build first.`);

  // Rewrite workspace deps → concrete versions.
  pkg.dependencies = rewriteDeps(pkg.dependencies);
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
  console.log(`packed ${pkg.name}@${pkg.version} → ${tgz}`);
}

rmSync(STAGE, { recursive: true, force: true });
writeFileSync(join(OUT, 'tarballs.json'), JSON.stringify(tarballs, null, 2) + '\n');
console.log(`\n${tarballs.length} tarballs written to ${OUT}`);
