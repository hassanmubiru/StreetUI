/**
 * Transition primitive + lifecycle + cancellation matrix (§2–§8).
 *
 * These tests exercise the CSS class-based transition controller against the
 * real `BrowserDOMAdapter` + happy-dom. happy-dom dispatches no
 * `transitionend`/`animationend`, so completion is driven either by the
 * controller's fallback timeout (production/tests-with-timers) OR — as here —
 * by explicitly dispatching a `transitionend` on the transitioning element,
 * which makes every assertion deterministic with NO reliance on wall-clock
 * timers. A large `duration` is used so the fallback never fires mid-test; the
 * explicit event clears that timer as part of completion.
 *
 * Coverage:
 *   - enter on append/insert (§3/§4/§7)
 *   - leave defers removal + dispose + detach until animation end (§3/§7)
 *   - cancellation matrix (§6): leave→enter reclaim, enter→leave, and that a
 *     cancelled leave never finalizes the node it was about to destroy
 *   - `when()` conditional enter/leave (§2)
 *   - handler pruning after leave completes (no orphan `__transition__`) (§23)
 *   - SSR emits NO transition classes — server output is deterministic (§21)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { resetIdCounter } from '@streetui/core';
import { streetui } from '@streetui/dsl';
import { signal, type Signal } from '@streetui/state';
import { compile } from '@streetui/compiler';
import { BrowserDOMAdapter } from '@streetui/dom';
import { createRenderer } from './renderer.js';
import { renderToString } from './ssr.js';

beforeEach(() => {
  resetIdCounter();
  document.body.innerHTML = '';
});

/** Complete a running transition on `el` by dispatching a real transitionend. */
function endTransition(el: Element): void {
  el.dispatchEvent(new Event('transitionend', { bubbles: true }));
}

function classesOf(el: Element): string[] {
  return (el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);
}

function mountApp(build: (page: import('@streetui/dsl').PageDSL) => void) {
  const app = streetui.app({ name: 'transition' });
  app.page('home', build);
  const compiled = compile(app);
  const container = document.createElement('div');
  document.body.appendChild(container);
  const renderer = createRenderer({ domAdapter: new BrowserDOMAdapter() });
  const handle = renderer.mount(compiled, container);
  return { container, handle, graph: compiled.graph };
}

const FADE = { name: 'fade', duration: 100000 } as const;

describe('list item transitions (§7)', () => {
  it('plays enter (from+active applied) when an item is appended', () => {
    const items: Signal<{ id: number }[]> = signal([{ id: 1 }]);
    const { container } = mountApp((page) => {
      page.listOf('rows', items, (it, _i, c) => c.text(String(it.id)), {
        itemTransition: FADE,
      });
    });

    const listEl = container.querySelector('ul')!;
    expect(listEl.querySelectorAll('[data-streetui-key]').length).toBe(1);

    items.set([{ id: 1 }, { id: 2 }]);

    const rows = listEl.querySelectorAll('[data-streetui-key]');
    expect(rows.length).toBe(2);
    const appended = listEl.querySelector('[data-streetui-key="id:2"]')!;
    // Enter classes are applied synchronously on insert (before the rAF flip).
    const cls = classesOf(appended);
    expect(cls).toContain('fade-enter-active');
    expect(cls).toContain('fade-enter-from');

    // Completing the transition clears every transition class.
    endTransition(appended);
    const after = classesOf(appended);
    expect(after).not.toContain('fade-enter-active');
    expect(after).not.toContain('fade-enter-from');
    expect(after).not.toContain('fade-enter-to');
  });

  it('defers removal + dispose + detach until the leave animation ends (§3)', () => {
    const items: Signal<{ id: number }[]> = signal([{ id: 1 }, { id: 2 }]);
    const { container, graph } = mountApp((page) => {
      page.listOf('rows', items, (it, _i, c) => c.text(String(it.id)), {
        itemTransition: FADE,
      });
    });
    const listEl = container.querySelector('ul')!;
    const leavingBefore = listEl.querySelector('[data-streetui-key="id:2"]')!;
    const transitionHandlers = () =>
      [...graph.handlers.keys()].filter((k) => k.startsWith('__transition__')).length;
    const before = transitionHandlers();

    items.set([{ id: 1 }]);

    // Still in the DOM, animating out — NOT yet removed/disposed/detached.
    const stillThere = listEl.querySelector('[data-streetui-key="id:2"]');
    expect(stillThere).toBe(leavingBefore);
    expect(classesOf(leavingBefore)).toContain('fade-leave-active');
    // Its transition handler is still registered (node not yet detached).
    expect(transitionHandlers()).toBe(before);

    // End the leave → the whole teardown chain runs now.
    endTransition(leavingBefore);
    expect(listEl.querySelector('[data-streetui-key="id:2"]')).toBeNull();
    // Handler pruned on detach (§23) — no orphan __transition__ descriptor.
    expect(transitionHandlers()).toBe(before - 1);
  });

  it('leave→enter: re-adding a key mid-leave reclaims the SAME node (no duplicate) (§6)', () => {
    const items: Signal<{ id: number }[]> = signal([{ id: 1 }, { id: 2 }]);
    const { container } = mountApp((page) => {
      page.listOf('rows', items, (it, _i, c) => c.text(String(it.id)), {
        itemTransition: FADE,
      });
    });
    const listEl = container.querySelector('ul')!;
    const original = listEl.querySelector('[data-streetui-key="id:2"]')!;

    items.set([{ id: 1 }]); // begin leaving id:2
    expect(classesOf(original)).toContain('fade-leave-active');

    items.set([{ id: 1 }, { id: 2 }]); // re-add id:2 before the leave completes

    const rows = listEl.querySelectorAll('[data-streetui-key="id:2"]');
    expect(rows.length).toBe(1); // exactly one — reclaimed, not duplicated
    expect(rows[0]).toBe(original); // same live DOM node reused
    const cls = classesOf(original);
    expect(cls).not.toContain('fade-leave-active'); // leave cancelled
    expect(cls).toContain('fade-enter-active'); // enter now running
    endTransition(original);
  });

  it('a cancelled leave never finalizes (removes) the reclaimed node (§6)', () => {
    const items: Signal<{ id: number }[]> = signal([{ id: 1 }]);
    const { container } = mountApp((page) => {
      page.listOf('rows', items, (it, _i, c) => c.text(String(it.id)), {
        itemTransition: FADE,
      });
    });
    const listEl = container.querySelector('ul')!;
    const node = listEl.querySelector('[data-streetui-key="id:1"]')!;

    items.set([]); // begin leaving id:1
    items.set([{ id: 1 }]); // reclaim it before completion

    // Dispatching a transitionend now must NOT remove the reclaimed node: the
    // original leave run was cancelled, so its onDone/finalize can never fire.
    endTransition(node);
    expect(listEl.querySelector('[data-streetui-key="id:1"]')).toBe(node);
  });
});

describe('conditional (when) transitions (§2)', () => {
  it('enters on show and defers unmount until leave ends', () => {
    const shown: Signal<boolean> = signal(false);
    const { container } = mountApp((page) => {
      page.when(
        shown,
        (c) => c.text('Now you see me', { id: 'body' }),
        undefined,
        { transition: FADE },
      );
    });

    expect(document.getElementById('body')).toBeNull();

    shown.set(true);
    // The branch container is the animating element (holds the body text).
    const branch = container.querySelector('.fade-enter-active')!;
    expect(branch).not.toBeNull();
    expect(document.getElementById('body')).not.toBeNull();
    endTransition(branch);

    shown.set(false);
    // Body still present during the leave (deferred unmount).
    expect(document.getElementById('body')).not.toBeNull();
    const leaving = container.querySelector('.fade-leave-active')!;
    expect(leaving).not.toBeNull();
    endTransition(leaving);
    expect(document.getElementById('body')).toBeNull();
  });
});

describe('SSR determinism (§21)', () => {
  it('emits no transition classes on the server', () => {
    const items = signal([{ id: 1 }, { id: 2 }]);
    const app = streetui.app({ name: 'ssr-transition' });
    app.page('home', (page) => {
      page.when(signal(true), (c) => c.text('hi'), undefined, { transition: FADE });
      page.listOf('rows', items, (it, _i, c) => c.text(String(it.id)), {
        itemTransition: FADE,
      });
    });
    const html = renderToString(compile(app));
    expect(html).not.toContain('fade-enter');
    expect(html).not.toContain('fade-leave');
    expect(html).not.toContain('fade-appear');
  });
});

describe('hydration does not replay appear (§22)', () => {
  const APPEAR = { name: 'fade', duration: 100000, appear: true } as const;

  function buildAppearApp() {
    const app = streetui.app({ name: 'hydrate-appear' });
    app.page('home', (page) => {
      page.when(signal(true), (c) => c.text('hi', { id: 'body' }), undefined, {
        transition: APPEAR,
        appear: true,
      });
    });
    return app;
  }

  it('fresh browser mount plays the appear enter, but hydration adopts the DOM silently', () => {
    // Control: a fresh mount with appear:true DOES play the enter animation.
    const fresh = document.createElement('div');
    document.body.appendChild(fresh);
    createRenderer({ domAdapter: new BrowserDOMAdapter() }).mount(
      compile(buildAppearApp()),
      fresh,
    );
    expect(fresh.querySelector('.fade-enter-active')).not.toBeNull();

    // Hydration: server HTML carries no transition classes, and adopting it must
    // NOT start an enter — the DOM is already present and correct (§22).
    resetIdCounter();
    const serverHtml = renderToString(compile(buildAppearApp()));
    expect(serverHtml).not.toContain('fade-enter');
    expect(serverHtml).not.toContain('fade-appear');

    const container = document.createElement('div');
    container.innerHTML = serverHtml;
    document.body.appendChild(container);
    resetIdCounter();
    createRenderer({ domAdapter: new BrowserDOMAdapter() }).hydrate(
      compile(buildAppearApp()),
      container,
    );

    // No appear/enter classes were applied during hydration; the content is live.
    expect(container.querySelector('.fade-enter-active')).toBeNull();
    expect(container.querySelector('.fade-appear')).toBeNull();
    expect(container.querySelector('.fade-enter-from')).toBeNull();
    expect(document.getElementById('body')).not.toBeNull();
  });
});
