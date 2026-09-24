// src/signal.ts
var _activeConsumer = null;
function withConsumer(consumer, fn) {
  const prev = _activeConsumer;
  _activeConsumer = consumer;
  try {
    return fn();
  } finally {
    _activeConsumer = prev;
  }
}
var _batchDepth = 0;
var _pendingFlushes = /* @__PURE__ */ new Map();
function _enqueueBatchFlush(sig, value) {
  _pendingFlushes.set(sig, { signal: sig, value });
}
function _drainBatch() {
  const flushes = [..._pendingFlushes.values()];
  _pendingFlushes.clear();
  for (const { signal: sig, value } of flushes) {
    sig._flushBatch(value);
  }
}
var Signal = class {
  _value;
  _subscribers = /* @__PURE__ */ new Set();
  _consumers = /* @__PURE__ */ new Set();
  constructor(initial) {
    this._value = initial;
  }
  get() {
    if (_activeConsumer !== null) {
      this._consumers.add(_activeConsumer);
      _activeConsumer._addSource(this);
    }
    return this._value;
  }
  peek() {
    return this._value;
  }
  set(value) {
    if (Object.is(this._value, value)) return;
    this._value = value;
    if (_batchDepth > 0) {
      _enqueueBatchFlush(this, value);
    } else {
      this._flush(value);
    }
  }
  update(fn) {
    this.set(fn(this._value));
  }
  subscribe(fn) {
    this._subscribers.add(fn);
    return () => {
      this._subscribers.delete(fn);
    };
  }
  _removeConsumer(consumer) {
    this._consumers.delete(consumer);
  }
  /**
   * Called by the batch machinery after the batch has completed.
   * Notifies subscribers with the final coalesced value.
   */
  _flushBatch(value) {
    this._flush(value);
  }
  _flush(value) {
    for (const sub of [...this._subscribers]) sub(value);
    for (const consumer of [...this._consumers]) consumer._invalidate();
  }
  /**
   * @internal DevTools inspection only. The number of live observers
   * (direct subscribers plus derived/effect consumers). Read-only; never
   * mutates reactive state.
   */
  _observerCount() {
    return this._subscribers.size + this._consumers.size;
  }
};
var DerivedSignal = class {
  _value = void 0;
  _dirty = true;
  _disposed = false;
  _fn;
  _subscribers = /* @__PURE__ */ new Set();
  /** All upstream sources this derived currently reads from. */
  _sources = /* @__PURE__ */ new Set();
  /** Downstream consumers that depend on this derived. */
  _consumers = /* @__PURE__ */ new Set();
  constructor(fn) {
    this._fn = fn;
  }
  get() {
    if (_activeConsumer !== null) {
      this._consumers.add(_activeConsumer);
      _activeConsumer._addSource(this);
    }
    if (this._dirty) this._recompute();
    return this._value;
  }
  peek() {
    if (this._dirty) this._recompute();
    return this._value;
  }
  subscribe(fn) {
    if (this._dirty) this._recompute();
    this._subscribers.add(fn);
    return () => {
      this._subscribers.delete(fn);
    };
  }
  _addSource(src) {
    this._sources.add(src);
  }
  _removeConsumer(consumer) {
    this._consumers.delete(consumer);
  }
  _invalidate() {
    if (this._disposed) return;
    this._dirty = true;
    const newVal = this.peek();
    for (const sub of [...this._subscribers]) sub(newVal);
    for (const consumer of [...this._consumers]) consumer._invalidate();
  }
  _recompute() {
    for (const src of this._sources) src._removeConsumer(this);
    this._sources.clear();
    this._value = withConsumer(this, this._fn);
    this._dirty = false;
  }
  dispose() {
    this._disposed = true;
    for (const src of this._sources) src._removeConsumer(this);
    this._sources.clear();
    this._subscribers.clear();
    this._consumers.clear();
  }
  /**
   * @internal DevTools inspection only. Live observers (subscribers plus
   * downstream consumers). Read-only.
   */
  _observerCount() {
    return this._subscribers.size + this._consumers.size;
  }
};
var Effect = class {
  _fn;
  _cleanup = void 0;
  _disposed = false;
  _sources = /* @__PURE__ */ new Set();
  constructor(fn) {
    this._fn = fn;
    this._run();
  }
  _addSource(src) {
    this._sources.add(src);
  }
  _invalidate() {
    if (this._disposed) return;
    this._run();
  }
  _run() {
    for (const src of this._sources) src._removeConsumer(this);
    this._sources.clear();
    if (typeof this._cleanup === "function") this._cleanup();
    const result = withConsumer(this, this._fn);
    this._cleanup = typeof result === "function" ? result : void 0;
  }
  dispose() {
    this._disposed = true;
    for (const src of this._sources) src._removeConsumer(this);
    this._sources.clear();
    if (typeof this._cleanup === "function") this._cleanup();
    this._cleanup = void 0;
  }
};
function signal(initial) {
  return new Signal(initial);
}
function derived(fn) {
  return new DerivedSignal(fn);
}
function effect(fn) {
  const e = new Effect(fn);
  return () => e.dispose();
}
function batch(fn) {
  _batchDepth++;
  try {
    fn();
  } finally {
    _batchDepth--;
    if (_batchDepth === 0) {
      _drainBatch();
    }
  }
}
function isBatching() {
  return _batchDepth > 0;
}
function signalKind(source) {
  return source instanceof DerivedSignal ? "derived" : "writable";
}
function observerCount(source) {
  const maybe = source;
  return typeof maybe._observerCount === "function" ? maybe._observerCount() : void 0;
}

// src/store.ts
var Store = class {
  _signals;
  constructor(initial) {
    const signals = {};
    for (const key in initial) {
      if (Object.prototype.hasOwnProperty.call(initial, key)) {
        signals[key] = signal(initial[key]);
      }
    }
    this._signals = signals;
  }
  get(key) {
    const s = this._signals[key];
    if (s === void 0) {
      throw new Error(`Store: unknown key "${String(key)}"`);
    }
    return s.get();
  }
  set(key, value) {
    const s = this._signals[key];
    if (s === void 0) {
      throw new Error(`Store: unknown key "${String(key)}"`);
    }
    s.set(value);
  }
  signal(key) {
    const s = this._signals[key];
    if (s === void 0) {
      throw new Error(`Store: unknown key "${String(key)}"`);
    }
    return s;
  }
  subscribe(key, fn) {
    return this.signal(key).subscribe(fn);
  }
  getSnapshot() {
    const snap = {};
    for (const key in this._signals) {
      if (Object.prototype.hasOwnProperty.call(this._signals, key)) {
        snap[key] = this._signals[key]?.peek();
      }
    }
    return snap;
  }
};
function createStore(initial) {
  return new Store(initial);
}

// src/resource.ts
function isAbortError(err) {
  return err instanceof Error && err.name === "AbortError" || typeof DOMException !== "undefined" && err instanceof DOMException && err.name === "AbortError";
}
function resource(loader, options = {}) {
  const hasInitial = options.initialData !== void 0 || options.initialError !== void 0 || options.initialStatus !== void 0;
  const seededStatus = options.initialStatus ?? (options.initialData !== void 0 ? "success" : options.initialError !== void 0 ? "error" : "idle");
  const status = signal(seededStatus);
  const data = signal(options.initialData);
  const error = signal(options.initialError);
  const loading = derived(() => status.get() === "loading");
  const isRefetching = derived(() => status.get() === "loading" && data.get() !== void 0);
  let disposed = false;
  let runId = 0;
  let controller = null;
  const load = async () => {
    if (disposed) return;
    controller?.abort();
    const myRun = ++runId;
    const myController = new AbortController();
    controller = myController;
    batch(() => {
      error.set(void 0);
      status.set("loading");
    });
    try {
      const result = await loader({ signal: myController.signal });
      if (disposed || myRun !== runId) return;
      batch(() => {
        data.set(result);
        error.set(void 0);
        status.set("success");
      });
    } catch (err) {
      if (disposed || myRun !== runId) return;
      if (isAbortError(err)) return;
      batch(() => {
        error.set(err);
        status.set("error");
      });
    }
  };
  const refetch = () => load();
  const watchUnsubs = [];
  if (options.watch !== void 0) {
    for (const dep of options.watch) {
      watchUnsubs.push(
        dep.subscribe(() => {
          if (!disposed) void load();
        })
      );
    }
  }
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    controller?.abort();
    controller = null;
    for (const unsub of watchUnsubs) unsub();
    watchUnsubs.length = 0;
  };
  if (options.onCleanup !== void 0) {
    options.onCleanup(dispose);
  }
  if (options.immediate === true || options.immediate !== false && !hasInitial) {
    void load();
  }
  return {
    status,
    data,
    error,
    loading,
    isRefetching,
    refetch,
    dispose
  };
}
export {
  DerivedSignal,
  Signal,
  Store,
  batch,
  createStore,
  derived,
  effect,
  isBatching,
  observerCount,
  resource,
  signal,
  signalKind
};
//# sourceMappingURL=index.js.map