/**
 * Tests for the one-call DevTools report (2.1 §23). Prove that
 * `renderDevToolsReport(compiled)` is exactly the composition of the existing
 * `createDevTools` + `renderDevToolsHTML` pieces (a thin, additive convenience),
 * is non-mutating, and adds no capability of its own.
 *
 * As with the view layer, these DO NOT assert real-browser rendering or
 * accessibility — the browser/AT gate is BLOCKED. They assert the emitted
 * document faithfully reflects the app.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { resetIdCounter } from '@streetui/core';
import { streetui } from '@streetui/dsl';
import { compile, type CompiledApplication } from '@streetui/compiler';
import { signal } from '@streetui/state';
import { createDevTools } from './panels.js';
import { renderDevToolsHTML } from './view.js';
import { renderDevToolsReport } from './devtools-report.js';

beforeEach(() => resetIdCounter());

function buildApp(): CompiledApplication {
  const label = signal('dynamic');
  const app = streetui.app({ name: 'report-demo', version: '2.1.0' });
  app.page('home', (page) => {
    page.heading('Report Title');
    page.text(label);
    page.button('Go', { onClick: () => void 0 });
  });
  return compile(app);
}

describe('renderDevToolsReport', () => {
  it('emits a complete self-contained HTML document', () => {
    const html = renderDevToolsReport(buildApp());
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('StreetUI DevTools — report-demo');
    expect(html).toContain('report-demo');
    expect(html).toContain('</html>');
  });

  it('equals renderDevToolsHTML(createDevTools(compiled).snapshot)', () => {
    resetIdCounter();
    const viaReport = renderDevToolsReport(buildApp());
    resetIdCounter();
    const viaPieces = renderDevToolsHTML(createDevTools(buildApp()).snapshot);
    expect(viaReport).toBe(viaPieces);
  });

  it('is non-mutating — re-running yields identical output', () => {
    resetIdCounter();
    const first = renderDevToolsReport(buildApp());
    resetIdCounter();
    const second = renderDevToolsReport(buildApp());
    expect(first).toBe(second);
  });
});
