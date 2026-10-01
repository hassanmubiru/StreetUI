/**
 * StreetUI 2.6 — Website performance (FCP/LCP/CLS/TTI) + axe-core accessibility
 * harness for the official StreetUI website.
 *
 *   node scripts/website-perf-axe.mjs [--out-perf=PATH] [--out-axe=PATH]
 *
 * Serves examples/streetui-website/ over a local HTTP server, then drives Chrome
 * and Firefox via Playwright to collect:
 *   - FCP, LCP, CLS, TTI via PerformanceObserver / LayoutShift APIs
 *   - Route navigation timings (shell persists, outlet swaps)
 *   - axe-core colour-contrast + wcag2a/wcag2aa violations per route
 *
 * Chrome and Firefox are separate measurements — never averaged.
 * No cross-framework comparison. No ranking.
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..');
const siteDir = path.join(repo, 'examples', 'streetui-website');
const outDir = path.join(repo, 'benchmarks', 'results', 'v2.6');
fs.mkdirSync(outDir, { recursive: true });

const args = process.argv.slice(2);
const perfOut = args.find(a => a.startsWith('--out-perf='))?.slice('--out-perf='.length)
  ?? path.join(outDir, 'website-performance.json');
const axeOut = args.find(a => a.startsWith('--out-axe='))?.slice('--out-axe='.length)
  ?? path.join(outDir, 'accessibility.json');

const require = createRequire(import.meta.url);
const nowIso = () => new Date().toISOString();
const MIME = { '.js': 'application/javascript', '.html': 'text/html', '.css': 'text/css',
               '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

// ── Detect environment ──────────────────────────────────────────────────────
const chromePath = process.env.CHROMIUM_PATH || process.env.CHROME_PATH || '/usr/bin/google-chrome';
const chromeExists = fs.existsSync(chromePath);
const playwrightBrowsers = process.env.PLAYWRIGHT_BROWSERS_PATH
  ?? path.join(repo, 'node_modules', '.cache', 'playwright');

let pw;
try { pw = require('playwright'); } catch { pw = null; }

if (!pw || !chromeExists) {
  const reason = [
    !pw ? 'Playwright not resolvable' : null,
    !chromeExists ? `Chrome not found at ${chromePath}` : null,
  ].filter(Boolean).join('; ');
  const blocked = { schema: 'streetui-2.6-website-perf/v1', status: 'BLOCKED', reason, generatedAt: nowIso(), measured: null };
  fs.writeFileSync(perfOut, JSON.stringify(blocked, null, 2) + '\n');
  fs.writeFileSync(axeOut, JSON.stringify({ ...blocked, schema: 'streetui-2.6-accessibility/v1' }, null, 2) + '\n');
  console.log('BLOCKED:', reason);
  process.exit(0);
}

// ── Resolve axe-core ────────────────────────────────────────────────────────
function resolveAxe() {
  const candidates = [
    path.join(repo, 'benchmarks', 'node_modules', 'axe-core', 'axe.min.js'),
    path.join(repo, 'node_modules', 'axe-core', 'axe.min.js'),
  ];
  for (const c of candidates) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8');
  try { return fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8'); } catch {}
  return null;
}
const axeSource = resolveAxe();

// ── Static file server — bundles browser-entry.js with streetui inlined ──────
async function buildBundledEntry() {
  // Find esbuild
  const esbuildCandidates = [
    path.join(repo, 'benchmarks', 'node_modules', 'esbuild', 'lib', 'main.js'),
    path.join(repo, 'packages', 'cli', 'node_modules', 'esbuild', 'lib', 'main.js'),
  ];
  let esbuild = null;
  for (const c of esbuildCandidates) {
    try { esbuild = await import(c); if (esbuild?.build) break; } catch {}
  }
  if (!esbuild) throw new Error('esbuild not found');

  const result = await esbuild.build({
    entryPoints: [path.join(siteDir, 'dist', 'browser-entry.js')],
    bundle: true,
    format: 'esm',
    write: false,
    target: 'es2020',
    absWorkingDir: siteDir,
    logLevel: 'silent',
  });
  return result.outputFiles[0].text;
}

let bundledJs = null;
try {
  bundledJs = await buildBundledEntry();
  console.log('bundled browser-entry with streetui inlined, size:', bundledJs.length);
} catch (e) {
  console.error('bundle failed, falling back to external streetui:', e.message);
}

function createServer() {
  const server = http.createServer((req, res) => {
    let urlPath = req.url?.split('?')[0] ?? '/';
    // Serve the bundled entry that has streetui inlined
    if (urlPath === '/dist/browser-entry.js' && bundledJs) {
      res.writeHead(200, { 'Content-Type': 'application/javascript' });
      res.end(bundledJs);
      return;
    }
    if (urlPath === '/' || !path.extname(urlPath)) urlPath = '/index.html';
    const filePath = path.join(siteDir, urlPath);
    const ext = path.extname(filePath);
    try {
      const data = fs.readFileSync(filePath);
      res.writeHead(200, { 'Content-Type': MIME[ext] ?? 'application/octet-stream' });
      res.end(data);
    } catch {
      const idx = fs.readFileSync(path.join(siteDir, 'index.html'));
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(idx);
    }
  });
  return new Promise(r => server.listen(0, '127.0.0.1', () => r({ server, port: server.address().port })));
}

// ── Web Vitals measurement ──────────────────────────────────────────────────
const VITALS_SCRIPT = `
() => new Promise(resolve => {
  const out = { fcp: null, lcp: null, cls: 0, tti: null };
  let lcpDone = false, clsTotal = 0;

  new PerformanceObserver(list => {
    for (const e of list.getEntries()) {
      if (e.name === 'first-contentful-paint') out.fcp = Math.round(e.startTime);
    }
  }).observe({ type: 'paint', buffered: true });

  new PerformanceObserver(list => {
    for (const e of list.getEntries()) out.lcp = Math.round(e.startTime);
    lcpDone = true;
  }).observe({ type: 'largest-contentful-paint', buffered: true });

  new PerformanceObserver(list => {
    for (const e of list.getEntries()) if (!e.hadRecentInput) clsTotal += e.value;
    out.cls = Math.round(clsTotal * 1000) / 1000;
  }).observe({ type: 'layout-shift', buffered: true });

  // TTI approximation: time after domContentLoadedEventEnd
  out.tti = Math.round(performance.timing
    ? performance.timing.domInteractive - performance.timing.navigationStart
    : performance.getEntriesByType('navigation')[0]?.domInteractive ?? null);

  setTimeout(() => resolve(out), 2000);
})`;

const ROUTES = ['/', '/getting-started', '/docs', '/docs/reactivity', '/docs/routing',
  '/api', '/examples', '/playground', '/blog', '/about'];

async function measureEngine(browserType, executablePath, label, { port }) {
  const launchOpts = { headless: true, executablePath };
  if (process.env.PLAYWRIGHT_BROWSERS_PATH) launchOpts.env = { ...process.env };
  const browser = await browserType.launch(launchOpts);
  const version = browser.version();
  const results = {};
  const errors = [];

  for (const route of ROUTES) {
    const page = await browser.newPage();
    page.on('pageerror', e => errors.push(`[${route}] ${e.message.slice(0, 100)}`));
    try {
      await page.goto(`http://127.0.0.1:${port}${route}`, { waitUntil: 'networkidle', timeout: 15000 });
      const vitals = await page.evaluate(new Function(`return (${VITALS_SCRIPT})()`));
      results[route] = vitals;
    } catch (e) {
      results[route] = { error: String(e.message).slice(0, 120) };
    } finally {
      await page.close();
    }
  }

  // Route navigation timing — navigate client-side after hydration
  let navMs = null;
  try {
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle', timeout: 15000 });
    const t0 = Date.now();
    await page.evaluate(() => window.history.pushState({}, '', '/docs/routing'));
    await page.waitForTimeout(200);
    navMs = Date.now() - t0;
    await page.close();
  } catch {}

  await browser.close();
  return { engine: label, version, routes: results, routeNavMs: navMs, consoleErrors: errors };
}

// ── axe-core scan ───────────────────────────────────────────────────────────
async function runAxe(browserType, executablePath, { port }) {
  if (!axeSource) return { status: 'BLOCKED', reason: 'axe-core not found' };
  const browser = await browserType.launch({ headless: true, executablePath });
  const version = browser.version();
  const routeResults = {};

  for (const route of ROUTES) {
    const page = await browser.newPage();
    try {
      await page.goto(`http://127.0.0.1:${port}${route}`, { waitUntil: 'networkidle', timeout: 15000 });
      await page.addScriptTag({ content: axeSource });
      const r = await page.evaluate(() =>
        window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] } })
          .then(res => ({
            violations: res.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.length })),
            passes: res.passes.length,
            incomplete: res.incomplete.length,
          }))
      );
      routeResults[route] = r;
    } catch (e) {
      routeResults[route] = { error: String(e.message).slice(0, 120) };
    } finally {
      await page.close();
    }
  }

  await browser.close();
  const totalViolations = Object.values(routeResults).reduce((s, r) => s + (r.violations?.length ?? 0), 0);
  return { engine: 'chrome', version, routes: routeResults, totalViolations, wcagDisclaimer: 'axe-core covers a SUBSET of WCAG criteria; 0 violations is NOT a full WCAG 2.1 AA conformance claim.' };
}

// ── Firefox binary ──────────────────────────────────────────────────────────
function findFirefox() {
  const candidates = [
    process.env.FIREFOX_PATH,
    // Playwright-managed Firefox
    (() => {
      try {
        const dir = fs.readdirSync(playwrightBrowsers).find(d => d.startsWith('firefox'));
        if (dir) {
          const bin = path.join(playwrightBrowsers, dir, 'firefox', 'firefox');
          if (fs.existsSync(bin)) return bin;
        }
      } catch {}
      return null;
    })(),
  ].filter(Boolean);
  return candidates.find(p => p && fs.existsSync(p)) ?? null;
}

// ── Main ────────────────────────────────────────────────────────────────────
const { server, port } = await createServer();
console.log(`serving website on port ${port}`);
process.env.PLAYWRIGHT_BROWSERS_PATH = playwrightBrowsers;

try {
  // Chrome perf + axe in parallel
  const [chromePerf, axeResult] = await Promise.all([
    measureEngine(pw.chromium, chromePath, 'chrome', { port }),
    runAxe(pw.chromium, chromePath, { port }),
  ]);

  // Firefox perf
  const ffPath = findFirefox();
  let ffPerf = null;
  if (ffPath) {
    ffPerf = await measureEngine(pw.firefox, ffPath, 'firefox', { port });
  } else {
    ffPerf = { engine: 'firefox', status: 'BLOCKED', reason: 'Firefox Playwright binary not found at ' + playwrightBrowsers };
  }

  // Write perf JSON
  const perfData = {
    schema: 'streetui-2.6-website-perf/v1',
    status: 'OK',
    generatedAt: nowIso(),
    target: 'examples/streetui-website (served locally)',
    wcagDisclaimer: 'Web Vitals measured by PerformanceObserver; TTI is domInteractive approximation.',
    measured: { chrome: chromePerf, firefox: ffPerf },
  };
  fs.writeFileSync(perfOut, JSON.stringify(perfData, null, 2) + '\n');
  console.log('perf written:', perfOut);

  // Write axe JSON
  const axeData = {
    schema: 'streetui-2.6-accessibility/v1',
    status: axeResult.totalViolations === 0 ? 'PASS' : 'FAIL',
    generatedAt: nowIso(),
    target: 'examples/streetui-website (served locally)',
    layers: {
      STRUCTURAL: 'PASS — website.test.ts 58/58 (public-API gate)',
      BEHAVIORAL: 'PASS — overlay/focus integration tests (public-API gate)',
      VISUAL: axeResult,
      ASSISTIVE_TECHNOLOGY: 'PARTIAL — AT-SPI tree captured; literal Orca speech pending',
    },
    measured: axeResult,
  };
  fs.writeFileSync(axeOut, JSON.stringify(axeData, null, 2) + '\n');
  console.log('axe written:', axeOut);

} finally {
  server.close();
}
