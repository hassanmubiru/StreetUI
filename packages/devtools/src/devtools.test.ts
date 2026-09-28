import { describe, it, expect, beforeEach } from 'vitest';
import { resetIdCounter } from '@streetui/core';
import { streetui } from '@streetui/dsl';
import { compile } from '@streetui/compiler';
import { signal } from '@streetui/state';
import { inspectGraph, printGraph, printDiagnostics, nodeTypeStats, inspectComponents, inspectInteractions } from './inspector.js';
import { component } from '@streetui/dsl';

beforeEach(() => resetIdCounter());

describe('inspectGraph', () => {
  it('returns a tree rooted at the application node', () => {
    const app = streetui.app({ name: 'test' });
    app.page('home', page => {
      page.heading('Hello');
    });
    const compiled = compile(app);
    const tree = inspectGraph(compiled.graph);
    expect(tree.type).toBe('application');
    expect(tree.children[0]?.type).toBe('page');
    expect(tree.children[0]?.children[0]?.type).toBe('heading');
  });

  it('includes props in inspection', () => {
    const app = streetui.app({ name: 'test' });
    app.page('home', page => {
      page.heading('My Title');
    });
    const compiled = compile(app);
    const tree = inspectGraph(compiled.graph);
    const heading = tree.children[0]?.children[0];
    expect(heading?.props['text']).toBe('My Title');
  });

  it('includes event types', () => {
    const app = streetui.app({ name: 'test' });
    app.page('home', page => {
      page.button('Click', { onClick: () => {} });
    });
    const compiled = compile(app);
    const tree = inspectGraph(compiled.graph);
    const btn = tree.children[0]?.children[0];
    expect(btn?.eventTypes).toContain('click');
  });

  it('includes state binding info', () => {
    const label = signal('dynamic');
    const app = streetui.app({ name: 'test' });
    app.page('home', page => {
      page.text(label);
    });
    const compiled = compile(app);
    const tree = inspectGraph(compiled.graph);
    const textNode = tree.children[0]?.children[0];
    expect(textNode?.stateBindings.length).toBeGreaterThan(0);
  });

  it('sets correct depth', () => {
    const app = streetui.app({ name: 'test' });
    app.page('home', page => {
      page.section('s', section => {
        section.heading('deep');
      });
    });
    const compiled = compile(app);
    const tree = inspectGraph(compiled.graph);
    const heading = tree.children[0]?.children[0]?.children[0];
    expect(heading?.depth).toBe(3);
  });
});

describe('printGraph', () => {
  it('returns a non-empty string', () => {
    const app = streetui.app({ name: 'test' });
    app.page('home', page => { page.heading('Hi'); });
    const compiled = compile(app);
    const output = printGraph(compiled.graph);
    expect(typeof output).toBe('string');
    expect(output.length).toBeGreaterThan(0);
  });

  it('contains node types', () => {
    const app = streetui.app({ name: 'test' });
    app.page('home', page => { page.button('Go'); });
    const compiled = compile(app);
    const output = printGraph(compiled.graph);
    expect(output).toContain('button');
    expect(output).toContain('page');
  });
});

describe('printDiagnostics', () => {
  it('returns no diagnostics message for a clean compile', () => {
    const app = streetui.app({ name: 'test' });
    app.page('home', page => { page.heading('X'); });
    const compiled = compile(app);
    const output = printDiagnostics(compiled);
    expect(output).toBe('(no diagnostics)');
  });

  it('includes warning messages', () => {
    const app = streetui.app({ name: 'empty' });
    // no pages → warning
    const compiled = compile(app);
    const output = printDiagnostics(compiled);
    expect(output).toContain('WARNING');
  });
});

describe('nodeTypeStats', () => {
  it('counts nodes per type', () => {
    const app = streetui.app({ name: 'test' });
    app.page('home', page => {
      page.heading('H');
      page.button('B');
      page.button('B2');
      page.text('T');
    });
    const compiled = compile(app);
    const stats = nodeTypeStats(compiled.graph);
    expect(stats['button']).toBe(2);
    expect(stats['heading']).toBe(1);
    expect(stats['text']).toBe(1);
    expect(stats['application']).toBe(1);
  });
});

describe('inspectComponents (§21)', () => {
  it('lists every component instance in document order with name/key/depth', () => {
    const Inner = component<{ label: string }>((props) => (c) => {
      c.text(props.label);
    }, { name: 'Inner' });
    const Outer = component((_p) => (c) => {
      c.component('a', Inner, { label: 'A' });
      c.component('b', Inner, { label: 'B' });
    }, { name: 'Outer' });

    const app = streetui.app({ name: 'test' });
    app.page('home', (page) => page.component('o', Outer, {}));
    const compiled = compile(app);

    const comps = inspectComponents(compiled.graph);
    expect(comps.map((c) => c.name)).toEqual(['Outer', 'Inner', 'Inner']);
    // Stable author key is surfaced (not the churny build-order id).
    expect(comps.map((c) => c.key)).toEqual(['o', 'a', 'b']);
    // Outer is shallower than the Inners it composes.
    expect(comps[0]!.depth).toBeLessThan(comps[1]!.depth);
    // Non-component nodes are excluded.
    expect(comps.every((c) => c.name.length > 0)).toBe(true);
  });

  it('reports childCount and returns [] for a component-free graph', () => {
    const Card = component<{ title: string }>((props) => (c) => {
      c.heading(props.title, { level: 3 });
      c.text('body');
    }, { name: 'Card' });

    const withComp = streetui.app({ name: 'w' });
    withComp.page('home', (page) => page.component('c', Card, { title: 'T' }));
    const comps = inspectComponents(compile(withComp).graph);
    expect(comps).toHaveLength(1);
    expect(comps[0]!.name).toBe('Card');
    expect(comps[0]!.childCount).toBe(2);

    const plain = streetui.app({ name: 'p' });
    plain.page('home', (page) => page.heading('none'));
    expect(inspectComponents(compile(plain).graph)).toEqual([]);
  });
});

describe('inspectInteractions (§19)', () => {
  it('snapshots overlays with their descriptor flags and live open state', () => {
    const open = signal(false);
    const app = streetui.app({ name: 'i' });
    app.page('home', (page) => {
      page.dialog('dlg', { open }, (d) => d.button('OK', { id: 'ok' }));
    });
    const graph = compile(app).graph;

    let snap = inspectInteractions(graph);
    expect(snap.overlays).toHaveLength(1);
    const dlg = snap.overlays[0]!;
    expect(dlg.key).toBe('dlg');
    expect(dlg.open).toBe(false); // peeked, closed
    expect(dlg.modal).toBe(true);
    expect(dlg.takesFocus).toBe(true);
    expect(dlg.menu).toBe(false);
    expect(dlg.closeOnEscape).toBe(true);
    expect(dlg.restoreFocus).toBe(true);

    // Peeks the live signal without subscribing: flipping open is reflected.
    open.set(true);
    snap = inspectInteractions(graph);
    expect(snap.overlays[0]!.open).toBe(true);
  });

  it('flags a dropdown as a menu and lists transitions with duration/appear', () => {
    const open = signal(false);
    const app = streetui.app({ name: 'i2' });
    app.page('home', (page) => {
      page.dropdown('menu', { open }, (m) => m.button('Item', { id: 'it' }));
      page.section('s', (s) => s.text('body'), {
        transition: { name: 'fade', duration: 250, appear: true },
      });
    });
    const graph = compile(app).graph;
    const snap = inspectInteractions(graph);

    expect(snap.overlays.map((o) => o.menu)).toContain(true);
    expect(snap.transitions.length).toBeGreaterThanOrEqual(1);
    const t = snap.transitions.find((x) => x.key === 's')!;
    expect(t).toBeDefined();
    expect(t.duration).toBe(250);
    expect(t.appear).toBe(true);
    expect(typeof t.nodeType).toBe('string');
  });

  it('returns empty arrays for a graph with no overlays or transitions', () => {
    const app = streetui.app({ name: 'i3' });
    app.page('home', (page) => page.heading('plain'));
    expect(inspectInteractions(compile(app).graph)).toEqual({ overlays: [], transitions: [] });
  });
});
