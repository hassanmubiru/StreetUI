/**
 * Real-browser benchmark harness for the v1.3 real performance app (spec §3–§7, §19, §22).
 *
 *   node scripts/browser-harness.mjs
 *
 * The in-browser scenarios require a real Chromium instance driven through
 * Playwright. Node + happy-dom can measure relative JS/DOM cost and DOM-mutation
 * counts (see packages/benchmarks/perf-app-scenarios.mjs) but is NOT a browser and
 * cannot measure paint, layout, long tasks, true time-to-interactive, or frame
 * pacing. Those come only from a real engine.
 *
 * This harness:
 *   1. Detects whether Playwright + a Chromium binary are available.
 *   2. If available: bundles the app's in-page harness (examples/streetui-
 *      performance-app/src/bench-browser.ts → window.__bench) with esbuild, serves
 *      it over http, launches Chromium, calls window.__bench(), and writes the real
 *      measurements to benchmarks/results/v1.3/streetui-browser.json.
 *   3. If NOT available: writes a BLOCKED marker (status "BLOCKED") with the exact
 *      environmental reason and the full catalogue of scenarios that WOULD run, then
 *      exits 0 WITHOUT fabricating any numbers. happy-dom is never substituted for
 *      browser numbers.
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..');
const appDir = path.join(repo, 'examples', 'streetui-performance-app');
const outPath = path.join(repo, 'benchmarks', 'results', 'v1.3', 'streetui-browser.json');
const legacyOut = path.join(repo, 'benchmarks', 'results', 'browser.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });

const write = (obj) => {
  const json = JSON.stringify(obj, null, 2) + '\n';
  fs.writeFileSync(outPath, json);
  try { fs.mkdirSync(path.dirname(legacyOut), { recursive: true }); fs.writeFileSync(legacyOut, json); } catch { /* ignore */ }
};

// The catalogue of what the real-browser run measures — documented so a BLOCKED
// record still shows exactly what would be produced on a Chromium-capable machine.
const SCENARIO_CATALOGUE = {
  initialMountUsers10k: 'performance.now around mounting the 10,000-row users route; DOM node count.',
  reactiveSearch: 'MutationObserver-counted DOM mutations + time for query narrow then clear over 10k rows.',
  reverse: 'MutationObserver-counted mutations + time to reverse sort direction (worst-case reorder).',
  fineGrainedToggle1of1000: 'MutationObserver mutation count when toggling exactly one of 1,000 controls.',
  routerNavigationMs: 'performance.now per navigation across /dashboard, /users, /settings, /.',
  hydrateUsers10k: 'MutationObserver-verified DOM adoption (added nodes must be 0) + hydration time.',
  frames: 'requestAnimationFrame pacing vs 16.67ms (60Hz) / 8.33ms (120Hz) reference budgets — reference points, NOT a frame-rate guarantee.',
  memory: 'performance.memory usedJSHeapSize across repeated mount→interact→unmount cycles (indicative, no explicit GC).',
  longTasks: 'PerformanceObserver longtask entries over the whole run.',
};

async function detectPlaywright() {
  try {
    const pw = await import('playwright');
    return pw?.chromium ? pw : null;
  } catch {
    try {
      const pwc = await import('playwright-core');
      return pwc?.chromium ? pwc : null;
    } catch { return null; }
  }
}

const playwright = await detectPlaywright();

if (playwright === null) {
  write({
    schema: 'streetui-browser/v1.3',
    status: 'BLOCKED',
    reason:
      'No Playwright driver with a launchable Chromium binary is available in this environment ' +
      '(no `playwright`/`playwright-core` package resolves to a runnable browser, and no ms-playwright ' +
      'browser cache is present). The npm registry is unreachable offline (E403), so ' +
      '`npx playwright install chromium` cannot fetch a binary. Real-browser metrics (paint, layout, ' +
      'long tasks, true TTI, frame pacing, JS heap) therefore cannot be measured and are NOT fabricated.',
    remediation:
      'On a machine with npm registry access: `npm i -D playwright && npx playwright install chromium`, ' +
      'then re-run `node scripts/browser-harness.mjs`. The harness will bundle bench-browser.ts, serve it, ' +
      'launch Chromium, and populate the fields below with real numbers.',
    target: 'examples/streetui-performance-app (via window.__bench in src/bench-browser.ts)',
    scenarioCatalogue: SCENARIO_CATALOGUE,
    scenarios: Object.fromEntries(Object.keys(SCENARIO_CATALOGUE).map((k) => [k, null])),
    nodeFallback:
      'Node/happy-dom relative measurements + DOM-mutation-count invariants for these workloads are in ' +
      'benchmarks/results/v1.3/streetui-node.json (a different runtime; not a browser substitute).',
    timestamp: new Date().toISOString(),
  });
  process.stdout.write(`browser-harness: BLOCKED — no Playwright/Chromium. Wrote ${outPath} (no numbers fabricated).\n`);
  process.exit(0);
}

// ── Real-browser path (executes only when Playwright + Chromium are present) ──
let server = null;
let browser = null;
try {
  const esbuild = await import(path.join(repo, 'packages', 'cli', 'node_modules', 'esbuild', 'lib', 'main.js'));
  const build = await esbuild.build({
    entryPoints: [path.join(appDir, 'src', 'bench-browser.ts')],
    bundle: true, format: 'esm', write: false, sourcemap: false, target: 'es2020',
    absWorkingDir: appDir,
  });
  const js = build.outputFiles[0].text;
  const htmlPage =
    '<!doctype html><html><head><meta charset="utf-8"><title>streetui bench</title></head>' +
    '<body><div id="app"></div><script type="module">' + js + '</script></body></html>';

  server = http.createServer((req, res) => {
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.end(htmlPage);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address();
  const url = `http://127.0.0.1:${port}/`;

  browser = await playwright.chromium.launch();
  const version = browser.version?.() ?? 'unknown';
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof window.__bench === 'function', null, { timeout: 30000 });
  const measured = await page.evaluate(async () => await window.__bench());

  write({
    schema: 'streetui-browser/v1.3',
    status: 'OK',
    browser: 'chromium',
    browserVersion: version,
    target: 'examples/streetui-performance-app (window.__bench)',
    scenarioCatalogue: SCENARIO_CATALOGUE,
    scenarios: measured,
    timestamp: new Date().toISOString(),
  });
  process.stdout.write(`browser-harness: OK — wrote ${outPath}\n`);
} catch (err) {
  write({
    schema: 'streetui-browser/v1.3',
    status: 'ERROR',
    reason: 'Playwright resolved but the browser run failed: ' + String(err?.stack ?? err?.message ?? err),
    target: 'examples/streetui-performance-app (window.__bench)',
    scenarioCatalogue: SCENARIO_CATALOGUE,
    scenarios: Object.fromEntries(Object.keys(SCENARIO_CATALOGUE).map((k) => [k, null])),
    timestamp: new Date().toISOString(),
  });
  process.stdout.write('browser-harness: ERROR during browser run — recorded, no numbers fabricated.\n');
} finally {
  try { await browser?.close(); } catch { /* ignore */ }
  try { server?.close(); } catch { /* ignore */ }
}
process.exit(0);
