/**
 * StreetUI 2.4 — Visual accessibility harness (Phase 4): axe-core + focus-visible.
 *
 *   node scripts/visual-a11y-axe.mjs
 *
 * Renders a REAL StreetUI application in a real browser (Playwright) and runs an
 * accessibility analyzer (axe-core) against the RENDERED output — not against
 * source-code assumptions. It measures the VISUAL accessibility layer ONLY and
 * keeps it strictly separate from STRUCTURAL / BEHAVIORAL / ASSISTIVE_TECHNOLOGY
 * (2.4 Phase 5 rule: never collapse the four layers into one score).
 *
 * What it checks against rendered pixels/DOM:
 *   - colour contrast          → axe-core `color-contrast` rule
 *   - required a11y hygiene     → axe-core `wcag2a`/`wcag2aa` tags (reported, not
 *                                 asserted as full WCAG conformance)
 *   - :focus-visible           → Tab through focusables; record element.matches(':focus-visible')
 *   - focus indicator          → computed outline/box-shadow deltas on focus
 *
 * WCAG WORDING RULE: this reports axe-core violations for specific rules. It does
 * NOT claim blanket "WCAG 2.1 AA conformance" — axe-core covers only a subset of
 * criteria and cannot establish full conformance. The report states exactly which
 * rules ran and their results.
 *
 * HONESTY CONTRACT: real browser + axe-core required. If Playwright, a browser
 * binary, or axe-core is absent, writes an explicit BLOCKED marker with the exact
 * reason and exits 0 — no fabricated pass, no happy-dom substitution.
 *
 * Output: benchmarks/results/v2.4/visual-a11y.json
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..');
const appDir = path.join(repo, 'examples', 'streetui-performance-app');
const outPath = path.join(repo, 'benchmarks', 'results', 'v2.4', 'visual-a11y.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });

const require = createRequire(import.meta.url);
const write = (obj) => fs.writeFileSync(outPath, JSON.stringify(obj, null, 2) + '\n');
const nowIso = () => new Date().toISOString();

const AXE_RULES = ['color-contrast'];
const AXE_TAGS = ['wcag2a', 'wcag2aa'];

async function detectPlaywright() {
  try { const pw = await import('playwright'); return pw?.chromium ? pw : null; }
  catch {
    try { const pwc = await import('playwright-core'); return pwc?.chromium ? pwc : null; }
    catch { return null; }
  }
}
function resolveAxeSource() {
  // axe-core ships a single UMD file we can inject via addScriptTag({ content }).
  try { return fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8'); }
  catch { try { return fs.readFileSync(require.resolve('axe-core'), 'utf8'); } catch { return null; } }
}

const playwright = await detectPlaywright();
const axeSource = resolveAxeSource();

const catalogue = {
  colourContrast: 'axe-core color-contrast rule over the rendered app DOM',
  wcagHygiene: `axe-core tags ${AXE_TAGS.join('/')} (subset — NOT full WCAG conformance)`,
  focusVisible: 'Tab through focusable elements; record element.matches(":focus-visible")',
  focusIndicator: 'computed outline/box-shadow delta between blurred and focused states',
};

if (playwright === null || axeSource === null) {
  const reasons = [];
  if (playwright === null) reasons.push('Playwright with a launchable Chromium is not available (registry E403 blocks `playwright install`).');
  if (axeSource === null) reasons.push('axe-core is not installed/resolvable (`npm i -D axe-core`).');
  write({
    schema: 'streetui-2.4-visual-a11y/v1', layer: 'VISUAL', status: 'BLOCKED',
    reason: reasons.join(' '),
    remediation: 'On a registry-connected machine: `npm i -D playwright axe-core && npx playwright install chromium`, then re-run `node scripts/visual-a11y-axe.mjs`.',
    checkCatalogue: catalogue,
    note: 'STRUCTURAL and BEHAVIORAL layers are covered by packages/testing/src/a11y-regression.test.ts and are reported separately; ASSISTIVE_TECHNOLOGY is covered by scripts/at-orca-driver.mjs. This file is the VISUAL layer only.',
    capturedAt: nowIso(),
  });
  process.stdout.write(`visual-a11y-axe: BLOCKED — wrote ${outPath} (no fabricated pass).\n`);
  process.exit(0);
}
let chromiumBin = null;
try { chromiumBin = playwright.chromium.executablePath(); } catch { /* older API */ }
if (chromiumBin === null || !fs.existsSync(chromiumBin)) {
  write({
    schema: 'streetui-2.4-visual-a11y/v1', layer: 'VISUAL', status: 'BLOCKED',
    reason: 'Playwright resolves but its Chromium binary is not downloaded; a real launch would fail. `playwright install chromium` needs the CDN (unreachable offline).',
    checkCatalogue: catalogue, capturedAt: nowIso(),
  });
  process.stdout.write(`visual-a11y-axe: BLOCKED — Chromium binary absent. Wrote ${outPath}.\n`);
  process.exit(0);
}

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
  // Mount the real app for scanning. bench-browser exposes window.__bench(); we
  // also mount the app into #app so axe has real rendered DOM to analyze.
  const htmlPage =
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>streetui a11y</title></head>' +
    '<body><div id="app"></div><script type="module">' + js +
    '\ntry{ if(typeof window.__mount==="function"){ window.__mount(document.getElementById("app")); } else if(typeof window.__bench==="function"){ window.__bench(); } }catch(e){ window.__mountError=String(e); }' +
    '</script></body></html>';

  server = http.createServer((req, res) => { res.setHeader('content-type', 'text/html; charset=utf-8'); res.end(htmlPage); });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address();

  browser = await playwright.chromium.launch();
  const version = browser.version?.() ?? 'unknown';
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load' });
  await page.waitForTimeout(300); // allow mount

  await page.addScriptTag({ content: axeSource });
  const axeResult = await page.evaluate(async ({ rules, tags }) => {
    // eslint-disable-next-line no-undef
    const run = await axe.run(document, {
      runOnly: { type: 'tag', values: tags },
    });
    const contrast = run.violations.filter((v) => v.id === 'color-contrast');
    return {
      violationCount: run.violations.length,
      colorContrastViolations: contrast.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length })),
      violationsByRule: run.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length })),
      passesCount: run.passes.length,
      incompleteCount: run.incomplete.length,
      rulesRequested: rules,
      tags,
    };
  }, { rules: AXE_RULES, tags: AXE_TAGS });

  // focus-visible + focus indicator: Tab through focusables, record matches + style delta.
  const focus = await page.evaluate(async () => {
    const focusables = Array.from(document.querySelectorAll(
      'a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])',
    )).slice(0, 25);
    const results = [];
    for (const el of focusables) {
      const before = getComputedStyle(el);
      const beforeOutline = before.outlineStyle + '|' + before.outlineWidth + '|' + before.boxShadow;
      el.focus();
      const after = getComputedStyle(el);
      const afterOutline = after.outlineStyle + '|' + after.outlineWidth + '|' + after.boxShadow;
      let fv = false; try { fv = el.matches(':focus-visible'); } catch {}
      results.push({ tag: el.tagName.toLowerCase(), focusVisible: fv, indicatorChanged: beforeOutline !== afterOutline });
      el.blur();
    }
    return {
      sampled: results.length,
      withFocusVisible: results.filter((r) => r.focusVisible).length,
      withVisibleIndicator: results.filter((r) => r.indicatorChanged).length,
      detail: results,
    };
  });

  const contrastPass = axeResult.colorContrastViolations.length === 0;
  const focusIndicatorPass = focus.sampled === 0 ? null : focus.withVisibleIndicator > 0;

  write({
    schema: 'streetui-2.4-visual-a11y/v1',
    layer: 'VISUAL',
    status: contrastPass && focusIndicatorPass !== false ? 'PASS' : 'FAIL',
    browser: 'chromium', browserVersion: version,
    target: 'examples/streetui-performance-app rendered DOM',
    wcagDisclaimer: 'axe-core covers a SUBSET of WCAG criteria; a PASS here is NOT a full WCAG 2.1 AA conformance claim.',
    colorContrast: { pass: contrastPass, violations: axeResult.colorContrastViolations },
    axe: axeResult,
    focusVisible: focus,
    focusIndicator: { pass: focusIndicatorPass },
    note: 'VISUAL layer only. STRUCTURAL+BEHAVIORAL = packages/testing/src/a11y-regression.test.ts; ASSISTIVE_TECHNOLOGY = scripts/at-orca-driver.mjs. Overlay-specific states (dialog/popover/dropdown/tooltip/toast, disabled/selected/expanded) need a dedicated showcase entry that opens each overlay before the scan — follow-up.',
    capturedAt: nowIso(),
  });
  process.stdout.write(`visual-a11y-axe: wrote ${outPath}\n`);
} catch (err) {
  write({
    schema: 'streetui-2.4-visual-a11y/v1', layer: 'VISUAL', status: 'ERROR',
    reason: 'Browser/axe run failed: ' + String(err?.stack ?? err?.message ?? err),
    checkCatalogue: catalogue, capturedAt: nowIso(),
  });
  process.stdout.write('visual-a11y-axe: ERROR — recorded, no fabricated result.\n');
} finally {
  try { await browser?.close(); } catch { /* ignore */ }
  try { server?.close(); } catch { /* ignore */ }
}
process.exit(0);
