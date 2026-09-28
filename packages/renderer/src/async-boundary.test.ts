/**
 * asyncBoundary + async-component lifecycle + errorBoundary reporting hook
 * (2.0 §4–§6) — full-pipeline behavior (DSL → compiler → graph → renderer → DOM).
 *
 * `asyncBoundary(key, resource, { loading, error, success })` is deliberately
 * NOT a second async system and NOT a literal port of React Suspense: it is thin
 * sugar over the existing `resource` state machine and `when()`. Exactly one
 * branch is live at a time (error wins, then resolved data — kept visible during
 * a refetch — then loading), so mount/unmount/cleanup all reuse the conditional
 * machinery. These tests prove branch selection, the `retry()` wrapper over
 * `refetch`, SSR rendering of the resolved branch, hydration reuse without a
 * duplicate load, an async component cancelling its resource on unmount (§5),
 * and the additive `errorBoundary` `onError` reporting hook (§6/§7).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { resetIdCounter } from '@streetui/core';
import { streetui, component, type ContainerDSL } from '@streetui/dsl';
import { signal, resource } from '@streetui/state';
import { compile } from '@streetui/compiler';
import { BrowserDOMAdapter } from '@streetui/dom';
import { createRenderer } from './renderer.js';
import { renderToString } from './ssr.js';

beforeEach(() => resetIdCounter());

const txt = (el: Element | null) => el?.textContent?.trim() ?? '';
const tick = () => new Promise<void>((r) => setTimeout(r, 0));

function mountApp(build: (page: ContainerDSL) => void) {
  resetIdCounter();
  const app = streetui.app({ name: 'test' });
  app.page('home', (p) => build(p));
  const compiled = compile(app);
  const container = document.createElement('div');
  const renderer = createRenderer({ domAdapter: new BrowserDOMAdapter() });
  const handle = renderer.mount(compiled, container);
  return { container, handle };
}

// ── Branch selection ─────────────────────────────────────────────────────────

describe('asyncBoundary — branch selection', () => {
  it('shows loading while idle/loading, then success once data arrives', async () => {
    let resolve!: (v: string[]) => void;
    const items = resource<string[]>(
      () => new Promise<string[]>((r) => { resolve = r; }),
      { immediate: false },
    );

    const { container } = mountApp((p) => {
      p.asyncBoundary('items', items, {
        loading: (c) => c.text('loading…', { id: 'loading' }),
        error: (c, e) => c.text(`err: ${(e as Error).message}`, { id: 'error' }),
        success: (c) => c.text('ready', { id: 'success' }),
      });
    });

    // Idle → loading branch (no data yet).
    expect(txt(container.querySelector('#loading'))).toBe('loading…');
    expect(container.querySelector('#success')).toBeNull();

    void items.refetch();
    // Still loading (promise unresolved), no data.
    expect(txt(container.querySelector('#loading'))).toBe('loading…');

    resolve(['A', 'B']);
    await tick();

    // Data present → success branch; loading gone.
    expect(container.querySelector('#loading')).toBeNull();
    expect(txt(container.querySelector('#success'))).toBe('ready');
    items.dispose();
  });

  it('shows the error branch when the resource rejects, and retry() re-runs the loader', async () => {
    let attempt = 0;
    const items = resource<string[]>(() => {
      attempt++;
      return attempt === 1
        ? Promise.reject(new Error('HTTP 500'))
        : Promise.resolve(['ok']);
    }, { immediate: false });

    let retryFn: (() => void) | undefined;
    const { container } = mountApp((p) => {
      p.asyncBoundary('items', items, {
        loading: (c) => c.text('loading…', { id: 'loading' }),
        error: (c, e, retry) => {
          retryFn = retry;
          c.text(`err: ${(e as Error).message}`, { id: 'error' });
        },
        success: (c, data) => c.text(data.get()[0]!, { id: 'success' }),
      });
    });

    await items.refetch();
    expect(txt(container.querySelector('#error'))).toBe('err: HTTP 500');
    expect(container.querySelector('#success')).toBeNull();

    // retry() is a thin wrapper over refetch — the loader runs again and succeeds.
    retryFn!();
    await tick();
    expect(attempt).toBe(2);
    expect(container.querySelector('#error')).toBeNull();
    expect(txt(container.querySelector('#success'))).toBe('ok');
    items.dispose();
  });

  it('keeps the success branch visible (data) while a refetch is in flight', async () => {
    let calls = 0;
    let resolve!: (v: string) => void;
    const item = resource<string>(() => {
      calls++;
      if (calls === 1) return Promise.resolve('first');
      return new Promise<string>((r) => { resolve = r; });
    }, { immediate: false });

    const { container } = mountApp((p) => {
      p.asyncBoundary('item', item, {
        loading: (c) => c.text('loading…', { id: 'loading' }),
        success: (c, data) => c.text(data, { id: 'success' }),
      });
    });

    await item.refetch();
    expect(txt(container.querySelector('#success'))).toBe('first');

    // A second refetch keeps the old data visible → still the success branch.
    void item.refetch();
    await tick();
    expect(container.querySelector('#loading')).toBeNull();
    expect(txt(container.querySelector('#success'))).toBe('first');

    resolve('second');
    await tick();
    expect(txt(container.querySelector('#success'))).toBe('second');
    item.dispose();
  });
});

// ── SSR + hydration (§25 determinism / reuse) ─────────────────────────────────

describe('asyncBoundary — SSR renders the resolved branch, hydration reuses it', () => {
  it('server emits the success branch for a seeded resource; hydration does not re-load', async () => {
    let loads = 0;
    function build() {
      // Seeded with initialData (SSR transfer) → status 'success', no auto-load.
      const items = resource<string[]>(() => { loads++; return Promise.resolve(['seed']); }, {
        initialData: ['seed'],
      });
      const app = streetui.app({ name: 'ssr-async' });
      app.page('home', (page) => {
        page.asyncBoundary('items', items, {
          loading: (c) => c.text('loading…', { id: 'loading' }),
          success: (c, data) => c.text(data.get()[0]!, { id: 'success' }),
        });
      });
      return { compiled: compile(app), items };
    }

    // Server: the resolved success branch is serialized (no loading placeholder).
    resetIdCounter();
    const server = build();
    const html = renderToString(server.compiled);
    expect(html).toContain('id="success"');
    expect(html).toContain('seed');
    expect(html).not.toContain('id="loading"');

    // Browser: hydrate over that markup; the seeded resource never re-loads.
    resetIdCounter();
    const client = build();
    const container = document.createElement('div');
    container.innerHTML = html;
    const renderer = createRenderer({ domAdapter: new BrowserDOMAdapter() });
    const handle = renderer.hydrate(client.compiled, container);
    await tick();

    expect(loads).toBe(0); // seeded state skipped the initial auto-load
    expect(txt(container.querySelector('#success'))).toBe('seed');
    handle.unmount();
    client.items.dispose();
  });
});

// ── §5 async component lifecycle: cancel on unmount ───────────────────────────

describe('async component — resource is disposed/aborted on unmount (§5)', () => {
  it('a resource created in setup with { onCleanup: ctx.onCleanup } aborts when the component unmounts', async () => {
    let seenSignal: AbortSignal | undefined;
    const show = signal(true);

    const AsyncCard = component((_props, ctx) => {
      const data = resource<string>((lc) => {
        seenSignal = lc.signal;
        // Never resolves — we only care that it is aborted on unmount.
        return new Promise<string>(() => {});
      }, { onCleanup: ctx.onCleanup });
      return (c) => {
        c.asyncBoundary('inner', data, {
          loading: (l) => l.text('loading…', { id: 'loading' }),
          success: (s, d) => s.text(d.get(), { id: 'success' }),
        });
      };
    });

    const { container } = mountApp((page) => {
      page.when(show, (b) => b.component('card', AsyncCard, {}));
    });

    await tick();
    expect(txt(container.querySelector('#loading'))).toBe('loading…');
    expect(seenSignal).toBeDefined();
    expect(seenSignal!.aborted).toBe(false);

    // Unmount the component (remove the `when` branch) → ctx.onCleanup runs
    // resource.dispose() → the in-flight loader's AbortSignal is aborted.
    show.set(false);
    await tick();
    expect(container.querySelector('#loading')).toBeNull();
    expect(seenSignal!.aborted).toBe(true);
  });
});

// ── §6 errorBoundary onError reporting hook (additive) ────────────────────────

describe('errorBoundary — onError reporting hook (§6/§7)', () => {
  it('fires onError each time the boundary ENTERS its error state, including re-entry after a failed retry', () => {
    const err = signal<unknown>(undefined);
    const reported: unknown[] = [];
    let retryFn: (() => void) | undefined;

    const { container } = mountApp((p) => {
      p.errorBoundary('eb', (c) => c.text('ok', { id: 'body' }), {
        source: err,
        onError: (e) => reported.push(e),
        onRetry: () => { /* retry does not clear the error → boundary re-enters */ },
        fallback: (fb, _e, retry) => {
          retryFn = retry;
          fb.text('failed', { id: 'fallback' });
        },
      });
    });

    // Healthy at mount → no report yet.
    expect(reported.length).toBe(0);
    expect(txt(container.querySelector('#body'))).toBe('ok');

    // Enter error state → onError fires once with the current error.
    const e1 = new Error('first');
    err.set(e1);
    expect(txt(container.querySelector('#fallback'))).toBe('failed');
    expect(reported).toEqual([e1]);

    // Retry that fails to clear the error re-enters the error state → fires again.
    retryFn!();
    expect(reported.length).toBe(2);
    expect(reported[1]).toBe(e1);

    // Observe-only: it never changed the boundary's behavior (still showing fallback).
    expect(txt(container.querySelector('#fallback'))).toBe('failed');
  });
});
