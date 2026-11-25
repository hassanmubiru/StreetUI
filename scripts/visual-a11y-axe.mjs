/**
 * StreetUI visual accessibility harness (M11/M15): axe-core + focus-visible.
 *
 *   node scripts/visual-a11y-axe.mjs [--engine chromium|firefox|webkit|all]
 *                                    [--mode dev|prod] [--out=<path>]
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
 *   - :focus-visible           → focus each focusable; record element.matches(':focus-visible')
 *   - focus indicator          → computed outline/box-shadow deltas on focus
 *
 * WCAG WORDING RULE: this reports axe-core violations for specific rules. It does
 * NOT claim blanket "WCAG 2.1 AA conformance" — axe-core covers only a subset of
 * criteria and cannot establish full conformance. The report states exactly which
 * rules ran and their results.
 *
 * HONESTY CONTRACT: a real browser + axe-core are required. A missing Playwright,
 * browser binary, host library, or axe-core produces an explicit BLOCKED entry
 * for that engine with the exact reason — never a fabricated pass and never a
 * happy-dom substitution.
 *
 * EXIT SEMANTICS: FAIL/ERROR always exit nonzero; BLOCKED exits nonzero under CI
 * or `--require`; a requested engine/mode without a verified result also fails.
 *
 * Output: benchmarks/results/v2.5/visual-a11y.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { launchBrowser, enginesFromArgv, modesFromArgv, assertNoUnknownSelectionFlags } from './lib/browser-engines.mjs';
import { startServerFixture } from './lib/dev-server-fixture.mjs';
import { applyExitCode, formatSummary, summarizeReports, summaryForArtifact } from './lib/harness-status.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..');
const appDir = path.join(repo, 'examples', 'streetui-performance-app');
const argValue = (flag) => {
  const withEquals = process.argv.find((a) => a.startsWith(`${flag}=`));
  if (withEquals !== undefined) return withEquals.slice(flag.length + 1);
  const index = process.argv.indexOf(flag);
  return index === -1 ? undefined : process.argv[index + 1];
};
const outFlag = argValue('--out');
const outPath = outFlag ?? path.join(repo, 'benchmarks', 'results', 'v2.5', 'visual-a11y.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });

assertNoUnknownSelectionFlags();
const engines = enginesFromArgv(undefined, ['chromium']);
const modes = modesFromArgv(undefined, ['dev']);

const AXE_RULES = ['color-contrast'];
const AXE_TAGS = ['wcag2a', 'wcag2aa'];

const require = createRequire(import.meta.url);
const nowIso = () => new Date().toISOString();

const catalogue = {
  colourContrast: 'axe-core color-contrast rule over the rendered app DOM',
  wcagHygiene: `axe-core tags ${AXE_TAGS.join('/')} (subset — NOT full WCAG conformance)`,
  focusVisible: 'Focus each focusable element; record element.matches(":focus-visible")',
  focusIndicator: 'computed outline/box-shadow delta between blurred and focused states',
};

function resolveAxeSource() {
  const candidates = [
    path.join(repo, 'benchmarks', 'node_modules', 'axe-core', 'axe.min.js'),
    path.join(repo, 'node_modules', 'axe-core', 'axe.min.js'),
  ];
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) return fs.readFileSync(candidate, 'utf8');
    } catch {
      /* try next */
    }
  }
  for (const specifier of ['axe-core/axe.min.js', 'axe-core']) {
    try {
      return fs.readFileSync(require.resolve(specifier), 'utf8');
    } catch {
      /* try next */
    }
  }
  return null;
}

async function loadPlaywright() {
  for (const specifier of ['playwright', 'playwright-core']) {
    try {
      const module = await import(specifier);
      if (module?.chromium !== undefined) return module;
    } catch {
      /* try next */
    }
  }
  return null;
}

/** Hosts that cannot load Playwright's shared libraries are BLOCKED, not FAIL. */
function isUnavailableHostError(message) {
  return /Executable doesn't exist|Failed to launch|browserType\.launch|error while loading shared libraries|Host system is missing dependencies/i.test(
    message,
  );
}

const playwright = await loadPlaywright();
const axeSource = resolveAxeSource();

const reports = [];

async function runEngineMode(engine, mode, browserType) {
  const report = {
    requestedEngine: engine,
    actualEngine: null,
    engine,
    browserVersion: null,
    requestedMode: mode,
    actualMode: null,
    mode,
    status: 'BLOCKED',
    reason: '',
    scenarios: {},
    checks: {},
  };

  if (playwright === null) {
    report.reason = 'Playwright is not installed or provides no launchable browser.';
    return report;
  }
  if (axeSource === null) {
    report.reason = 'axe-core is not installed/resolvable (`npm i -D axe-core`).';
    return report;
  }

  let fixture = null;
  let browser = null;
  try {
    fixture = await startServerFixture(repo, appDir, mode);
    report.actualMode = fixture.actualMode;

    browser = await launchBrowser(playwright, engine, { timeout: 45000 });
    report.actualEngine = browser.browserType().name();
    report.browserVersion = browser.version();

    const page = await browser.newPage();
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(String(error?.message ?? error)));
    page.on('console', (message) => {
      if (message.type() === 'error') pageErrors.push(`console.error: ${message.text()}`);
    });

    await page.goto(`${fixture.url}/`, { waitUntil: 'load', timeout: 45000 });
    await page.waitForFunction(() => typeof window.__bench === 'function', null, { timeout: 45000 });
    await page.evaluate(async () => {
      await window.__bench();
    });
    await page.waitForTimeout(300);

    // Inject axe into the live page, then run it in the same page. The source is
    // a UMD bundle that installs `window.axe`; evaluate it directly instead of
    // wrapping ~650 KB in a Function constructor (which stalls the page).
    await page.addScriptTag({ content: axeSource });
    const axeResult = await page.evaluate(
      async ({ tags }) => {
        const axeGlobal = globalThis.axe;
        if (axeGlobal === undefined || typeof axeGlobal.run !== 'function') {
          throw new Error('axe-core did not install a global');
        }
        const run = await axeGlobal.run(document, { runOnly: { type: 'tag', values: tags } });
        const contrast = run.violations.filter((v) => v.id === 'color-contrast');
        return {
          violationCount: run.violations.length,
          colorContrastViolations: contrast.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length })),
          violationsByRule: run.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length })),
          passesCount: run.passes.length,
          incompleteCount: run.incomplete.length,
          tags,
        };
      },
      { tags: AXE_TAGS },
    );

    const focus = await page.evaluate(async () => {
      const focusables = Array.from(
        document.querySelectorAll('a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])'),
      ).slice(0, 25);
      const results = [];
      for (const element of focusables) {
        const before = getComputedStyle(element);
        const beforeIndicator = `${before.outlineStyle}|${before.outlineWidth}|${before.boxShadow}`;
        element.focus();
        const after = getComputedStyle(element);
        const afterIndicator = `${after.outlineStyle}|${after.outlineWidth}|${after.boxShadow}`;
        let focusVisible = false;
        try {
          focusVisible = element.matches(':focus-visible');
        } catch {
          /* engine may not support the selector */
        }
        results.push({
          tag: element.tagName.toLowerCase(),
          focusVisible,
          indicatorChanged: beforeIndicator !== afterIndicator,
        });
        element.blur();
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
    report.checks = {
      colourContrast: { pass: contrastPass, rule: 'color-contrast' },
      focusVisible: { pass: focus.withFocusVisible > 0, sampled: focus.sampled },
      focusIndicator: { pass: focusIndicatorPass },
    };
    report.axe = { ...axeResult, rulesRequested: AXE_RULES };
    report.focus = focus;
    report.pageErrors = pageErrors;
    report.status = contrastPass && focusIndicatorPass !== false ? 'PASS' : 'FAIL';
    if (report.status === 'FAIL') {
      report.reason = [
        contrastPass ? null : 'colour contrast violations present',
        focusIndicatorPass === false ? 'no visible focus indicator on sampled elements' : null,
      ]
        .filter(Boolean)
        .join('; ');
    }
    return report;
  } catch (error) {
    const message = String(error?.stack ?? error?.message ?? error);
    const blocked = isUnavailableHostError(message);
    report.status = blocked ? 'BLOCKED' : 'ERROR';
    report.reason = `${blocked ? 'Browser unavailable on this host' : 'Browser/axe run failed'}: ${message.split('\n')[0]}`;
    return report;
  } finally {
    try {
      await browser?.close();
    } catch {
      /* already closed */
    }
    try {
      await fixture?.stop();
    } catch {
      /* already stopped */
    }
  }
}

for (const engine of engines) {
  for (const mode of modes) reports.push(await runEngineMode(engine, mode, playwright));
}

const summary = summarizeReports(reports, { requestedEngines: engines, requestedModes: modes });
const artifact = {
  schema: 'streetui-2.4-visual-a11y/v1',
  layer: 'VISUAL',
  target: 'examples/streetui-performance-app rendered DOM',
  wcagDisclaimer:
    'axe-core covers a SUBSET of WCAG criteria; a PASS here is NOT a full WCAG 2.1 AA conformance claim.',
  checkCatalogue: catalogue,
  note:
    'VISUAL layer only. STRUCTURAL+BEHAVIORAL = packages/testing/src/a11y-regression.test.ts; ' +
    'ASSISTIVE_TECHNOLOGY = scripts/at-orca-driver.mjs. Overlay-specific states ' +
    '(dialog/popover/dropdown/tooltip/toast, disabled/selected/expanded) need a dedicated showcase ' +
    'entry that opens each overlay before the scan — follow-up.',
  engines: reports,
  summary: summaryForArtifact(summary),
  capturedAt: nowIso(),
};
fs.writeFileSync(outPath, `${JSON.stringify(artifact, null, 2)}\n`);

const lines = formatSummary(summary).split('\n');
process.stdout.write(`${lines[0]}\n`);
for (const report of reports) {
  process.stdout.write(
    `visual-a11y: ${report.requestedEngine}/${report.requestedMode} → ${report.status}` +
      `${report.actualEngine === null ? '' : ` (launched ${report.actualEngine} ${report.browserVersion ?? 'unknown'})`}\n`,
  );
}
process.stdout.write(`visual-a11y-axe: wrote ${outPath}\n`);
process.exitCode = applyExitCode(summary, { write: () => {} });
