import assert from 'node:assert/strict';
import test from 'node:test';
import {
  mean,
  median,
  parseSamplingArgs,
  percentile,
  stddev,
  summarizePhases,
  summarizeSamples,
  variance,
} from './perf-stats.mjs';

test('empty samples report null statistics instead of zero', () => {
  const summary = summarizeSamples([]);
  assert.equal(summary.count, 0);
  for (const field of ['min', 'max', 'mean', 'median', 'variance', 'stddev', 'p95']) {
    assert.equal(summary[field], null, `${field} must be null for an empty run`);
  }
  assert.deepEqual(summary.samples, []);
});

test('single sample has zero variance and equal statistics', () => {
  const summary = summarizeSamples([42]);
  assert.equal(summary.count, 1);
  assert.equal(summary.min, 42);
  assert.equal(summary.max, 42);
  assert.equal(summary.mean, 42);
  assert.equal(summary.median, 42);
  assert.equal(summary.variance, 0);
  assert.equal(summary.stddev, 0);
  assert.equal(summary.p95, 42);
});

test('known values produce exact mean/median/population variance/stddev', () => {
  const samples = [2, 4, 4, 4, 5, 5, 7, 9];
  assert.equal(mean(samples), 5);
  assert.equal(median(samples), 4.5);
  assert.equal(variance(samples), 4);
  assert.equal(stddev(samples), 2);
  assert.equal(percentile(samples, 0.95), 9);
});

test('p95 uses nearest-rank and keeps raw samples untouched', () => {
  const samples = Array.from({ length: 20 }, (_, index) => index + 1);
  const summary = summarizeSamples(samples);
  assert.equal(summary.p95, 19);
  assert.deepEqual(summary.samples, samples);
  assert.deepEqual(samples, Array.from({ length: 20 }, (_, index) => index + 1));
  assert.equal(percentile([5, 1, 3], 0.5), 3);
});

test('non-finite samples are rejected rather than silently dropped', () => {
  assert.throws(() => summarizeSamples([1, Number.NaN]), /finite number/);
  assert.throws(() => summarizeSamples([1, '2']), /finite number/);
  assert.throws(() => summarizeSamples('1,2'), /must be an array/);
});

test('cold and warm phases stay separate', () => {
  const summary = summarizePhases({ cold: [10], warm: [5, 5] });
  assert.equal(summary.cold.count, 1);
  assert.equal(summary.warm.count, 2);
  assert.equal(summary.cold.mean, 10);
  assert.equal(summary.warm.mean, 5);
});

test('sampling defaults are 5 warmups and 20 measured samples', () => {
  assert.deepEqual(parseSamplingArgs([]), { warmup: 5, samples: 20 });
  assert.deepEqual(parseSamplingArgs(['--warmup', '2', '--samples=7']), { warmup: 2, samples: 7 });
  assert.throws(() => parseSamplingArgs(['--samples', '0']), /at least 1/);
  assert.throws(() => parseSamplingArgs(['--warmup', '-1']), /non-negative integer/);
  assert.throws(() => parseSamplingArgs(['--samples', 'x']), /non-negative integer/);
});
