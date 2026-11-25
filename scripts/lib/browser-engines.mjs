/**
 * Shared browser-engine and mode handling for verification harnesses.
 *
 * Engine selection is deliberately strict: an unknown engine is an error and a
 * launched browser must report the requested engine. No fallback may substitute
 * Chromium for Firefox or WebKit.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const BROWSER_ENGINES = Object.freeze(['chromium', 'firefox', 'webkit']);
export const SERVER_MODES = Object.freeze(['dev', 'prod']);

export function assertBrowserEngine(engine) {
  if (!BROWSER_ENGINES.includes(engine)) {
    throw new Error(`Unknown browser engine "${engine}". Expected one of: ${BROWSER_ENGINES.join(', ')}`);
  }
  return engine;
}

function list(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') return value.split(',');
  return [];
}

export function normalizeEngines(value, fallback = ['chromium', 'firefox']) {
  const requested = list(value).map((entry) => entry.trim()).filter(Boolean);
  const selected = requested.length > 0 ? requested : fallback;
  if (selected.includes('all')) return [...BROWSER_ENGINES];
  return [...new Set(selected.map(assertBrowserEngine))];
}

export function normalizeModes(value, fallback = ['dev', 'prod']) {
  const requested = list(value).map((entry) => entry.trim()).filter(Boolean);
  const selected = requested.length > 0 ? requested : fallback;
  const expanded = selected.flatMap((mode) => (mode === 'both' ? SERVER_MODES : [mode]));
  for (const mode of expanded) {
    if (!SERVER_MODES.includes(mode)) {
      throw new Error(`Unknown server mode "${mode}". Expected dev, prod or both`);
    }
  }
  return [...new Set(expanded)];
}

/** Read `--flag value` or `--flag=value` from an argv slice. */
export function flagValue(flag, argv = process.argv.slice(2)) {
  const withEquals = argv.find((arg) => arg.startsWith(`${flag}=`));
  if (withEquals !== undefined) return withEquals.slice(flag.length + 1);
  const index = argv.indexOf(flag);
  if (index === -1) return undefined;
  const next = argv[index + 1];
  // A following flag means the value was omitted; treat as absent rather than
  // letting `--mode` swallow `--engines chromium`.
  if (next === undefined || next.startsWith('--')) return undefined;
  return next;
}

/**
 * Engine selection from argv, accepting both `--engine` and `--engines`.
 *
 * A harness that only understood one spelling silently dropped the other, so a
 * requested engine produced no record and the run still exited 0. Both spellings
 * are therefore first-class here, and supplying both is an error rather than a
 * silent win for one of them.
 */
export function enginesFromArgv(argv = process.argv.slice(2), fallback = ['chromium', 'firefox']) {
  const singular = flagValue('--engine', argv);
  const plural = flagValue('--engines', argv);
  if (singular !== undefined && plural !== undefined) {
    throw new Error('Pass either --engine or --engines, not both');
  }
  return normalizeEngines(singular ?? plural, fallback);
}

/** Mode selection from argv, accepting `--mode dev|prod|both`. */
export function modesFromArgv(argv = process.argv.slice(2), fallback = ['dev', 'prod']) {
  return normalizeModes(flagValue('--mode', argv), fallback);
}

/** Fail loudly on engine/mode-shaped flags the harness would otherwise ignore. */
export function assertNoUnknownSelectionFlags(argv = process.argv.slice(2)) {
  const allowed = new Set(['--engine', '--engines', '--mode']);
  for (const arg of argv) {
    const name = arg.split('=')[0];
    if (name === undefined || !name.startsWith('--')) continue;
    if (/^--(engine|engines|mode|browser|server|target)s?$/i.test(name) && !allowed.has(name)) {
      throw new Error(`Unknown selection flag "${name}". Use --engine/--engines and --mode`);
    }
  }
}

export function resolveBrowserType(playwright, engine) {
  assertBrowserEngine(engine);
  const type = playwright?.[engine];
  if (type === undefined || type === null || typeof type.launch !== 'function') {
    throw new Error(`Playwright does not provide ${engine}`);
  }
  return type;
}

/** Locate only the requested engine's real executable in the Playwright cache. */
export function cachedEngineExecutable(engine, cacheRoot = path.join(os.homedir(), '.cache', 'ms-playwright')) {
  assertBrowserEngine(engine);
  if (!fs.existsSync(cacheRoot)) return undefined;
  const prefix = { chromium: 'chromium-', firefox: 'firefox-', webkit: 'webkit-' }[engine];
  const dirs = fs.readdirSync(cacheRoot).filter((dir) => dir.startsWith(prefix)).sort().reverse();
  for (const dir of dirs) {
    const candidates = {
      chromium: ['chrome-linux/chrome', 'chrome-linux64/chrome'],
      firefox: ['firefox/firefox'],
      webkit: ['pw_run.sh'],
    }[engine];
    for (const candidate of candidates) {
      const executable = path.join(cacheRoot, dir, candidate);
      if (fs.existsSync(executable)) return executable;
    }
  }
  return undefined;
}

export function assertLaunchedBrowser(browser, engine) {
  assertBrowserEngine(engine);
  const actual = browser?.browserType?.().name?.();
  if (actual !== engine) {
    throw new Error(`Requested ${engine} but Playwright launched ${actual ?? 'an unknown engine'}`);
  }
  return browser;
}

/**
 * Launch the requested engine, using only a same-engine cached executable as a
 * fallback. The returned browser is verified before any scenario is recorded.
 */
export async function launchBrowser(playwright, engine, options = {}) {
  const type = resolveBrowserType(playwright, engine);
  const args = options.args ?? (engine === 'chromium' ? ['--no-sandbox'] : []);
  const launch = (executablePath) => type.launch({
    headless: options.headless ?? true,
    args,
    ...(executablePath === undefined ? {} : { executablePath }),
    ...(options.timeout === undefined ? {} : { timeout: options.timeout }),
  });

  let browser;
  try {
    browser = await launch(options.executablePath);
  } catch (error) {
    const fallback = options.executablePath ?? cachedEngineExecutable(engine, options.cacheRoot);
    if (fallback === undefined || fallback === options.executablePath) throw error;
    browser = await launch(fallback);
  }
  return assertLaunchedBrowser(browser, engine);
}
