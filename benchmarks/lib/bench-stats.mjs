// DEV-ONLY benchmark artifact — StreetUI 2.2 Phase 3 harness hardening.
// NOT part of the `streetui` runtime; never imported by shipped code.
/**
 * Standardized benchmark capture: statistics, environment, and a
 * machine-readable result envelope shared by every 2.2 benchmark emitter.
 *
 * Phase 3 goal (verbatim): "Standardize capture (browser version, OS, CPU,
 * memory, warmup runs, measured runs, median, p95, min/max, variance, raw
 * results, timestamp, git revision, package versions). Every benchmark must
 * emit machine-readable JSON. Add reproducibility checks."
 *
 * This module is a strict SUPERSET of the existing stats used by the competitor
 * harness (`competitors/shared/measure.mjs`) and the StreetUI node harness:
 * median = sorted[floor(n/2)], p95 = sorted[min(n-1, ceil(0.95*n)-1)], and
 * round() to 4 decimals are byte-identical to those, so historical numbers stay
 * directly comparable. It ADDS mean, variance, stddev and coefficient-of-
 * variation (the reproducibility signal) plus the full raw sample vector.
 *
 * HONEST SCOPE: nothing here fabricates a measurement. `detectBrowser()`
 * empirically sweeps for a real Chromium and returns BLOCKED when none exists;
 * the envelope carries that status through unchanged. happy-dom is never
 * reported as a browser.
 */
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import os from 'node:os';

/** Round to 4 decimals — identical to the competitor/StreetUI harness `round()`. */
export const round = (x) => Math.round(x * 1e4) / 1e4;

/**
 * Standardized summary over a raw sample vector (milliseconds or any scalar).
 * median/p95 selection is byte-identical to `measure.mjs`; mean/variance/stddev
 * /cv are added for reproducibility analysis. `variance` is the population
 * variance (÷n) so a single deterministic value yields exactly 0.
 *
 * @param {number[]} rawSamples
 * @returns {{samples:number, mean:number, median:number, p95:number,
 *   min:number, max:number, variance:number, stddev:number, cv:number,
 *   raw:number[]}}
 */
export function summarize(rawSamples) {
  if (!Array.isArray(rawSamples) || rawSamples.length === 0) {
    throw new Error('summarize(): non-empty numeric sample array required');
  }
  const n = rawSamples.length;
  const sorted = [...rawSamples].sort((a, b) => a - b);
  const median = sorted[Math.floor(n / 2)];
  const p95 = sorted[Math.min(n - 1, Math.ceil(0.95 * n) - 1)];
  const mean = rawSamples.reduce((s, x) => s + x, 0) / n;
  const variance = rawSamples.reduce((s, x) => s + (x - mean) ** 2, 0) / n;
  const stddev = Math.sqrt(variance);
  const cv = mean === 0 ? 0 : stddev / mean;
  return {
    samples: n,
    mean: round(mean),
    median: round(median),
    p95: round(p95),
    min: round(sorted[0]),
    max: round(sorted[n - 1]),
    variance: round(variance),
    stddev: round(stddev),
    cv: round(cv),
    raw: rawSamples.map(round),
  };
}

/** Candidate real-browser executables/paths swept by {@link detectBrowser}. */
const BROWSER_BINARIES = [
  'google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser',
  'chrome', 'msedge', 'microsoft-edge',
];
const BROWSER_PATHS = [
  '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable',
  '/opt/google/chrome/chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  '/snap/bin/chromium', '/usr/lib/chromium/chromium',
];

/**
 * Empirically sweep for a real browser binary. Returns AVAILABLE only if an
 * actual executable is found; otherwise BLOCKED with the exact evidence. Never
 * substitutes happy-dom. `version` stays null unless a binary answers.
 */
export function detectBrowser() {
  const foundOnPath = [];
  for (const bin of BROWSER_BINARIES) {
    try {
      const p = execSync(`command -v ${bin} 2>/dev/null`, { encoding: 'utf8' }).trim();
      if (p) foundOnPath.push({ bin, path: p });
    } catch { /* absent on PATH */ }
  }
  const foundAtPath = BROWSER_PATHS.filter((p) => existsSync(p));
  const found = foundOnPath.length > 0 || foundAtPath.length > 0;
  if (found) {
    return {
      status: 'AVAILABLE', version: null, foundOnPath, foundAtPath,
      note: 'A browser binary was found; a real launch would still be required to record a version.',
    };
  }
  return {
    status: 'BLOCKED', version: null, foundOnPath: [], foundAtPath: [],
    checked: { onPath: BROWSER_BINARIES, atPath: BROWSER_PATHS },
    reason: 'No Chromium/Chrome/Edge executable found on PATH or at any known install location. '
      + 'A real browser measurement cannot be produced; happy-dom is NOT substituted.',
  };
}

/** Read the single-source framework version + CLI version + competitor pins. */
export function readPackageVersions(repoRoot) {
  const out = { streetui: null, cli: null, competitorPins: null };
  try {
    const v = readFileSync(join(repoRoot, 'packages/streetui/src/version.ts'), 'utf8');
    out.streetui = (v.match(/VERSION\s*=\s*['"]([^'"]+)['"]/) || [])[1] ?? null;
  } catch { /* leave null */ }
  try {
    const c = readFileSync(join(repoRoot, 'packages/cli/src/index.ts'), 'utf8');
    out.cli = (c.match(/CLI_VERSION\s*=\s*['"]([^'"]+)['"]/) || [])[1] ?? null;
  } catch { /* leave null */ }
  try {
    const fv = JSON.parse(readFileSync(join(repoRoot, 'benchmarks/framework-versions.json'), 'utf8'));
    out.competitorPins = fv;
  } catch { /* leave null */ }
  return out;
}

/** Short git SHA for `repoRoot`, or null if not a checkout. */
export function gitRevision(repoRoot) {
  try {
    return execSync('git rev-parse --short HEAD', { cwd: repoRoot, encoding: 'utf8' }).trim();
  } catch { return null; }
}

/**
 * Capture the full, standardized environment record. Every field the Phase 3
 * spec enumerates is present; unavailable capabilities carry an explicit
 * BLOCKED status rather than a fabricated value.
 */
export function captureEnvironment(repoRoot) {
  const cpus = os.cpus() || [];
  return {
    capturedAt: new Date().toISOString(),
    host: {
      os: `${os.type()} ${os.release()}`,
      platform: os.platform(),
      arch: os.arch(),
      cpuModel: cpus[0]?.model ?? null,
      cpuCores: cpus.length || null,
      memTotalGB: round(os.totalmem() / 1024 ** 3),
      memFreeGB: round(os.freemem() / 1024 ** 3),
      node: process.version,
    },
    gitRevision: gitRevision(repoRoot),
    packageVersions: readPackageVersions(repoRoot),
    browser: detectBrowser(),
  };
}

/** Required top-level keys every 2.2 machine-readable envelope MUST carry. */
export const REQUIRED_ENVELOPE_FIELDS = [
  'schema', 'name', 'unit', 'capturedAt', 'config', 'metrics', 'environment',
];

/**
 * Build the canonical machine-readable result envelope. `metrics` is the
 * output of {@link summarize} (or a map of them); `config` records warmup /
 * measured-run counts so a run is reproducible from the file alone.
 */
export function makeEnvelope({ name, unit = 'ms', config, metrics, environment, notes }) {
  return {
    schema: 'streetui-2.2-benchmark/v1',
    name,
    unit,
    capturedAt: new Date().toISOString(),
    config: { warmup: 5, iterations: 25, ...(config || {}) },
    metrics,
    environment,
    notes: notes ?? null,
  };
}

/**
 * Validate that an object is a conformant 2.2 envelope. Returns
 * `{ valid, missing }` — never throws — so a conformance sweep can report every
 * offending file rather than aborting on the first.
 */
export function validateEnvelope(obj) {
  const missing = [];
  if (!obj || typeof obj !== 'object') return { valid: false, missing: REQUIRED_ENVELOPE_FIELDS };
  for (const f of REQUIRED_ENVELOPE_FIELDS) {
    if (!(f in obj) || obj[f] === undefined) missing.push(f);
  }
  return { valid: missing.length === 0, missing };
}
