import { describe, it, expect, beforeEach } from 'vitest';
import { resetIdCounter } from '@streetui/core';
import { streetui } from '@streetui/dsl';
import { ApplicationGraph } from '@streetui/graph';
import { compile, compileGraph, type CompiledApplication } from './compile.js';

beforeEach(() => resetIdCounter());

describe('compile', () => {
  it('returns a CompiledApplication from a StreetApp', () => {
    const app = streetui.app({ name: 'test' });
    app.page('home', page => {
      page.heading('Hello');
    });
    const compiled = compile(app);
    expect(compiled).toBeDefined();
    expect(compiled.graph).toBeInstanceOf(ApplicationGraph);
    expect(compiled.name).toBe('test');
  });

  it('compiledAt is a timestamp', () => {
    const app = streetui.app({ name: 'test' });
    app.page('home', () => {});
    const compiled = compile(app);
    expect(typeof compiled.compiledAt).toBe('number');
    expect(compiled.compiledAt).toBeGreaterThan(0);
  });

  it('applies transform defaults — heading level defaults to 1', () => {
    const app = streetui.app({ name: 'test' });
    app.page('home', page => {
      page.heading('Title');
    });
    compile(app);
    const heading = app.graph.findByType('heading')[0]!;
    expect(heading.getProp('level')).toBe(1);
  });

  it('assigns _renderKey to every node', () => {
    const app = streetui.app({ name: 'test' });
    app.page('home', page => {
      page.section('s1', section => {
        section.text('hi');
      });
    });
    compile(app);
    app.graph.walk(node => {
      expect(node.getProp('_renderKey')).toBeDefined();
    });
  });

  it('produces deterministic output for the same input', () => {
    const build = () => {
      resetIdCounter();
      const app = streetui.app({ name: 'det' });
      app.page('home', page => {
        page.heading('Title');
        page.button('Go');
      });
      return compile(app).graph.serialize();
    };
    const a = build();
    const b = build();
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('does not throw for a valid app with no pages (warning only)', () => {
    const app = streetui.app({ name: 'empty' });
    expect(() => compile(app)).not.toThrow();
    const compiled = compile(app);
    expect(compiled.diagnostics.hasWarnings).toBe(true);
  });

  it('throws for an app with error-level issues', () => {
    // Build a graph with a link missing href directly
    const graph = new ApplicationGraph({ name: 'broken' });
    const link = graph.createNode('link', { parent: graph.root });
    // deliberately omit href
    expect(() => compileGraph(graph, { strict: true })).toThrow();
  });
});

describe('compileGraph', () => {
  it('compiles a raw ApplicationGraph', () => {
    const graph = new ApplicationGraph({ name: 'raw' });
    graph.createNode('page', { parent: graph.root });
    const compiled = compileGraph(graph);
    expect(compiled.name).toBe('raw');
    expect(compiled.graph).toBe(graph);
  });

  it('strict:false collects errors without throwing', () => {
    const graph = new ApplicationGraph({ name: 'lenient' });
    const link = graph.createNode('link', { parent: graph.root });
    // missing href — error
    let compiled: CompiledApplication | undefined;
    expect(() => {
      compiled = compileGraph(graph, { strict: false });
    }).not.toThrow();
    expect(compiled?.diagnostics.hasErrors).toBe(true);
  });
});
