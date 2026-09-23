import { describe, it, expect, beforeEach } from 'vitest';
import { resetIdCounter } from '@streetui/core';
import { streetui } from '@streetui/dsl';
import { compile } from '@streetui/compiler';
import { signal } from '@streetui/state';
import { inspectGraph, printGraph, printDiagnostics, nodeTypeStats } from './inspector.js';

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
