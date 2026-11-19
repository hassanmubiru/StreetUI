#!/usr/bin/env node
/**
 * M8.2.1 — Registry reconciliation (v2).
 * Queries the LIVE npm registry. `versions` is an array of manifests; the
 * top-level `dist`/`time` reflect the latest. Emits repo-vs-registry.json.
 */

import { existsSync } from 'node:fs';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PKGS = join(ROOT, 'packages');
const PUBLIC = [
  '@streetui/core', '@streetui/state', '@streetui/graph', '@streetui/dsl',
  '@streetui/compiler', '@streetui/runtime', '@streetui/events', '@streetui/scheduler',
  '@streetui/dom', '@streetui/renderer', '@streetui/router', '@streetui/forms',
  '@streetui/i18n', '@streetui/context', '@streetui/devtools', '@streetui/testing',
  '@streetui/cli', 'streetui', 'create-streetui',
];

const repoVersions = new Map();
for (const dir of ['core','state','graph','dsl','compiler','runtime','events','scheduler','dom','renderer','router','forms','i18n','context','devtools','testing','cli','streetui','create-streetui']) {
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
    has31_0: versions.includes('3.1.0'),
    has31_1: versions.includes('3.1.1'),
    tarball,
    integrity,
    publishedAt,
    deps: meta.dependencies,
    isRepoLatest: repoVersions.get(pkg) === latest,
  };
}

writeFileSync(join(ROOT, 'benchmarks', 'results', 'toolchain', 'repo-vs-registry.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log('written');
