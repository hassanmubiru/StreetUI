/**
 * Tests for @streetui/testing — the test renderer and query helpers.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resetIdCounter } from '@streetui/core';
import { streetui } from '@streetui/dsl';
import { signal } from '@streetui/state';
import { render, renderOnce } from './test-renderer.js';

beforeEach(() => resetIdCounter());

describe('render — basic structure', () => {
  it('renders a heading', () => {
    const app = streetui.app({ name: 'test' });
    app.page('home', page => { page.heading('Hello World'); });
    const result = render(app);
    const h1 = result.getByTag('h1');
    expect(h1.textContent).toBe('Hello World');
    result.unmount();
  });

  it('renders a button', () => {
    const app = streetui.app({ name: 'test' });
    app.page('home', page => { page.button('Click Me'); });
    const result = render(app);
    const btn = result.getByTag('button');
    expect(btn.textContent).toBe('Click Me');
    result.unmount();
  });

  it('renders multiple elements', () => {
    const app = streetui.app({ name: 'test' });
    app.page('home', page => {
      page.heading('Title');
      page.button('A');
      page.button('B');
    });
    const result = render(app);
    expect(result.getAllByTag('button')).toHaveLength(2);
    result.unmount();
  });

  it('renders nested section', () => {
    const app = streetui.app({ name: 'test' });
    app.page('home', page => {
      page.section('hero', section => {
        section.heading('Nested');
      });
    });
    const result = render(app);
    const section = result.getByTag('section');
    expect(section.querySelector('h1')?.textContent).toBe('Nested');
    result.unmount();
  });
});

describe('render — query helpers', () => {
  it('getByText finds element by content', () => {
    const app = streetui.app({ name: 'test' });
    app.page('home', page => { page.text('find me'); });
    const result = render(app);
    const el = result.getByText('find me');
    expect(el).not.toBeNull();
    result.unmount();
  });

  it('getByText throws when not found', () => {
    const app = streetui.app({ name: 'test' });
    app.page('home', page => { page.text('present'); });
    const result = render(app);
    expect(() => result.getByText('absent')).toThrow();
    result.unmount();
  });

  it('query returns null when no match', () => {
    const app = streetui.app({ name: 'test' });
    app.page('home', () => {});
    const result = render(app);
    expect(result.query('canvas')).toBeNull();
    result.unmount();
  });

  it('find throws when selector matches nothing', () => {
    const app = streetui.app({ name: 'test' });
    app.page('home', () => {});
    const result = render(app);
    expect(() => result.find('canvas')).toThrow();
    result.unmount();
  });

  it('queryAll returns all matching elements', () => {
    const app = streetui.app({ name: 'test' });
    app.page('home', page => {
      page.button('A');
      page.button('B');
      page.button('C');
    });
    const result = render(app);
    expect(result.queryAll('button')).toHaveLength(3);
    result.unmount();
  });
});

describe('render — events', () => {
  it('button click fires handler', () => {
    let fired = false;
    const app = streetui.app({ name: 'test' });
    app.page('home', page => {
      page.button('Go', { onClick: () => { fired = true; } });
    });
    const result = render(app);
    result.getByTag('button').dispatchEvent(new Event('click'));
    expect(fired).toBe(true);
    result.unmount();
  });
});

describe('render — reactive updates', () => {
  it('signal update patches the DOM', () => {
    resetIdCounter();
    const label = signal('before');
    const app = streetui.app({ name: 'test' });
    app.page('home', page => { page.text(label); });
    const result = render(app);

    expect(result.container.textContent).toContain('before');
    label.set('after');
    expect(result.container.textContent).toContain('after');
    result.unmount();
  });
});

describe('render — unmount', () => {
  it('removes DOM content on unmount', () => {
    const app = streetui.app({ name: 'test' });
    app.page('home', page => { page.heading('Hi'); });
    const result = render(app);
    expect(result.container.children.length).toBeGreaterThan(0);
    result.unmount();
    expect(result.container.children.length).toBe(0);
  });
});

describe('renderOnce', () => {
  it('cleans up automatically', async () => {
    const app = streetui.app({ name: 'test' });
    app.page('home', page => { page.heading('Auto'); });
    let containerRef: HTMLElement | null = null;
    await renderOnce(app, result => {
      containerRef = result.container as HTMLElement;
      expect(result.getByTag('h1').textContent).toBe('Auto');
    });
    // After renderOnce, container is removed from body
    const connected: boolean = containerRef !== null
      ? (containerRef as HTMLElement).isConnected
      : false;
    expect(connected).toBe(false);
  });
});
