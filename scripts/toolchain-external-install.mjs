#!/usr/bin/env node
/**
 * M8.1 — Clean external installation verification.
 *
 * Proves the packed/npm artifacts work OUTSIDE the monorepo:
 *   - packs every public package into real npm tarballs,
 *   - installs them into an isolated consumer project via `file:` specifiers
 *     (offline; no workspace links, no symlinks, no monorepo-relative imports),
 *   - drives the installed CLI to `doctor`, `create`, `build`, `start`, and
 *     `preview` for BOTH templates,
 *   - verifies development SSR boots via `streetui dev --json`.
 *
 * TypeScript is the only non-StreetUI runtime dependency of the CLI. Offline,
 * it is staged from the locally installed copy of the same public package so the
 * consumer never resolves it from the monorepo.
 *
 * Usage:  node scripts/toolchain-external-install.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..');
const requireFromRepo = createRequire(path.join(repo, 'package.json'));

const TARBALLS = path.join(repo, 'dist-tarballs');
const consumer = fs.mkdtempSync(path.join(os.tmpdir(), 'streetui-ext-'));
const STREETUI_DEPS = [
  'compiler', 'context', 'core', 'devtools', 'dom', 'dsl', 'events', 'forms',
  'graph', 'i18n', 'renderer', 'router', 'runtime', 'scheduler', 'state', 'testing',
];

function run(args, cwd) {
  console.log(`\n$ ${args.join(' ')}  (cwd=${cwd})`);
  execFileSync(args[0], args.slice(1), { cwd, stdio: 'inherit', env: { ...process.env, NO_COLOR: '1' } });
}

function stageTypeScript(target) {
  const tsEntry = requireFromRepo.resolve('typescript/package.json');
  const tsDir = path.dirname(tsEntry);
  const off = path.join(target, 'offline');
  fs.mkdirSync(off, { recursive: true });
  const stage = path.join(off, 'typescript');
  fs.rmSync(stage, { recursive: true, force: true });
  fs.cpSync(tsDir, stage, { recursive: true });
  const out = execFileSync('npm', ['pack', '--pack-destination', off], { cwd: stage, encoding: 'utf8' });
  const tgzName = out.trim().split('\n').pop().trim();
  return `file:${path.join('offline', tgzName)}`;
}

function tgz(pkgName) {
  const prefix = pkgName.replace(/^@/, '').replace('/', '-');
  const matches = fs.readdirSync(TARBALLS).filter((f) => f.startsWith(`${prefix}-`) && f.endsWith('.tgz'));
  if (matches.length === 0) throw new Error(`No tarball for ${pkgName} (${prefix})`);
  return path.join(TARBALLS, matches[0]);
}

function writePackage(target, pkg) {
  fs.writeFileSync(path.join(target, 'package.json'), `${JSON.stringify(pkg, null, 2)}\n`);
}

function installConsumer() {
  run(['node', 'scripts/pack-tarballs.mjs'], repo);
  if (!fs.existsSync(path.join(TARBALLS, 'tarballs.json'))) throw new Error('pack-tarballs did not produce tarballs.json');

  // Host consumer: framework deps + CLI, all from local tarballs.
  const deps = {};
  for (const dep of STREETUI_DEPS) deps[`@streetui/${dep}`] = `file:${tgz(`@streetui/${dep}`)}`;
  deps['@streetui/cli'] = `file:${tgz('@streetui/cli')}`;
  deps.typescript = stageTypeScript(consumer);
  writePackage(consumer, {
    name: 'streetui-ext-consumer',
    private: true,
    version: '0.0.0',
    type: 'module',
    dependencies: deps,
    devDependencies: {},
    engines: { node: '>=18.0.0' },
  });
  run(['npm', 'install', '--offline', '--no-audit', '--no-fund', '--loglevel=error'], consumer);
  return consumer;
}

function verifyConsumer(consumer) {
  // no workspace links / no symlinks into the monorepo
  const scoped = path.join(consumer, 'node_modules', '@streetui');
  for (const entry of fs.readdirSync(scoped)) {
    const p = path.join(scoped, entry);
    const st = fs.lstatSync(p);
    if (st.isSymbolicLink()) throw new Error(`unexpected symlink in installed consumer: ${p}`);
  }
  const pkgText = fs.readFileSync(path.join(consumer, 'node_modules', '@streetui', 'cli', 'package.json'), 'utf8');
  if (pkgText.includes('workspace:')) throw new Error('installed CLI still contains workspace: specifier');
}

async function withServer(cwd, binArgs, checkUrl, onReady) {
  return new Promise((resolve, reject) => {
    const child = spawn(path.join(cwd, 'node_modules', '.bin', 'streetui'), binArgs, {
      cwd,
      env: { ...process.env, NO_COLOR: '1' },
      stdio: ['ignore', 'pipe', 'inherit'],
    });
    let stdout = '';
    const events = [];
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
      for (const line of stdout.split('\n')) {
        if (!line.trim()) continue;
        try {
          events.push(JSON.parse(line));
        } catch {
          /* not JSON */
        }
      }
    });
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`server did not become ready at ${checkUrl}\n${stdout}`));
    }, 60000);

    const poll = async () => {
      const start = Date.now();
      while (Date.now() - start < 40000) {
        try {
          const res = await fetch(checkUrl);
          if (res.status < 500) {
            clearTimeout(timer);
            try {
              await onReady(res, child, events);
            } finally {
              child.kill('SIGTERM');
            }
            setTimeout(() => resolve(), 200);
            return;
          }
        } catch {
          /* not up yet */
        }
        await new Promise((r) => setTimeout(r, 250));
      }
      clearTimeout(timer);
      child.kill('SIGTERM');
      reject(new Error(`http timeout ${checkUrl}\n${stdout}`));
    };
    void poll();

    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

async function verifyTemplate(template, index) {
  const app = path.join(consumer, `app-${template}`);
  console.log(`\n=== external template: ${template} ===`);

  run([path.join(consumer, 'node_modules', '.bin', 'streetui'), 'create', `app-${template}`, '--template', template], consumer);

  // Rewrite the generated app's @streetui deps to local tarballs (offline) so
  // every direct AND transitive framework dependency installs from the packed
  // artifacts. Non-StreetUI template deps are preserved. TypeScript is staged
  // from a locally packed tarball.
  const appPkg = JSON.parse(fs.readFileSync(path.join(app, 'package.json'), 'utf8'));
  const deps = {};
  for (const dep of STREETUI_DEPS) deps[`@streetui/${dep}`] = `file:${tgz(`@streetui/${dep}`)}`;
  for (const [key, value] of Object.entries(appPkg.dependencies ?? {})) {
    if (!key.startsWith('@streetui/') && deps[key] === undefined) deps[key] = value;
  }
  appPkg.devDependencies = appPkg.devDependencies ?? {};
  if (appPkg.devDependencies['@streetui/cli']) {
    appPkg.devDependencies['@streetui/cli'] = `file:${tgz('@streetui/cli')}`;
  }
  if (appPkg.devDependencies.typescript) delete appPkg.devDependencies.typescript;
  appPkg.dependencies = deps;
  appPkg.dependencies.typescript = stageTypeScript(app);
  writePackage(app, appPkg);
  run(['npm', 'install', '--offline', '--no-audit', '--no-fund', '--loglevel=error'], app);

  // Doctor must pass on a real generated app (client entry present).
  run([path.join(app, 'node_modules', '.bin', 'streetui'), 'doctor'], app);

  // No Vite/Vite config anywhere in the generated project.
  const viteFiles = [];
  const walkVite = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') continue;
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) walkVite(p);
      else if (/vite/i.test(entry.name)) viteFiles.push(p);
    }
  };
  walkVite(app);
  if (viteFiles.length > 0) throw new Error(`Vite configuration found in generated project: ${viteFiles.join(', ')}`);

  // Production build.
  run([path.join(app, 'node_modules', '.bin', 'streetui'), 'build'], app);
  const manifestPath = path.join(app, 'dist', 'client', 'manifest.json');
  if (!fs.existsSync(manifestPath)) throw new Error('manifest.json missing after build');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const entryJs = path.join(app, 'dist', 'client', manifest.entry.js.replace(/^\//, ''));
  if (!fs.existsSync(entryJs)) throw new Error(`entry js missing: ${entryJs}`);

  // Start (SSR) serves '/' with rendered HTML.
  const startPort = 5100 + index;
  await withServer(app, ['start', '--json', '--port', String(startPort)], `http://localhost:${startPort}/`, async (res, child) => {
    const html = await res.text();
    if (!html.includes('id="app"')) throw new Error(`start did not serve SSR HTML for ${template}`);
  });

  // Preview serves the hashed client entry.
  const previewPort = 5200 + index;
  await withServer(app, ['preview', '--json', '--port', String(previewPort)], `http://localhost:${previewPort}${manifest.entry.js}`, async (res, child) => {
    const text = await res.text();
    if (text.length === 0) throw new Error(`preview served empty client entry for ${template}`);
  });

  // Development boot via --json events.
  const devPort = 5300 + index;
  await withServer(app, ['dev', '--json', '--port', String(devPort)], `http://localhost:${devPort}/`, async (res, child, events) => {
    const html = await res.text();
    if (!html.includes('id="app"')) throw new Error(`dev did not serve SSR HTML for ${template}`);
    const ready = events.find((e) => e.event === 'preview_ready');
    if (!ready) throw new Error('dev did not emit preview_ready');
    if (!ready.version) throw new Error('preview_ready missing version');
  });

  console.log(`✓ external template ${template} OK`);
}

try {
  installConsumer();
  verifyConsumer(consumer);
  await verifyTemplate('basic', 0);
  await verifyTemplate('ssr', 1);
  console.log('\nEXTERNAL INSTALL VERIFICATION PASSED — packed artifacts work outside the monorepo.');
} finally {
  fs.rmSync(consumer, { recursive: true, force: true });
}
