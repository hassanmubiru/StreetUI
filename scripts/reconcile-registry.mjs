#!/usr/bin/env node
/**
 * M8.2.1 — Registry reconciliation (v2).
 * Queries the LIVE npm registry. `versions` is an array of manifests; the
 * top-level `dist`/`time` reflect the latest. Emits repo-vs-registry.json.
 *
 * The package set comes from the shared release list, so this cannot drift from
 * what is actually packed and published.
 */

import { existsSync } from 'node:fs';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { PUBLIC_DIRS, packageName } from './lib/public-packages.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PKGS = join(ROOT, 'packages');
const PUBLIC = PUBLIC_DIRS.map(packageName);

const repoVersions = new Map();
for (const dir of PUBLIC_DIRS) {
  const p = join(PKGS, dir, 'package.json');
  if (existsSync(p)) {
    const j = JSON.parse(readFileSync(p, 'utf8'));
    repoVersions.set(j.name, j.version);
  }
}

const report = { created: new Date().toISOString(), packages: {} };
for (const pkg of PUBLIC) {
  let meta;
  try {
    meta = JSON.parse(execFileSync('npm', ['view', pkg, '--json'], { encoding: 'utf8' }));
  } catch {
    report.packages[pkg] = { package: pkg, repoVersion: repoVersions.get(pkg), published: false, error: '404-or-unavailable' };
    continue;
  }
  const versions = Array.isArray(meta.versions) ? meta.versions.map((v) => v.version) : [];
  const latest = meta['dist-tags']?.latest;
  const tarball = meta.dist?.tarball;
  const integrity = meta.dist?.integrity;
  const publishedAt = meta.time?.[latest];
  report.packages[pkg] = {
    package: pkg,
    repoVersion: repoVersions.get(pkg),
    published: true,
    latestDistTag: latest,
    publishedVersions: versions,
    tarball,
    integrity,
    publishedAt,
    deps: meta.dependencies,
    isRepoLatest: repoVersions.get(pkg) === latest,
  };
}

writeFileSync(join(ROOT, 'benchmarks', 'results', 'toolchain', 'repo-vs-registry.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log('written');
