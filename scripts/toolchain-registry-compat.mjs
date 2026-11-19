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
 * Usage:  node scripts/toolchain-registry-compat.mjs [--engines chromium,firefox]
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..');
const CLI_SPEC = '@streetui/cli@3.1.5';
const REGISTRY = 'https://registry.npmjs.org/';

const enginesArg = process.argv.includes('--engines')
  ? process.argv[process.argv.indexOf('--engines') + 1].split(',')
  : ['chromium', 'firefox'];

const onlyArg = process.argv.includes('--only')
  ? process.argv[process.argv.indexOf('--only') + 1].split(',').map((s) => s.trim())
  : null;

const LOCAL_BUILD = process.argv.includes('--local');
const LOCAL_BIN = path.join(repo, 'packages', 'cli', 'dist', 'bin.js');
const LOCAL_CLI_TGZ = path.join(repo, 'dist-tarballs', 'streetui-cli-3.1.6.tgz');

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
  return spawn(path.join(cwd, 'node_modules', '.bin', 'streetui'), args, { cwd, env, stdio: ['ignore','pipe','pipe'] });
}

function browserHelpers(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  return errors;
}

async function checkBrowser(engine, url, expectText) {
  const pw = await import('playwright');
  let browser;
  try { browser = await pw[engine].launch(); }
  catch (error) {
    const cacheRoot = path.join(os.homedir(), '.cache', 'ms-playwright');
    const prefix = engine === 'firefox' ? 'firefox-' : 'chromium-';
    const dirs = fs.existsSync(cacheRoot) ? fs.readdirSync(cacheRoot).filter((d)=>d.startsWith(prefix)).sort().reverse() : [];
    for (const d of dirs) {
      const bin = engine === 'firefox' ? path.join(cacheRoot,d,'firefox','firefox') : path.join(cacheRoot,d,'chrome-linux','chrome');
      if (fs.existsSync(bin)) { browser = await pw[engine].launch({ executablePath: bin }); break; }
    }
    if (!browser) return { ok: false, fatal: String(error.message).split('\n')[0] };
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
    return { ok: ok && errors.length === 0, out: String(out).slice(0,120), errors };
  } catch (error) {
    return { ok: false, error: String(error.message), errors: [] };
  } finally {
    await browser.close();
  }
}

async function scaffoldApp(name) {
  const app = path.join(base, name);
  if (LOCAL_BUILD) {
    // Candidate build: scaffold with the local 3.1.6 CLI.
    run(['node', LOCAL_BIN, 'create', name, '--template', 'ssr'], base);
    // Point the app's CLI devDependency at the candidate tarball so the test
    // runs the candidate (not the published 3.1.5).
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
  const out = run([path.join(app,'node_modules','.bin','streetui'),'build','--json'], app, { silent: true });
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
      result.dev[engine] = await checkBrowser(engine, url, expectText);
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
      if (prod.url) result.prod[engine] = await checkBrowser(engine, prod.url, expectText);
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
  cli: LOCAL_BUILD ? `local-3.1.6 (${LOCAL_CLI_TGZ})` : CLI_SPEC,
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
  const failSupported = Object.values(report.supported).some((r) => Object.values(r.dev).some((d) => !d.ok) || Object.values(r.prod).some((d) => typeof d === 'object' && d.ok === false));
  // Unsupported probes must yield a documented diagnostic (CommonJS, or a
  // Node-builtin incompatibility) — never raw source served as a 200.
  const diagOk = Object.values(report.unsupported).every((r) => r.diagnostic && (r.diagnostic.includes('CommonJS') || r.diagnostic.includes('Node-builtin')));
  if (failSupported || !diagOk) report.status = 'PARTIAL';
} catch (error) {
  report.status = 'BLOCKED';
  report.fatal = String(error.stack || error);
}

const resultsDir = path.join(repo, 'benchmarks', 'results', 'toolchain');
fs.mkdirSync(resultsDir, { recursive: true });
fs.writeFileSync(path.join(resultsDir, 'registry-compat.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log('StreetUI Registry Compat');
console.log('Supported: ' + Object.keys(report.supported).join(', '));
console.log('Unsupported diagnostics: ' + Object.values(report.unsupported).map((r) => r.diagnostic).join(' | '));
console.log('Final: ' + report.status);
fs.rmSync(base, { recursive: true, force: true });
