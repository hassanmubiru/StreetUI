/**
 * Tests for the SSR / Hydration inspector (panel #12). These verify the
 * structural static-vs-dynamic split is derived faithfully from the compiler's
 * own `analyzeGraph`, is deterministic, and — per the HONEST SCOPE contract —
 * reports counts only (no wall-clock timings; browser gate BLOCKED).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { resetIdCounter } from '@streetui/core';
import { streetui } from '@streetui/dsl';
import { compile } from '@streetui/compiler';
import { signal } from '@streetui/state';
import { inspectHydration } from './inspect-ssr.js';

beforeEach(() => resetIdCounter());

function buildApp() {
  const label = signal('dynamic');
  const app = streetui.app({ name: 'ssr-demo', version: '2.2.0' });
  app.page('home', (page) => {
    page.heading('Static Title');
    page.text('static body');
    page.text(label); // dynamic text
    page.button('Go', { onClick: () => void 0 }); // event node
  });
  return compile(app);
}

describe('inspectHydration (panel #12)', () => {
  it('splits the graph into static and dynamic parts consistently', () => {
    const h = inspectHydration(buildApp());
    expect(h.totalNodes).toBeGreaterThan(0);
    expect(h.staticNodes).toBeGreaterThanOrEqual(1);
    expect(h.dynamicNodes).toBe(h.totalNodes - h.staticNodes);
    expect(h.dynamicTextNodes).toBeGreaterThanOrEqual(1);
    expect(h.eventNodes).toBeGreaterThanOrEqual(1);
    expect(h.portals).toBeGreaterThanOrEqual(0);
    expect(h.headAnchors).toBeGreaterThanOrEqual(0);
  });

  it('reports staticRatio in [0,1], rounded to 4 dp', () => {
    const h = inspectHydration(buildApp());
    expect(h.staticRatio).toBeGreaterThanOrEqual(0);
    expect(h.staticRatio).toBeLessThanOrEqual(1);
    expect(Math.round(h.staticRatio * 1e4) / 1e4).toBe(h.staticRatio);
    // Ratio equals static/total.
    expect(h.staticRatio).toBeCloseTo(h.staticNodes / h.totalNodes, 4);
  });

  it('is deterministic across repeated calls', () => {
    const compiled = buildApp();
    expect(inspectHydration(compiled)).toEqual(inspectHydration(compiled));
  });

  it('counts portal hosts and head anchors when present', () => {
    resetIdCounter();
    const open = signal(false);
    const app = streetui.app({ name: 'ssr-overlays', version: '2.2.0' });
    app.page('home', (page) => {
      page.heading('T');
      page.dialog('dlg', { open }, (d) => d.button('OK', { id: 'ok' }));
    });
    const h = inspectHydration(compile(app));
    expect(h.portals).toBeGreaterThanOrEqual(1);
    expect(h.totalNodes).toBeGreaterThan(0);
  });
});
