/**
 * Tests for the DOM-free DevTools HTML view (§8). These prove the string
 * renderer faithfully reflects the snapshot and escapes every dynamic value.
 * They do NOT (and cannot here) assert that the markup renders in a real
 * browser or is accessible — the §24 browser/AT gate remains BLOCKED.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { resetIdCounter } from '@streetui/core';
import { streetui, component } from '@streetui/dsl';
import { compile, type CompiledApplication } from '@streetui/compiler';
import { signal } from '@streetui/state';
import { createDevTools } from './panels.js';
import { renderDevToolsHTML, escapeHtml } from './view.js';

beforeEach(() => resetIdCounter());

function buildApp(): CompiledApplication {
  const label = signal('dynamic');
  const app = streetui.app({ name: 'devtools-demo', version: '2.0.0' });
  app.page('home', (page) => {
    page.heading('Title');
    page.text(label);
    page.button('Go', { onClick: () => void 0 });
  });
  return compile(app);
}

describe('escapeHtml', () => {
  it('escapes the five HTML-significant characters', () => {
    expect(escapeHtml(`<img src=x onerror="alert('&')">`)).toBe(
      '&lt;img src=x onerror=&quot;alert(&#39;&amp;&#39;)&quot;&gt;',
    );
  });

  it('stringifies non-string values safely', () => {
    expect(escapeHtml(42)).toBe('42');
    expect(escapeHtml(null)).toBe('null');
    expect(escapeHtml(undefined)).toBe('undefined');
    expect(escapeHtml({ a: 1 })).toBe('{&quot;a&quot;:1}');
  });
});

describe('renderDevToolsHTML', () => {
  it('produces a self-contained document reflecting the application panel', () => {
    const html = renderDevToolsHTML(createDevTools(buildApp()).snapshot);
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('<title>StreetUI DevTools — devtools-demo</title>');
    expect(html).toContain('devtools-demo');
    expect(html).toContain('v2.0.0');
    // Section headings for the panels §8 requires.
    for (const h of ['Application', 'Components', 'Graph', 'Signals', 'Overlays', 'Transitions', 'Performance', 'Diagnostics']) {
      expect(html).toContain(`<h2>${h}`);
    }
  });

  it('renders live signals with kind, value, and observer counts (effects surrogate)', () => {
    const count = signal(7);
    const dt = createDevTools(buildApp(), { signals: { count } });
    const html = renderDevToolsHTML(dt.snapshot);
    expect(html).toContain('count');
    expect(html).toContain('[writable]');
    expect(html).toContain('7');
    // §8 effects are surfaced honestly as observer counts, not a fake registry.
    expect(html).toContain('observer counts (no global effect registry)');
  });

  it('lists components and overlays/transitions in the tree', () => {
    const Card = component<{ title: string }>((props) => (c) => {
      c.heading(props.title, { level: 3 });
    }, { name: 'Card' });
    const open = signal(false);
    const app = streetui.app({ name: 'ui', version: '2.0.0' });
    app.page('home', (page) => {
      page.component('c', Card, { title: 'T' });
      page.dialog('dlg', { open }, (d) => d.button('OK', { id: 'ok' }));
      page.section('s', (s) => s.text('body'), {
        transition: { name: 'fade', duration: 250, appear: true },
      });
    });
    const html = renderDevToolsHTML(createDevTools(compile(app)).snapshot);
    expect(html).toContain('Card');
    expect(html).toContain('dlg');
    expect(html).toContain('[modal]');
    expect(html).toContain('250ms');
  });

  it('escapes app-supplied data so it cannot break out of the markup', () => {
    const evil = signal('<script>alert(1)</script>');
    const app = streetui.app({ name: '<b>x</b>', version: '2.0.0' });
    app.page('home', (page) => page.text(evil));
    const dt = createDevTools(compile(app), { signals: { danger: evil } });
    const html = renderDevToolsHTML(dt.snapshot);
    // The raw payload never appears unescaped anywhere in the document.
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).not.toContain('<b>x</b>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('redacted signal values propagate to the view', () => {
    const token = signal('secret-token');
    const dt = createDevTools(buildApp(), { signals: { token } }, { redactSignals: true });
    const html = renderDevToolsHTML(dt.snapshot);
    expect(html).not.toContain('secret-token');
    expect(html).toContain('[redacted]');
  });
});
