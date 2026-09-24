/**
 * Tests for static graph analysis + diagnostic inspection (v1.2 §3/§14).
 */
import { describe, it, expect } from 'vitest';
import { streetui } from '@streetui/dsl';
import { signal } from '@streetui/state';
import { compile } from '../compile.js';
import { analyzeGraph } from './analyze.js';
import { inspectCompilation, formatInspection } from './inspect.js';

describe('analyzeGraph (v1.2 §3)', () => {
  it('marks a purely static tree as fully static subtrees', () => {
    const app = streetui.app({ name: 'static', version: '1.0.0' });
    app.page('home', (p) =>
      p.section('main', (s) => {
        s.text('hello', { class: 'a' });
        s.text('world', { class: 'b' });
      }),
    );
    const { graph } = compile(app);
    const a = analyzeGraph(graph);
    // application > page > section > 2 text = 5 nodes, all static.
    expect(a.summary.totalNodes).toBe(5);
    expect(a.summary.staticNodes).toBe(5);
    // every node is a static subtree (including the root).
    expect(a.summary.staticSubtrees).toBe(5);
    expect(a.summary.eventNodes).toBe(0);
    expect(a.summary.dynamicTextNodes).toBe(0);
  });

  it('classifies a signal-bound text node as dynamic and taints its ancestors', () => {
    const label = signal('tick');
    const app = streetui.app({ name: 'dyn', version: '1.0.0' });
    app.page('home', (p) =>
      p.section('main', (s) => {
        s.text('static', { class: 'a' });
        s.text(label, { class: 'live' });
      }),
    );
    const { graph } = compile(app);
    const a = analyzeGraph(graph);
    expect(a.summary.dynamicTextNodes).toBe(1);
    // The bound text node itself is not static; its section/page/app ancestors
    // are no longer *static subtrees* (a dynamic descendant taints the rollup),
    // but the sibling static text node is still individually static.
    expect(a.summary.staticNodes).toBe(4); // app,page,section,staticText
    expect(a.summary.staticSubtrees).toBe(1); // only the static leaf text
  });

  it('counts reactive lists', () => {
    const items = signal([{ id: 1, label: 'x' }]);
    const app = streetui.app({ name: 'list', version: '1.0.0' });
    app.page('home', (p) =>
      p.section('main', (s) => {
        s.listOf('rows', items, (item, _i, content) => content.text(item.label));
      }),
    );
    const { graph } = compile(app);
    const a = analyzeGraph(graph);
    expect(a.summary.lists).toBe(1);
  });
});

describe('inspectCompilation (v1.2 §14)', () => {
  it('produces per-node classification and a formatted report', () => {
    const label = signal('tick');
    const app = streetui.app({ name: 'demo', version: '2.1.0' });
    app.page('home', (p) =>
      p.section('main', (s) => {
        s.text('static', { class: 'a' });
        s.text(label, { class: 'live' });
      }),
    );
    const { graph } = compile(app);
    const insp = inspectCompilation(graph);
    expect(insp.name).toBe('demo');
    expect(insp.version).toBe('2.1.0');
    expect(insp.summary.staticRatio).toBeGreaterThan(0);
    expect(insp.summary.staticRatio).toBeLessThanOrEqual(1);
    // exactly one node reports dynamic text and wants dynamic hydration.
    const dyn = insp.nodes.filter((n) => n.dynamicText);
    expect(dyn.length).toBe(1);
    expect(dyn[0]!.hydration).toBe('verify-dynamic');
    const text = formatInspection(insp);
    expect(text).toContain('compiler inspection — demo v2.1.0');
    expect(text).toContain('{text}');
  });
});
