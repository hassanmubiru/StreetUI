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
export {
  DerivedSignal,
  Signal,
  Store,
  batch,
  createStore,
  derived,
  effect,
  isBatching,
  signal
};
//# sourceMappingURL=index.js.map