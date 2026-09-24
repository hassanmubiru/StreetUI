/**
 * Tests for the headless DevTools session/panels layer. These verify that the
 * panels compose the existing inspectors correctly, that node selection walks
 * the single graph, that live values only change on explicit `refresh()`, and
 * that sensitive surfaces stay hidden by default.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { resetIdCounter } from '@streetui/core';
import { streetui } from '@streetui/dsl';
import { compile, type CompiledApplication } from '@streetui/compiler';
import { signal, derived, resource } from '@streetui/state';
import { createDevTools } from './panels.js';

beforeEach(() => resetIdCounter());

function buildApp(): CompiledApplication {
  const label = signal('dynamic');
  const app = streetui.app({ name: 'devtools-demo', version: '1.0.0' });
  app.page('home', (page) => {
    page.heading('Title');
    page.text(label);
    page.button('Go', { onClick: () => void 0 });
  });
  return compile(app);
}

describe('createDevTools — application panel', () => {
  it('summarises the compiled app from inspectApplication', () => {
    const dt = createDevTools(buildApp());
    const app = dt.snapshot.application;
    expect(app.identity.name).toBe('devtools-demo');
    expect(app.identity.version).toBe('1.0.0');
    expect(app.nodeCount).toBeGreaterThan(0);
    expect(app.maxDepth).toBeGreaterThanOrEqual(2);
    expect(app.eventHandlers).toBeGreaterThanOrEqual(1);
    expect(app.stateBindings).toBeGreaterThanOrEqual(1);
    expect(app.pages.map((p) => p.key)).toContain('home');
    expect(app.errors).toBe(0);
  });
});

describe('createDevTools — graph panel & node selection (§8)', () => {
  it('exposes the single inspected graph tree', () => {
    const dt = createDevTools(buildApp());
    expect(dt.snapshot.graph.type).toBe('application');
    expect(dt.snapshot.graph.children[0]?.type).toBe('page');
  });

  it('selectNode finds a node by id and returns undefined otherwise', () => {
    const dt = createDevTools(buildApp());
    const rootId = dt.snapshot.graph.id;
    expect(dt.selectNode(rootId)?.id).toBe(rootId);
    const pageId = dt.snapshot.graph.children[0]!.id;
    expect(dt.selectNode(pageId)?.type).toBe('page');
    expect(dt.selectNode('no-such-node')).toBeUndefined();
  });
});

describe('createDevTools — signals panel', () => {
  it('reports bound signal ids and live inspections by label', () => {
    const count = signal(1);
    const doubled = derived(() => count.peek() * 2);
    const dt = createDevTools(buildApp(), { signals: { count, doubled } });
    const panel = dt.snapshot.signals;
    expect(panel.boundSignalIds.length).toBeGreaterThan(0);
    expect(panel.live['count']?.kind).toBe('writable');
    expect(panel.live['count']?.value).toBe(1);
    expect(panel.live['doubled']?.kind).toBe('derived');
  });

  it('redacts live signal values when asked', () => {
    const token = signal('secret-token');
    const dt = createDevTools(buildApp(), { signals: { token } }, { redactSignals: true });
    expect(dt.snapshot.signals.live['token']?.value).toBe('[redacted]');
  });
});

describe('createDevTools — explicit refresh protocol (§7)', () => {
  it('only reflects new values after refresh()', () => {
    const count = signal(1);
    const dt = createDevTools(buildApp(), { signals: { count } });
    expect(dt.snapshot.signals.live['count']?.value).toBe(1);
    count.set(42);
    // Snapshot is unchanged until an explicit refresh — DevTools pulls, never pushed.
    expect(dt.snapshot.signals.live['count']?.value).toBe(1);
    const next = dt.refresh();
    expect(next.signals.live['count']?.value).toBe(42);
    expect(dt.snapshot.signals.live['count']?.value).toBe(42);
  });
});

describe('createDevTools — reactive source panels', () => {
  it('omits router/resources/forms/contexts/i18n panels when no sources given', () => {
    const dt = createDevTools(buildApp());
    const s = dt.snapshot;
    expect(s.router).toBeUndefined();
    expect(s.resources).toBeUndefined();
    expect(s.forms).toBeUndefined();
    expect(s.contexts).toBeUndefined();
    expect(s.i18n).toBeUndefined();
  });

  it('inspects a resource without leaking its payload by default', async () => {
    const r = resource<string>(() => Promise.resolve('SENSITIVE'));
    await r.refetch();
    const dt = createDevTools(buildApp(), { resources: { user: r } });
    const snap = dt.snapshot.resources!['user']!;
    expect(snap.status).toBe('success');
    expect(snap.hasData).toBe(true);
    expect(snap.data).toBeUndefined();
  });

  it('inspects router, forms, context, and i18n through structural sources', () => {
    const route = signal({
      path: '/users/7',
      pattern: '/users/:id',
      params: { id: '7' },
      query: new URLSearchParams('tab=profile'),
      isFallback: false,
    });
    const form = {
      values: signal({ email: 'a@b.co', password: 'pw' }),
      errors: signal<Record<string, string | undefined>>({ password: 'too short' }),
      touched: signal<Record<string, boolean | undefined>>({ email: true }),
      dirty: signal(true),
      valid: signal(false),
      status: signal('idle'),
    };
    const ctx = { id: Symbol('app.theme'), hasProvider: () => true };
    const i18n = { locale: signal('en'), locales: ['en', 'fr'] as const, has: (k: string) => k === 'title' };

    const dt = createDevTools(
      buildApp(),
      { router: { currentRoute: route }, forms: { login: form }, contexts: { theme: ctx }, i18n },
      { i18nCheckKeys: ['title', 'subtitle'] },
    );
    const s = dt.snapshot;
    expect(s.router?.path).toBe('/users/7');
    expect(s.forms?.['login']?.valid).toBe(false);
    expect(s.forms?.['login']?.values).toBeUndefined(); // password not leaked
    expect(s.contexts?.['theme']?.hasProvider).toBe(true);
    expect(s.i18n?.locale).toBe('en');
    expect(s.i18n?.missingKeys).toEqual(['subtitle']);
  });
});

describe('createDevTools — performance panel & text report', () => {
  it('carries the perf snapshot and advisory diagnostics', () => {
    const dt = createDevTools(buildApp());
    expect(dt.snapshot.performance.snapshot.totalNodes).toBeGreaterThan(0);
    expect(Array.isArray(dt.snapshot.performance.diagnostics)).toBe(true);
  });

  it('formats a readable multi-panel report', () => {
    const count = signal(7);
    const dt = createDevTools(buildApp(), { signals: { count } });
    const report = dt.format();
    expect(report).toContain('StreetUI DevTools — devtools-demo v1.0.0');
    expect(report).toContain('Application:');
    expect(report).toContain('count [writable] = 7');
    expect(report).toContain('Performance:');
  });
});
