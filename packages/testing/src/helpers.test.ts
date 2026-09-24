/**
 * Tests for the higher-level testing helpers: role/text queries, update
 * flushing, async waiting, and the SSR → hydrate workflow.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { resetIdCounter } from '@streetui/core';
import { streetui } from '@streetui/dsl';
import { signal, resource } from '@streetui/state';
import {
  findByText,
  findByRole,
  findAllByRole,
  flushUpdates,
  waitFor,
  renderServerThenHydrate,
} from './helpers.js';
import { render } from './test-renderer.js';

beforeEach(() => resetIdCounter());

describe('findByText / findByRole', () => {
  it('finds a leaf element by text', () => {
    const app = streetui.app({ name: 't' });
    app.page('home', (p) => p.heading('Welcome'));
    const { container, unmount } = render(app);
    expect(findByText(container, 'Welcome').tagName.toLowerCase()).toBe('h1');
    unmount();
  });

  it('finds elements by implicit role', () => {
    const app = streetui.app({ name: 't' });
    app.page('home', (p) => {
      p.heading('Title');
      p.button('Go');
    });
    const { container, unmount } = render(app);
    expect(findByRole(container, 'heading').textContent).toBe('Title');
    expect(findByRole(container, 'button').textContent).toBe('Go');
    unmount();
  });

  it('filters by accessible name and throws when ambiguous', () => {
    const app = streetui.app({ name: 't' });
    app.page('home', (p) => {
      p.button('Save');
      p.button('Cancel');
    });
    const { container, unmount } = render(app);
    expect(findAllByRole(container, 'button')).toHaveLength(2);
    expect(findByRole(container, 'button', { name: 'Save' }).textContent).toBe('Save');
    expect(() => findByRole(container, 'button')).toThrow(/2 elements/);
    unmount();
  });

  it('respects an explicit role attribute', () => {
    const app = streetui.app({ name: 't' });
    app.page('home', (p) =>
      p.section('nav', (s) => s.link('Home', { href: '/' }), { role: 'navigation' }),
    );
    const { container, unmount } = render(app);
    expect(findByRole(container, 'navigation')).not.toBeNull();
    unmount();
  });
});

describe('flushUpdates / waitFor', () => {
  it('waitFor resolves once an async resource settles', async () => {
    let resolveLoad: (v: string) => void = () => {};
    const p = new Promise<string>((r) => {
      resolveLoad = r;
    });
    const res = resource<string>(() => p);
    expect(res.status.peek()).toBe('loading');

    resolveLoad('done');
    const value = await waitFor(() => res.data.peek());
    expect(value).toBe('done');
    expect(res.status.peek()).toBe('success');
  });

  it('flushUpdates applies a scheduled signal change to the DOM', async () => {
    const count = signal(0);
    const app = streetui.app({ name: 't' });
    app.page('home', (p) => p.text(count));
    const { container, unmount } = render(app);
    count.set(5);
    await flushUpdates();
    expect(container.textContent).toContain('5');
    unmount();
  });

  it('waitFor rejects after the timeout when the condition never holds', async () => {
    await expect(waitFor(() => false, { timeout: 30, interval: 5 })).rejects.toThrow();
  });
});

describe('renderServerThenHydrate', () => {
  it('renders on the server then adopts the same DOM on hydrate (identity)', () => {
    const build = () => {
      const app = streetui.app({ name: 'app' });
      app.page('home', (page) => page.heading('Hydrated'));
      return app;
    };
    const r = renderServerThenHydrate(build);
    expect(r.serverHtml).toContain('Hydrated');
    const h1 = r.container.querySelector('h1');
    expect(h1?.textContent).toBe('Hydrated');
    // No mismatches expected on a matching server/client build.
    expect(r.diagnostics).toHaveLength(0);
    r.unmount();
  });

  it('drives the hydrated app live and reports no mismatch diagnostics', () => {
    const count = signal(1);
    const build = () => {
      const app = streetui.app({ name: 'app' });
      app.page('home', (page) => {
        page.text(count);
        page.button('inc', { onClick: () => count.update((n) => n + 1), id: 'inc' });
      });
      return app;
    };
    const r = renderServerThenHydrate(build, { collectDiagnostics: true });
    expect(r.diagnostics).toHaveLength(0);
    (r.container.querySelector('#inc') as HTMLButtonElement).dispatchEvent(new Event('click'));
    r.flush();
    expect(r.container.textContent).toContain('2');
    r.unmount();
  });
});
