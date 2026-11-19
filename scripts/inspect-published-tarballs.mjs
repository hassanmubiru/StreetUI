#!/usr/bin/env node
/**
 * M8.2.1 — Inspect published tarballs directly from the npm registry.
 * Downloads each selected package@version tarball (npm pack) and reports:
 *   - file listing (templates, dist bins, .d.ts presence)
 *   - whether the package.json declares esbuild
 *   - whether any shipped .js contains an esbuild reference
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, readdirSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execSync } from 'node:child_process';

const targets = [
  ['@streetui/cli', '3.1.1'],
  ['streetui', '3.1.1'],
  ['@streetui/renderer', '3.1.0'],
  ['@streetui/core', '3.1.0'],
];

const out = {};
for (const [pkg, ver] of targets) {
  const spec = `${pkg}@${ver}`;
  const dir = mkdtempSync(join(tmpdir(), 'streetui-tar-'));
  try {
    execFileSync('npm', ['pack', spec, '--pack-destination', dir], { encoding: 'utf8', stdio: ['ignore','pipe','ignore'] });
    const tgz = readdirSync(dir).find((f) => f.endsWith('.tgz'));
    const stage = join(dir, 'stage');
    mkdirSync(stage);
    execSync(`tar -xzf "${join(dir, tgz)}" -C "${stage}"`);
    const pkgDir = join(stage, 'package');
    const manifest = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'));
    const hasTemplates = ['templates/basic/src/main.ts', 'templates/ssr/src/main.ts'].every((f) => {
      try { readFileSync(join(pkgDir, f)); return true; } catch { return false; }
    });
    const hasBin = Object.values(manifest.bin ?? {}).every((b) => {
      try { readFileSync(join(pkgDir, b)); return true; } catch { return false; }
    });
    const hasTypes = manifest.types ? (() => { try { readFileSync(join(pkgDir, manifest.types)); return true; } catch { return false; } })() : false;
    // scan shipped .js files for esbuild references
    let esbuildInFiles = 0;
    const walk = (d) => {
      for (const e of readdirSync(d, { withFileTypes: true })) {
        const p = join(d, e.name);
        if (e.isDirectory()) walk(p);
        else if (e.name.endsWith('.js')) {
          const s = readFileSync(p, 'utf8');
          if (/esbuild/.test(s)) esbuildInFiles++;
        }
      }
    };
    walk(pkgDir);
    out[spec] = {
      files: readdirSync(pkgDir).sort(),
      deps: manifest.dependencies,
      esbuildDep: manifest.dependencies?.esbuild,
      hasTemplates,
      hasBin,
      hasTypes,
      esbuildInFiles,
    };
  } catch (err) {
    out[spec] = { error: String(err.message).split('\n')[0] };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

import { writeFileSync } from 'node:fs';
writeFileSync('/home/error51/Downloads/StreetUI/.kilo/worktrees/neon-newspaper/benchmarks/results/toolchain/published-tarball-inspection.json', JSON.stringify(out, null, 2) + '\n');
console.log(JSON.stringify(out, null, 2));
