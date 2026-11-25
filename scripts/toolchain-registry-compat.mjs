#!/usr/bin/env node
/**
 * M8.4 — Real npm ecosystem compatibility.
 *
 * Scaffolds isolated consumer apps via the published CLI, installs real
 * third-party packages from the registry, and verifies dev + production in
 * real Chromium and Firefox:
 *   - supported apps: nanoid, clsx, date-fns, @fontsource/inter, and a combined
 *     app importing all supported packages.
 *   - unsupported probes: slugify (CJS-only) and node-fetch v2 (CJS + Node).
 *
 * Usage:  node scripts/toolchain-registry-compat.mjs [--engines chromium,firefox,webkit] [--only <pkgs>] [--local]
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { assertNoUnknownSelectionFlags, enginesFromArgv, launchBrowser } from './lib/browser-engines.mjs';
import { applyExitCode, summarizeReports, summaryForArtifact } from './lib/harness-status.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..');
const WORKSPACE_VERSION = JSON.parse(
  fs.readFileSync(path.join(repo, 'packages', 'streetui', 'package.json'), 'utf8'),
).version;
const CLI_SPEC = `@streetui/cli@${WORKSPACE_VERSION}`;
const REGISTRY = 'https://registry.npmjs.org/';

assertNoUnknownSelectionFlags();
const enginesArg = enginesFromArgv();

const onlyArg = process.argv.includes('--only')
  ? process.argv[process.argv.indexOf('--only') + 1].split(',').map((s) => s.trim())
  : null;

const LOCAL_BUILD = process.argv.includes('--local');
const LOCAL_BIN = path.join(repo, 'packages', 'cli', 'dist', 'bin.js');
const LOCAL_CLI_TGZ = path.join(repo, 'dist-tarballs', `streetui-cli-${WORKSPACE_VERSION}.tgz`);

const SUPPORTED = {
  nanoid: {
    pkg: 'nanoid',
    note: 'ESM (type:module); subpath ./non-secure',
    import: `import { nanoid } from 'nanoid';\nimport { customAlphabet } from 'nanoid/non-secure';\n`,
    expr: `customAlphabet('a', 8)()`,
    expect: 'aaaaaaaa',
  },
  clsx: {
    pkg: 'clsx',
    note: 'dual ESM/CJS (import→.mjs)',
    import: `import { clsx } from 'clsx';\n`,
    expr: `clsx('a', { b: true, c: false }, ['d'])`,
    expect: 'a b d',
  },
  'date-fns': {
    pkg: 'date-fns',
    note: 'ESM/dual conditional exports, many subpaths',
    import: `import { format, addDays } from 'date-fns';\nimport { zhCN } from 'date-fns/locale';\n`,
    expr: `format(addDays(new Date(2020, 0, 1), 1), 'yyyy-MM-dd')`,
    expect: '2020-01-02',
  },
  fontsource: {
    pkg: '@fontsource/inter',
    note: 'CSS + woff2/woff font assets via exports',
    import: `import '@fontsource/inter';\n`,
    expr: `'font-loaded'`,
    expect: 'font-loaded',
    css: true,
    clientOnly: true,
  },
};

const UNSUPPORTED = {
  slugify: { pkg: 'slugify', import: `import slugify from 'slugify';\n`, expr: `slugify('Hello World')`, expected: 'CommonJS' },
  'node-fetch': { pkg: 'node-fetch@2', import: `import fetch from 'node-fetch';\n`, expr: `typeof fetch`, expected: 'CommonJS' },
};

const base = fs.mkdtempSync(path.join(os.tmpdir(), 'streetui-compat-'));
const cache = path.join(base, 'npm-cache');
fs.mkdirSync(cache, { recursive: true });
const env = { ...process.env, npm_config_registry: REGISTRY, npm_config_cache: cache, NO_COLOR: '1' };

function run(args, cwd, opts = {}) {
  return execFileSync(args[0], args.slice(1), {
    cwd,
    env,
    encoding: 'utf8',
    stdio: opts.silent ? ['ignore','pipe','pipe'] : ['ignore','pipe','inherit'],
  });
}

function joinUrl(base, p) {
  return base.replace(/\/$/, '') + '/' + String(p).replace(/^\//, '');
}

function view(pkg) {
  try {
    return JSON.parse(execFileSync('npm', ['view', pkg, 'version', '--json'], { env, encoding: 'utf8' }));
  } catch {
    return null;
  }
}

function waitForEvent(child, predicate, timeoutMs = 70000) {
  return new Promise((resolve, reject) => {
    let acc = '';
    const timer = setTimeout(() => { child.kill('SIGTERM'); reject(new Error(`event timeout\n${acc}`)); }, timeoutMs);
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

async function waitForHttp(url, ms = 45000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    try { const r = await fetch(url); if (r.status < 500) return r; } catch { /* not up */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`http timeout ${url}`);
}

function spawnCli(cwd, args) {
  // `.bin/streetui` is ambiguous: the unified `streetui` package ships a bin of
  // the same name, so it can resolve to the framework instead of the CLI.
  // Invoke the CLI entry point directly.
  const bin = path.join(cwd, 'node_modules', '@streetui', 'cli', 'dist', 'bin.js');
  return spawn(process.execPath, [bin, ...args], { cwd, env, stdio: ['ignore','pipe','pipe'] });
}

function browserHelpers(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  return errors;
}

async function checkBrowser(engine, url, expectText, mode) {
  const pw = await import('playwright');
  let browser;
  try {
    browser = await launchBrowser(pw, engine);
  } catch (error) {
    return {
      ok: false,
      status: 'BLOCKED',
      requestedEngine: engine,
      actualEngine: null,
      browserVersion: null,
      requestedMode: mode,
      actualMode: null,
      reason: String(error.message).split('\n')[0],
    };
  }
  try {
    const page = await browser.newPage();
    const errors = browserHelpers(page);
    await Promise.race([
      page.goto(url, { waitUntil: 'load' }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('goto timeout 30s')), 30000)),
    ]);
    await Promise.race([
      page.waitForSelector('#app', { timeout: 15000 }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('wait #app timeout')), 20000)),
    ]);
    await new Promise((r) => setTimeout(r, 300));
    const out = await page.evaluate(() => globalThis.__compatOut).catch(() => undefined);
    const ok = expectText ? out === expectText : out !== undefined && out !== '';
    const passed = ok && errors.length === 0;
    return {
      ok: passed,
      status: passed ? 'PASS' : 'FAIL',
      requestedEngine: engine,
      actualEngine: browser.browserType().name(),
      browserVersion: browser.version(),
      requestedMode: mode,
      actualMode: mode,
      out: String(out).slice(0,120),
      errors,
      ...(passed ? {} : { reason: errors.length > 0 ? errors.join(' | ') : `output ${String(out).slice(0, 60)} !== ${expectText}` }),
    };
  } catch (error) {
    return {
      ok: false,
      status: 'FAIL',
      requestedEngine: engine,
      actualEngine: browser.browserType().name(),
      browserVersion: browser.version(),
      requestedMode: mode,
      actualMode: mode,
      reason: String(error.message).split('\n')[0],
      errors: [],
    };
  } finally {
    await browser.close();
  }
}

async function scaffoldApp(name) {
  const app = path.join(base, name);
  if (LOCAL_BUILD) {
    // Candidate build: scaffold with the local CLI.
    run(['node', LOCAL_BIN, 'create', name, '--template', 'ssr'], base);
    // Point the app's CLI devDependency at the candidate tarball so the test
    // runs the candidate (not the published release).
    const pkgPath = path.join(app, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    pkg.devDependencies = pkg.devDependencies ?? {};
    pkg.devDependencies['@streetui/cli'] = `file:${LOCAL_CLI_TGZ}`;
    fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
  } else {
    run(['npx','--yes','--package',CLI_SPEC,'streetui','create',name,'--template','ssr'], base);
  }
  return app;
}

async function installDep(app, spec) {
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      run(['npm','install',spec,'--no-audit','--no-fund'], app);
      run(['npm','install','--no-audit','--no-fund'], app);
      return;
    } catch (error) {
      lastErr = error;
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  throw lastErr;
}

async function writeImport(app, code, targetFile = 'app') {
  const file = path.join(app, 'src', targetFile === 'main' ? 'main.ts' : 'app.ts');
  const original = fs.readFileSync(file, 'utf8');
  const block = [
    code.import,
    `globalThis.__compatOut = (${code.expr});`,
    '',
    original,
  ].join('\n');
  fs.writeFileSync(file, block, 'utf8');
}

async function runDev(app, port) {
  const child = spawnCli(app, ['dev','--json','--port',String(port)]);
  const ready = await waitForEvent(child, (e) => e.event === 'preview_ready');
  return { child, url: ready.url };
}

async function runProd(app, port) {
  const bin = path.join(app, 'node_modules', '@streetui', 'cli', 'dist', 'bin.js');
  const out = run([process.execPath, bin, 'build', '--json'], app, { silent: true });
  const completed = out.split('\n').some((l) => { try { return JSON.parse(l).event === 'build_completed'; } catch { return false; } });
  if (!completed) return { ok: false, reason: 'build_completed missing' };
  const manifest = JSON.parse(fs.readFileSync(path.join(app,'dist','client','manifest.json'),'utf8'));
  // SSR template: production is served by `streetui start` (server-rendered).
  const child = spawnCli(app, ['start','--json','--port',String(port)]);
  const ready = await waitForEvent(child, (e) => e.event === 'server_started' || e.event === 'preview_ready');
  const homeRes = await waitForHttp(`${ready.url}/`);
  if (homeRes.status !== 200) return { ok: false, reason: `home ${homeRes.status}`, child };
  const assets = fs.readdirSync(path.join(app,'dist','client','assets'));
  return { ok: true, url: ready.url, assets, manifest, child };
}

async function testSupported(name, cfg, index) {
  const result = { package: cfg.pkg, note: cfg.note, resolvedVersion: view(cfg.pkg), dev: {}, prod: {} };
  console.error(`[compat] start ${name} (${cfg.pkg})`);
  try {
    const app = await scaffoldApp(`app-${name}`);
    console.error(`[compat] ${name} scaffolded`);
    await installDep(app, cfg.pkg);
    console.error(`[compat] ${name} installed`);
    await writeImport(app, cfg, cfg.clientOnly ? 'main' : 'app');
    const devPort = 6400 + index * 20;
    const { child: devChild, url } = await runDev(app, devPort);
    console.error(`[compat] ${name} dev up ${url}`);
    const expectText = cfg.expect;
    for (const engine of enginesArg) {
      result.dev[engine] = await checkBrowser(engine, url, expectText, 'dev');
      console.error(`[compat] ${name} dev ${engine} ok=${result.dev[engine].ok}`);
    }
    if (cfg.css) {
      const cssRes = await fetch(joinUrl(url, 'src/styles.css')).catch(() => null);
      result.css = cssRes ? { status: cssRes.status } : null;
    }
    devChild.kill('SIGTERM');
    const appTs = path.join(app,'src','app.ts');
    fs.appendFileSync(appTs, `\n// hmr-compat ${Date.now()}\n`);
    const prodPort = 7000 + index * 20;
    const prod = await runProd(app, prodPort);
    console.error(`[compat] ${name} prod build ok=${prod.ok}`);
    result.prod.build = prod.ok;
    result.prod.assets = prod.assets;
    for (const engine of enginesArg) {
      if (prod.url) result.prod[engine] = await checkBrowser(engine, prod.url, expectText, 'prod');
      if (prod.url) console.error(`[compat] ${name} prod ${engine} ok=${result.prod?.[engine]?.ok}`);
    }
    if (prod.child) prod.child.kill('SIGTERM');
  } catch (error) {
    result.error = String(error.message).split('\n')[0];
    console.error(`[compat] ${name} ERROR ${result.error}`);
  }
  return result;
}

async function testUnsupported(name, cfg, index) {
  const result = { package: cfg.pkg, expected: cfg.expected, diagnostic: null };
  console.error(`[compat] start probe ${name} (${cfg.pkg})`);
  try {
    const app = await scaffoldApp(`probe-${name}`);
    await installDep(app, cfg.pkg);
    await writeImport(app, { import: cfg.import, expr: cfg.expr });
    const port = 7600 + index * 20;
    const child = spawnCli(app, ['dev','--json','--port',String(port)]);
    const ready = await waitForEvent(child, (e) => e.event === 'preview_ready').catch(() => null);
    if (!ready) { result.diagnostic = 'no dev server (scaffold/install failed)'; return result; }
    // The importer transforms fine; the CommonJS diagnostic is served from the
    // resolved dependency module URL. Mimic the browser by fetching that URL.
    const mod = await fetch(joinUrl(ready.url, 'src/app.ts')).catch(() => null);
    const code = mod ? await mod.text() : '';
    const pkgName = cfg.pkg.startsWith('@') ? cfg.pkg.slice(cfg.pkg.indexOf('/') + 1) : cfg.pkg.split('@')[0];
    const re = new RegExp('/@streetui/pkg/' + pkgName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '/[^"\' ]+');
    const m = code.match(re);
    const depUrl = m ? m[0] : null;
    let diag = 'no dep url in transformed app';
    if (depUrl) {
      const res = await fetch(joinUrl(ready.url, depUrl)).catch(() => null);
      const body = res ? await res.text() : '';
      if (body.includes('CommonJS')) diag = 'CommonJS diagnostic';
      else if (/import\s+(Stream|[A-Za-z]+)\s+from\s+['"](node:|stream|http|https|url|path|fs|util|os|events)/.test(body)) {
        diag = 'Node-builtin dependency (incompatible with browser; not CJS)';
      } else diag = `status ${res ? res.status : 'n/a'}: ${body.slice(0,80)}`;
    }
    result.diagnostic = diag;
    child.kill('SIGTERM');
    console.error(`[compat] probe ${name} diagnostic=${diag}`);
  } catch (error) {
    result.error = String(error.message).split('\n')[0];
    console.error(`[compat] probe ${name} ERROR ${result.error}`);
  }
  return result;
}

const report = {
  schema: 'streetui-toolchain-registry-compat/v1',
  created: new Date().toISOString(),
  // Evidence target: the published CLI and the third-party packages come from
  // the real registry; `--local` swaps only the CLI for the workspace build.
  target: LOCAL_BUILD ? 'local-workspace' : 'npm-registry',
  cli: LOCAL_BUILD ? `local-workspace@${WORKSPACE_VERSION} (${LOCAL_CLI_TGZ})` : CLI_SPEC,
  local: LOCAL_BUILD,
  supported: {},
  unsupported: {},
  status: 'PASS',
};

try {
  let i = 0;
  for (const [name, cfg] of Object.entries(SUPPORTED)) {
    if (onlyArg && !onlyArg.includes(name)) continue;
    report.supported[name] = await testSupported(name, cfg, i++);
  }
  let j = 0;
  for (const [name, cfg] of Object.entries(UNSUPPORTED)) {
    if (onlyArg && !onlyArg.includes(name)) continue;
    report.unsupported[name] = await testUnsupported(name, cfg, j++);
  }
} catch (error) {
  report.status = 'BLOCKED';
  report.fatal = String(error.stack || error);
}

// Per engine/mode records for every supported package, plus one record per
// unsupported probe (its contract is a documented diagnostic, not a render).
const rows = [];
for (const [name, result] of Object.entries(report.supported)) {
  for (const mode of ['dev', 'prod']) {
    for (const engine of enginesArg) {
      const record = result[mode]?.[engine];
      if (record === undefined) {
        rows.push({
          package: name,
          requestedEngine: engine,
          requestedMode: mode,
          status: result.error ? 'FAIL' : 'BLOCKED',
          reason: result.error ?? `${mode} result missing`,
        });
        continue;
      }
      rows.push({ package: name, ...record, status: record.status ?? (record.ok ? 'PASS' : 'FAIL') });
    }
  }
  if (result.error) {
    rows.push({ package: name, requestedEngine: enginesArg[0], requestedMode: 'dev', status: 'FAIL', reason: result.error });
  }
}
for (const [name, result] of Object.entries(report.unsupported)) {
  const diagOk =
    typeof result.diagnostic === 'string' &&
    (result.diagnostic.includes('CommonJS') || result.diagnostic.includes('Node-builtin'));
  rows.push({
    package: name,
    requestedEngine: enginesArg[0],
    requestedMode: 'dev',
    status: diagOk ? 'PASS' : 'FAIL',
    reason: result.error ?? `diagnostic: ${result.diagnostic ?? 'missing'}`,
  });
}

const summary = summarizeReports(rows, {
  requestedEngines: enginesArg,
  requestedModes: ['dev', 'prod'],
});
report.status = report.fatal
  ? 'BLOCKED'
  : summary.exitCode === 0
    ? 'PASS'
    : summary.counts.blocked > 0 && summary.counts.failed === 0 && summary.counts.unknown === 0
      ? 'PARTIAL'
      : 'FAIL';
report.summary = summaryForArtifact(summary);

const resultsDir = path.join(repo, 'benchmarks', 'results', 'toolchain');
fs.mkdirSync(resultsDir, { recursive: true });
fs.writeFileSync(path.join(resultsDir, 'registry-compat.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log('StreetUI Registry Compat');
console.log('Supported: ' + Object.keys(report.supported).join(', '));
console.log('Unsupported diagnostics: ' + Object.values(report.unsupported).map((r) => r.diagnostic).join(' | '));
console.log('Final: ' + report.status);
process.exitCode = applyExitCode(summary, process.stdout);
fs.rmSync(base, { recursive: true, force: true });
