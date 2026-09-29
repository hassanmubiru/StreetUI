/**
 * Tests for the interactive 12-panel DevTools document (2.2 Phase 1).
 *
 * SCOPE NOTE: `renderInteractiveDevTools` is a pure string builder. These tests
 * verify — deterministically, in Node — that the document (a) contains all 12
 * panels, (b) faithfully and SAFELY embeds the snapshot JSON (no raw `<` can
 * break out of the <script>, and the payload round-trips through JSON.parse),
 * (c) wires the pull-based refresh contract, and (d) that the inlined controller
 * is syntactically valid JavaScript. Whether the document RENDERS or is
 * accessible in a real browser is NOT asserted here: no browser/AT exists in
 * this environment (those gates are BLOCKED), and happy-dom is not a browser.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { resetIdCounter } from '@streetui/core';
import { streetui } from '@streetui/dsl';
import { compile } from '@streetui/compiler';
import { signal, mutation } from '@streetui/state';
import { createDevTools } from './panels.js';
import { renderInteractiveDevTools, DEVTOOLS_TABS } from './interactive.js';

beforeEach(() => resetIdCounter());

function snapshotWithEverything(name = 'interactive-demo') {
  const label = signal('dynamic');
  const save = mutation<void, string>(() => 'ok');
  const app = streetui.app({ name, version: '2.2.0' });
  app.page('home', (page) => {
    page.heading('Title');
    page.text(label);
    page.button('Go', { onClick: () => void 0 });
  });
  const dt = createDevTools(compile(app), { signals: { label }, mutations: { save } });
  return dt.snapshot;
}

function extractStData(html: string): string {
  const m = html.match(/<script type="application\/json" id="st-data">([\s\S]*?)<\/script>/);
  if (!m) throw new Error('st-data script not found');
  return m[1]!;
}

function extractController(html: string): string {
  const m = html.match(/<script>([\s\S]*?)<\/script>/);
  if (!m) throw new Error('controller script not found');
  return m[1]!;
}

describe('renderInteractiveDevTools — document shape', () => {
  it('renders all 12 panels as tabs, in spec order', () => {
    const html = renderInteractiveDevTools(snapshotWithEverything());
    expect(DEVTOOLS_TABS).toHaveLength(12);
    for (const t of DEVTOOLS_TABS) {
      expect(html).toContain(`data-tab="${t.id}"`);
      expect(html).toContain(t.label);
    }
  });

  it('marks the initial tab selected and defaults to the first panel', () => {
    const html = renderInteractiveDevTools(snapshotWithEverything());
    expect(html).toContain(`data-tab="components" aria-selected="true"`);
    const custom = renderInteractiveDevTools(snapshotWithEverything(), { initialTab: 'events' });
    expect(custom).toContain(`data-tab="events" aria-selected="true"`);
    expect(custom).toContain(`data-tab="components" aria-selected="false"`);
  });

  it('wires the pull-based refresh contract and exposes a control handle', () => {
    const html = renderInteractiveDevTools(snapshotWithEverything());
    expect(html).toContain('id="st-refresh"');
    expect(html).toContain('__STREETUI_DEVTOOLS_REFRESH__');
    expect(html).toContain('__StreetUIDevTools');
  });

  it('labels honest scope (not a profiler; gates BLOCKED)', () => {
    const html = renderInteractiveDevTools(snapshotWithEverything());
    expect(html).toContain('BLOCKED');
    expect(html.toLowerCase()).toContain('not a production profiler');
  });
});

describe('renderInteractiveDevTools — safe, faithful embedding', () => {
  it('escapes `<` so app data cannot break out of the <script> block', () => {
    const snap = snapshotWithEverything('</script><b>xss</b>');
    const html = renderInteractiveDevTools(snap);
    const data = extractStData(html);
    // No raw `<` survives inside the JSON payload.
    expect(data.includes('<')).toBe(false);
    // …but it round-trips back to the exact original via JSON.parse.
    const parsed = JSON.parse(data) as typeof snap;
    expect(parsed.application.identity.name).toBe('</script><b>xss</b>');
  });

  it('embeds the whole snapshot faithfully (round-trips through JSON.parse)', () => {
    const snap = snapshotWithEverything();
    const parsed = JSON.parse(extractStData(renderInteractiveDevTools(snap))) as typeof snap;
    expect(parsed.events.totalHandlers).toBe(snap.events.totalHandlers);
    expect(parsed.signalGraph.signals.length).toBe(snap.signalGraph.signals.length);
    expect(parsed.hydration.totalNodes).toBe(snap.hydration.totalNodes);
    expect(Object.keys(parsed.mutations ?? {})).toEqual(['save']);
  });
});

describe('renderInteractiveDevTools — controller validity', () => {
  it('inlines syntactically valid JavaScript (parseable by the JS engine)', () => {
    const controller = extractController(renderInteractiveDevTools(snapshotWithEverything()));
    // new Function parses the source (throws on syntax error) without running it.
    expect(() => new Function(controller)).not.toThrow();
    // The controller references every panel renderer by id.
    for (const t of DEVTOOLS_TABS) expect(controller).toContain(`${t.id}:`);
  });

  it('is deterministic for a fixed snapshot', () => {
    const snap = snapshotWithEverything();
    expect(renderInteractiveDevTools(snap)).toBe(renderInteractiveDevTools(snap));
  });
});
