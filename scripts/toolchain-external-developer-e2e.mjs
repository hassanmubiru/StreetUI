#!/usr/bin/env node
/**
 * M12.13 — External developer acceptance test.
 *
 * Reproduces an ordinary developer's full journey using only published npm
 * packages: install streetui + @streetui/cli, copy the dashboard example into
 * a clean consumer project, build for production, serve SSR, and drive the app
 * in real Chromium and Firefox with interactions, screenshots, and error
 * checks. No workspace aliases or local source shortcuts.
 *
 * Usage: node scripts/toolchain-external-developer-e2e.mjs [--engines chromium,firefox,webkit]
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium, firefox, webkit } from 'playwright';
import { assertNoUnknownSelectionFlags, enginesFromArgv, launchBrowser } from './lib/browser-engines.mjs';
import { applyExitCode, summarizeReports, summaryForArtifact } from './lib/harness-status.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..');
const dashboard = path.join(repo, 'examples', 'streetui-dashboard');
assertNoUnknownSelectionFlags();
const enginesArg = enginesFromArgv();

function argValue(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

/** Version under test: the workspace's coordinated version unless overridden. */
const targetVersion =
  argValue('--version') ??
  JSON.parse(fs.readFileSync(path.join(repo, 'packages', 'streetui', 'package.json'), 'utf8')).version;
/** Optional local tarball directory: accept an unreleased candidate (no registry). */
const tarballArg = argValue('--tarballs');
// Resolve against the caller's cwd immediately: the install runs in a temp
// project, where a relative path would be reinterpreted as a git/registry spec.
const tarballDir = tarballArg === undefined ? undefined : path.resolve(process.cwd(), tarballArg);
if (tarballDir !== undefined && !fs.existsSync(tarballDir)) {
  throw new Error(`--tarballs directory does not exist: ${tarballDir}`);
}

const report = {
  schema: 'streetui-external-developer-e2e/v2',
  created: new Date().toISOString(),
  targetVersion,
  // Evidence targets are never conflated: a tarball install is `local-packed`,
  // a registry install is `npm-registry`. Neither is GitHub CI evidence.
  target: tarballDir === undefined ? 'npm-registry' : 'local-packed',
  engines: {},
  ok: false,
};
const base = fs.mkdtempSync(path.join(os.tmpdir(), 'streetui-developer-e2e-'));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function run(cmd, args, cwd) {
  return execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 240000 });
}
function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}
async function waitForServer(url, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {
      /* not ready */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`server did not respond at ${url}`);
}

async function prepareConsumer() {
  const app = path.join(base, 'consumer');
  fs.mkdirSync(app, { recursive: true });
  run('npm', ['init', '-y'], app);
  if (tarballDir !== undefined) {
    // Offline install of the packed release candidate: no registry, no
    // workspace symlinks. This is the only honest pre-publish proof.
    const tarballs = fs.readdirSync(tarballDir)
      .filter((f) => f.endsWith('.tgz'))
      .map((f) => path.join(tarballDir, f));
    assert(tarballs.length > 0, `no tarballs in ${tarballDir}`);
    run('npm', ['install', '--offline', '--no-audit', '--no-fund', '--no-package-lock', ...tarballs], app);
  } else {
    run('npm', ['install', `streetui@${targetVersion}`, `@streetui/cli@${targetVersion}`, '--no-audit', '--no-fund', '--loglevel=error'], app);
  }
  const cliVersion = JSON.parse(fs.readFileSync(path.join(app, 'node_modules', '@streetui', 'cli', 'package.json'), 'utf8')).version;
  const frameworkVersion = JSON.parse(fs.readFileSync(path.join(app, 'node_modules', 'streetui', 'package.json'), 'utf8')).version;
  assert(
    cliVersion === targetVersion && frameworkVersion === targetVersion,
    `unexpected installed versions: cli=${cliVersion}, streetui=${frameworkVersion} (expected ${targetVersion})`,
  );
  assert(fs.existsSync(path.join(app, 'node_modules', 'create-streetui')), 'create-streetui was not installed');
  for (const entry of ['src', 'public', 'streetui.config.ts', 'tsconfig.json']) {
    fs.cpSync(path.join(dashboard, entry), path.join(app, entry), { recursive: true });
  }
  return { app, cliVersion, frameworkVersion };
}

async function verifyEngine(engine, app, origin) {
  const steps = {};
  const browser = await launchBrowser({ chromium, firefox, webkit }, engine);
  const actualEngine = browser.browserType().name();
  const browserVersion = browser.version();
  const consoleErrors = [];
  const pageErrors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1100, height: 750 } });
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await page.goto(`${origin}/`, { waitUntil: 'networkidle' });
    await page.waitForSelector('text=Total users', { timeout: 15000 });
    const metricText = await page.locator('body').innerText();
    assert(metricText.includes('24'), 'overview metrics did not render the user total');
    assert(metricText.includes('Recent activity'), 'activity feed missing');
    steps.overview = { metrics: true, activity: true };

    // Navigation + table content.
    await page.click('#nav-users');
    await page.waitForSelector('#user-search', { timeout: 15000 });
    await page.waitForFunction(() => document.body.innerText.includes('of 24 users'), undefined, { timeout: 15000 });
    steps.navigation = { usersRoute: true, tablePopulated: true };

    // Reactive filtering: query + role filter + pagination.
    await page.fill('#user-search', 'ava');
    await page.waitForFunction(() => document.body.innerText.includes('Ava Chen'), undefined, { timeout: 15000 });
    const filteredText = await page.locator('body').innerText();
    assert(filteredText.includes('Ava Chen'), 'search did not find Ava Chen');
    await page.fill('#user-search', '');
    await page.click('#role-admin');
    await page.waitForFunction(() => document.body.innerText.includes('of 6 users') || document.body.innerText.includes('of 24 users') === false, undefined, { timeout: 15000 });
    const adminRows = await page.locator('text=admin').count();
    assert(adminRows >= 1, 'role filter produced no admin results');
    await page.click('#role-all');
    await page.click('#users-next');
    await page.waitForFunction(() => document.body.innerText.includes('Page 2 of 3'), undefined, { timeout: 15000 });
    steps.filters = { search: true, role: true, pagination: true };

    // Accessibility: labelled inputs and keyboard-only interaction.
    const labelled = await page.evaluate(() => {
      const input = document.getElementById('user-search');
      const label = document.getElementById('user-search-label');
      return input?.getAttribute('aria-labelledby') === 'user-search-label' && label !== null;
    });
    assert(labelled, 'search input is not labelled via aria-labelledby');
    await page.focus('#user-search');
    await page.keyboard.type('ava');
    await page.waitForFunction(() => document.body.innerText.includes('Ava Chen'), undefined, { timeout: 15000 });
    await page.fill('#user-search', '');
    steps.accessibility = { labelledInputs: true, keyboardNavigation: true };

    // Projects view + status filter.
    await page.click('#nav-projects');
    await page.waitForSelector('text=Billing migration', { timeout: 15000 });
    await page.click('#status-at-risk');
    await page.waitForFunction(() => !document.body.innerText.includes('Billing migration'), undefined, { timeout: 15000 });
    steps.projects = { statusFilter: true };

    // Validated forms: invalid then valid submission.
    await page.click('#nav-settings');
    await page.click('#profile-submit');
    await page.waitForFunction(() => document.body.innerText.toLowerCase().includes('required') || document.body.innerText.toLowerCase().includes('email'), undefined, { timeout: 15000 });
    await page.fill('#profile-name-input', 'Ada Lovelace');
    await page.fill('#profile-email-input', 'ada@example.com');
    await page.click('#profile-submit');
    await page.waitForFunction(() => document.body.innerText.includes('Profile saved for Ada Lovelace'), undefined, { timeout: 15000 });
    steps.forms = { validationErrors: true, successfulSubmit: true };

    // Theme toggle + responsive layout signal.
    await page.click('#theme-toggle');
    const theme = await page.evaluate(() => document.documentElement.dataset.theme);
    assert(theme === 'dark', `theme did not switch to dark (got ${theme})`);
    steps.theme = { darkMode: true };

    // Screenshot: real PNG with a valid signature.
    const png = await page.screenshot({ type: 'png', fullPage: true });
    const signature = png.subarray(0, 8).toString('hex');
    assert(signature === '89504e470d0a1a0a', 'screenshot is not a valid PNG');
    assert(png.readUInt32BE(16) > 0 && png.readUInt32BE(20) > 0, 'screenshot has no dimensions');
    steps.screenshot = { bytes: png.length, width: png.readUInt32BE(16), height: png.readUInt32BE(20) };

    // Production route 404 handling.
    await page.goto(`${origin}/does-not-exist`, { waitUntil: 'networkidle' });
    await page.waitForSelector('text=Page not found', { timeout: 15000 });
    steps.notFound = { fallback: true };

    assert(consoleErrors.length === 0, `console errors: ${consoleErrors.join(' | ')}`);
    assert(pageErrors.length === 0, `runtime errors: ${pageErrors.join(' | ')}`);
    steps.console = { errors: 0, runtimeErrors: 0 };
    return {
      ok: true,
      status: 'PASS',
      requestedEngine: engine,
      actualEngine,
      browserVersion,
      requestedMode: 'prod',
      actualMode: 'prod',
      steps,
    };
  } finally {
    await browser.close();
  }
}

try {
  const { app, cliVersion, frameworkVersion } = await prepareConsumer();
  report.installed = { cli: cliVersion, streetui: frameworkVersion };
  // The unified `streetui` package ships a same-named bin, so `.bin/streetui`
  // does not reliably resolve to the CLI. Invoke the CLI entry point directly.
  const bin = path.join(app, 'node_modules', '@streetui', 'cli', 'dist', 'bin.js');
  assert(fs.existsSync(bin), `CLI bin missing at ${bin}`);
  run(process.execPath, [bin, 'build'], app);
  assert(fs.existsSync(path.join(app, 'dist', 'client', 'manifest.json')), 'production manifest missing');
  report.build = { manifest: true };

  const port = await freePort();
  const origin = `http://localhost:${port}`;
  const server = spawn(process.execPath, [bin, 'start', '--port', String(port)], { cwd: app, stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    await waitForServer(origin);
    for (const engine of enginesArg) {
      try {
        report.engines[engine] = await verifyEngine(engine, app, origin);
        console.log(`${engine}: VERIFIED`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const blocked = /Executable doesn't exist|Failed to launch|browserType\.launch/i.test(message);
        report.engines[engine] = {
          ok: false,
          status: blocked ? 'BLOCKED' : 'FAIL',
          requestedEngine: engine,
          actualEngine: null,
          browserVersion: null,
          requestedMode: 'prod',
          actualMode: null,
          reason: message.split('\n')[0],
          error: message,
        };
        console.log(`${engine}: ${blocked ? 'BLOCKED' : 'FAIL'} — ${message.split('\n')[0]}`);
      }
    }
  } finally {
    server.kill('SIGTERM');
  }
} catch (error) {
  report.error = error instanceof Error ? error.message : String(error);
  console.error(report.error);
}

const rows = Object.values(report.engines);
if (report.engines === undefined || rows.length === 0) {
  // A fixture failure before any engine ran is a blocked run, not a green one.
  rows.push({
    status: 'BLOCKED',
    requestedEngine: enginesArg[0],
    requestedMode: 'prod',
    reason: report.error ?? 'no engine was run',
  });
}
const summary = summarizeReports(rows, {
  requestedEngines: enginesArg,
  requestedModes: ['prod'],
});
report.ok = summary.exitCode === 0;
report.summary = summaryForArtifact(summary);

const outDir = path.join(repo, 'benchmarks', 'results', 'toolchain');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'external-developer-e2e.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
process.exitCode = applyExitCode(summary, process.stdout);
if (!report.ok) console.error(`artifacts kept at ${base}`);
else fs.rmSync(base, { recursive: true, force: true });
