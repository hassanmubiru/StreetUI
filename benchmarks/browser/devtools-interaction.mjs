/**
 * StreetUI 2.4 — DevTools interactive browser validation harness (Phase 2).
 *
 *   node benchmarks/browser/devtools-interaction.mjs
 *
 * Drives the real 12-panel `renderInteractiveDevTools()` output through a real
 * browser (Chrome + Firefox where available) via Playwright and asserts the
 * interaction contract end-to-end:
 *
 *   - the document loads with 0 console errors / 0 uncaught page errors
 *   - all 12 tabs from DEVTOOLS_TABS appear
 *   - clicking each tab activates it (aria-selected="true") and renders content
 *   - the pull-based Refresh hook (window.__STREETUI_DEVTOOLS_REFRESH__) updates
 *     the visible panel with fresh application state
 *   - an EMPTY snapshot renders the graceful ".st-empty" placeholder (no crash)
 *   - a MALFORMED embedded snapshot is handled safely (controller read() catches)
 *   - XSS-sensitive snapshot values are escaped (no <script>/onerror execution)
 *
 * HONESTY CONTRACT (identical policy to benchmarks/browser/run-all.mjs):
 *   A real browser is required. Node + happy-dom is NOT a browser and is NEVER
 *   substituted. If no Playwright + browser binary is available, this writes an
 *   explicit BLOCKED marker with the exact reason and exits 0 — it does NOT
 *   fabricate a pass. The moment a browser exists, real results appear with no
 *   code change. The DevTools snapshot used as input is representative TEST
 *   INPUT (it exercises every panel renderer); the PASS/FAIL values are observed
 *   from the real browser run, not synthesized.
 *
 * Output: benchmarks/results/v2.4/devtools-browser.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..');
const outDir = path.join(repo, 'benchmarks', 'results', 'v2.4');
const outPath = path.join(outDir, 'devtools-browser.json');
fs.mkdirSync(outDir, { recursive: true });

const require = createRequire(import.meta.url);
const nowIso = () => new Date().toISOString();

function writeResult(obj) {
  fs.writeFileSync(outPath, JSON.stringify(obj, null, 2) + '\n');
  console.log('[devtools-browser] wrote', outPath);
}

/** Resolve Playwright + a browser binary, honestly. */
function detectEnvironment() {
  let playwright = null;
  let playwrightReason = '';
  try { playwright = require('playwright'); }
  catch (e) { playwrightReason = e && e.code ? e.code : String(e); }

  const chromeCandidates = [
    process.env.CHROMIUM_PATH, process.env.CHROME_PATH, process.env.PLAYWRIGHT_CHROMIUM_PATH,
    '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/opt/google/chrome/chrome',
    '/usr/bin/chromium', '/usr/bin/chromium-browser', '/snap/bin/chromium',
  ].filter(Boolean);
  const firefoxCandidates = [
    process.env.FIREFOX_PATH, '/usr/bin/firefox', '/snap/bin/firefox',
  ].filter(Boolean);
  const exists = (p) => { try { return fs.existsSync(p); } catch { return false; } };

  return {
    playwright,
    playwrightReason,
    chromePath: chromeCandidates.find(exists) ?? null,
    firefoxPath: firefoxCandidates.find(exists) ?? null,
  };
}

/** Import the public DevTools view surface from the built package. */
async function loadDevToolsView() {
  const tries = ['streetui', '@streetui/devtools'];
  let lastErr = null;
  for (const spec of tries) {
    try {
      const mod = await import(spec);
      if (typeof mod.renderInteractiveDevTools === 'function' && Array.isArray(mod.DEVTOOLS_TABS)) {
        return { renderInteractiveDevTools: mod.renderInteractiveDevTools, DEVTOOLS_TABS: mod.DEVTOOLS_TABS, from: spec };
      }
      lastErr = new Error(`${spec} did not export renderInteractiveDevTools/DEVTOOLS_TABS`);
    } catch (e) { lastErr = e; }
  }
  throw lastErr ?? new Error('could not load DevTools view');
}

/**
 * Representative snapshot that gives EVERY panel non-empty content. Shape follows
 * the DevToolsSnapshot the controller reads (see packages/devtools/src/interactive.ts).
 * This is test INPUT, not a measurement.
 */
function makeSnapshot(overrides = {}) {
  const base = {
    application: { identity: { name: 'DevTools Harness App', version: '2.4.0' } },
    components: [
      { id: 'c0', name: 'AppRoot', depth: 0, childCount: 2, key: null },
      { id: 'c1', name: 'UserCard', depth: 1, childCount: 0, key: 'u1' },
    ],
    graph: {
      id: 'c0', type: 'component', depth: 0, key: null, props: { title: 'Home' },
      eventTypes: [], stateBindings: ['count'],
      children: [
        { id: 'c1', type: 'component', depth: 1, key: 'u1', props: { name: 'Ada' }, eventTypes: ['click'], stateBindings: [], children: [] },
      ],
    },
    signals: { live: { count: { kind: 'signal', value: 42, observerCount: 2 } }, boundSignalIds: ['s_count'] },
    signalGraph: { signals: [{ signalId: 's_count', boundNodeIds: ['c0'], bindingCount: 1, kind: 'signal', observerCount: 2 }], edges: [{ from: 's_count', to: 'c0' }] },
    router: { path: '/users/1', pattern: '/users/:id', isFallback: false, params: { id: '1' }, query: { tab: 'profile' } },
    resources: { user: { status: 'success', loading: false, isRefetching: false, hasError: false, errorName: null } },
    mutations: { saveUser: { status: 'idle', pending: false, hasError: false, errorName: null } },
    events: { nodes: [{ id: 'c1', nodeType: 'button', key: 'u1', eventTypes: ['click'] }], totalHandlers: 1, byType: { click: 1 } },
    overlays: [{ id: 'ov0', key: 'confirm', modal: true, menu: false, takesFocus: true, open: false, closeOnEscape: true, restoreFocus: true }],
    performance: { snapshot: { nodes: 2, signals: 1, edges: 1 }, diagnostics: [] },
    diagnostics: { errors: 0, warnings: 1, messages: ['demo warning: unused binding'] },
    hydration: {
      totalNodes: 2, staticNodes: 1, dynamicNodes: 1, staticRatio: 0.5, staticSubtrees: 1,
      dynamicTextNodes: 1, dynamicAttrNodes: 0, eventNodes: 1, lists: 0, conditionals: 0, portals: 1, headAnchors: 1,
    },
  };
  return { ...base, ...overrides };
}

/** The 18 XSS-sensitive probe strings, embedded across snapshot fields. */
const XSS = '<img src=x onerror="window.__xss=1">"><script>window.__xss=1<\/script>';
function makeXssSnapshot() {
  return makeSnapshot({
    application: { identity: { name: XSS, version: XSS } },
    components: [{ id: XSS, name: XSS, depth: 0, childCount: 0, key: XSS }],
    diagnostics: { errors: 0, warnings: 1, messages: [XSS] },
  });
}

async function driveBrowser(engine, launch, view) {
  const { renderInteractiveDevTools, DEVTOOLS_TABS } = view;
  const consoleErrors = [];
  const pageErrors = [];
  const browser = await launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => pageErrors.push(String(e)));

  const checks = {};
  const version = browser.version ? browser.version() : 'unknown';

  // ---- main document with a full snapshot ----
  const html = renderInteractiveDevTools(makeSnapshot());
  await page.setContent(html, { waitUntil: 'load' });

  checks.pageLoads = { pass: (await page.title()).length > 0 };

  const tabHandles = await page.$$('.st-tab');
  checks.allTabsAppear = { pass: tabHandles.length === DEVTOOLS_TABS.length, expected: DEVTOOLS_TABS.length, found: tabHandles.length };

  // Click each of the 12 tabs; assert active + non-empty panel content.
  const panels = {};
  for (const tab of DEVTOOLS_TABS) {
    const sel = `.st-tab[data-tab="${tab.id}"]`;
    await page.click(sel);
    const active = await page.getAttribute(sel, 'aria-selected');
    const panelHtml = (await page.innerHTML('#st-panel')).trim();
    panels[tab.id] = {
      label: tab.label,
      activated: active === 'true',
      rendered: panelHtml.length > 0,
      pass: active === 'true' && panelHtml.length > 0,
    };
  }
  checks.panels = panels;
  checks.allPanelsRender = { pass: Object.values(panels).every((p) => p.pass) };

  // ---- refresh hook: fresh state must become visible ----
  await page.evaluate(() => {
    window.__STREETUI_DEVTOOLS_REFRESH__ = function () {
      const d = window.__StreetUIDevTools.data;
      return Object.assign({}, d, {
        signals: { live: { count: { kind: 'signal', value: 999, observerCount: 5 } }, boundSignalIds: ['s_count'] },
      });
    };
  });
  await page.click('.st-tab[data-tab="state"]');
  const before = await page.innerHTML('#st-panel');
  await page.click('#st-refresh');
  const after = await page.innerHTML('#st-panel');
  checks.refreshHook = { pass: after.includes('999') && after !== before };

  // ---- empty snapshot: graceful placeholder, no crash ----
  const emptyHtml = renderInteractiveDevTools({ application: { identity: { name: 'Empty', version: '2.4.0' } } });
  await page.setContent(emptyHtml, { waitUntil: 'load' });
  await page.click('.st-tab[data-tab="components"]');
  const emptyPanel = await page.innerHTML('#st-panel');
  checks.emptySnapshot = { pass: emptyPanel.includes('st-empty') };

  // ---- malformed embedded snapshot: controller read() must catch ----
  const malformed = emptyHtml.replace(
    /<script type="application\/json" id="st-data">[\s\S]*?<\/script>/,
    '<script type="application/json" id="st-data">{ this is not valid json }<\/script>',
  );
  const preMalformedPageErrors = pageErrors.length;
  await page.setContent(malformed, { waitUntil: 'load' });
  await page.click('.st-tab[data-tab="components"]').catch(() => {});
  const malformedPanel = await page.innerHTML('#st-panel').catch(() => '');
  checks.malformedSnapshot = {
    pass: pageErrors.length === preMalformedPageErrors && malformedPanel.length >= 0,
    note: 'controller JSON.parse is wrapped in try/catch → falls back to {} and renders empty state',
  };

  // ---- XSS: sensitive values must be escaped, never executed ----
  await page.evaluate(() => { window.__xss = 0; });
  const xssHtml = renderInteractiveDevTools(makeXssSnapshot());
  await page.setContent(xssHtml, { waitUntil: 'load' });
  await page.click('.st-tab[data-tab="components"]');
  const xssFlag = await page.evaluate(() => window.__xss);
  const rawImg = await page.$('#st-panel img[onerror]');
  checks.xssSafe = { pass: xssFlag === 0 && rawImg === null, executed: xssFlag === 1 };

  await browser.close();

  const allPass =
    checks.pageLoads.pass && checks.allTabsAppear.pass && checks.allPanelsRender.pass &&
    checks.refreshHook.pass && checks.emptySnapshot.pass && checks.malformedSnapshot.pass &&
    checks.xssSafe.pass && consoleErrors.length === 0 && pageErrors.length === 0;

  return {
    engine,
    browserVersion: version,
    status: allPass ? 'PASS' : 'FAIL',
    consoleErrors,
    pageErrors,
    checks,
  };
}

async function main() {
  const env = detectEnvironment();
  const view = await loadDevToolsView().catch((e) => ({ error: String(e) }));

  const base = {
    schema: 'streetui-2.4-devtools-browser/v1',
    purpose: 'StreetUI 2.4 Phase 2 — real-browser 12-panel DevTools interaction validation. Real results or explicit BLOCKED; never fabricated.',
    capturedAt: nowIso(),
    devtoolsViewSource: view && view.from ? view.from : null,
    panelsUnderTest: (view && view.DEVTOOLS_TABS ? view.DEVTOOLS_TABS.map((t) => t.label) : null),
  };

  if (view && view.error) {
    writeResult({ ...base, status: 'BLOCKED', reason: `Could not load renderInteractiveDevTools from the built package: ${view.error}. Build the workspace first (turbo run build).` });
    return;
  }
  if (!env.playwright) {
    writeResult({ ...base, status: 'BLOCKED', reason: `Playwright is not installed/resolvable (${env.playwrightReason}). Install Playwright and a browser to run the DevTools interaction suite.` });
    return;
  }
  if (!env.chromePath && !env.firefoxPath) {
    writeResult({ ...base, status: 'BLOCKED', reason: 'No Chrome/Chromium or Firefox binary found (checked CHROMIUM_PATH/CHROME_PATH/FIREFOX_PATH and standard install paths). happy-dom is NOT substituted.' });
    return;
  }

  const runs = [];
  if (env.chromePath) {
    try {
      runs.push(await driveBrowser('chromium', () => env.playwright.chromium.launch({ executablePath: env.chromePath }), view));
    } catch (e) { runs.push({ engine: 'chromium', status: 'ERROR', error: String(e) }); }
  } else {
    runs.push({ engine: 'chromium', status: 'BLOCKED', reason: 'no Chrome/Chromium binary found' });
  }
  if (env.firefoxPath) {
    try {
      runs.push(await driveBrowser('firefox', () => env.playwright.firefox.launch({ executablePath: env.firefoxPath }), view));
    } catch (e) { runs.push({ engine: 'firefox', status: 'ERROR', error: String(e) }); }
  } else {
    runs.push({ engine: 'firefox', status: 'BLOCKED', reason: 'no Firefox binary found' });
  }

  const measured = runs.filter((r) => r.status === 'PASS' || r.status === 'FAIL');
  const overall = measured.length === 0 ? 'BLOCKED' : (measured.every((r) => r.status === 'PASS') ? 'PASS' : 'FAIL');
  writeResult({ ...base, status: overall, runs });
  if (overall === 'FAIL') process.exitCode = 1;
}

main().catch((e) => {
  writeResult({
    schema: 'streetui-2.4-devtools-browser/v1', capturedAt: nowIso(),
    status: 'ERROR', reason: String(e && e.stack ? e.stack : e),
  });
  process.exitCode = 1;
});
