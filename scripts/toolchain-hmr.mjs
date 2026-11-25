#!/usr/bin/env node
/**
 * M8.3 — HMR reliability under realistic changes.
 *
 * Drives a real dev server + a real browser and exercises the update boundary:
 *   1. edit a source file            → app stays interactive (no reload break)
 *   2. introduce a syntax error      → error overlay appears (never silently broken)
 *   3. fix the file                  → overlay clears and the app recovers
 *
 * The requested engine is verified against the launched engine; a host that
 * cannot launch it is BLOCKED, never PASS. FAIL/ERROR exits nonzero, and BLOCKED
 * exits nonzero under CI or `--require`.
 *
 * Usage:  node scripts/toolchain-hmr.mjs [--engine|--engines chromium,firefox,webkit]
 *
 * Output: benchmarks/results/toolchain/hmr.json
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  assertNoUnknownSelectionFlags,
  cachedEngineExecutable,
  enginesFromArgv,
  launchBrowser,
} from './lib/browser-engines.mjs';
import { applyExitCode, summarizeReports, summaryForArtifact } from './lib/harness-status.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..');
process.chdir(path.join(repo, 'packages', 'cli'));
const cli = await import(path.join(repo, 'packages', 'cli', 'dist', 'index.js'));
const BIN = path.join(repo, 'packages', 'cli', 'dist', 'bin.js');
const logger = { info() {}, success() {}, warn() {}, error() {}, plain() {} };

assertNoUnknownSelectionFlags();
const engines = enginesFromArgv(undefined, ['chromium']);

const WORKSPACE_VERSION = JSON.parse(
  fs.readFileSync(path.join(repo, 'packages', 'streetui', 'package.json'), 'utf8'),
).version;

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

const reports = [];
let playwright = null;
try {
  playwright = await import('playwright');
} catch {
  playwright = null;
}

let child = null;
try {
  await cli.createProject({ targetDir: app, template: 'ssr', frameworkVersion: WORKSPACE_VERSION, logger });
  await wireDependencies(app);

  child = spawn(process.execPath, [BIN, 'dev', '--port', String(PORT)], {
    cwd: app,
    env: { ...process.env, NO_COLOR: '1' },
    stdio: ['ignore', 'inherit', 'inherit'],
  });
  const dev = `http://localhost:${PORT}`;
  await waitForHttp(dev);

  for (const engine of engines) {
    const report = {
      requestedEngine: engine,
      actualEngine: null,
      engine,
      browserVersion: null,
      requestedMode: 'dev',
      actualMode: 'dev',
      status: 'BLOCKED',
      reason: '',
      steps: {},
    };
    if (playwright === null) {
      report.reason = 'Playwright is not installed.';
      reports.push(report);
      continue;
    }
    // Prefer the engine's own resolved executable; the cache is only a fallback
    // for hosts where Playwright's default path is stale.
    const binary = (() => {
      try {
        const resolved = playwright[engine].executablePath();
        if (resolved !== undefined && fs.existsSync(resolved)) return resolved;
      } catch {
        /* fall through to the cache */
      }
      return cachedEngineExecutable(engine);
    })();
    if (binary === undefined || !fs.existsSync(binary)) {
      report.reason = `No launchable ${engine} binary is available.`;
      reports.push(report);
      continue;
    }

    let browser = null;
    try {
      browser = await launchBrowser(playwright, engine, { executablePath: binary, timeout: 45000 });
      report.actualEngine = browser.browserType().name();
      report.browserVersion = browser.version();

      const page = await browser.newPage();
      const consoleErrors = [];
      page.on('pageerror', (e) => consoleErrors.push(String(e)));
      page.on('console', (m) => {
        if (m.type() === 'error') consoleErrors.push(`console: ${m.text()}`);
      });

      const appTs = path.join(app, 'src', 'app.ts');
      const original = fs.readFileSync(appTs, 'utf8');

      await page.goto(dev, { waitUntil: 'load' });
      await waitFor(page, () => page.$('#app'), 15000, 'initial render');
      await waitFor(page, () => page.$('#increment'), 15000, 'counter');
      report.steps.initialRender = true;

      fs.writeFileSync(appTs, `${original}\n// hmr-edit-1\n`);
      await new Promise((r) => setTimeout(r, 1500));
      await page.click('#increment');
      await waitFor(page, () => page.evaluate(() => document.getElementById('count')?.textContent.includes('1')), 8000, 'post-edit interactivity');
      await waitFor(page, () => page.$('#app'), 8000, 'app after edit');
      report.steps.editStayedInteractive = true;

      fs.writeFileSync(appTs, `${original}\nconst broken = ;\n`);
      await new Promise((r) => setTimeout(r, 1500));
      await waitFor(page, () => page.$('#__streetui_hmr_overlay'), 10000, 'syntax-error overlay');
      report.steps.syntaxErrorOverlay = true;

      fs.writeFileSync(appTs, original);
      await waitFor(page, () => page.evaluate(() => !document.getElementById('__streetui_hmr_overlay')), 10000, 'overlay clear');
      await waitFor(page, () => page.$('#app'), 10000, 'recovery render');
      report.steps.recoveredCleanly = true;

      const errors = consoleErrors.filter((e) => !e.includes('hmr-edit-1'));
      report.steps.consoleClean = errors.length === 0;
      if (errors.length > 0) report.reason = `console errors after recovery: ${errors.join(' | ')}`;
      report.status = errors.length === 0 ? 'PASS' : 'FAIL';
    } catch (error) {
      const message = String(error && error.message || error);
      const blocked = /Executable doesn't exist|Failed to launch|browserType\.launch|error while loading shared libraries|Host system is missing dependencies/i.test(message);
      report.status = blocked ? 'BLOCKED' : 'ERROR';
      report.reason = message.split('\n')[0];
    } finally {
      try {
        await browser?.close();
      } catch {
        /* already closed */
      }
    }
    reports.push(report);
  }
} catch (error) {
  reports.push({
    requestedEngine: engines[0] ?? 'chromium',
    actualEngine: null,
    engine: engines[0] ?? 'chromium',
    browserVersion: null,
    requestedMode: 'dev',
    actualMode: null,
    status: 'ERROR',
    reason: String(error && error.message || error).split('\n')[0],
    steps: {},
  });
} finally {
  try {
    child?.kill('SIGTERM');
  } catch {
    /* already gone */
  }
  fs.rmSync(base, { recursive: true, force: true });
}

const outDir = path.join(repo, 'benchmarks', 'results', 'toolchain');
fs.mkdirSync(outDir, { recursive: true });
const summary = summarizeReports(reports, { requestedEngines: engines, requestedModes: ['dev'] });
const artifact = {
  schema: 'streetui-toolchain-hmr/v1',
  created: new Date().toISOString(),
  target: 'local-workspace',
  engines: reports,
  summary: summaryForArtifact(summary),
  capturedAt: new Date().toISOString(),
};
fs.writeFileSync(path.join(outDir, 'hmr.json'), `${JSON.stringify(artifact, null, 2)}\n`);

for (const report of reports) {
  process.stdout.write(`toolchain-hmr: ${report.requestedEngine} → ${report.status}\n`);
}
process.exitCode = applyExitCode(summary, process.stdout);
