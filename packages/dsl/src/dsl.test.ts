import { describe, it, expect, beforeEach } from 'vitest';
import { resetIdCounter } from '@streetui/core';
import { signal } from '@streetui/state';
import { streetui, StreetApp } from './dsl.js';

beforeEach(() => resetIdCounter());

describe('streetui.app', () => {
  it('creates a StreetApp', () => {
    const app = streetui.app({ name: 'test' });
    expect(app).toBeInstanceOf(StreetApp);
  });

  it('builds an ApplicationGraph', () => {
    const app = streetui.app({ name: 'test' });
    const graph = app.build();
    expect(graph.root.type).toBe('application');
    expect(graph.name).toBe('test');
  });
});

describe('page', () => {
  it('adds a page node to the graph', () => {
    const app = streetui.app({ name: 'test' });
    app.page('home', () => {});
    const graph = app.graph;
    expect(graph.findByType('page')).toHaveLength(1);
  });

  it('sets the page key', () => {
    const app = streetui.app({ name: 'test' });
    app.page('dashboard', () => {});
    const pages = app.graph.findByType('page');
    expect(pages[0]?.key).toBe('dashboard');
  });

  it('supports multiple pages', () => {
    const app = streetui.app({ name: 'test' });
    app.page('home', () => {});
    app.page('about', () => {});
    expect(app.graph.findByType('page')).toHaveLength(2);
  });
});

describe('section', () => {
  it('adds a section inside a page', () => {
    const app = streetui.app({ name: 'test' });
    app.page('home', page => {
      page.section('hero', () => {});
    });
    expect(app.graph.findByType('section')).toHaveLength(1);
  });
});

describe('heading', () => {
  it('creates a heading node', () => {
    const app = streetui.app({ name: 'test' });
    app.page('home', page => {
      page.heading('Welcome');
    });
    const headings = app.graph.findByType('heading');
    expect(headings).toHaveLength(1);
    expect(headings[0]?.getProp('text')).toBe('Welcome');
  });

  it('respects heading level option', () => {
    const app = streetui.app({ name: 'test' });
    app.page('home', page => {
      page.heading('Sub', { level: 2 });
    });
    expect(app.graph.findByType('heading')[0]?.getProp('level')).toBe(2);
  });
});

describe('text', () => {
  it('creates a text node', () => {
    const app = streetui.app({ name: 'test' });
    app.page('home', page => {
      page.text('Hello world');
    });
    const texts = app.graph.findByType('text');
    expect(texts[0]?.getProp('text')).toBe('Hello world');
  });
});

describe('button', () => {
  it('creates a button node', () => {
    const app = streetui.app({ name: 'test' });
    app.page('home', page => {
      page.button('Click me');
    });
    expect(app.graph.findByType('button')).toHaveLength(1);
  });

  it('registers click handler', () => {
    let clicked = false;
    const app = streetui.app({ name: 'test' });
    app.page('home', page => {
      page.button('Go', { onClick: () => { clicked = true; } });
    });
    const btn = app.graph.findByType('button')[0]!;
    expect(btn.events).toHaveLength(1);
    const handlerKey = btn.events[0]!.handlerKey;
    const handler = app.graph.getHandler(handlerKey);
    expect(handler).toBeDefined();
    (handler as () => void)();
    expect(clicked).toBe(true);
  });
});

describe('input', () => {
  it('creates an input node', () => {
    const app = streetui.app({ name: 'test' });
    app.page('home', page => {
      page.input({ placeholder: 'Type here' });
    });
    const inputs = app.graph.findByType('input');
    expect(inputs).toHaveLength(1);
    expect(inputs[0]?.getProp('placeholder')).toBe('Type here');
  });

  it('registers onInput handler', () => {
    const values: string[] = [];
    const app = streetui.app({ name: 'test' });
    app.page('home', page => {
      page.input({ onInput: v => values.push(v) });
    });
    const node = app.graph.findByType('input')[0]!;
    const handlerKey = node.events.find(e => e.type === 'input')!.handlerKey;
    const handler = app.graph.getHandler(handlerKey) as (v: string) => void;
    handler('hello');
    expect(values).toEqual(['hello']);
  });
});

describe('reactive binding', () => {
  it('records state ref when a signal is passed as text', () => {
    const label = signal('initial');
    const app = streetui.app({ name: 'test' });
    app.page('home', page => {
      page.text(label);
    });
    const textNode = app.graph.findByType('text')[0]!;
    expect(textNode.stateRefs).toHaveLength(1);
    expect(textNode.stateRefs[0]?.propKey).toBe('text');
  });

  it('stores initial signal value as prop', () => {
    const count = signal(42);
    const app = streetui.app({ name: 'test' });
    app.page('home', page => {
      page.text(count as unknown as string);
    });
    const textNode = app.graph.findByType('text')[0]!;
    expect(textNode.getProp('text')).toBe(42);
  });
});

describe('nesting', () => {
  it('builds deeply nested structure', () => {
    const app = streetui.app({ name: 'test' });
    app.page('home', page => {
      page.section('hero', section => {
        section.container('inner', container => {
          container.heading('Title');
          container.button('CTA');
        });
      });
    });
    expect(app.graph.findByType('heading')).toHaveLength(1);
    expect(app.graph.findByType('button')).toHaveLength(1);
    const heading = app.graph.findByType('heading')[0]!;
    // heading → container → section → page → application
    expect(heading.depth).toBe(4);
  });
});

describe('validation', () => {
  it('build() does not throw for a valid graph', () => {
    const app = streetui.app({ name: 'test' });
    app.page('home', page => {
      page.heading('Welcome');
    });
    expect(() => app.build()).not.toThrow();
  });
});
