// src/bench-support.ts
import {
  createRenderer,
  renderToString,
  BrowserDOMAdapter,
  signal,
  batch
} from "streetui";
import { BrowserDOMAdapter as _Base } from "streetui";
function makeCountingAdapter() {
  const base = new _Base();
  const c = {
    createElement: 0,
    createTextNode: 0,
    createComment: 0,
    setTextContent: 0,
    setAttribute: 0,
    removeAttribute: 0,
    setProperty: 0,
    appendChild: 0,
    insertBefore: 0,
    removeChild: 0
  };
  const b = base;
  const call = (k, ...a) => {
    const fn = b[k];
    if (typeof fn !== "function") throw new Error(`adapter missing ${k}`);
    return fn.apply(base, a);
  };
  const adapter = {
    createElement: (t) => {
      c.createElement++;
      return call("createElement", t);
    },
    createTextNode: (d) => {
      c.createTextNode++;
      return call("createTextNode", d);
    },
    createComment: (d) => {
      c.createComment++;
      return call("createComment", d);
    },
    appendChild: (p, ch) => {
      c.appendChild++;
      return call("appendChild", p, ch);
    },
    insertBefore: (p, ch, r) => {
      c.insertBefore++;
      return call("insertBefore", p, ch, r);
    },
    removeChild: (p, ch) => {
      c.removeChild++;
      return call("removeChild", p, ch);
    },
    setAttribute: (e, n, v) => {
      c.setAttribute++;
      return call("setAttribute", e, n, v);
    },
    removeAttribute: (e, n) => {
      c.removeAttribute++;
      return call("removeAttribute", e, n);
    },
    setProperty: (e, n, v) => {
      c.setProperty++;
      return call("setProperty", e, n, v);
    },
    setTextContent: (n, t) => {
      c.setTextContent++;
      return call("setTextContent", n, t);
    }
  };
  for (const k of Object.getOwnPropertyNames(Object.getPrototypeOf(base))) {
    if (k !== "constructor" && typeof b[k] === "function" && !(k in adapter)) {
      adapter[k] = (...a) => call(k, ...a);
    }
  }
  return {
    adapter,
    counters: c,
    reset() {
      Object.keys(c).forEach((k) => c[k] = 0);
    },
    snapshot() {
      return { ...c };
    },
    total() {
      return Object.values(c).reduce((a, x) => a + x, 0);
    },
    structuralWrites() {
      return c.setAttribute + c.removeAttribute + c.setProperty + c.setTextContent + c.appendChild + c.insertBefore + c.removeChild;
    }
  };
}
export {
  BrowserDOMAdapter,
  batch,
  createRenderer,
  makeCountingAdapter,
  renderToString,
  signal
};
//# sourceMappingURL=bench-support.js.map