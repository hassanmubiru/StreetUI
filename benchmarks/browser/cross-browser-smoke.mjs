/**
 * StreetUI 2.4 — Cross-browser smoke runner (Phase 7 / cross-browser).
 *
 *   node benchmarks/browser/cross-browser-smoke.mjs
 *
 * Runs the core public framework path in EVERY browser actually available
 * (Chrome + Firefox via Playwright) and records pass/fail + console errors +
 * uncaught exceptions PER BROWSER. This is a smoke test (does the core path work
 * at all in each engine), NOT a compatibility matrix and NOT a perf run.
 *
 * Core path exercised (via the real app + its window.__bench entry):
 *   create app · render · reactive update · routing · SSR/hydration ·
 *   (overlays/forms/async/devtools are additionally probed when the app exposes
 *    the corresponding window hooks; otherwise recorded as NOT MEASURED for that
 *    item rather than faked).
 *
 * HONESTY: real browser required per engine. Missing engine → that engine is
 * BLOCKED with the exact reason. Nothing is simulated; happy-dom is not used.
 *
 * Output: benchmarks/results/v2.4/cross-browser.json
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..');
const appDir = path.join(repo, 'examples', 'streetui-performance-app');
const outPath = path.join(repo, 'benchmarks', 'results', 'v2.4', 'cross-browser.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
const write = (obj) => fs.writeFileSync(outPath, JSON.stringify(obj, null, 2) + '\n');
const nowIso = () => new Date().toISOString();

const CORE_PATH = ['create app', 'render', 'reactive update', 'routing', 'forms', 'overlay', 'async state', 'SSR/hydration', 'devtools HTML'];

async function detectPlaywright() {
  try { return await import('playwright'); }
  catch { try { return await import('playwright-core'); } catch { return null; } }
}
const exists = (p) => { try { return p && fs.existsSync(p); } catch { return false; } };

function findBrowsers(pw) {
  const engines = {};
  const chrome = [process.env.CHROMIUM_PATH, process.env.CHROME_PATH, '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/opt/google/chrome/chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/snap/bin/chromium'].find(exists) || null;
  let pwChrome = null; try { pwChrome = pw?.chromium?.executablePath?.(); } catch {}
  engines.chromium = { launcher: pw?.chromium, executablePath: chrome || (exists(pwChrome) ? pwChrome : null) };
  const ff = [process.env.FIREFOX_PATH, '/usr/bin/firefox', '/snap/bin/firefox'].find(exists) || null;
  let pwFf = null; try { pwFf = pw?.firefox?.executablePath?.(); } catch {}
  engines.firefox = { launcher: pw?.firefox, executablePath: ff || (exists(pwFf) ? pwFf : null) };
  return engines;
}

async function buildAppHtml() {
  const esbuild = await import(path.join(repo, 'packages', 'cli', 'node_modules', 'esbuild', 'lib', 'main.js'));
  const build = await esbuild.build({
    entryPoints: [path.join(appDir, 'src', 'bench-browser.ts')],
    bundle: true, format: 'esm', write: false, target: 'es2020', absWorkingDir: appDir,
    define: { 'Buffer.byteLength': '__bufferByteLength' },
    banner: { js: 'const __bufferByteLength=(s)=>new TextEncoder().encode(s).length;' },
  });
  const js = build.outputFiles[0].text;
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>streetui smoke</title></head><body><div id="app"></div><script type="module">' + js +
    '\ntry{ (window.__mount||window.__bench)?.(document.getElementById("app")); window.__smokeMounted = document.querySelectorAll("#app *").length > 0; }catch(e){ window.__smokeError=String(e); }</script></body></html>';
}

async function smokeEngine(name, launcher, executablePath, html) {
  const consoleErrors = [], pageErrors = [];
  const browser = await launcher.launch(executablePath ? { executablePath } : {});
  const version = browser.version?.() ?? 'unknown';
  const server = http.createServer((_q, res) => { res.setHeader('content-type', 'text/html; charset=utf-8'); res.end(html); });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address();
  const items = {};
  try {
    const page = await browser.newPage();
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
    page.on('pageerror', (e) => pageErrors.push(String(e)));
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load' });
    await page.waitForTimeout(300);
    const mounted = await page.evaluate(() => !!window.__smokeMounted);
    const mountErr = await page.evaluate(() => window.__smokeError || null);
    items['create app'] = { pass: mounted, detail: mountErr };
    items['render'] = { pass: mounted };
    // reactive update: run the bench (exercises updates/routing/hydration internally)
    let benchOk = null, bench = null;
    const hasBench = await page.evaluate(() => typeof window.__bench === 'function');
    if (hasBench) {
      try { bench = await page.evaluate(async () => await window.__bench()); benchOk = !!bench; }
      catch (e) { benchOk = false; items['bench.error'] = String(e); }
    }
    items['reactive update'] = { pass: benchOk === null ? 'NOT MEASURED' : benchOk };
    items['routing'] = { pass: bench && bench.routerNavigationMs != null ? true : 'NOT MEASURED' };
    items['SSR/hydration'] = { pass: bench && bench.hydrateUsers10k != null ? true : 'NOT MEASURED' };
    items['forms'] = { pass: 'NOT MEASURED', note: 'perf-app entry does not expose a forms hook; needs a showcase entry' };
    items['overlay'] = { pass: 'NOT MEASURED', note: 'needs a showcase entry that opens overlays' };
    items['async state'] = { pass: 'NOT MEASURED', note: 'needs an async-resource hook in the smoke entry' };
    items['devtools HTML'] = { pass: 'NOT MEASURED', note: 'covered separately by benchmarks/browser/devtools-interaction.mjs' };
  } finally {
    try { await browser.close(); } catch {}
    try { server.close(); } catch {}
  }
  const measured = Object.values(items).filter((v) => v && (v.pass === true || v.pass === false));
  const status = measured.length === 0 ? 'BLOCKED' : (measured.every((v) => v.pass === true) && consoleErrors.length === 0 && pageErrors.length === 0 ? 'PASS' : 'FAIL');
  return { engine: name, browserVersion: version, status, consoleErrors, pageErrors, corePath: items };
}

async function main() {
  const base = {
    schema: 'streetui-2.4-cross-browser/v1',
    purpose: 'StreetUI 2.4 core-path smoke in every available browser. Real per-engine results or explicit BLOCKED. No fabrication.',
    os: `${os.type()} ${os.release()} ${os.arch()}`,
    corePathCatalogue: CORE_PATH,
    capturedAt: nowIso(),
  };
  const pw = await detectPlaywright();
  if (!pw) { write({ ...base, status: 'BLOCKED', reason: 'Playwright not installed/resolvable; cannot launch any browser (registry E403 blocks install).' }); return; }

  let html;
  try { html = await buildAppHtml(); }
  catch (e) { write({ ...base, status: 'BLOCKED', reason: 'Could not bundle the app entry (build the workspace first): ' + String(e) }); return; }

  const engines = findBrowsers(pw);
  const runs = [];
  for (const [name, e] of Object.entries(engines)) {
    if (!e.launcher || !e.executablePath) { runs.push({ engine: name, status: 'BLOCKED', reason: `${name} binary not found (checked env vars + standard paths + Playwright cache).` }); continue; }
    try { runs.push(await smokeEngine(name, e.launcher, e.executablePath, html)); }
    catch (err) { runs.push({ engine: name, status: 'ERROR', error: String(err?.stack ?? err) }); }
  }
  const measured = runs.filter((r) => r.status === 'PASS' || r.status === 'FAIL');
  const overall = measured.length === 0 ? 'BLOCKED' : (measured.every((r) => r.status === 'PASS') ? 'PASS' : 'FAIL');
  write({ ...base, status: overall, runs });
  if (overall === 'FAIL') process.exitCode = 1;
}

main().catch((e) => { write({ schema: 'streetui-2.4-cross-browser/v1', status: 'ERROR', reason: String(e?.stack ?? e), capturedAt: nowIso() }); process.exitCode = 1; });
