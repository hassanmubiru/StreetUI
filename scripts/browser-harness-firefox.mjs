/**
 * StreetUI 2.4 — Firefox performance harness (Phase 6).
 *
 *   node scripts/browser-harness-firefox.mjs
 *
 * Runs the EXACT SAME in-page workload as the Chromium harness
 * (scripts/browser-harness.mjs): it bundles the same
 * `examples/streetui-performance-app/src/bench-browser.ts` entry, serves it, and
 * calls the same `window.__bench()`. The ONLY difference is the engine — Firefox
 * via Playwright instead of Chromium. No new methodology, workload, iteration
 * count, or warmup is introduced (2.4 Phase 6 requirement).
 *
 * Chrome and Firefox are recorded as SEPARATE browser measurements — never
 * averaged or treated as interchangeable. Results go to a Firefox-specific file
 * so the Chromium result is never overwritten.
 *
 * HONESTY CONTRACT (same as the Chromium harness): a real Firefox binary driven
 * through Playwright is required. If Playwright or a Firefox binary is absent,
 * this writes an explicit BLOCKED marker with the exact reason and exits 0 — it
 * NEVER fabricates numbers and NEVER substitutes happy-dom.
 *
 * Output: benchmarks/results/v2.4/streetui-firefox.json
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..');
const appDir = path.join(repo, 'examples', 'streetui-performance-app');
const outFlag = process.argv.find((a) => a.startsWith('--out='));
const outPath = outFlag
  ? outFlag.slice('--out='.length)
  : path.join(repo, 'benchmarks', 'results', 'v2.5', 'streetui-firefox.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });

const write = (obj) => fs.writeFileSync(outPath, JSON.stringify(obj, null, 2) + '\n');

// Identical catalogue to the Chromium harness — the SAME scenarios, so the two
// engines' numbers line up field-for-field (as separate measurements).
const SCENARIO_CATALOGUE = {
  initialMountUsers10k: 'performance.now around mounting the 10,000-row users route; DOM node count.',
  reactiveSearch: 'MutationObserver-counted DOM mutations + time for query narrow then clear over 10k rows.',
  reverse: 'MutationObserver-counted mutations + time to reverse sort direction (worst-case reorder).',
  fineGrainedToggle1of1000: 'MutationObserver mutation count when toggling exactly one of 1,000 controls.',
  routerNavigationMs: 'performance.now per navigation across /dashboard, /users, /settings, /.',
  hydrateUsers10k: 'MutationObserver-verified DOM adoption (added nodes must be 0) + hydration time.',
  frames: 'requestAnimationFrame pacing vs 16.67ms (60Hz) reference budgets — reference points, NOT a guarantee.',
  memory: 'usedJSHeapSize where the engine exposes it (Firefox may not expose performance.memory; recorded as null then).',
  longTasks: 'PerformanceObserver longtask entries where supported (Firefox longtask support differs from Chromium; recorded honestly).',
};

async function detectPlaywright() {
  try { const pw = await import('playwright'); return pw?.firefox ? pw : null; }
  catch {
    try { const pwc = await import('playwright-core'); return pwc?.firefox ? pwc : null; }
    catch { return null; }
  }
}

const playwright = await detectPlaywright();

if (playwright === null) {
  write({
    schema: 'streetui-firefox/v2.4',
    status: 'BLOCKED',
    reason:
      'No Playwright driver with a launchable Firefox binary is available in this environment. The npm ' +
      'registry is unreachable offline (E403), so `npx playwright install firefox` cannot fetch a binary. ' +
      'Real Firefox metrics are therefore NOT measured and NOT fabricated; happy-dom is never substituted.',
    remediation:
      'On a machine with registry access: `npm i -D playwright && npx playwright install firefox`, then ' +
      're-run `node scripts/browser-harness-firefox.mjs`.',
    engine: 'firefox',
    target: 'examples/streetui-performance-app (via window.__bench in src/bench-browser.ts)',
    scenarioCatalogue: SCENARIO_CATALOGUE,
    scenarios: Object.fromEntries(Object.keys(SCENARIO_CATALOGUE).map((k) => [k, null])),
    timestamp: new Date().toISOString(),
  });
  process.stdout.write(`browser-harness-firefox: BLOCKED — no Playwright/Firefox. Wrote ${outPath}.\n`);
  process.exit(0);
}

let firefoxBin = null;
try { firefoxBin = playwright.firefox.executablePath(); } catch { /* older API */ }
if (firefoxBin === null || !fs.existsSync(firefoxBin)) {
  write({
    schema: 'streetui-firefox/v2.4',
    status: 'BLOCKED',
    reason:
      'Playwright resolves, but its Firefox browser binary is NOT downloaded' +
      (firefoxBin ? ` (executable absent at ${firefoxBin})` : ' (no executable path available)') +
      '. A real firefox.launch() would fail. `playwright install firefox` needs the Playwright CDN, ' +
      'unreachable offline. Real Firefox metrics are NOT measured and NOT fabricated.',
    remediation: 'On a registry-connected machine: `npx playwright install firefox`, then re-run.',
    engine: 'firefox',
    target: 'examples/streetui-performance-app (window.__bench)',
    scenarioCatalogue: SCENARIO_CATALOGUE,
    scenarios: Object.fromEntries(Object.keys(SCENARIO_CATALOGUE).map((k) => [k, null])),
    timestamp: new Date().toISOString(),
  });
  process.stdout.write(`browser-harness-firefox: BLOCKED — Firefox binary absent. Wrote ${outPath}.\n`);
  process.exit(0);
}

// ── Real Firefox path (executes only when Playwright + Firefox are present) ──
let server = null;
let browser = null;
try {
  const esbuild = await import(path.join(repo, 'packages', 'cli', 'node_modules', 'esbuild', 'lib', 'main.js'));
  const build = await esbuild.build({
    entryPoints: [path.join(appDir, 'src', 'bench-browser.ts')],
    bundle: true, format: 'esm', write: false, sourcemap: false, target: 'es2020',
    absWorkingDir: appDir,
    define: { 'Buffer.byteLength': '__bufferByteLength' },
    banner: { js: 'const __bufferByteLength = (s, enc) => new TextEncoder().encode(s).length;' },
  });
  const js = build.outputFiles[0].text;
  const htmlPage =
    '<!doctype html><html><head><meta charset="utf-8"><title>streetui bench (firefox)</title></head>' +
    '<body><div id="app"></div><script type="module">' + js + '</script></body></html>';

  server = http.createServer((req, res) => {
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.end(htmlPage);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address();
  const url = `http://127.0.0.1:${port}/`;

  browser = await playwright.firefox.launch();
  const version = browser.version?.() ?? 'unknown';
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof window.__bench === 'function', null, { timeout: 30000 });
  const measured = await page.evaluate(async () => await window.__bench());

  write({
    schema: 'streetui-firefox/v2.4',
    status: 'OK',
    browser: 'firefox',
    browserVersion: version,
    note: 'Separate from the Chromium run (benchmarks/results/v1.3/streetui-browser.json). Same workload; do NOT average across engines.',
    target: 'examples/streetui-performance-app (window.__bench)',
    scenarioCatalogue: SCENARIO_CATALOGUE,
    scenarios: measured,
    timestamp: new Date().toISOString(),
  });
  process.stdout.write(`browser-harness-firefox: OK — wrote ${outPath}\n`);
} catch (err) {
  write({
    schema: 'streetui-firefox/v2.4',
    status: 'ERROR',
    reason: 'Playwright resolved but the Firefox run failed: ' + String(err?.stack ?? err?.message ?? err),
    engine: 'firefox',
    target: 'examples/streetui-performance-app (window.__bench)',
    scenarioCatalogue: SCENARIO_CATALOGUE,
    scenarios: Object.fromEntries(Object.keys(SCENARIO_CATALOGUE).map((k) => [k, null])),
    timestamp: new Date().toISOString(),
  });
  process.stdout.write('browser-harness-firefox: ERROR during run — recorded, no numbers fabricated.\n');
} finally {
  try { await browser?.close(); } catch { /* ignore */ }
  try { server?.close(); } catch { /* ignore */ }
}
process.exit(0);
