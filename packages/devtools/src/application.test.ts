import { describe, it, expect, beforeEach } from 'vitest';
import { resetIdCounter } from '@streetui/core';
import { streetui } from '@streetui/dsl';
import { compile } from '@streetui/compiler';
import { signal } from '@streetui/state';
import { inspectApplication } from './application.js';

beforeEach(() => resetIdCounter());

describe('inspectApplication', () => {
  it('reports application identity from the compiled metadata', () => {
    const app = streetui.app({ name: 'my-app', version: '2.1.0' });
    app.page('home', (page) => {
      page.heading('Hello');
    });
    const compiled = compile(app);
    const snapshot = inspectApplication(compiled);
    expect(snapshot.identity.name).toBe('my-app');
    expect(snapshot.identity.version).toBe('2.1.0');
    expect(typeof snapshot.identity.compiledAt).toBe('number');
  });

  it('reuses the graph inspection tree without duplicating it', () => {
    const app = streetui.app({ name: 'test' });
    app.page('home', (page) => {
      page.heading('Hello');
    });
    const compiled = compile(app);
    const snapshot = inspectApplication(compiled);
    expect(snapshot.graph.type).toBe('application');
    expect(snapshot.graph.children[0]?.type).toBe('page');
  });

  it('lists page nodes as the top-level route surface', () => {
    const app = streetui.app({ name: 'test' });
    app.page('home', (page) => page.heading('Home'));
    app.page('about', (page) => page.heading('About'));
    const compiled = compile(app);
    const snapshot = inspectApplication(compiled);
    const keys = snapshot.pages.map((p) => p.key);
    expect(keys).toContain('home');
    expect(keys).toContain('about');
    expect(snapshot.pages.length).toBe(2);
  });

  it('collects distinct signal ids bound in the graph', () => {
    const label = signal('dynamic');
    const app = streetui.app({ name: 'test' });
    app.page('home', (page) => {
      page.text(label);
    });
    const compiled = compile(app);
    const snapshot = inspectApplication(compiled);
    expect(snapshot.signals.length).toBeGreaterThan(0);
    // ids are non-empty and de-duplicated (a Set of them stays the same size)
    expect(snapshot.signals.every((id) => id.length > 0)).toBe(true);
    expect(new Set(snapshot.signals).size).toBe(snapshot.signals.length);
  });

  it('counts node types', () => {
    const app = streetui.app({ name: 'test' });
    app.page('home', (page) => {
      page.button('A');
      page.button('B');
    });
    const compiled = compile(app);
    const snapshot = inspectApplication(compiled);
    expect(snapshot.nodeStats['button']).toBe(2);
    expect(snapshot.nodeStats['application']).toBe(1);
  });

  it('summarises diagnostics (warning for an app with no pages)', () => {
    const app = streetui.app({ name: 'empty' });
    const compiled = compile(app);
    const snapshot = inspectApplication(compiled);
    expect(snapshot.diagnostics.errors).toBe(0);
    expect(snapshot.diagnostics.warnings).toBeGreaterThan(0);
    expect(snapshot.diagnostics.messages.join('\n')).toContain('WARNING');
  });

  it('reports zero diagnostics for a clean compile', () => {
    const app = streetui.app({ name: 'test' });
    app.page('home', (page) => page.heading('X'));
    const compiled = compile(app);
    const snapshot = inspectApplication(compiled);
    expect(snapshot.diagnostics.errors).toBe(0);
    expect(snapshot.diagnostics.warnings).toBe(0);
    expect(snapshot.diagnostics.messages).toEqual([]);
  });

  it('reports cheap structural perf counters (v0.7 §20)', () => {
    const label = signal('dynamic');
    const app = streetui.app({ name: 'perf' });
    app.page('home', (page) => {
      page.heading('Title');
      page.text(label); // one state binding
      page.button('Go', { onClick: () => void 0 }); // one event handler
    });
    const compiled = compile(app);
    const snapshot = inspectApplication(compiled);

    // Counts only — never timings.
    expect(snapshot.perf.totalNodes).toBeGreaterThan(0);
    expect(snapshot.perf.totalNodes).toBe(snapshot.nodeStats['application']! +
      Object.entries(snapshot.nodeStats)
        .filter(([t]) => t !== 'application')
        .reduce((a, [, c]) => a + c, 0));
    expect(snapshot.perf.maxDepth).toBeGreaterThanOrEqual(2);
    expect(snapshot.perf.eventHandlers).toBeGreaterThanOrEqual(1);
    expect(snapshot.perf.stateBindings).toBeGreaterThanOrEqual(1);
    expect(snapshot.perf.distinctSignals).toBe(snapshot.signals.length);
    expect(snapshot.perf.largestChildCount).toBeGreaterThanOrEqual(1);
  });
});
