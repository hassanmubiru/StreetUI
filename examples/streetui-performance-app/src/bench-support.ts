/**
 * Benchmark support surface. Re-exports the exact `streetui` primitives the app
 * itself is built on (so a harness shares ONE module instance with the compiled
 * app — no duplicate reactive system or renderer), plus a counting DOM adapter
 * that proves mutation counts instead of assuming them. Not part of the app UI;
 * imported only by measurement harnesses and tests.
 */
export {
  createRenderer,
  renderToString,
  BrowserDOMAdapter,
  signal,
  batch,
  type StreetRenderer,
} from 'streetui';

export interface Counters {
  createElement: number;
  createTextNode: number;
  createComment: number;
  setTextContent: number;
  setAttribute: number;
  removeAttribute: number;
  setProperty: number;
  appendChild: number;
  insertBefore: number;
  removeChild: number;
}

export interface CountingAdapter {
  readonly adapter: unknown;
  readonly counters: Counters;
  reset(): void;
  snapshot(): Counters;
  total(): number;
  structuralWrites(): number;
}

import { BrowserDOMAdapter as _Base } from 'streetui';

export function makeCountingAdapter(): CountingAdapter {
  const base = new _Base();
  const c: Counters = {
    createElement: 0, createTextNode: 0, createComment: 0, setTextContent: 0,
    setAttribute: 0, removeAttribute: 0, setProperty: 0, appendChild: 0,
    insertBefore: 0, removeChild: 0,
  };
  const b = base as unknown as Record<string, (...a: unknown[]) => unknown>;
  const adapter: Record<string, unknown> = {
    createElement: (t: unknown) => { c.createElement++; return b.createElement(t); },
    createTextNode: (d: unknown) => { c.createTextNode++; return b.createTextNode(d); },
    createComment: (d: unknown) => { c.createComment++; return b.createComment(d); },
    appendChild: (p: unknown, ch: unknown) => { c.appendChild++; return b.appendChild(p, ch); },
    insertBefore: (p: unknown, ch: unknown, r: unknown) => { c.insertBefore++; return b.insertBefore(p, ch, r); },
    removeChild: (p: unknown, ch: unknown) => { c.removeChild++; return b.removeChild(p, ch); },
    setAttribute: (e: unknown, n: unknown, v: unknown) => { c.setAttribute++; return b.setAttribute(e, n, v); },
    removeAttribute: (e: unknown, n: unknown) => { c.removeAttribute++; return b.removeAttribute(e, n); },
    setProperty: (e: unknown, n: unknown, v: unknown) => { c.setProperty++; return b.setProperty(e, n, v); },
    setTextContent: (n: unknown, t: unknown) => { c.setTextContent++; return b.setTextContent(n, t); },
  };
  for (const k of Object.getOwnPropertyNames(Object.getPrototypeOf(base))) {
    if (k !== 'constructor' && typeof b[k] === 'function' && !(k in adapter)) {
      adapter[k] = (...a: unknown[]) => b[k](...a);
    }
  }
  return {
    adapter,
    counters: c,
    reset(): void { (Object.keys(c) as (keyof Counters)[]).forEach((k) => (c[k] = 0)); },
    snapshot(): Counters { return { ...c }; },
    total(): number { return Object.values(c).reduce((a, x) => a + x, 0); },
    structuralWrites(): number {
      return c.setAttribute + c.removeAttribute + c.setProperty + c.setTextContent +
        c.appendChild + c.insertBefore + c.removeChild;
    },
  };
}
