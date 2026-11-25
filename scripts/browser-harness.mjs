/**
 * Real-browser benchmark harness for the v1.3 real performance app (spec §3–§7, §19, §22).
 *
 *   node scripts/browser-harness.mjs [--warmup 5] [--samples 20]
 *
 * The in-browser scenarios require a real browser instance driven through
 * Playwright. Node + happy-dom can measure relative JS/DOM cost and DOM-mutation
 * counts (see packages/benchmarks/perf-app-scenarios.mjs) but is NOT a browser and
 * cannot measure paint, layout, long tasks, true time-to-interactive, or frame
 * pacing. Those come only from a real engine.
 *
 * This harness:
 *   1. Starts the performance app on the real StreetUI dev server (no esbuild, no
 *      external bundler), which serves `src/bench-browser.ts` → `window.__bench`.
 *   2. Launches the requested engine with the shared verified launcher.
 *   3. Discards `--warmup` observations, then records `--samples` observations.
 *      Every raw observation is preserved next to the computed summary.
 *   4. If Playwright/browser/axe-class tooling is unavailable, writes a BLOCKED
 *      marker with the exact reason and the scenario catalogue, then exits without
 *      fabricating numbers. happy-dom is never substituted for browser numbers.
 *
 * Output: benchmarks/results/v1.3/streetui-browser.json (plus benchmarks/results/browser.json)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServerFixture } from './lib/dev-server-fixture.mjs';
import {
  assertNoUnknownSelectionFlags,
  cachedEngineExecutable,
  enginesFromArgv,
  launchBrowser,
  modesFromArgv,
} from './lib/browser-engines.mjs';
import { summarizeSamples, parseSamplingArgs } from './lib/perf-stats.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..');
const appDir = path.join(repo, 'examples', 'streetui-performance-app');
const outPath = path.join(repo, 'benchmarks', 'results', 'v1.3', 'streetui-browser.json');
const legacyOut = path.join(repo, 'benchmarks', 'results', 'browser.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });

assertNoUnknownSelectionFlags();
const engines = enginesFromArgv(undefined, ['chromium']);
const modes = modesFromArgv(undefined, ['dev']);
const sampling = parseSamplingArgs();

const write = (obj) => {
  const json = `${JSON.stringify(obj, null, 2)}\n`;
  fs.writeFileSync(outPath, json);
  try {
    fs.mkdirSync(path.dirname(legacyOut), { recursive: true });
    fs.writeFileSync(legacyOut, json);
  } catch {
    /* legacy path is best-effort */
  }
};

const SCENARIO_CATALOGUE = {
  initialMountUsers10k: 'performance.now around mounting the 10,000-row users route; DOM node count.',
  reactiveSearch: 'MutationObserver-counted DOM mutations + time for query narrow then clear over 10k rows.',
  reverse: 'MutationObserver-counted mutations + time to reverse sort direction (worst-case reorder).',
  fineGrainedToggle1of1000: 'MutationObserver mutation count when toggling exactly one of 1,000 controls.',
  routerNavigationMs: 'performance.now per navigation across /dashboard, /users, /settings, /.',
  hydrateUsers10k: 'MutationObserver-verified DOM adoption (added nodes must be 0) + hydration time.',
  frames:
    'requestAnimationFrame pacing vs 16.67ms (60Hz) / 8.33ms (120Hz) reference budgets — reference points, NOT a frame-rate guarantee.',
  memory: 'performance.memory usedJSHeapSize across repeated mount→interact→unmount cycles (indicative, no explicit GC).',
  longTasks: 'PerformanceObserver longtask entries over the whole run.',
};

/** Flatten the scalar metrics a reader wants to compare across samples. */
function flatten(measured) {
  if (measured === null || typeof measured !== 'object') return {};
  const scalars = {};
  const push = (key, value) => {
    if (typeof value === 'number' && Number.isFinite(value)) scalars[key] = value;
  };
  push('initialMountUsers10k.ms', measured.initialMountUsers10k?.ms);
  push('initialMountUsers10k.domNodeCount', measured.initialMountUsers10k?.domNodeCount);
  push('reactiveSearch.narrowMs', measured.reactiveSearch?.narrow?.ms);
  push('reactiveSearch.clearMs', measured.reactiveSearch?.clear?.ms);
  push('reverse.ms', measured.reverse?.ms);
  push('fineGrainedToggle.ms', measured.fineGrainedToggle1of1000?.ms);
  push('hydrateUsers10k.ms', measured.hydrateUsers10k?.ms);
  push('hydrateUsers10k.addedDuringHydration', measured.hydrateUsers10k?.addedDuringHydration);
  push('longTasks.count', measured.longTasks?.count);
  push('longTasks.totalMs', measured.longTasks?.totalMs);
  const navs = measured.routerNavigationMs;
  if (Array.isArray(navs)) navs.forEach((value, index) => push(`routerNavigationMs[${index}]`, value));
  return scalars;
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

const isUnavailableError = (message) =>
  /Executable doesn't exist|Failed to launch|browserType\.launch|error while loading shared libraries|Host system is missing dependencies/i.test(
    message,
  );

const playwright = await loadPlaywright();

const blockedArtifact = (reason, base = {}) => ({
  schema: 'streetui-browser/v1.3',
  status: 'BLOCKED',
  reason,
  requestedEngine: base.requestedEngine ?? engines[0] ?? 'chromium',
  actualEngine: null,
  browserVersion: null,
  requestedMode: base.requestedMode ?? modes[0] ?? 'dev',
  actualMode: null,
  target: 'examples/streetui-performance-app (via window.__bench in src/bench-browser.ts)',
  scenarioCatalogue: SCENARIO_CATALOGUE,
  scenarios: Object.fromEntries(Object.keys(SCENARIO_CATALOGUE).map((key) => [key, null])),
  nodeFallback:
    'Node/happy-dom relative measurements + DOM-mutation-count invariants for these workloads are in ' +
    'benchmarks/results/v1.3/streetui-node.json (a different runtime; not a browser substitute).',
  timestamp: new Date().toISOString(),
});

if (playwright === null) {
  write(
    blockedArtifact(
      'No Playwright driver with a launchable browser is available in this environment. ' +
        'Real-browser metrics (paint, layout, long tasks, true TTI, frame pacing, JS heap) cannot be measured and are NOT fabricated.',
    ),
  );
  process.stdout.write(`browser-harness: BLOCKED — no Playwright/browser. Wrote ${outPath} (no numbers fabricated).\n`);
  process.exit(0);
}

const runs = [];
let blocked = false;

for (const engine of engines) {
  for (const mode of modes) {
    const run = {
      requestedEngine: engine,
      actualEngine: null,
      browserVersion: null,
      requestedMode: mode,
      actualMode: null,
      status: 'BLOCKED',
      reason: '',
      samples: [],
      scalars: {},
      summary: {},
    };
    const binary =
      (() => {
        try {
          const resolved = playwright[engine].executablePath();
          if (resolved !== undefined && fs.existsSync(resolved)) return resolved;
        } catch {
          /* fall through to the cache */
        }
        return cachedEngineExecutable(engine);
      })();
    if (binary === undefined || !fs.existsSync(binary)) {
      run.reason = `No launchable ${engine} binary is available.`;
      blocked = true;
      runs.push(run);
      continue;
    }

    let fixture = null;
    let browser = null;
    try {
      fixture = await startServerFixture(repo, appDir, mode);
      run.actualMode = fixture.actualMode;
      browser = await launchBrowser(playwright, engine, { executablePath: binary, timeout: 45000 });
      run.actualEngine = browser.browserType().name();
      run.browserVersion = browser.version();

      const page = await browser.newPage();
      const pageErrors = [];
      page.on('pageerror', (error) => pageErrors.push(String(error?.message ?? error)));
      await page.goto(`${fixture.url}/`, { waitUntil: 'load', timeout: 45000 });
      await page.waitForFunction(() => typeof window.__bench === 'function', null, { timeout: 45000 });

      for (let i = 0; i < sampling.warmup + sampling.samples; i += 1) {
        const measured = await page.evaluate(async () => await window.__bench());
        if (i < sampling.warmup) continue;
        run.samples.push(measured);
      }
      run.pageErrors = pageErrors;

      // Summarize every scalar independently; never average across engines/modes.
      const keys = new Set(run.samples.flatMap((sample) => Object.keys(flatten(sample))));
      for (const key of keys) {
        const values = run.samples.map((sample) => flatten(sample)[key]).filter((value) => typeof value === 'number');
        run.scalars[key] = summarizeSamples(values);
      }
      run.status = pageErrors.length === 0 ? 'OK' : 'FAIL';
      if (pageErrors.length > 0) run.reason = `page errors: ${pageErrors.join(' | ')}`;
    } catch (error) {
      const message = String(error?.stack ?? error?.message ?? error);
      run.status = isUnavailableError(message) ? 'BLOCKED' : 'ERROR';
      run.reason = message.split('\n')[0];
      if (run.status === 'BLOCKED') blocked = true;
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
    runs.push(run);
  }
}

const verified = runs.filter((run) => run.status === 'OK');
const failed = runs.filter((run) => run.status === 'FAIL' || run.status === 'ERROR');
const allBlocked = runs.length > 0 && runs.every((run) => run.status === 'BLOCKED');

if (verified.length === 0) {
  const run = runs[0] ?? { requestedEngine: engines[0], requestedMode: modes[0], reason: 'no run produced' };
  write(
    blockedArtifact(
      run.reason || 'No browser run produced measurements.',
      { requestedEngine: run.requestedEngine, requestedMode: run.requestedMode },
    ),
  );
  process.stdout.write(
    `browser-harness: ${allBlocked ? 'BLOCKED' : 'ERROR'} — ${run.reason ?? 'no verified run'}. Wrote ${outPath} (no numbers fabricated).\n`,
  );
  process.exit(0);
}

write({
  schema: 'streetui-browser/v1.3',
  status: failed.length === 0 ? 'OK' : 'PARTIAL',
  target: 'examples/streetui-performance-app (window.__bench)',
  scenarioCatalogue: SCENARIO_CATALOGUE,
  workload: {
    warmup: sampling.warmup,
    samplesPerRun: sampling.samples,
    note: 'Each engine/mode run is summarized independently; cold and warm phases are never averaged.',
  },
  runs,
  timestamp: new Date().toISOString(),
});

for (const run of runs) {
  process.stdout.write(
    `browser-harness: ${run.requestedEngine}/${run.requestedMode} → ${run.status}` +
      `${run.actualEngine === null ? '' : ` (${run.actualEngine} ${run.browserVersion ?? 'unknown'})`}\n`,
  );
}
process.stdout.write(`browser-harness: wrote ${outPath}\n`);
if (blocked && verified.length === 0) process.exitCode = 0;
