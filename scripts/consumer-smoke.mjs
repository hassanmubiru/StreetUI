#!/usr/bin/env node
/**
 * External-consumer smoke test (release gate).
 *
 * Proves the packed tarballs are consumable OUTSIDE the monorepo with NO
 * workspace linking, NO symlinks, NO pnpm resolution — a plain `npm install` of
 * the tarball files into a throwaway project, then real execution.
 *
 * Three phases:
 *   1. Framework ESM  — `import` the compiler/DSL/state/renderer and server-render.
 *   2. Framework CJS  — the same through `require`.
 *   3. CLI flow       — `create` → `build` → `dev` SSR, driven by the installed
 *                       `@streetui/cli` binary.
 *   4. Strict TS      — a NodeNext + strict `tsc --noEmit` consumer that imports
 *                       every release package and every declared subpath, so a
 *                       broken/absent declaration entry fails the gate. The
 *                       bin-only `create-streetui` is checked through its bin
 *                       contract instead of an invented root export.
 *
 * Phase 3 is the one that would have caught the Node 18 SSR defect: it exercises
 * the CLI's SSR runner through a real install rather than a workspace link. The
 * CLI is invoked as `node_modules/@streetui/cli/dist/bin.js` on purpose — the
 * unified `streetui` package ships a same-named bin and `node_modules/.bin`
 * would otherwise resolve to the wrong artifact.
 *
 * Usage:  node scripts/consumer-smoke.mjs [tarball-dir]
 *   <tarball-dir> defaults to ./dist-tarballs (produced by pack-tarballs.mjs).
 *
 * Exit code 0 = every tarball installed and executed correctly.
 */
import { readdirSync, mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync, cpSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PUBLISH_ORDER, packageName } from './lib/public-packages.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Locate `@types/node` in the workspace so the offline strict-TS phase can model
 * a real external install (where `@types/node` comes from the developer's own
 * devDependencies). The package is copied, never linked.
 */
function findNodeTypes() {
  const candidates = [
    join(ROOT, 'node_modules', '@types', 'node'),
    join(ROOT, 'packages', 'cli', 'node_modules', '@types', 'node'),
    join(ROOT, 'packages', 'streetui', 'node_modules', '@types', 'node'),
  ];
  for (const candidate of candidates) {
    if (existsSync(join(candidate, 'package.json'))) return candidate;
  }
  const pnpmDir = join(ROOT, 'node_modules', '.pnpm');
  if (existsSync(pnpmDir)) {
    const match = readdirSync(pnpmDir).find((name) => name.startsWith('@types+node@'));
    if (match !== undefined) {
      const candidate = join(pnpmDir, match, 'node_modules', '@types', 'node');
      if (existsSync(join(candidate, 'package.json'))) return candidate;
    }
  }
  return undefined;
}

const tarDir = resolve(process.argv[2] ?? 'dist-tarballs');
const tarballs = readdirSync(tarDir)
  .filter((f) => f.endsWith('.tgz'))
  .map((f) => join(tarDir, f))
  .sort();

if (tarballs.length === 0) throw new Error(`No tarballs found in ${tarDir}`);

const consumer = mkdtempSync(join(tmpdir(), 'streetui-consumer-'));
console.log(`consumer project: ${consumer}`);
console.log(`node ${process.version}`);
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

// Assert the installed tree has concrete versions and no workspace protocol.
const installedScoped = readdirSync(join(consumer, 'node_modules', '@streetui'));
console.log(`installed @streetui packages: ${installedScoped.sort().join(', ')}`);
if (!existsSync(join(consumer, 'node_modules', 'streetui'))) throw new Error('streetui was not installed');
if (!existsSync(join(consumer, 'node_modules', 'create-streetui'))) throw new Error('create-streetui was not installed');
if (!installedScoped.includes('cli')) throw new Error('@streetui/cli was not installed');

const esmApp = `
import { streetui } from '@streetui/dsl';
import { signal } from '@streetui/state';
import { compile } from '@streetui/compiler';
import { renderToString } from '@streetui/renderer';
import { streetui as unified, compile as compileUnified } from 'streetui';
import { inspectCompilation, formatInspection } from 'streetui/diagnostics';

const count = signal(41);
const app = streetui.app({ name: 'consumer' });
app.page('home', (page) => {
  page.heading('Consumer OK');
  page.text(count);
});
const html = renderToString(compile(app));
if (!html.includes('Consumer OK')) throw new Error('SSR missing heading');
if (!html.includes('41')) throw new Error('SSR missing signal value');
const diagnosticsApp = unified.app({ name: 'diagnostics-example' });
diagnosticsApp.page('home', (page) => page.heading('Diagnostics'));
const { graph } = compileUnified(diagnosticsApp);
const report = formatInspection(inspectCompilation(graph));
if (!report.includes('diagnostics-example')) throw new Error('diagnostics subpath did not inspect the graph');
console.log('ESM-SSR-OK len=' + html.length);
console.log('ESM-DIAGNOSTICS-OK');
`;

const cjsApp = `
const { streetui } = require('@streetui/dsl');
const { signal } = require('@streetui/state');
const { compile } = require('@streetui/compiler');
const { renderToString } = require('@streetui/renderer');
const { streetui: unified, compile: compileUnified } = require('streetui');
const { inspectCompilation, formatInspection } = require('streetui/diagnostics');

const count = signal(7);
const app = streetui.app({ name: 'consumer-cjs' });
app.page('home', (page) => { page.heading('CJS OK'); page.text(count); });
const html = renderToString(compile(app));
if (!html.includes('CJS OK') || !html.includes('7')) throw new Error('CJS SSR failed');
const diagnosticsApp = unified.app({ name: 'diagnostics-example-cjs' });
diagnosticsApp.page('home', (page) => page.heading('Diagnostics'));
const { graph } = compileUnified(diagnosticsApp);
const report = formatInspection(inspectCompilation(graph));
if (!report.includes('diagnostics-example-cjs')) throw new Error('CJS diagnostics subpath did not inspect the graph');
console.log('CJS-SSR-OK len=' + html.length);
console.log('CJS-DIAGNOSTICS-OK');
`;

writeFileSync(join(consumer, 'app.mjs'), esmApp);
writeFileSync(join(consumer, 'app.cjs'), cjsApp);

console.log('--- phase 1: ESM consumer ---');
execFileSync('node', ['app.mjs'], { cwd: consumer, stdio: 'inherit' });
console.log('--- phase 2: CJS consumer ---');
execFileSync('node', ['app.cjs'], { cwd: consumer, stdio: 'inherit' });

console.log('--- phase 3: installed CLI flow (create → build → dev SSR) ---');
const cliBin = join(consumer, 'node_modules', '@streetui', 'cli', 'dist', 'bin.js');
if (!existsSync(cliBin)) throw new Error(`CLI bin not found at ${cliBin}`);
const versionOut = execFileSync('node', [cliBin, '--version'], { cwd: consumer, encoding: 'utf8' });
console.log(`CLI version: ${versionOut.trim()}`);

execFileSync('node', [cliBin, 'create', 'smoke-app', '--template', 'ssr'], { cwd: consumer, stdio: 'inherit' });
const appDir = join(consumer, 'smoke-app');

// The generated app pins the framework by version, which cannot resolve offline.
// Point its `streetui` / `@streetui/*` dependencies at the installed copies so
// the smoke test exercises the real installed packages without a registry.
const appPkgPath = join(appDir, 'package.json');
const appPkg = JSON.parse(readFileSync(appPkgPath, 'utf8'));
const appScoped = readdirSync(join(consumer, 'node_modules', '@streetui'));
appPkg.dependencies = appPkg.dependencies ?? {};
appPkg.devDependencies = appPkg.devDependencies ?? {};
for (const field of ['dependencies', 'devDependencies']) {
  for (const key of Object.keys(appPkg[field])) {
    if (key === 'streetui' || key.startsWith('@streetui/')) delete appPkg[field][key];
  }
}
appPkg.dependencies.streetui = 'file:../node_modules/streetui';
for (const name of appScoped) appPkg.dependencies[`@streetui/${name}`] = `file:../node_modules/@streetui/${name}`;
writeFileSync(appPkgPath, `${JSON.stringify(appPkg, null, 2)}\n`);
execFileSync('npm', ['install', '--offline', '--no-audit', '--no-fund', '--loglevel=error'], { cwd: appDir, stdio: 'inherit' });

execFileSync('node', [cliBin, 'build'], { cwd: appDir, stdio: 'inherit' });
if (!existsSync(join(appDir, 'dist', 'client', 'manifest.json'))) throw new Error('production manifest missing after build');

const port = 3000 + Math.floor(Math.random() * 2000);
const dev = spawn('node', [cliBin, 'dev', '--json', '--port', String(port)], {
  cwd: appDir,
  stdio: ['ignore', 'pipe', 'pipe'],
});
let devOutput = '';
dev.stdout.on('data', (chunk) => { devOutput += chunk; });
dev.stderr.on('data', (chunk) => { devOutput += chunk; });

const waitForHtml = async () => {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://localhost:${port}/`);
      if (res.ok) {
        const html = await res.text();
        if (html.includes('id="app"')) return html;
      }
    } catch {
      /* not listening yet */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`dev server never served the app at http://localhost:${port}\n${devOutput.slice(-4000)}`);
};

try {
  const html = await waitForHtml();
  console.log(`dev SSR OK — ${html.length} bytes, <div id="app"> present`);
} finally {
  dev.kill('SIGTERM');
}

console.log('--- phase 4: strict NodeNext TypeScript consumer ---');
const tsDir = join(consumer, 'ts-consumer');
mkdirSync(tsDir, { recursive: true });

// The CLI is a Node-targeted package: its declarations reference `node:http`
// and the `NodeJS` namespace. A real developer installing `@streetui/cli` also
// installs `@types/node`, so this consumer does the same (copied from the repo
// because the run is offline). This is not a workspace link — only the ambient
// Node declarations are provided, exactly as an external install would.
const nodeTypesSource = findNodeTypes();
if (nodeTypesSource === undefined) throw new Error('phase 4: @types/node is not available to model an external install');
cpSync(nodeTypesSource, join(consumer, 'node_modules', '@types', 'node'), { recursive: true });
const tsImports = [];
let tsIndex = 0;
for (const dir of PUBLISH_ORDER) {
  const name = packageName(dir);
  const manifestPath = join(consumer, 'node_modules', ...name.split('/'), 'package.json');
  if (!existsSync(manifestPath)) throw new Error(`phase 4: ${name} is not installed`);
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const exportsField = manifest.exports ?? {};
  const subpaths = Object.keys(exportsField).filter((key) => key.startsWith('.') && key !== './package.json');
  // Bin-only packages (create-streetui) have no library surface: assert the bin.
  if (subpaths.length === 0) {
    const bins = typeof manifest.bin === 'string' ? { default: manifest.bin } : manifest.bin ?? {};
    for (const rel of Object.values(bins)) {
      const abs = join(consumer, 'node_modules', ...name.split('/'), rel);
      if (!existsSync(abs)) throw new Error(`phase 4: ${name} bin target missing at ${rel}`);
    }
    continue;
  }
  const specifiers = subpaths.map((sub) => (sub === '.' ? name : `${name}/${sub.slice(2)}`));
  if (!specifiers.includes(name)) specifiers.unshift(name);
  for (const specifier of specifiers) {
    const alias = `ns${tsIndex++}`;
    tsImports.push(`import * as ${alias} from '${specifier}';`);
    tsImports.push(`void ${alias};`);
  }
}

writeFileSync(
  join(tsDir, 'consumer.ts'),
  [
    '// Generated by consumer-smoke.mjs — imports every declared release surface.',
    ...tsImports,
    '',
    // Named-import reachability for the documented subpaths.
    "import { renderToString, serializeState, readState } from 'streetui/server';",
    "import { compile } from '@streetui/compiler';",
    "import { renderStyles } from 'streetui';",
    "import { inspectCompilation, formatInspection } from 'streetui/diagnostics';",
    'void renderToString;',
    'void serializeState;',
    'void readState;',
    'void compile;',
    'void renderStyles;',
    'void inspectCompilation;',
    'void formatInspection;',
    '',
  ].join('\n'),
);
writeFileSync(
  join(tsDir, 'tsconfig.json'),
  `${JSON.stringify(
    {
      compilerOptions: {
        target: 'ES2022',
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        strict: true,
        noEmit: true,
        skipLibCheck: false,
        noUncheckedIndexedAccess: true,
        exactOptionalPropertyTypes: true,
        types: ['node'],
      },
      include: ['consumer.ts'],
    },
    null,
    2,
  )}\n`,
);
const tscBin = join(ROOT, 'node_modules', '.bin', 'tsc');
if (!existsSync(tscBin)) throw new Error(`phase 4: tsc not found at ${tscBin}`);
execFileSync(tscBin, ['--noEmit', '-p', join(tsDir, 'tsconfig.json')], { cwd: tsDir, stdio: 'inherit' });
console.log('strict TS consumer OK — every declared package/subpath resolves under NodeNext + strict');

rmSync(consumer, { recursive: true, force: true });
console.log('\nCONSUMER SMOKE TEST PASSED — tarballs installed and executed (ESM, CJS, CLI flow, strict TS).');
