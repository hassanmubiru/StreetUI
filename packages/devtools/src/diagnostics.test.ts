import { describe, it, expect, beforeEach } from 'vitest';
import { resetIdCounter } from '@streetui/core';
import { streetui } from '@streetui/dsl';
import { compile } from '@streetui/compiler';
import { diagnosePerformance, DEFAULT_PERF_THRESHOLDS } from './diagnostics.js';

beforeEach(() => resetIdCounter());

describe('diagnosePerformance (dev-only, count-based)', () => {
  it('returns no diagnostics for a small, shallow app under default thresholds', () => {
    const app = streetui.app({ name: 'small' });
    app.page('home', (page) => {
      page.heading('Hi');
      page.text('body');
    });
    expect(diagnosePerformance(compile(app))).toEqual([]);
  });

  it('flags a large graph when node count exceeds the threshold', () => {
    const app = streetui.app({ name: 'big' });
    app.page('home', (page) => {
      for (let i = 0; i < 40; i++) page.text(`row ${i}`);
    });
    // Lower the threshold so the tiny test app trips it deterministically.
    const diags = diagnosePerformance(compile(app), { maxNodes: 10 });
    expect(diags.some((d) => d.code === 'large-graph')).toBe(true);
    const d = diags.find((x) => x.code === 'large-graph')!;
    expect(d.observed).toBeGreaterThan(d.threshold);
  });

  it('flags a large list when a node has too many children', () => {
    const app = streetui.app({ name: 'list' });
    app.page('home', (page) => {
      for (let i = 0; i < 30; i++) page.text(`item ${i}`);
    });
    const diags = diagnosePerformance(compile(app), { maxChildCount: 5 });
    expect(diags.some((d) => d.code === 'large-list')).toBe(true);
  });

  it('never throws and defaults are sane (nothing tripped)', () => {
    const app = streetui.app({ name: 'ok' });
    app.page('home', (page) => page.heading('X'));
    expect(() => diagnosePerformance(compile(app))).not.toThrow();
    expect(DEFAULT_PERF_THRESHOLDS.maxNodes).toBeGreaterThan(0);
  });
});
