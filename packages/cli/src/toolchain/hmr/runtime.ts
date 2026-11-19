/**
 * The browser-side HMR runtime module, served at `/@streetui/client/hmr-runtime.js`.
 *
 * `createHotContext(id)` is injected by the transform into any module that uses
 * `import.meta.hot`. The context registers accept/dispose callbacks in a global
 * registry so the HMR client can find them when an update arrives.
 */

export const HMR_RUNTIME_CODE = String.raw`const __registry = (globalThis.__STREETUI_HMR_RUNTIME__ ||= {
  accept: new Map(),
  dispose: new Map(),
});

function disposeModule(id) {
  const cb = __registry.dispose.get(id);
  if (typeof cb === 'function') {
    try { cb(); } catch (error) { console.error('[streetui hmr] dispose failed', id, error); }
    __registry.dispose.delete(id);
  }
}

export function createHotContext(id) {
  return {
    accept(arg, maybeCb) {
      if (typeof arg === 'function') {
        __registry.accept.set(id, arg);
        return;
      }
      if (typeof arg === 'string') {
        const depId = arg;
        const cb = typeof maybeCb === 'function' ? maybeCb : () => {};
        __registry.accept.set(depId, cb);
        return;
      }
      // accept() with no callback: accept self and do nothing.
      if (arg === undefined) __registry.accept.set(id, () => {});
    },
    dispose(cb) {
      if (typeof cb === 'function') __registry.dispose.set(id, cb);
    },
    data: {},
  };
}

export function __streetuiAccept(id) {
  return __registry.accept.get(id);
}

export function __streetuiDispose(id) {
  disposeModule(id);
}

export function __streetuiDecline(id) {
  __registry.accept.delete(id);
}
`;