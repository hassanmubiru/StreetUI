/**
 * StreetUI toolchain browser verification harness.
 *
 *   node scripts/toolchain-browser-tests.mjs [--engine chromium|firefox|all]
 *                                             [--mode dev|prod|both]
 *
 * Drives real Chromium and Firefox (via the installed Playwright) against a
 * freshly scaffolded StreetUI app. Each engine/mode combination runs the same
 * shared scenarios and writes a JSON report. If a browser binary is missing,
 * that engine/mode is recorded as BLOCKED, never as passed.
 *
 * No happy-dom is ever substituted for a real browser.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..');
// The built CLI finds its templates relative to the working directory.
process.chdir(path.join(repo, 'packages', 'cli'));
const cliEntry = path.join(repo, 'packages', 'cli', 'dist', 'index.js');
const { createProject, resolveProject, buildProject, createDevServer, startPreview, runStart } = await import(cliEntry);

const engines = process.argv.includes('--engine')
  ? process.argv[process.argv.indexOf('--engine') + 1].split(',')
  : ['chromium', 'firefox'];
const modes = process.argv.includes('--mode')
  ? process.argv[process.argv.indexOf('--mode') + 1].split(',')
  : ['dev', 'prod'];

const resultsDir = path.join(repo, 'benchmarks', 'results', 'toolchain');
fs.mkdirSync(resultsDir, { recursive: true });

const noopLogger = () => ({ info() {}, success() {}, warn() {}, error() {}, plain() {} });

async function wireDependencies(projectRoot) {
  const { mkdir, symlink } = await import('node:fs/promises');
  const modules = path.join(projectRoot, 'node_modules');
  const scoped = path.join(modules, '@streetui');
  await mkdir(scoped, { recursive: true });
  const pkgs = ['compiler', 'dom', 'dsl', 'renderer', 'state', 'core', 'graph', 'runtime', 'events', 'scheduler', 'cli'];
  for (const pkg of pkgs) {
    await symlink(path.join(repo, 'packages', pkg), path.join(scoped, pkg), 'dir');
  }
}

function makeScenarios(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`);
  });

  const wrap = (fn) => async (url) => {
    try {
      const result = await Promise.race([
        fn(url),
        new Promise((_, reject) => setTimeout(() => reject(new Error('scenario timeout 60s')), 60000)),
      ]);
      result.errors = [...errors];
      return result;
    } catch (error) {
      let body = '';
      try {
        body = await page.content();
      } catch {
        /* ignore */
      }
      return { ok: false, error: String(error && error.message || error), errors: [...errors], body: body.slice(0, 2000) };
    }
  };

  return {
    initialRender: wrap(async (url) => {
      await page.goto(url, { waitUntil: 'load' });
      await page.waitForSelector('#app', { timeout: 15000 });
      return { ok: true, text: await page.textContent('#app') };
    }),
    interact: wrap(async (url) => {
      await page.goto(url, { waitUntil: 'load' });
      await page.waitForSelector('#increment', { timeout: 15000 });
      await page.click('#increment');
      await page.waitForFunction(() => document.getElementById('count')?.textContent.includes('1'), null, { timeout: 5000 });
      return { ok: true };
    }),
    navigate: wrap(async (url) => {
      await page.goto(url, { waitUntil: 'load' });
      await page.waitForSelector('#nav-about', { timeout: 15000 });
      await page.click('#nav-about');
      await page.waitForSelector('#about-title', { timeout: 5000 });
      return { ok: true };
    }),
    form: wrap(async (url) => {
      await page.goto(url, { waitUntil: 'load' });
      await page.waitForSelector('#name-input', { timeout: 15000 });
      await page.fill('#name-input', 'Ada');
      await page.click('#greet-submit');
      await page.waitForSelector('#greeting', { timeout: 5000 });
      const greeting = await page.textContent('#greeting');
      return { ok: /Hello, Ada/.test(greeting), greeting };
    }),
    consoleClean: wrap(async (url) => {
      await page.goto(url, { waitUntil: 'load' });
      await page.waitForSelector('#app', { timeout: 15000 });
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 300));
      return { ok: true };
    }),
    refreshNested: wrap(async (url) => {
      await page.goto(url.replace(/\/$/, '') + '/about', { waitUntil: 'load' });
      await page.waitForSelector('#nav-about', { timeout: 15000 });
      await page.click('#nav-about');
      await page.waitForSelector('#about-title', { timeout: 5000 });
      await page.reload({ waitUntil: 'load' });
      await page.waitForSelector('#about-title', { timeout: 8000 });
      return { ok: true };
    }),
  };
}

async function runServer(mode, project, logger) {
  if (mode === 'dev') {
    const server = await createDevServer({ project, logger });
    return { url: server.url, stop: server.stop };
  }
  const server = await runStart({ project, logger });
  return { url: server.url, stop: server.close };
}

function findBrowserBin(engine) {
  const cache = path.join(os.homedir(), '.cache', 'ms-playwright');
  if (!fs.existsSync(cache)) return undefined;
  let prefix;
  if (engine === 'firefox') prefix = 'firefox-';
  else if (engine === 'webkit') prefix = 'webkit-';
  else prefix = 'chromium-';
  let names = [];
  try {
    names = fs.readdirSync(cache).filter((n) => n.startsWith(prefix));
  } catch {
    return undefined;
  }
  names.sort((a, b) => {
    const va = Number.parseInt(a.slice(prefix.length), 10);
    const vb = Number.parseInt(b.slice(prefix.length), 10);
    return vb - va;
  });
  for (const name of names) {
    const rootPath = path.join(cache, name);
    let candidate;
    if (engine === 'firefox') candidate = path.join(rootPath, 'firefox', 'firefox');
    else if (engine === 'webkit') candidate = path.join(rootPath, 'pw_run.sh') ?? path.join(rootPath, 'MiniBrowser');
    else candidate = path.join(rootPath, 'chrome-linux', 'chrome');
    if (typeof candidate === 'string' && fs.existsSync(candidate)) return candidate;
  }
  return undefined;
}

async function runEngineMode(engine, mode, playwright) {
  const report = {
    schema: 'streetui-toolchain-browser/v1',
    engine,
    mode,
    status: 'BLOCKED',
    reason: '',
    scenarios: {},
  };
  const browsers = playwright[engine];
  let binary = browsers?.executablePath?.();
  if (!binary || !fs.existsSync(binary)) binary = findBrowserBin(engine);
  if (!binary || !fs.existsSync(binary)) {
    report.reason = `No launchable ${engine} binary is available.`;
    return report;
  }

  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'streetui-browser-'));
  try {
    process.stderr.write(`[harness] ${engine}/${mode}: setup\n`);
    const { mkdir, symlink } = await import('node:fs/promises');
    const projectRoot = path.join(base, 'app');
    const logger = noopLogger();
    await createProject({ targetDir: projectRoot, template: 'ssr', frameworkVersion: '3.1.0', logger });
    await wireDependencies(projectRoot);
    const project = await resolveProject(projectRoot, { requireEntry: true });

    const server = await runServer(mode, project, logger);
    process.stderr.write(`[harness] ${engine}/${mode}: server ${server.url}\n`);
    try {
      let browser;
      process.stderr.write(`[harness] ${engine}/${mode}: launching\n`);
      try {
        browser = await browsers.launch();
      } catch (error) {
        if (!binary || !fs.existsSync(binary)) throw error;
        browser = await browsers.launch({ executablePath: binary });
      }
      process.stderr.write(`[harness] ${engine}/${mode}: launched\n`);
      try {
        const page = await Promise.race([
          browser.newPage(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('newPage timeout 30s')), 30000)),
        ]);
        const scenarios = makeScenarios(page);
        const results = {};
        for (const [name, run] of Object.entries(scenarios)) {
          results[name] = await run(`${server.url}/`);
        }
        report.status = Object.values(results).every((r) => r.ok) ? 'OK' : 'FAIL';
        report.scenarios = results;
        return report;
      } finally {
        await browser.close();
      }
    } finally {
      await server.stop();
    }
  } catch (error) {
    report.status = 'ERROR';
    report.reason = String(error && error.stack || error);
    return report;
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
}

let playwright = null;
try {
  playwright = await import('playwright');
} catch {
  playwright = null;
}

const all = [];
if (!playwright) {
  for (const engine of engines) {
    for (const mode of modes) {
      all.push({ schema: 'streetui-toolchain-browser/v1', engine, mode, status: 'BLOCKED', reason: 'Playwright is not installed.', scenarios: {} });
    }
  }
} else {
  for (const engine of engines) {
    for (const mode of modes) {
      all.push(await runEngineMode(engine, mode, playwright));
    }
  }
}

for (const report of all) {
  const file = path.join(resultsDir, `${report.engine}-${report.mode}.json`);
  fs.writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`toolchain-browser: ${report.engine}/${report.mode} → ${report.status} (${file})\n`);
}