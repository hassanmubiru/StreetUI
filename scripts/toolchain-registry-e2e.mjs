#!/usr/bin/env node
/**
 * M8.3 — Live public-registry end-to-end verification.
 *
 * Probes the actually-published packages and, only if they correspond to the
 * independent toolchain (M0–M8), runs the full lifecycle: generate → install →
 * dev → browser → HMR → build → preview → agent events.
 *
 * If the published CLI is stale (declares esbuild and/or exposes the old
 * command surface), every lifecycle step is recorded as BLOCKED with the reason
 * — never fabricated as passed.
 *
 * Usage:  node scripts/toolchain-registry-e2e.mjs [--engines chromium,firefox,webkit]
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  assertNoUnknownSelectionFlags,
  enginesFromArgv,
  launchBrowser,
} from './lib/browser-engines.mjs';
import { applyExitCode, summarizeReports } from './lib/harness-status.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..');
const REGISTRY = 'https://registry.npmjs.org/';
const PUBLISHED_CLI = '@streetui/cli';

/** The version under test is the workspace version, never a hardcoded pin. */
const WORKSPACE_VERSION = JSON.parse(
  fs.readFileSync(path.join(repo, 'packages', 'streetui', 'package.json'), 'utf8'),
).version;

assertNoUnknownSelectionFlags();
const enginesArg = enginesFromArgv();

const CLI_SPEC = `@streetui/cli@${WORKSPACE_VERSION}`;
const EXPECTED_CLI_VERSION = WORKSPACE_VERSION;

const base = fs.mkdtempSync(path.join(os.tmpdir(), 'streetui-e2e-'));
const cache = path.join(base, 'npm-cache');
fs.mkdirSync(cache, { recursive: true });
const env = { ...process.env, npm_config_registry: REGISTRY, npm_config_cache: cache, NO_COLOR: '1' };

function run(args, cwd, opts = {}) {
  return execFileSync(args[0], args.slice(1), {
    cwd,
    env,
    encoding: 'utf8',
    stdio: opts.silent ? ['ignore', 'pipe', 'pipe'] : ['ignore', 'pipe', 'inherit'],
  });
}

function view(pkg, fields) {
  try {
    const raw = execFileSync('npm', ['view', pkg, ...fields, '--json'], { env, encoding: 'utf8' });
    return JSON.parse(raw);
  } catch (error) {
    return { error: String(error.message).split('\n')[0] };
  }
}

function waitForEvent(child, predicate, timeoutMs = 70000) {
  return new Promise((resolve, reject) => {
    let acc = '';
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`event timeout\n${acc}`));
    }, timeoutMs);
    const onData = (chunk) => {
      acc += chunk.toString();
      const lines = acc.split('\n');
      acc = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const ev = JSON.parse(line);
          if (predicate(ev)) {
            clearTimeout(timer);
            child.stdout.off('data', onData);
            resolve(ev);
            return;
          }
        } catch {
          /* ignore */
        }
      }
    };
    child.stdout.on('data', onData);
    child.on('error', reject);
  });
}

async function waitForHttp(url, ms = 45000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    try {
      const res = await fetch(url);
      if (res.status < 500) return res;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`http timeout ${url}`);
}

function spawnCli(cwd, args) {
  return spawn(path.join(cwd, 'node_modules', '.bin', 'streetui'), args, {
    cwd,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function makeScenarios(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
  const wrap = (fn) => async (url) => {
    try {
      const r = await fn(url);
      r.errors = [...errors];
      return r;
    } catch (error) {
      return { ok: false, error: String(error.message), errors: [...errors] };
    }
  };
  return {
    initialRender: wrap(async (url) => {
      await page.goto(url, { waitUntil: 'load' });
      await page.waitForSelector('#app', { timeout: 15000 });
      return { ok: true };
    }),
    interact: wrap(async (url) => {
      await page.goto(url, { waitUntil: 'load' });
      await page.waitForSelector('#increment', { timeout: 15000 });
      await page.click('#increment');
      await page.waitForFunction(() => document.getElementById('count')?.textContent.includes('1'), null, { timeout: 6000 });
      return { ok: true };
    }),
    form: wrap(async (url) => {
      await page.goto(url, { waitUntil: 'load' });
      await page.waitForSelector('#name-input', { timeout: 15000 });
      await page.fill('#name-input', 'Ada');
      await page.click('#greet-submit');
      await page.waitForSelector('#greeting', { timeout: 6000 });
      return { ok: true };
    }),
    navigate: wrap(async (url) => {
      await page.goto(url, { waitUntil: 'load' });
      await page.waitForSelector('#nav-about', { timeout: 15000 });
      await page.click('#nav-about');
      await page.waitForSelector('#about-title', { timeout: 6000 });
      return { ok: true };
    }),
    refreshNested: wrap(async (url) => {
      await page.goto(url.replace(/\/$/, '') + '/about', { waitUntil: 'load' });
      await page.waitForSelector('#nav-about', { timeout: 15000 });
      await page.click('#nav-about');
      await page.waitForSelector('#about-title', { timeout: 6000 });
      await page.reload({ waitUntil: 'load' });
      await page.waitForSelector('#about-title', { timeout: 8000 });
      return { ok: true };
    }),
    consoleClean: wrap(async (url) => {
      await page.goto(url, { waitUntil: 'load' });
      await page.waitForSelector('#app', { timeout: 15000 });
      await new Promise((r) => setTimeout(r, 300));
      return { ok: errors.length === 0 };
    }),
  };
}

async function runBrowser(engine, url, scenarioSet) {
  const playwright = await import('playwright');
  const browser = await launchBrowser(playwright, engine, { timeout: 45000 });
  const evidence = {
    requestedEngine: engine,
    actualEngine: browser.browserType().name(),
    browserVersion: browser.version(),
  };
  try {
    const page = await browser.newPage();
    const scenarios = makeScenarios(page);
    const results = {};
    for (const name of scenarioSet) results[name] = await scenarios[name](url);
    return { ...evidence, status: Object.values(results).every((r) => r.ok) ? 'PASS' : 'FAIL', results };
  } finally {
    await browser.close();
  }
}

async function verifyTemplate(template, index) {
  const app = path.join(base, `app-${template}`);
  const r = { template, generator: false, install: false, identity: 'unknown', dev: false, build: false, preview: false, browser: {}, hmr: false };
  try {
    run(['npx', '--yes', '--package', CLI_SPEC, 'streetui', 'create', `app-${template}`, '--template', template], base);
    r.generator = fs.existsSync(path.join(app, 'package.json'));
  } catch (error) {
    r.generatorError = String(error.message).split('\n')[0];
    return r;
  }
  try {
    run(['npm', 'install', '--no-audit', '--no-fund'], app);
    r.install = true;
    const cliPkg = JSON.parse(fs.readFileSync(path.join(app, 'node_modules', '@streetui', 'cli', 'package.json'), 'utf8'));
    r.identity = cliPkg.dependencies?.esbuild !== undefined ? 'stale-esbuild' : 'independent';
  } catch (error) {
    r.installError = String(error.message).split('\n')[0];
    return r;
  }
  if (r.identity !== 'independent') {
    r.note = `Published CLI still depends on esbuild. Full lifecycle is BLOCKED against the published packages; source work is validated by the local/packed harnesses instead.`;
    return r;
  }
  // Independent published CLI → run full lifecycle.
  try {
    const port = 4000 + index * 20;
    const dev = spawnCli(app, ['dev', '--json', '--port', String(port)]);
    const ready = await waitForEvent(dev, (e) => e.event === 'preview_ready');
    r.dev = ready.event === 'preview_ready' && ready.version === EXPECTED_CLI_VERSION;
    const scenarios = ['initialRender', 'interact', 'form', 'navigate', 'refreshNested', 'consoleClean'];
    for (const engine of enginesArg) {
      try {
        r.browser[engine] = await runBrowser(engine, `${ready.url}`, template === 'ssr' ? scenarios : ['initialRender', 'interact', 'consoleClean']);
      } catch (error) {
        const message = String(error && error.message || error);
        const blocked = /Executable doesn't exist|Failed to launch|error while loading shared libraries|Host system is missing dependencies/i.test(message);
        r.browser[engine] = {
          requestedEngine: engine,
          actualEngine: null,
          status: blocked ? 'BLOCKED' : 'ERROR',
          fatal: message.split('\n')[0],
        };
      }
    }
    const appTs = path.join(app, 'src', 'app.ts');
    const original = fs.readFileSync(appTs, 'utf8');
    fs.writeFileSync(appTs, `${original}\n// e2e-edit ${Date.now()}\n`);
    const changeEv = await waitForEvent(dev, (e) => e.event === 'file_changed' || e.event === 'module_updated', 15000).catch(() => null);
    r.hmr = changeEv !== null;
    dev.kill('SIGTERM');
    await new Promise((r2) => setTimeout(r2, 300));
  } catch (error) {
    r.devError = String(error.message).split('\n')[0];
  }
  try {
    const out = run([path.join(app, 'node_modules', '.bin', 'streetui'), 'build', '--json'], app, { silent: true });
    r.build = out.split('\n').some((l) => {
      try {
        return JSON.parse(l).event === 'build_completed';
      } catch {
        return false;
      }
    }) && fs.existsSync(path.join(app, 'dist', 'client', 'manifest.json'));
  } catch {
    r.build = false;
  }
  try {
    const manifest = JSON.parse(fs.readFileSync(path.join(app, 'dist', 'client', 'manifest.json'), 'utf8'));
    const port = 5000 + index * 20;
    const child = spawnCli(app, ['preview', '--json', '--port', String(port)]);
    const ready = await waitForEvent(child, (e) => e.event === 'preview_ready');
    const res = await waitForHttp(`${ready.url}${manifest.entry.js}`);
    r.preview = res.status === 200;
    child.kill('SIGTERM');
  } catch {
    r.preview = false;
  }
  return r;
}

const report = {
  schema: 'streetui-toolchain-registry-e2e/v1',
  created: new Date().toISOString(),
  registry: REGISTRY,
  evidenceTarget: 'npm-registry',
  workspaceVersion: WORKSPACE_VERSION,
  requestedEngines: enginesArg,
  publishedIdentity: {},
  templates: {},
  status: 'BLOCKED',
};

/** A lifecycle passes only when the browser AND HMR work, not just dev/build. */
function lifecyclePasses(template) {
  const enginesVerified = enginesArg.every((engine) => template.browser[engine]?.status === 'PASS');
  return Boolean(template.dev && template.build && template.preview && template.hmr && enginesVerified);
}

try {
  const cli = view(PUBLISHED_CLI, ['version', 'dependencies']);
  const streetui = view('streetui', ['version', 'dependencies']);
  report.publishedIdentity[PUBLISHED_CLI] = { version: cli.version, dependencies: cli.dependencies, esbuild: cli.dependencies?.esbuild };
  report.publishedIdentity.streetui = { version: streetui.version, dependencies: streetui.dependencies, esbuild: streetui.dependencies?.esbuild };

  report.templates.basic = await verifyTemplate('basic', 0);
  report.templates.ssr = await verifyTemplate('ssr', 1);

  const stale = report.publishedIdentity[PUBLISHED_CLI].esbuild || report.publishedIdentity.streetui.esbuild;
  const lifecyclesPass = lifecyclePasses(report.templates.basic) && lifecyclePasses(report.templates.ssr);
  if (!stale && lifecyclesPass) report.status = 'PASS';
  else if (!stale) report.status = 'PARTIAL';
  else report.status = 'BLOCKED';
} catch (error) {
  report.fatal = String(error.stack || error);
}

const resultsDir = path.join(repo, 'benchmarks', 'results', 'toolchain');
fs.mkdirSync(resultsDir, { recursive: true });
fs.writeFileSync(path.join(resultsDir, 'registry-e2e.json'), `${JSON.stringify(report, null, 2)}\n`);

console.log('StreetUI Registry E2E');
console.log('Workspace version: ' + WORKSPACE_VERSION);
console.log('Published cli esbuild: ' + (report.publishedIdentity[PUBLISHED_CLI]?.esbuild || 'none'));
console.log('Basic: ' + report.templates.basic.identity);
console.log('SSR: ' + report.templates.ssr.identity);
console.log('Final status: ' + report.status);

fs.rmSync(base, { recursive: true, force: true });

// One row per template so an unverified engine or a blocked publish is fatal
// under CI/--require rather than silently green.
const rows = Object.values(report.templates).map((template) => ({
  engine: template.template,
  mode: 'lifecycle',
  status: report.status === 'BLOCKED' ? 'BLOCKED' : template.identity === 'independent' && lifecyclePasses(template) ? 'PASS' : 'FAIL',
  reason: report.status === 'BLOCKED' ? 'published packages are not the independent toolchain' : template.note,
}));
process.exitCode = applyExitCode(summarizeReports(rows), process.stdout);
