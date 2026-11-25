/**
 * Deterministic summary statistics for sampled performance evidence.
 *
 * Samples are raw observations (milliseconds). Nothing here filters outliers or
 * smooths data: the raw arrays are always reported alongside the summary so a
 * reader can recompute every number.
 *
 * p95 uses the nearest-rank method: index = ceil(0.95 * n) - 1 over the sorted
 * ascending samples, clamped to the valid range.
 */

function assertFiniteSamples(samples) {
  if (!Array.isArray(samples)) throw new TypeError('samples must be an array of numbers');
  for (const sample of samples) {
    if (typeof sample !== 'number' || !Number.isFinite(sample)) {
      throw new TypeError(`sample must be a finite number, received ${String(sample)}`);
    }
  }
}

export function mean(samples) {
  if (samples.length === 0) return null;
  return samples.reduce((total, value) => total + value, 0) / samples.length;
}

export function median(samples) {
  if (samples.length === 0) return null;
  const sorted = [...samples].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

/** Population variance (divides by n) — the samples are the whole run. */
export function variance(samples) {
  if (samples.length === 0) return null;
  const average = mean(samples);
  return samples.reduce((total, value) => total + (value - average) ** 2, 0) / samples.length;
}

export function stddev(samples) {
  const value = variance(samples);
  return value === null ? null : Math.sqrt(value);
}

export function percentile(samples, fraction = 0.95) {
  if (samples.length === 0) return null;
  if (!(fraction > 0 && fraction <= 1)) throw new RangeError('fraction must be in (0, 1]');
  const sorted = [...samples].sort((a, b) => a - b);
  const rank = Math.ceil(fraction * sorted.length);
  const index = Math.min(Math.max(rank - 1, 0), sorted.length - 1);
  return sorted[index];
}

export function summarizeSamples(samples) {
  assertFiniteSamples(samples);
  const empty = samples.length === 0;
  const sorted = [...samples].sort((a, b) => a - b);
  return {
    count: samples.length,
    min: empty ? null : sorted[0],
    max: empty ? null : sorted[sorted.length - 1],
    mean: mean(samples),
    median: median(samples),
    variance: variance(samples),
    stddev: stddev(samples),
    p95: percentile(samples, 0.95),
    samples: [...samples],
  };
}

/** Cold and warm observations are kept separate — never averaged together. */
export function summarizePhases({ cold = [], warm = [] } = {}) {
  return {
    cold: summarizeSamples(cold),
    warm: summarizeSamples(warm),
  };
}

export function parseSamplingArgs(argv = process.argv.slice(2), defaults = { warmup: 5, samples: 20 }) {
  const read = (flag) => {
    const withEquals = argv.find((arg) => arg.startsWith(`${flag}=`));
    if (withEquals !== undefined) return withEquals.slice(flag.length + 1);
    const index = argv.indexOf(flag);
    return index === -1 ? undefined : argv[index + 1];
  };
  const parseCount = (raw, fallback, name) => {
    if (raw === undefined) return fallback;
    const value = Number(raw);
    if (!Number.isInteger(value) || value < 0) throw new Error(`${name} must be a non-negative integer, received "${raw}"`);
    return value;
  };
  const warmup = parseCount(read('--warmup'), defaults.warmup, '--warmup');
  const samples = parseCount(read('--samples'), defaults.samples, '--samples');
  if (samples < 1) throw new Error('--samples must be at least 1');
  return { warmup, samples };
}
