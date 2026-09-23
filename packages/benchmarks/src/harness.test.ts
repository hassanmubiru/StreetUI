/**
 * Correctness tests for the benchmark harness — pure math + comparison logic.
 * These are fast and run under the normal `test` task; the actual performance
 * runs happen only via `npm run bench` and are never gated as tests.
 */

import { describe, it, expect } from 'vitest';
import { summarize, bench, environment } from './harness.js';
import { compareResults } from './compare.js';

describe('summarize', () => {
  it('computes median/min/max/mean/p95 for an odd sample set', () => {
    const r = summarize('t', 'cat', 5, 1, [1, 2, 3, 4, 5]);
    expect(r.medianMs).toBe(3);
    expect(r.minMs).toBe(1);
    expect(r.maxMs).toBe(5);
    expect(r.meanMs).toBe(3);
    expect(r.p95Ms).toBe(5);
    expect(r.samples).toBe(5);
    expect(r.n).toBe(5);
  });

  it('averages the two middle samples for an even sample set', () => {
    const r = summarize('t', 'cat', null, 1, [10, 20, 30, 40]);
    expect(r.medianMs).toBe(25);
  });

  it('derives opsPerSec from the median', () => {
    const r = summarize('t', 'cat', null, 1, [2, 2, 2]);
    expect(r.opsPerSec).toBeCloseTo(500, 5);
  });

  it('is order-independent (sorts internally)', () => {
    const a = summarize('t', 'cat', null, 1, [5, 1, 3, 2, 4]);
    const b = summarize('t', 'cat', null, 1, [1, 2, 3, 4, 5]);
    expect(a.medianMs).toBe(b.medianMs);
    expect(a.p95Ms).toBe(b.p95Ms);
  });
});

describe('bench', () => {
  it('runs setup/run/teardown the expected number of times and returns stats', () => {
    let setups = 0;
    let runs = 0;
    let teardowns = 0;
    const r = bench<{ v: number }>(
      'noop',
      () => {
        runs++;
      },
      {
        category: 'meta',
        warmup: 2,
        iterations: 5,
        inner: 3,
        setup: () => {
          setups++;
          return { v: 1 };
        },
        teardown: () => {
          teardowns++;
        },
      },
    );
    // warmup(2) + iterations(5) setups and teardowns; runs = (2+5)*inner(3).
    expect(setups).toBe(7);
    expect(teardowns).toBe(7);
    expect(runs).toBe(21);
    expect(r.samples).toBe(5);
    expect(r.inner).toBe(3);
    expect(r.medianMs).toBeGreaterThanOrEqual(0);
  });
});

describe('environment', () => {
  it('captures a populated environment header', () => {
    const e = environment();
    expect(e.node).toMatch(/^v\d+/);
    expect(e.cpuCount).toBeGreaterThan(0);
    expect(typeof e.cpuModel).toBe('string');
    expect(e.capturedAt).toMatch(/T/);
  });
});

describe('compareResults', () => {
  it('flags improvement, regression, unchanged, and new benchmarks', () => {
    const baseline = [
      summarize('a', 'c', null, 1, [10]),
      summarize('b', 'c', null, 1, [10]),
      summarize('c', 'c', null, 1, [10]),
    ];
    const current = [
      summarize('a', 'c', null, 1, [8]), // -20% → improved
      summarize('b', 'c', null, 1, [12]), // +20% → regressed
      summarize('c', 'c', null, 1, [10.2]), // +2% → unchanged
      summarize('d', 'c', null, 1, [5]), // no baseline → new
    ];
    const cmp = compareResults(baseline, current, { band: 0.1 });
    const byName = new Map(cmp.map((c) => [c.name, c]));
    expect(byName.get('a')?.status).toBe('improved');
    expect(byName.get('b')?.status).toBe('regressed');
    expect(byName.get('c')?.status).toBe('unchanged');
    expect(byName.get('d')?.status).toBe('new');
    expect(byName.get('a')?.deltaPct).toBeCloseTo(-20, 5);
  });
});
