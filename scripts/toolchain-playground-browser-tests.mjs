#!/usr/bin/env node
/**
 * M9 — Playground browser verification.
 *
 * Starts the local Playground for a generated app and drives the real IDE in
 * Chromium and Firefox:
 *   - UI loads, brand + file explorer render
 *   - open a file → CodeMirror editor appears
 *   - type → dirty; Ctrl+S saves (file written)
 *   - Build → build ok
 *   - Run → preview iframe to the real dev server; actual app has #app
 *
 * Usage:  node scripts/toolchain-playground-browser-tests.mjs [--engines chromium,firefox]
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..');
const CLI_BIN = path.join(repo, 'packages', 'cli', 'dist', 'bin.js');

const enginesArg = process.argv.includes('--engines')
  ? process.argv[process.argv.indexOf('--engines') + 1].split(',')
  : ['chromium', 'firefox'];

const base = fs.mkdtempSync(path.join(os.tmpdir(), 'streetui-pg-'));
const app = path.join(base, 'app');

function run(args, cwd) {
  execFileSync(args[0], args.slice(1), { cwd, encoding: 'utf8', stdio: ['ignore','pipe','inherit'], env: { ...process.env, NO_COLOR: '1' } });
}

async function waitForHttp(url, ms = 45000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    try { const r = await fetch(url); if (r.status < 500) return r; } catch { /* not up */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`http timeout ${url}`);
}

function waitForEvent(child, predicate, ms = 60000) {
  return new Promise((resolve, reject) => {
    let acc = '';
    const timer = setTimeout(() => { child.kill('SIGTERM'); reject(new Error('event timeout\n' + acc)); }, ms);
    const onData = (chunk) => {
      acc += chunk.toString();
      const lines = acc.split('\n');
      acc = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const ev = JSON.parse(line);
          if (predicate(ev)) { clearTimeout(timer); child.stdout.off('data', onData); resolve(ev); return; }
        } catch { /* ignore */ }
      }
    };
    child.stdout.on('data', onData);
    child.on('error', reject);
  });
}

async function runBrowser(engine, script) {
  const pw = await import('playwright');
  let browser;
  try { browser = await pw[engine].launch(); }
  catch (error) {
    const cacheRoot = path.join(os.homedir(), '.cache', 'ms-playwright');
    const prefix = engine === 'firefox' ? 'firefox-' : 'chromium-';
    const dirs = fs.existsSync(cacheRoot) ? fs.readdirSync(cacheRoot).filter((d) => d.startsWith(prefix)).sort().reverse() : [];
    for (const d of dirs) {
      const bin = engine === 'firefox' ? path.join(cacheRoot, d, 'firefox', 'firefox') : path.join(cacheRoot, d, 'chrome-linux', 'chrome');
      if (fs.existsSync(bin)) { browser = await pw[engine].launch({ executablePath: bin }); break; }
    }
    if (!browser) return { ok: false, fatal: String(error.message).split('\n')[0] };
  }
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
    const result = await script(page);
    result.errors = errors;
    return result;
  } catch (error) {
    return { ok: false, error: String(error.message), errors: [] };
  } finally {
    await browser.close();
  }
}

const report = { schema: 'streetui-playground-browser/v1', created: new Date().toISOString(), engines: {}, status: 'PASS' };

try {
  run(['node', CLI_BIN, 'create', 'app', '--template', 'basic'], base);
  run(['npm', 'install', '--no-audit', '--no-fund'], app);

  const child = spawn(process.execPath, [CLI_BIN, 'playground', app, '--port', '4705'], {
    cwd: app,
    env: { ...process.env, NO_COLOR: '1' },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  const ready = await waitForEvent(child, (e) => e.event === 'session_attached');
  const UI = new URL('/__playground/', ready.url).href;

  for (const engine of enginesArg) {
    report.engines[engine] = await runBrowser(engine, async (page) => {
      await page.goto(UI, { waitUntil: 'load' });
      await page.waitForSelector('#brand', { timeout: 20000 });
      const brand = (await page.textContent('#brand'))?.trim();
      await page.waitForSelector('.pg-file', { timeout: 20000 });
      const fileCount = (await page.$$eval('.pg-file', (els) => els.length));

      // open app.ts
      await page.click('.pg-file:text-is("src/app.ts")');
      await page.waitForSelector('.cm-editor', { timeout: 15000 });
      const editorPresent = (await page.$('.cm-editor')) !== null;

      // edit + save
      await page.click('.cm-content');
      await page.keyboard.press('End');
      await page.keyboard.type('\n// playground-browser-edit');
      await page.keyboard.press('Control+s');
      await page.waitForTimeout(800);
      const dirtyAfter = await page.$$eval('.pg-tab.dirty', (els) => els.length);

      // build
      await page.click('#build-btn');
      await page.waitForFunction(
        () => document.getElementById('bottom-body')?.textContent?.includes('build ok'),
        null,
        { timeout: 25000 },
      );
      const buildText = (await page.textContent('#bottom-body'))?.slice(0, 60);

      // run → preview iframe exists; verify the real app renders server-side
      await page.click('#run-btn');
      await page.waitForSelector('#preview-frame iframe', { timeout: 10000 });
      const src = await page.getAttribute('#preview-frame iframe', 'src');
      const previewRes = await fetch(`${src}/`);
      const previewHtml = await previewRes.text();

      const ok =
        brand === 'StreetUI' &&
        fileCount > 0 &&
        editorPresent &&
        dirtyAfter === 0 &&
        (buildText ?? '').includes('build ok') &&
        previewRes.status === 200 &&
        previewHtml.includes('id="app"');

      return { ok, brand, fileCount, editorPresent, dirtyAfter, buildText, previewStatus: previewRes.status, previewHasApp: previewHtml.includes('id="app"') };
    });
  }
  child.kill('SIGTERM');

  const anyFail = Object.values(report.engines).some((r) => r.ok === false);
  if (anyFail) report.status = 'PARTIAL';
} catch (error) {
  report.status = 'BLOCKED';
  report.fatal = String(error.stack || error);
}

const outDir = path.join(repo, 'benchmarks', 'results', 'toolchain');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'playground-browser.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log('Playground Browser: ' + report.status);
console.log(JSON.stringify(report.engines, null, 2));
fs.rmSync(base, { recursive: true, force: true });
