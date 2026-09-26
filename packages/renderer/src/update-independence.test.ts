/**
 * Regression suite for fine-grained reactive-update locality (spec §9, §26).
 *
 * §9's load-bearing client invariant: mutating ONE bound signal must produce
 * exactly the DOM writes for the node(s) that subscribe to it — and that write
 * count must be INDEPENDENT of the number of unrelated nodes in the tree. This
 * is what lets a 1-of-10,000 update stay cheap. The browser scenario that
 * measures wall-clock frame cost is BLOCKED in this environment (no Chromium),
 * but the underlying structural guarantee is fully Node-testable: we count every
 * DOM write through the same DOMAdapter choke-point the renderer uses and assert
 * the count does not grow with N. These are structural assertions, not timings,
 * so they are deterministic in CI.
 *
 * NOTE: this pins a real StreetUI-controlled behaviour and never substitutes a
 * happy-dom number for a browser measurement — it asserts *operation counts*,
 * which are engine-independent.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { resetIdCounter } from '@streetui/core';
import { streetui } from '@streetui/dsl';
import { signal, type Signal } from '@streetui/state';
import { compile } from '@streetui/compiler';
import { BrowserDOMAdapter, type DOMAdapter } from '@streetui/dom';
import { createRenderContext } from './render-context.js';
import { mountGraph } from './mount.js';

beforeEach(() => resetIdCounter());

interface Counts {
  createElement: number; createTextNode: number; appendChild: number;
  insertBefore: number; removeChild: number; setTextContent: number; setAttribute: number;
}

function makeCountingAdapter(): { adapter: DOMAdapter; c: Counts; reset: () => void } {
  const base = new BrowserDOMAdapter();
  const c: Counts = {
    createElement: 0, createTextNode: 0, appendChild: 0, insertBefore: 0,
    removeChild: 0, setTextContent: 0, setAttribute: 0,
  };
  const adapter = {
    createElement(t: string) { c.createElement++; return base.createElement(t); },
    createTextNode(d: string) { c.createTextNode++; return base.createTextNode(d); },
    appendChild(p: Node, ch: Node) { c.appendChild++; return base.appendChild(p, ch); },
    insertBefore(p: Node, ch: Node, r: Node | null) { c.insertBefore++; return base.insertBefore(p, ch, r); },
    removeChild(p: Node, ch: Node) { c.removeChild++; return base.removeChild(p, ch); },
    setTextContent(n: Node, t: string) { c.setTextContent++; return base.setTextContent(n, t); },
    setAttribute(e: Element, n: string, v: string) { c.setAttribute++; return base.setAttribute(e, n, v); },
  } as Record<string, unknown>;
  const proto = base as unknown as Record<string, (...a: unknown[]) => unknown>;
  for (const k of Object.getOwnPropertyNames(Object.getPrototypeOf(base))) {
    if (k !== 'constructor' && typeof proto[k] === 'function' && !(k in adapter)) {
      adapter[k] = (...a: unknown[]) => proto[k]!(...a);
    }
  }
  return { adapter: adapter as unknown as DOMAdapter, c, reset() { for (const k of Object.keys(c)) (c as never)[k] = 0 as never; } };
}

/** Mount a page holding `n` text nodes, each bound to its own signal. */
function mountN(n: number): { sigs: Signal<string>[]; c: Counts; reset: () => void } {
  const sigs = Array.from({ length: n }, (_, i) => signal(`v${i}`));
  const app = streetui.app({ name: 'controls' });
  app.page('home', (page) => { for (const s of sigs) page.text(s); });
  const compiled = compile(app);
  const { adapter, c, reset } = makeCountingAdapter();
  const container = (globalThis as unknown as { document: Document }).document.createElement('div');
  mountGraph(createRenderContext(adapter, compiled.graph, container));
  return { sigs, c, reset };
}

const writeTotal = (c: Counts) =>
  c.createElement + c.createTextNode + c.appendChild + c.insertBefore +
  c.removeChild + c.setTextContent + c.setAttribute;

describe('fine-grained update locality — independent of N (spec §9)', () => {
  it('updating ONE of N bound signals writes exactly one text node, for any N', () => {
    for (const n of [100, 1000]) {
      const { sigs, c, reset } = mountN(n);
      reset();
      sigs[0]!.set('changed');
      expect(c.setTextContent).toBe(1);          // only the subscribed node
      expect(c.createElement).toBe(0);            // no re-creation
      expect(c.appendChild + c.insertBefore + c.removeChild).toBe(0); // no structural churn
      expect(writeTotal(c)).toBe(1);              // zero unrelated updates
    }
  });

  it('the single-update write count does NOT grow with list size', () => {
    const small = mountN(100); small.reset(); small.sigs[7]!.set('x');
    const large = mountN(2000); large.reset(); large.sigs[7]!.set('x');
    expect(large.c.setTextContent).toBe(small.c.setTextContent);
    expect(writeTotal(large.c)).toBe(writeTotal(small.c));
  });

  it('updating K distinct signals writes exactly K nodes, independent of N', () => {
    const { sigs, c, reset } = mountN(5000);
    reset();
    for (let i = 0; i < 10; i++) sigs[i * 100]!.set(`u${i}`);
    expect(c.setTextContent).toBe(10);
    expect(writeTotal(c)).toBe(10);
  });

  it('setting a signal to its current value performs no DOM write', () => {
    const { sigs, c, reset } = mountN(500);
    reset();
    sigs[3]!.set('v3'); // unchanged
    expect(writeTotal(c)).toBe(0);
  });
});
