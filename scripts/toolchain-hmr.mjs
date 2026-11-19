#!/usr/bin/env node
/**
 * M8.3 — HMR reliability under realistic changes.
 *
 * Drives a real dev server + Chromium and exercises the update boundary:
 *   1. edit a source file            → app stays interactive (no reload break)
 *   2. introduce a syntax error      → error overlay appears (never silently broken)
 *   3. fix the file                  → overlay clears and the app recovers
 *
 * Usage:  node scripts/toolchain-hmr.mjs [--engine chromium|firefox]
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..');
process.chdir(path.join(repo, 'packages', 'cli'));
const cli = await import(path.join(repo, 'packages', 'cli', 'dist', 'index.js'));
const BIN = path.join(repo, 'packages', 'cli', 'dist', 'bin.js');
const logger = { info() {}, success() {}, warn() {}, error() {}, plain() {} };

const engine = process.argv.includes('--engine')
  ? process.argv[process.argv.indexOf('--engine') + 1]
  : 'chromium';

const base = fs.mkdtempSync(path.join(os.tmpdir(), 'streetui-hmr-'));
const app = path.join(base, 'app');
const PORT = 3420;

async function wireDependencies(projectRoot) {
  const { mkdir, symlink } = await import('node:fs/promises');
  const mods = path.join(projectRoot, 'node_modules');
  const scoped = path.join(mods, '@streetui');
  await mkdir(scoped, { recursive: true });
  for (const pkg of ['compiler', 'dom', 'dsl', 'renderer', 'state', 'core', 'graph', 'runtime', 'events', 'scheduler', 'cli']) {
    await symlink(path.join(repo, 'packages', pkg), path.join(scoped, pkg), 'dir');
  }
}

function waitForHttp(url, ms = 30000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const iv = setInterval(async () => {
      try {
        const res = await fetch(url);
        if (res.status < 500) {
          clearInterval(iv);
          resolve();
          return;
        }
      } catch {
        /* not up yet */
      }
      if (Date.now() - start > ms) {
        clearInterval(iv);
        reject(new Error(`http timeout ${url}`));
      }
    }, 250);
  });
}

async function waitFor(page, fn, ms = 15000, label = 'condition') {
  const start = Date.now();
  while (Date.now() - start < ms) {
    try {
      if (await fn()) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`timed out waiting for ${label}`);
}

try {
  await cli.createProject({ targetDir: app, template: 'ssr', frameworkVersion: '3.1.0', logger });
  await wireDependencies(app);

  const child = spawn(process.execPath, [BIN, 'dev', '--port', String(PORT)], {
    cwd: app,
    env: { ...process.env, NO_COLOR: '1' },
    stdio: ['ignore', 'inherit', 'inherit'],
  });
  const dev = `http://localhost:${PORT}`;
  await waitForHttp(dev);

  const pw = await import('playwright');
  const browser = await pw[engine].launch();
  const page = await browser.newPage();
  const consoleErrors = [];
  page.on('pageerror', (e) => consoleErrors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(`console: ${m.text()}`);
  });

  const appTs = path.join(app, 'src', 'app.ts');
  const original = fs.readFileSync(appTs, 'utf8');

  // Baseline render.
  await page.goto(dev, { waitUntil: 'load' });
  await waitFor(page, () => page.$('#app'), 15000, 'initial render');
  await waitFor(page, () => page.$('#increment'), 15000, 'counter');

  // 1. Edit a source file → app should stay interactive (accepted boundary).
  fs.writeFileSync(appTs, `${original}\n// hmr-edit-1\n`);
  await new Promise((r) => setTimeout(r, 1500));
  await page.click('#increment');
  await waitFor(page, () => page.evaluate(() => document.getElementById('count')?.textContent.includes('1')), 8000, 'post-edit interactivity');
  await waitFor(page, () => page.$('#app'), 8000, 'app after edit');

  // 2. Syntax error → overlay appears; the app is never silently broken.
  fs.writeFileSync(appTs, `${original}\nconst broken = ;\n`);
  await new Promise((r) => setTimeout(r, 1500));
  await waitFor(page, () => page.$('#__streetui_hmr_overlay'), 10000, 'syntax-error overlay');

  // 3. Fix the file → overlay clears and the app recovers.
  fs.writeFileSync(appTs, original);
  await waitFor(page, () => page.evaluate(() => !document.getElementById('__streetui_hmr_overlay')), 10000, 'overlay clear');
  await waitFor(page, () => page.$('#app'), 10000, 'recovery render');

  const errors = consoleErrors.filter((e) => !e.includes('hmr-edit-1'));
  if (errors.length > 0) throw new Error(`console errors after recovery: ${errors.join(' | ')}`);

  console.log(`HMR HARDENING PASSED (${engine}) — edit kept app interactive; syntax error overlaid; recovery clean.`);

  await browser.close();
  child.kill('SIGTERM');
} finally {
  fs.rmSync(base, { recursive: true, force: true });
}
