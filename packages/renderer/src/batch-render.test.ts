/**
 * Batching regression suite (spec §14).
 *
 * `batch()` is StreetUI's write-coalescing primitive: many signal writes inside
 * one batch must produce ONE targeted DOM update per bound node when the batch
 * exits — never one per intermediate write, and never a full re-render. These
 * tests pin that guarantee at the *renderer* level (real mount pipeline + real
 * BrowserDOMAdapter), measuring genuine DOM traffic through a counting-adapter
 * decorator rather than trusting the subscriber-level batch tests in the state
 * package.
 *
 * Assertions are structural mutation counts, never wall-clock time.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { resetIdCounter } from '@streetui/core';
import { streetui } from '@streetui/dsl';
import { signal, batch, type Signal } from '@streetui/state';
import { compile } from '@streetui/compiler';
import { BrowserDOMAdapter, type DOMAdapter } from '@streetui/dom';
import { createRenderer } from './renderer.js';

beforeEach(() => resetIdCounter());

interface Counts {
  createElement: number;
  createTextNode: number;
  setTextContent: number;
  setAttribute: number;
}

function makeCountingAdapter(): { adapter: DOMAdapter; c: Counts; reset: () => void } {
  const base = new BrowserDOMAdapter();
  const c: Counts = { createElement: 0, createTextNode: 0, setTextContent: 0, setAttribute: 0 };
  const adapter = {
    createElement(t: string) { c.createElement++; return base.createElement(t); },
    createTextNode(d: string) { c.createTextNode++; return base.createTextNode(d); },
    setTextContent(n: Node, t: string) { c.setTextContent++; return base.setTextContent(n, t); },
    setAttribute(e: Element, n: string, v: string) { c.setAttribute++; return base.setAttribute(e, n, v); },
  } as Record<string, unknown>;
  const proto = base as unknown as Record<string, (...args: unknown[]) => unknown>;
  for (const k of Object.getOwnPropertyNames(Object.getPrototypeOf(base))) {
    if (k !== 'constructor' && typeof proto[k] === 'function' && !(k in adapter)) {
      adapter[k] = (...a: unknown[]) => proto[k]!(...a);
    }
  }
  return {
    adapter: adapter as unknown as DOMAdapter,
    c,
    reset() { for (const k of Object.keys(c)) (c as never)[k] = 0 as never; },
  };
}

function mountText(sig: Signal<string>) {
  const { adapter, c, reset } = makeCountingAdapter();
  const app = streetui.app({ name: 'batch' });
  app.page('home', (p) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (p as any).text(sig);
  });
  const container = document.createElement('div');
  createRenderer({ domAdapter: adapter }).mount(compile(app), container);
  return { container, c, reset };
}

function mountTwoTexts(a: Signal<string>, b: Signal<string>) {
  const { adapter, c, reset } = makeCountingAdapter();
  const app = streetui.app({ name: 'batch2' });
  app.page('home', (p) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (p as any).text(a);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (p as any).text(b);
  });
  const container = document.createElement('div');
  createRenderer({ domAdapter: adapter }).mount(compile(app), container);
  return { container, c, reset };
}

describe('batching / write coalescing (spec §14)', () => {
  it('many writes to one signal in a batch produce ONE DOM update', () => {
    const s = signal('v0');
    const { container, c, reset } = mountText(s);

    reset();
    batch(() => {
      s.set('a');
      s.set('b');
      s.set('c'); // only the final value should ever reach the DOM
    });

    expect(c.setTextContent).toBe(1);
    expect(container.textContent).toBe('c');
  });

  it('the same writes WITHOUT a batch update the DOM once per write', () => {
    const s = signal('v0');
    const { container, c, reset } = mountText(s);

    reset();
    s.set('a');
    s.set('b');
    s.set('c');

    // Fine-grained (unbatched) path: each write flushes immediately.
    expect(c.setTextContent).toBe(3);
    expect(container.textContent).toBe('c');
  });

  it('a batch touching two distinct signals updates each bound node exactly once', () => {
    const a = signal('a0');
    const b = signal('b0');
    const { container, c, reset } = mountTwoTexts(a, b);

    reset();
    batch(() => {
      a.set('a1');
      a.set('a2');
      b.set('b1');
      b.set('b2');
    });

    // One coalesced write per node — two nodes, so exactly two.
    expect(c.setTextContent).toBe(2);
    // No structural churn: nothing rebuilt.
    expect(c.createElement).toBe(0);
    expect(c.createTextNode).toBe(0);
    const texts = Array.from(container.querySelectorAll('span')).map((s) => s.textContent);
    expect(texts).toEqual(['a2', 'b2']);
  });
});
