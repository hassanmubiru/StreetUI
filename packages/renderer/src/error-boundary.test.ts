/**
 * errorBoundary — full-pipeline behavior tests (DSL → compiler → graph →
 * renderer → DOM). Covers: healthy body render, reactive swap to fallback on a
 * source error, retry restoring the body, synchronous build-throw capture, and
 * teardown on unmount.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { resetIdCounter } from '@streetui/core';
import { streetui, type ContainerDSL } from '@streetui/dsl';
import { signal, resource } from '@streetui/state';
import { compile } from '@streetui/compiler';
import { BrowserDOMAdapter } from '@streetui/dom';
import { createRenderer } from './renderer.js';

beforeEach(() => resetIdCounter());

const txt = (el: Element | null) => el?.textContent?.trim() ?? '';
const microtasks = () => new Promise<void>((r) => setTimeout(r, 0));

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

describe('errorBoundary — healthy body', () => {
  it('renders the body when there is no error', () => {
    const err = signal<unknown>(undefined);
    const { container } = mountApp((p) => {
      p.errorBoundary('eb', (c) => c.text('content', { id: 'body' }), {
        source: err,
        fallback: (fb) => fb.text('failed', { id: 'fallback' }),
      });
    });
    expect(txt(container.querySelector('#body'))).toBe('content');
    expect(container.querySelector('#fallback')).toBeNull();
  });
});

describe('errorBoundary — reactive fallback', () => {
  it('renders the fallback when the source is already in error at mount', () => {
    const err = signal<unknown>(new Error('boom'));
    const { container } = mountApp((p) => {
      p.errorBoundary('eb', (c) => c.text('content', { id: 'body' }), {
        source: err,
        fallback: (fb, error) => fb.text(`failed: ${(error as Error).message}`, { id: 'fallback' }),
      });
    });
    expect(container.querySelector('#body')).toBeNull();
    expect(txt(container.querySelector('#fallback'))).toBe('failed: boom');
  });

  it('swaps body → fallback when the source becomes an error', () => {
    const err = signal<unknown>(undefined);
    const { container } = mountApp((p) => {
      p.errorBoundary('eb', (c) => c.text('content', { id: 'body' }), {
        source: err,
        fallback: (fb) => fb.text('failed', { id: 'fallback' }),
      });
    });
    expect(txt(container.querySelector('#body'))).toBe('content');

    err.set(new Error('later'));
    expect(container.querySelector('#body')).toBeNull();
    expect(txt(container.querySelector('#fallback'))).toBe('failed');
  });
});

describe('errorBoundary — retry', () => {
  it('retry runs onRetry, clears the error, and restores the body', () => {
    const err = signal<unknown>(new Error('boom'));
    let retryFn: (() => void) | undefined;
    let onRetryCalls = 0;
    const { container } = mountApp((p) => {
      p.errorBoundary('eb', (c) => c.text('content', { id: 'body' }), {
        source: err,
        onRetry: () => {
          onRetryCalls++;
          err.set(undefined); // e.g. resource.refetch() clears the error
        },
        fallback: (fb, _e, retry) => {
          retryFn = retry;
          fb.text('failed', { id: 'fallback' });
        },
      });
    });
    expect(txt(container.querySelector('#fallback'))).toBe('failed');

    retryFn?.();
    expect(onRetryCalls).toBe(1);
    expect(container.querySelector('#fallback')).toBeNull();
    expect(txt(container.querySelector('#body'))).toBe('content');
  });
});

describe('errorBoundary — synchronous build throw', () => {
  it('captures a throw in the body builder and shows the fallback', async () => {
    const { container } = mountApp((p) => {
      p.errorBoundary('eb', () => {
        throw new Error('build failed');
      }, {
        fallback: (fb, error) => fb.text(`caught: ${(error as Error).message}`, { id: 'fallback' }),
      });
    });
    // Surfaced on the next microtask to avoid re-entrant reconciliation.
    await microtasks();
    expect(txt(container.querySelector('#fallback'))).toBe('caught: build failed');
  });
});

describe('errorBoundary — with a real resource', () => {
  it('shows fallback when a resource errors, then body after a successful retry', async () => {
    let attempt = 0;
    const products = resource<string[]>(() => {
      attempt++;
      return attempt === 1
        ? Promise.reject(new Error('HTTP 500'))
        : Promise.resolve(['A', 'B']);
    }, { immediate: false });

    const { container } = mountApp((p) => {
      p.errorBoundary('eb', (c) => c.text('loaded', { id: 'body' }), {
        source: products.error,
        onRetry: () => { void products.refetch(); },
        fallback: (fb, error) => fb.text(`err: ${(error as Error).message}`, { id: 'fallback' }),
      });
    });

    await products.refetch();
    expect(txt(container.querySelector('#fallback'))).toBe('err: HTTP 500');

    // Retry succeeds → error clears → body returns.
    await products.refetch();
    expect(container.querySelector('#fallback')).toBeNull();
    expect(txt(container.querySelector('#body'))).toBe('loaded');
    products.dispose();
  });
});

describe('errorBoundary — cleanup', () => {
  it('tears down on unmount and stops reacting to the source', () => {
    const err = signal<unknown>(undefined);
    const { container, handle } = mountApp((p) => {
      p.errorBoundary('eb', (c) => c.text('content', { id: 'body' }), {
        source: err,
        fallback: (fb) => fb.text('failed', { id: 'fallback' }),
      });
    });
    expect(txt(container.querySelector('#body'))).toBe('content');

    handle.unmount();
    expect(container.querySelector('#body')).toBeNull();
    // Mutating the source after unmount must not throw or resurrect anything.
    expect(() => err.set(new Error('after'))).not.toThrow();
    expect(container.querySelector('#fallback')).toBeNull();
  });
});
