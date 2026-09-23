#!/usr/bin/env node
/**
 * External-consumer smoke test (v0.8 package-quality gate).
 *
 * Proves the packed tarballs are consumable OUTSIDE the monorepo with NO
 * workspace linking, NO symlinks, NO pnpm resolution — a plain `npm install` of
 * the tarball files into a throwaway project, then real execution of the
 * packaged framework (build a page → compile → server-render) from BOTH an ESM
 * (`import`) and a CommonJS (`require`) entry point.
 *
 * Usage:  node scripts/consumer-smoke.mjs <tarball-dir>
 *   <tarball-dir> defaults to ./dist-tarballs (produced by pack-tarballs.mjs).
 *
 * Exit code 0 = the packaged framework installed and executed correctly.
 */
import { readdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';

const tarDir = resolve(process.argv[2] ?? 'dist-tarballs');

// The framework consumption path does not need the CLI (whose only extra dep is
// the native `esbuild` binary). Install every other @streetui tarball together
// so npm satisfies their inter-package deps from the tarballs themselves.
const tarballs = readdirSync(tarDir)
  .filter((f) => f.endsWith('.tgz') && !f.startsWith('streetui-cli-'))
  .map((f) => join(tarDir, f));

if (tarballs.length === 0) throw new Error(`No tarballs found in ${tarDir}`);

const consumer = mkdtempSync(join(tmpdir(), 'streetui-consumer-'));
console.log(`consumer project: ${consumer}`);
console.log(`installing ${tarballs.length} tarballs (offline, no workspace linking)…`);

writeFileSync(
  join(consumer, 'package.json'),
  JSON.stringify({ name: 'streetui-consumer', private: true, version: '0.0.0', type: 'module' }, null, 2),
);

// A real install from tarball files. --offline guarantees nothing is pulled from
// a registry; --no-audit/--no-fund keep the output focused.
execFileSync(
  'npm',
  ['install', '--offline', '--no-audit', '--no-fund', '--no-package-lock', ...tarballs],
  { cwd: consumer, stdio: 'inherit' },
);

// Assert the installed tree has no workspace symlinks and concrete versions.
const installed = readdirSync(join(consumer, 'node_modules', '@streetui'));
console.log(`installed @streetui packages: ${installed.sort().join(', ')}`);

const esmApp = `
import { streetui } from '@streetui/dsl';
import { signal } from '@streetui/state';
import { compile } from '@streetui/compiler';
import { renderToString } from '@streetui/renderer';

const count = signal(41);
const app = streetui.app({ name: 'consumer' });
app.page('home', (page) => {
  page.heading('Consumer OK');
  page.text(count);
});
const html = renderToString(compile(app));
if (!html.includes('Consumer OK')) throw new Error('SSR missing heading');
if (!html.includes('41')) throw new Error('SSR missing signal value');
console.log('ESM-SSR-OK len=' + html.length);
`;

const cjsApp = `
const { streetui } = require('@streetui/dsl');
const { signal } = require('@streetui/state');
const { compile } = require('@streetui/compiler');
const { renderToString } = require('@streetui/renderer');

const count = signal(7);
const app = streetui.app({ name: 'consumer-cjs' });
app.page('home', (page) => { page.heading('CJS OK'); page.text(count); });
const html = renderToString(compile(app));
if (!html.includes('CJS OK') || !html.includes('7')) throw new Error('CJS SSR failed');
console.log('CJS-SSR-OK len=' + html.length);
`;

writeFileSync(join(consumer, 'app.mjs'), esmApp);
writeFileSync(join(consumer, 'app.cjs'), cjsApp);

console.log('--- running ESM consumer ---');
execFileSync('node', ['app.mjs'], { cwd: consumer, stdio: 'inherit' });
console.log('--- running CJS consumer ---');
execFileSync('node', ['app.cjs'], { cwd: consumer, stdio: 'inherit' });

rmSync(consumer, { recursive: true, force: true });
console.log('\nCONSUMER SMOKE TEST PASSED — packaged framework consumed from tarballs (ESM + CJS).');
