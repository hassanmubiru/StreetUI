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
  focus,
  blur,
  pressKey,
  clickOutside,
  openOverlay,
  closeOverlay,
  waitForTransition,
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

describe('interaction helpers (§20)', () => {
  it('focus/blur move the active element', () => {
    const app = streetui.app({ name: 'fb' });
    app.page('home', (p) => p.button('Go', { id: 'go' }));
    const { container, unmount } = render(app);
    const go = container.querySelector('#go') as HTMLElement;
    focus(go);
    expect(document.activeElement).toBe(go);
    blur(go);
    expect(document.activeElement).not.toBe(go);
    unmount();
  });

  it('openOverlay/closeOverlay drive an overlay and pressKey(Escape) closes it', async () => {
    const open = signal(false);
    const app = streetui.app({ name: 'ov' });
    app.page('home', (page) => {
      page.dialog('dlg', { open, onClose: () => open.set(false) }, (d) =>
        d.button('First', { id: 'first' }),
      );
    });
    const { unmount } = render(app);

    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
    await openOverlay(open);
    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull();
    // Focus moved into the panel; Escape from there closes cooperatively.
    expect(document.activeElement).toBe(document.getElementById('first'));
    pressKey('Escape');
    await flushUpdates();
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();

    // closeOverlay is the explicit path too.
    await openOverlay(open);
    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull();
    await closeOverlay(open);
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
    unmount();
  });

  it('clickOutside dispatches outside and rejects an inside target', () => {
    const app = streetui.app({ name: 'co' });
    app.page('home', (p) => p.button('In', { id: 'in' }));
    const { container, unmount } = render(app);
    const inside = container.querySelector('#in') as HTMLElement;
    // Inside target is a loud error, not a silent no-op.
    expect(() => clickOutside(container, inside)).toThrow(/inside the container/);
    // Outside (body) dispatches without throwing.
    expect(() => clickOutside(container)).not.toThrow();
    unmount();
  });

  it('waitForTransition settles a leave so the node is removed', async () => {
    const FADE = { name: 'fade', duration: 100000 } as const;
    const open = signal(false);
    const app = streetui.app({ name: 'wt' });
    app.page('home', (page) => {
      page.dialog('dlg', { open, onClose: () => open.set(false), transition: FADE }, (d) =>
        d.button('First', { id: 'first' }),
      );
    });
    const { unmount } = render(app);

    await openOverlay(open);
    const portal = document.body.querySelector('[data-streetui-portal-container]')!;
    // Settle the enter so the leave is clean.
    await waitForTransition(portal.querySelector('.fade-enter-active')!);

    // Close: panel is still present, animating out.
    open.set(false);
    await flushUpdates();
    const leaving = portal.querySelector('.fade-leave-active')!;
    expect(leaving).not.toBeNull();
    expect(portal.querySelector('[role="dialog"]')).not.toBeNull();

    // waitForTransition dispatches transitionend + flushes → node removed.
    await waitForTransition(leaving);
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
    unmount();
  });
});
