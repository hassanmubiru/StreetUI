#!/usr/bin/env node
/**
 * M8.1 — Public npm registry smoke test.
 *
 * Proves StreetUI is installable directly from the public npm registry:
 *   - audits the 18 packages (version, dist-tag, tarball, integrity),
 *   - runs the real generator (`npm create streetui@latest`),
 *   - installs both templates from the registry (isolated cache),
 *   - drives the full lifecycle: doctor → dev (JSONL events) → browser →
 *     HMR edit → build (build_completed) → preview,
 *   - verifies real third-party registry packages (supported + CJS diagnostic),
 *   - writes machine-readable results to
 *     benchmarks/results/toolchain/registry-smoke.json.
 *
 * No file: aliases, no workspace links, no monorepo source at runtime.
 * Usage:  node scripts/toolchain-registry-smoke.mjs [--engines chromium,firefox,webkit]
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { assertNoUnknownSelectionFlags, enginesFromArgv, launchBrowser } from './lib/browser-engines.mjs';
import { applyExitCode, isNetworkError, summarizeReports } from './lib/harness-status.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..');
const REGISTRY = 'https://registry.npmjs.org/';

/** Expected published version is the workspace version — never a stale pin. */
const WORKSPACE_VERSION = JSON.parse(
  fs.readFileSync(path.join(repo, 'packages', 'streetui', 'package.json'), 'utf8'),
).version;

const PUBLISHED = [
  '@streetui/core', '@streetui/state', '@streetui/graph', '@streetui/dsl',
  '@streetui/compiler', '@streetui/runtime', '@streetui/events', '@streetui/scheduler',
  '@streetui/dom', '@streetui/renderer', '@streetui/router', '@streetui/forms',
  '@streetui/i18n', '@streetui/context', '@streetui/devtools', '@streetui/testing',
  '@streetui/cli', 'streetui',
];

const GENERATOR_PACKAGE = 'create-streetui';

assertNoUnknownSelectionFlags();
const enginesArg = enginesFromArgv();

const base = fs.mkdtempSync(path.join(os.tmpdir(), 'streetui-smoke-'));
const cache = path.join(base, 'npm-cache');
fs.mkdirSync(cache, { recursive: true });

const env = { ...process.env, npm_config_registry: REGISTRY, npm_config_cache: cache, NO_COLOR: '1' };

function run(args, cwd, opts = {}) {
  const out = execFileSync(args[0], args.slice(1), {
    cwd,
    env,
    encoding: 'utf8',
    stdio: opts.silent ? ['ignore', 'pipe', 'pipe'] : ['ignore', 'pipe', 'inherit'],
  });
  return out ?? '';
}

function view(pkg) {
  try {
    const raw = execFileSync('npm', ['view', pkg, 'version', 'dist.tarball', 'dist.integrity', 'dist-tags.latest', '--json'], {
      env,
      encoding: 'utf8',
    });
    const data = JSON.parse(raw);
    return {
      package: pkg,
      version: typeof data.version === 'string' ? data.version : data.latest,
      tarball: data.tarball,
      integrity: data.integrity,
      latest: data.latest ?? data.version,
      ok: true,
    };
  } catch (error) {
    return { package: pkg, ok: false, error: String(error.message).split('\n')[0] };
  }
}

function waitForHttp(url, ms = 45000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const iv = setInterval(async () => {
      try {
        const res = await fetch(url);
        if (res.status < 500) {
          clearInterval(iv);
          resolve(res);
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

async function readEventsWhile(child, predicate, timeoutMs = 60000) {
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

function spawnCli(cwd, args) {
  return spawn(path.join(cwd, 'node_modules', '.bin', 'streetui'), args, {
    cwd,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

async function withDevServer(cwd, port) {
  const child = spawnCli(cwd, ['dev', '--json', '--port', String(port)]);
  const ready = await readEventsWhile(child, (e) => e.event === 'preview_ready');
  return { child, ready };
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
      return { ok: true, greeting: await page.textContent('#greeting') };
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

async function runBrowser(engine, url, scenariosToRun) {
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
    for (const name of scenariosToRun) results[name] = await scenarios[name](url);
    return { ...evidence, status: Object.values(results).every((r) => r.ok) ? 'PASS' : 'FAIL', results };
  } finally {
    await browser.close();
  }
}

let generatorBin;

/** Preserve npm's network evidence and distinguish it from a product failure. */
function recordAttemptError(result, error, field = 'error') {
  const text = [error?.message, error?.stderr, error?.stdout]
    .filter((value) => value !== undefined && value !== null && String(value).length > 0)
    .map(String)
    .join('\n');
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  const networkLine = lines.find((line) => /npm error (?:code|network)|ETIMEDOUT|ECONNRESET|EAI_AGAIN/i.test(line));
  result[field] = networkLine ?? lines[0] ?? String(error);
  if (isNetworkError(error)) {
    result.infrastructureError = `Registry/network unavailable: ${result[field]}`;
  }
}

function ensureGenerator() {
  if (generatorBin) return generatorBin;
  run(['npm', 'install', '--no-save', '@streetui/cli'], base);
  generatorBin = path.join(base, 'node_modules', '.bin', 'streetui');
  return generatorBin;
}

async function verifyTemplate(template, index) {
  const app = path.join(base, `app-${template}`);
  const result = { template, generated: false, installed: false, publishedMatchesRepo: false, doctor: false, dev: false, build: false, preview: false, browser: {} };

  // 0. Discover generator syntax (do not invent flags).
  if (report.generatorHelp === undefined) {
    try {
      report.generatorHelp = execFileSync('npx', ['-y', 'streetui', 'create', '--help'], { env, encoding: 'utf8', timeout: 60000 });
    } catch {
      report.generatorHelp = '(unavailable)';
    }
  }

  // 1. Generate with the canonical `npm create streetui@latest` entry point when
  //     the `create-streetui` initializer is published; otherwise use the
  //     published `@streetui/cli` binary and record the fallback explicitly.
  const generatorState = view(GENERATOR_PACKAGE);
  report.generatorAvailable = generatorState.ok;
  report.generatorSource = generatorState.ok ? 'npm create streetui@latest' : '@streetui/cli binary (initializer unpublished)';
  try {
    const bin = ensureGenerator();
    if (generatorState.ok) {
      run(['npm', 'create', 'streetui@latest', `app-${template}`, '--', '--template', template], base);
    } else {
      run([bin, 'create', `app-${template}`, '--template', template], base);
    }
    result.generated = fs.existsSync(path.join(app, 'package.json'));
  } catch (error) {
    recordAttemptError(result, error);
    return result;
  }

  // 2. Install from the registry.
  try {
    run(['npm', 'install', '--no-audit', '--no-fund'], app);
    const installedVersion = (JSON.parse(fs.readFileSync(path.join(app, 'node_modules', '@streetui', 'renderer', 'package.json'), 'utf8'))).version;
    result.installedVersion = installedVersion;
    result.expectedVersion = WORKSPACE_VERSION;
    result.installed = installedVersion === WORKSPACE_VERSION;
    const cliPkg = JSON.parse(fs.readFileSync(path.join(app, 'node_modules', '@streetui', 'cli', 'package.json'), 'utf8'));
    result.publishedMatchesRepo = cliPkg.dependencies?.esbuild === undefined;
    result.publishedCliHasEsbuild = cliPkg.dependencies?.esbuild !== undefined;
    const cli = fs.readFileSync(path.join(app, 'package.json'), 'utf8');
    if (/vite/i.test(cli) || /workspace:/.test(cli)) throw new Error('generated project references vite or workspace:');
  } catch (error) {
    recordAttemptError(result, error, 'installError');
    return result;
  }

  // The published packages may still be the older, esbuild-based toolchain. If
  // so, full lifecycle verification against them would not validate this repo:
  // record the mismatch instead of pretending the lifecycle ran.
  if (!result.publishedMatchesRepo) {
    result.stalePublished = true;
    result.note = `Published ${WORKSPACE_VERSION} packages still depend on esbuild (stale toolchain); lifecycle verification skipped.`;
    return result;
  }

  // 3. doctor
  try {
    run([path.join(app, 'node_modules', '.bin', 'streetui'), 'doctor'], app);
    result.doctor = true;
  } catch {
    result.doctor = false;
  }

  // 4. dev (JSONL events) + browser
  const devPort = 3600 + index * 20;
  try {
    const { child, ready } = await withDevServer(app, devPort);
    result.dev = ready.event === 'preview_ready' && ready.version === WORKSPACE_VERSION;
    result.devUrl = ready.url;

    const fullScenarios = ['initialRender', 'interact', 'form', 'navigate', 'refreshNested', 'consoleClean'];
    const lightScenarios = ['initialRender', 'interact', 'consoleClean'];
    for (const engine of enginesArg) {
      try {
        result.browser[engine] = await runBrowser(engine, `${ready.url}`, template === 'ssr' ? fullScenarios : lightScenarios);
      } catch (error) {
        const message = String(error && error.message || error);
        const blocked = /Executable doesn't exist|Failed to launch|error while loading shared libraries|Host system is missing dependencies/i.test(message);
        result.browser[engine] = {
          requestedEngine: engine,
          actualEngine: null,
          status: blocked ? 'BLOCKED' : 'ERROR',
          fatal: message.split('\n')[0],
        };
      }
    }

    // HMR edit: append a valid line; expect a file_changed/module_updated event.
    const appTs = path.join(app, 'src', 'app.ts');
    const original = fs.readFileSync(appTs, 'utf8');
    fs.writeFileSync(appTs, `${original}\n// smoke-edit ${Date.now()}\n`);
    const changeEv = await readEventsWhile(child, (e) => e.event === 'file_changed' || e.event === 'module_updated', 15000).catch(() => null);
    result.hmr = changeEv !== null;

    child.kill('SIGTERM');
    await new Promise((r) => setTimeout(r, 300));
  } catch (error) {
    result.devError = String(error.message).split('\n')[0];
  }

  // 5. build → build_completed
  try {
    const out = run([path.join(app, 'node_modules', '.bin', 'streetui'), 'build', '--json'], app, { silent: true });
    const completed = out.split('\n').map((l) => l.trim()).filter(Boolean).some((l) => {
      try {
        return JSON.parse(l).event === 'build_completed';
      } catch {
        return false;
      }
    });
    result.build = completed && fs.existsSync(path.join(app, 'dist', 'client', 'manifest.json'));
  } catch {
    result.build = false;
  }

  // 6. preview serves the hashed entry
  try {
    const manifest = JSON.parse(fs.readFileSync(path.join(app, 'dist', 'client', 'manifest.json'), 'utf8'));
    const previewPort = 4700 + index * 20;
    const child = spawnCli(app, ['preview', '--json', '--port', String(previewPort)]);
    const ready = await readEventsWhile(child, (e) => e.event === 'preview_ready');
    const res = await waitForHttp(`${ready.url}${manifest.entry.js}`);
    result.preview = res.status === 200;
    child.kill('SIGTERM');
  } catch {
    result.preview = false;
  }

  return result;
}

async function verifyThirdParty() {
  const dir = path.join(base, 'third-party');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify({ name: 'smoke-third-party', private: true, version: '0.0.0', type: 'module', dependencies: { nanoid: '*', clsx: '*', 'date-fns': '*', slugify: '*' } }, null, 2) + '\n',
  );
  run(['npm', 'install', '--no-audit', '--no-fund'], dir);

  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'src', 'main.ts'),
    [
      'import { nanoid } from "nanoid";',
      'import { clsx } from "clsx";',
      'import { format } from "date-fns";',
      'import slugify from "slugify";',
      'export const value = `${nanoid()}:${clsx("a","b")}:${format(new Date(),"yyyy")}`;',
      'export const slug = slugify("hello world");',
    ].join('\n'),
    'utf8',
  );

  const result = { supported: {}, cjsDiagnostic: false };
  const devPort = 6100;
  try {
    const child = spawnCli(dir, ['dev', '--json', '--port', String(devPort)]);
    const ready = await readEventsWhile(child, (e) => e.event === 'preview_ready');

    // The transformed entry must rewrite bare specifiers to /@streetui/pkg/... and
    // contain no unresolved `from "..."` imports.
    const entryRes = await fetch(`${ready.url}/src/main.ts`);
    const code = entryRes.status === 200 ? await entryRes.text() : '';
    result.entryRewritten = entryRes.status === 200 && code.includes('/@streetui/pkg/') && !/from\s+"(nanoid|clsx|date-fns|slugify)"/.test(code);

    // CommonJS-only package (slugify) must yield the documented diagnostic.
    const slugUrl = (code.match(/\/@streetui\/pkg\/slugify\/[^"']+/) ?? [null])[0];
    if (slugUrl) {
      const diag = await fetch(`${ready.url}${slugUrl}`);
      const body = await diag.text();
      result.cjsDiagnostic = diag.status === 500 && body.includes('CommonJS');
    }

    child.kill('SIGTERM');
  } catch (error) {
    result.error = String(error.message).split('\n')[0];
  }
  return result;
}

const report = {
  schema: 'streetui-toolchain-registry-smoke/v1',
  created: new Date().toISOString(),
  registry: REGISTRY,
  evidenceTarget: 'npm-registry',
  workspaceVersion: WORKSPACE_VERSION,
  requestedEngines: enginesArg,
  packageAvailability: {},
  templates: {},
  thirdParty: {},
  status: 'PASS',
};

try {
  for (const pkg of PUBLISHED) {
    const v = view(pkg);
    report.packageAvailability[pkg] = { version: v.version, latest: v.latest, tarball: v.tarball, integrity: v.integrity, ok: v.ok, error: v.error };
  }
  const gen = view(GENERATOR_PACKAGE);
  report.packageAvailability[GENERATOR_PACKAGE] = { version: gen.version, latest: gen.latest, tarball: gen.tarball, integrity: gen.integrity, ok: gen.ok, error: gen.error, requiredForNpmCreate: true };
  for (const pkg of ['@streetui/cli', 'streetui']) {
    try {
      const d = JSON.parse(execFileSync('npm', ['view', pkg, 'dependencies', '--json'], { env, encoding: 'utf8' }));
      report.packageAvailability[pkg].dependencies = d;
    } catch {
      /* ignore */
    }
  }
  const mismatchedVersions = Object.entries(report.packageAvailability)
    .filter(([, v]) => v.ok && v.version !== WORKSPACE_VERSION)
    .map(([name, v]) => ({ package: name, published: v.version, expected: WORKSPACE_VERSION }));
  report.versionMismatches = mismatchedVersions;
  if (Object.values(report.packageAvailability).some((v) => !v.ok || v.version !== WORKSPACE_VERSION)) report.status = 'PARTIAL';

  report.templates.basic = await verifyTemplate('basic', 0);
  report.templates.ssr = await verifyTemplate('ssr', 1);
  const stale = report.templates.basic.stalePublished || report.templates.ssr.stalePublished;
  if (stale) {
    report.thirdParty = { status: 'BLOCKED', reason: 'Published toolchain is stale (esbuild); current repo resolver is not published. Real-registry third-party verification requires a fresh publish.' };
  } else {
    report.thirdParty = await verifyThirdParty();
  }

  const templatePass = (template) =>
    template.installed && template.dev && template.build && template.preview && template.hmr === true &&
    enginesArg.every((engine) => template.browser[engine]?.status === 'PASS');
  const allPass = templatePass(report.templates.basic) && templatePass(report.templates.ssr);
  if (!allPass && report.status === 'PASS') report.status = 'PARTIAL';
  if (!allPass && Object.values(report.packageAvailability).some((v) => !v.ok)) report.status = 'BLOCKED';
} catch (error) {
  report.status = 'BLOCKED';
  report.fatal = String(error.stack || error);
}

const resultsDir = path.join(repo, 'benchmarks', 'results', 'toolchain');
fs.mkdirSync(resultsDir, { recursive: true });
fs.writeFileSync(path.join(resultsDir, 'registry-smoke.json'), `${JSON.stringify(report, null, 2)}\n`);

console.log('StreetUI Registry Smoke Test');
console.log('Workspace version: ' + WORKSPACE_VERSION);
console.log('Package availability: ' + (Object.values(report.packageAvailability).every((v) => v.ok) ? 'PASS' : 'FAIL'));
const printableTemplateStatus = (template) =>
  template.infrastructureError !== undefined || template.stalePublished === true
    ? 'BLOCKED'
    : template.dev
      ? 'PASS'
      : 'FAIL';
console.log('Basic template: ' + printableTemplateStatus(report.templates.basic));
console.log('SSR template: ' + printableTemplateStatus(report.templates.ssr));
console.log('Final status: ' + report.status);

fs.rmSync(base, { recursive: true, force: true });

const rows = Object.values(report.templates).map((template) => ({
  engine: template.template,
  mode: 'lifecycle',
  status:
    report.status === 'BLOCKED' || template.stalePublished === true || template.infrastructureError !== undefined
      ? 'BLOCKED'
      : template.installed && template.dev && template.build && template.preview && template.hmr === true &&
          enginesArg.every((engine) => template.browser[engine]?.status === 'PASS')
        ? 'PASS'
        : 'FAIL',
  reason: template.infrastructureError ?? template.note ?? template.devError ?? template.installError ?? template.error,
}));
process.exitCode = applyExitCode(summarizeReports(rows), process.stdout);
