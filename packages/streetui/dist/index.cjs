"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var src_exports = {};
__export(src_exports, {
  AppBuilder: () => AppBuilder,
  Application: () => Application,
  ApplicationGraph: () => ApplicationGraph,
  BaseNode: () => BaseNode,
  BrowserDOMAdapter: () => BrowserDOMAdapter,
  CleanupRegistry: () => CleanupRegistry,
  ContainerBuilderImpl: () => ContainerBuilderImpl,
  DEFAULT_PERF_THRESHOLDS: () => DEFAULT_PERF_THRESHOLDS,
  DerivedSignal: () => DerivedSignal,
  DiagnosticCollector: () => DiagnosticCollector,
  DiagnosticError: () => DiagnosticError,
  DomEventRegistry: () => DomEventRegistry,
  Environment: () => Environment,
  EventBus: () => EventBus,
  FOCUSABLE_SELECTOR: () => FOCUSABLE_SELECTOR,
  FormBuilderImpl: () => FormBuilderImpl,
  GraphNode: () => GraphNode,
  Lifecycle: () => Lifecycle,
  ListBuilderImpl: () => ListBuilderImpl,
  NodeInstance: () => NodeInstance,
  PageBuilderImpl: () => PageBuilderImpl,
  ROUTER_OUTLET_ID: () => ROUTER_OUTLET_ID,
  Runtime: () => Runtime,
  RuntimeNodeInstance: () => RuntimeNodeInstance,
  STATE_MARKER_ATTR: () => STATE_MARKER_ATTR,
  Scheduler: () => Scheduler,
  SectionBuilderImpl: () => SectionBuilderImpl,
  ServerComment: () => ServerComment,
  ServerDOMAdapter: () => ServerDOMAdapter,
  ServerElement: () => ServerElement,
  ServerFragment: () => ServerFragment,
  ServerStyle: () => ServerStyle,
  ServerText: () => ServerText,
  Signal: () => Signal,
  Store: () => Store,
  StreetApp: () => StreetApp,
  StreetFrameworkError: () => StreetFrameworkError,
  StreetRenderHandle: () => StreetRenderHandle,
  StreetRendererImpl: () => StreetRendererImpl,
  VERSION: () => VERSION,
  a11yIds: () => a11yIds,
  applyNodeProps: () => applyNodeProps,
  applyProp: () => applyProp,
  batch: () => batch,
  bindDomEvent: () => bindDomEvent,
  browserDOMAdapter: () => browserDOMAdapter,
  buttonUpdate: () => buttonUpdate,
  compile: () => compile,
  compileGraph: () => compileGraph,
  consoleDiagnosticSink: () => consoleDiagnosticSink,
  consoleHydrationDiagnosticSink: () => consoleHydrationDiagnosticSink,
  createApplication: () => createApplication,
  createBrowserHistory: () => createBrowserHistory,
  createContext: () => createContext,
  createDevTools: () => createDevTools,
  createForm: () => createForm,
  createHydrationDiagnosticCollector: () => createHydrationDiagnosticCollector,
  createI18n: () => createI18n,
  createMemoryHistory: () => createMemoryHistory,
  createNodeId: () => createNodeId,
  createRenderContext: () => createRenderContext,
  createRenderer: () => createRenderer,
  createRouter: () => createRouter,
  createRuntime: () => createRuntime,
  createStore: () => createStore,
  createStreetEvent: () => createStreetEvent,
  defineConfig: () => defineConfig,
  derived: () => derived,
  diagnosePerformance: () => diagnosePerformance,
  effect: () => effect,
  email: () => email,
  environment: () => environment,
  escapeHtmlAttr: () => escapeHtmlAttr,
  escapeHtmlText: () => escapeHtmlText,
  flushSync: () => flushSync,
  focusById: () => focusById,
  focusFirst: () => focusFirst,
  formatDiagnostic: () => formatDiagnostic,
  formatDiagnosticContext: () => formatDiagnosticContext,
  formatHydrationDiagnostic: () => formatHydrationDiagnostic,
  frameworkError: () => frameworkError,
  generateApplicationId: () => generateApplicationId,
  generateNodeId: () => generateNodeId,
  globalEventBus: () => globalEventBus,
  headingUpdate: () => headingUpdate,
  hydrateGraph: () => hydrateGraph,
  inputUpdate: () => inputUpdate,
  inspectApplication: () => inspectApplication,
  inspectContext: () => inspectContext,
  inspectForm: () => inspectForm,
  inspectGraph: () => inspectGraph,
  inspectI18n: () => inspectI18n,
  inspectResource: () => inspectResource,
  inspectRouter: () => inspectRouter,
  inspectSignal: () => inspectSignal,
  interpolate: () => interpolate,
  isBatching: () => isBatching,
  matchPattern: () => matchPattern,
  matchRoutes: () => matchRoutes,
  maxLength: () => maxLength,
  minLength: () => minLength,
  mountGraph: () => mountGraph,
  mountNode: () => mountNode,
  mountRouter: () => mountRouter,
  nextId: () => nextId,
  nodeIdPrefix: () => nodeIdPrefix,
  nodeTypeStats: () => nodeTypeStats,
  normalizePath: () => normalizePath,
  observerCount: () => observerCount,
  patchNode: () => patchNode,
  patchProp: () => patchProp,
  pattern: () => pattern,
  printDiagnostics: () => printDiagnostics,
  printGraph: () => printGraph,
  reactiveListItemKey: () => reactiveListItemKey,
  reactiveListItemSignature: () => reactiveListItemSignature,
  readState: () => readState,
  reconcileChildren: () => reconcileChildren,
  reconcileChildrenByPlan: () => reconcileChildrenByPlan,
  renderToString: () => renderToString,
  reportDiagnostic: () => reportDiagnostic,
  required: () => required,
  resetIdCounter: () => resetIdCounter,
  resolveTag: () => resolveTag,
  resource: () => resource,
  routerOutlet: () => routerOutlet,
  runValidators: () => runValidators,
  scheduleImmediate: () => scheduleImmediate,
  scheduleUpdate: () => scheduleUpdate,
  scheduler: () => scheduler,
  serializeChildren: () => serializeChildren,
  serializeServerNode: () => serializeServerNode,
  serializeState: () => serializeState,
  serverDOMAdapter: () => serverDOMAdapter,
  signal: () => signal,
  signalKind: () => signalKind,
  splitTarget: () => splitTarget,
  streetui: () => streetui,
  textUpdate: () => textUpdate,
  toIdToken: () => toIdToken,
  transformGraph: () => transformGraph,
  validateGraph: () => validateGraph,
  wireEvents: () => wireEvents,
  wireReactiveList: () => wireReactiveList,
  wireSignalBindings: () => wireSignalBindings
});
module.exports = __toCommonJS(src_exports);

// src/version.ts
var VERSION = "1.5.0";

// ../state/src/signal.ts
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

// ../state/src/store.ts
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

// ../state/src/resource.ts
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

// ../core/src/a11y-ids.ts
var UNSAFE = /[^A-Za-z0-9_-]+/g;
function toIdToken(base) {
  const token = base.trim().replace(UNSAFE, "-").replace(/^-+|-+$/g, "");
  return token.length > 0 ? token : "field";
}
function a11yIds(base) {
  const token = toIdToken(base);
  return {
    base: token,
    input: `${token}-input`,
    label: `${token}-label`,
    description: `${token}-description`,
    error: `${token}-error`,
    title: `${token}-title`,
    id: (suffix) => `${token}-${toIdToken(suffix)}`
  };
}

// ../core/src/identity.ts
var _counter = 0;
function nextId() {
  return ++_counter;
}
function resetIdCounter() {
  _counter = 0;
}
function createNodeId(value) {
  return value;
}
function generateNodeId(prefix = "node") {
  return createNodeId(`${prefix}:${nextId()}`);
}
function nodeIdPrefix(id) {
  const colon = id.indexOf(":");
  return colon === -1 ? id : id.slice(0, colon);
}
function generateApplicationId(name) {
  return `app:${name}:${nextId()}`;
}

// ../core/src/lifecycle.ts
var Lifecycle = class {
  _phase = "created";
  _hooks = /* @__PURE__ */ new Map();
  get phase() {
    return this._phase;
  }
  get isMounted() {
    return this._phase === "mounted" || this._phase === "active" || this._phase === "updating";
  }
  get isDestroyed() {
    return this._phase === "destroyed";
  }
  on(phase, hook) {
    const hooks = this._hooks.get(phase) ?? [];
    hooks.push(hook);
    this._hooks.set(phase, hooks);
    return () => {
      const current = this._hooks.get(phase);
      if (current !== void 0) {
        const idx = current.indexOf(hook);
        if (idx !== -1) current.splice(idx, 1);
      }
    };
  }
  async transition(to) {
    this._phase = to;
    const hooks = this._hooks.get(to) ?? [];
    for (const hook of hooks) {
      await hook();
    }
  }
  onMount(hook) {
    return this.on("mounted", hook);
  }
  onUnmount(hook) {
    return this.on("unmounting", hook);
  }
  onDestroy(hook) {
    return this.on("destroyed", hook);
  }
};
var CleanupRegistry = class {
  _fns = [];
  add(fn) {
    this._fns.push(fn);
  }
  run() {
    for (const fn of this._fns) {
      try {
        fn();
      } catch {
      }
    }
    this._fns.length = 0;
  }
};

// ../core/src/environment.ts
function detectEnvironment() {
  try {
    if (typeof process !== "undefined" && process !== null && typeof process === "object" && (process.env?.["NODE_ENV"] === "test" || process.env?.["VITEST"] === "true")) {
      return "test";
    }
  } catch {
  }
  if (typeof window !== "undefined" && typeof document !== "undefined") {
    return "browser";
  }
  if (typeof self !== "undefined" && typeof self["importScripts"] === "function") {
    return "worker";
  }
  try {
    if (typeof process !== "undefined" && typeof process === "object") {
      return "server";
    }
  } catch {
  }
  return "unknown";
}
function detectCapabilities() {
  return {
    hasDom: typeof document !== "undefined",
    hasWindow: typeof window !== "undefined",
    hasDocument: typeof document !== "undefined",
    isSecureContext: typeof window !== "undefined" ? window["isSecureContext"] === true : false
  };
}
var Environment = class {
  kind;
  capabilities;
  constructor(kind) {
    this.kind = kind ?? detectEnvironment();
    this.capabilities = detectCapabilities();
  }
  get isBrowser() {
    return this.kind === "browser";
  }
  get isServer() {
    return this.kind === "server";
  }
  get isTest() {
    return this.kind === "test";
  }
  get isWorker() {
    return this.kind === "worker";
  }
};
var environment = new Environment();

// ../core/src/diagnostics.ts
var DiagnosticError = class extends Error {
  diagnostics;
  constructor(diagnostics) {
    const summary = diagnostics.filter((d) => d.severity === "error").map((d) => `[${d.code}] ${d.message}`).join("\n");
    super(`StreetUI diagnostics:
${summary}`);
    this.name = "DiagnosticError";
    this.diagnostics = diagnostics;
  }
};
var DiagnosticCollector = class {
  _diagnostics = [];
  get diagnostics() {
    return this._diagnostics;
  }
  get hasErrors() {
    return this._diagnostics.some((d) => d.severity === "error");
  }
  get hasWarnings() {
    return this._diagnostics.some((d) => d.severity === "warning");
  }
  error(code, message, location, cause) {
    this._diagnostics.push({ severity: "error", code, message, location: location ?? void 0, cause: cause ?? void 0 });
  }
  warn(code, message, location) {
    this._diagnostics.push({ severity: "warning", code, message, location: location ?? void 0, cause: void 0 });
  }
  info(code, message, location) {
    this._diagnostics.push({ severity: "info", code, message, location: location ?? void 0, cause: void 0 });
  }
  merge(other) {
    for (const d of other.diagnostics) {
      this._diagnostics.push(d);
    }
  }
  throwIfErrors() {
    if (this.hasErrors) {
      throw new DiagnosticError(this._diagnostics);
    }
  }
  clear() {
    this._diagnostics.length = 0;
  }
};
function formatDiagnostic(d) {
  const loc = d.location !== void 0 ? ` (${[d.location.file, d.location.line, d.location.column].filter(Boolean).join(":")})` : "";
  return `[${d.severity.toUpperCase()}] ${d.code}: ${d.message}${loc}`;
}

// ../core/src/application.ts
var Application = class {
  id;
  name;
  version;
  lifecycle;
  cleanup;
  diagnostics;
  environment;
  constructor(options) {
    this.name = options.name;
    this.version = options.version ?? "0.0.1";
    this.id = generateApplicationId(options.name);
    this.lifecycle = new Lifecycle();
    this.cleanup = new CleanupRegistry();
    this.diagnostics = new DiagnosticCollector();
    this.environment = options.environment ?? environment;
  }
  async mount() {
    if (this.lifecycle.phase !== "created") {
      throw new Error(`Application "${this.name}" is already mounted (phase: ${this.lifecycle.phase})`);
    }
    await this.lifecycle.transition("mounted");
    await this.lifecycle.transition("active");
  }
  async unmount() {
    if (!this.lifecycle.isMounted) {
      return;
    }
    await this.lifecycle.transition("unmounting");
    this.cleanup.run();
    await this.lifecycle.transition("destroyed");
  }
  onMount(fn) {
    this.lifecycle.onMount(fn);
  }
  onUnmount(fn) {
    this.lifecycle.onUnmount(fn);
  }
};
function createApplication(options) {
  return new Application(options);
}

// ../core/src/node.ts
var BaseNode = class {
  id;
  type;
  metadata;
  constructor(type, id) {
    this.type = type;
    this.id = id ?? generateNodeId(type);
    this.metadata = { createdAt: Date.now() };
  }
};

// ../core/src/observability.ts
function formatDiagnosticContext(context) {
  if (context === void 0) return "";
  const parts = [];
  if (context.package !== void 0) parts.push(`package=${context.package}`);
  if (context.operation !== void 0) parts.push(`operation=${context.operation}`);
  if (context.nodeId !== void 0) parts.push(`node=${context.nodeId}`);
  if (context.route !== void 0) parts.push(`route=${context.route}`);
  if (context.resource !== void 0) parts.push(`resource=${context.resource}`);
  return parts.length > 0 ? ` [${parts.join(", ")}]` : "";
}
var StreetFrameworkError = class extends Error {
  context;
  constructor(message, context) {
    super(`${message}${formatDiagnosticContext(context)}`);
    this.name = "StreetFrameworkError";
    this.context = context ?? void 0;
  }
};
function frameworkError(message, context) {
  return new StreetFrameworkError(message, context);
}
function reportDiagnostic(sink, level, message, context) {
  if (sink === void 0) return;
  const fn = sink[level];
  if (typeof fn !== "function") return;
  try {
    fn.call(sink, message, context);
  } catch {
  }
}
function consoleDiagnosticSink(logger = console) {
  return {
    debug: (m, c) => logger.debug?.(`${m}${formatDiagnosticContext(c)}`),
    info: (m, c) => logger.info?.(`${m}${formatDiagnosticContext(c)}`),
    warn: (m, c) => logger.warn?.(`${m}${formatDiagnosticContext(c)}`),
    error: (m, c) => logger.error?.(`${m}${formatDiagnosticContext(c)}`)
  };
}

// ../graph/src/graph-node.ts
var GraphNode = class _GraphNode {
  id;
  type;
  key;
  props;
  events;
  stateRefs;
  children;
  parent;
  constructor(type, options = {}) {
    this.type = type;
    this.id = options.id ?? generateNodeId(type);
    this.key = options.key;
    this.props = options.props ?? {};
    this.events = options.events ?? [];
    this.stateRefs = options.stateRefs ?? [];
    this.children = [];
    this.parent = null;
  }
  // ── Child management ────────────────────────────────────────────────────────
  appendChild(child) {
    if (child.parent !== null) {
      child.parent.removeChild(child);
    }
    child.parent = this;
    this.children.push(child);
  }
  insertBefore(child, reference) {
    const idx = this.children.indexOf(reference);
    if (idx === -1) {
      this.appendChild(child);
      return;
    }
    if (child.parent !== null) {
      child.parent.removeChild(child);
    }
    child.parent = this;
    this.children.splice(idx, 0, child);
  }
  removeChild(child) {
    const idx = this.children.indexOf(child);
    if (idx === -1) return;
    this.children.splice(idx, 1);
    child.parent = null;
  }
  replaceChild(newChild, oldChild) {
    const idx = this.children.indexOf(oldChild);
    if (idx === -1) {
      throw new Error(`GraphNode.replaceChild: oldChild is not a child of this node`);
    }
    if (newChild.parent !== null) {
      newChild.parent.removeChild(newChild);
    }
    oldChild.parent = null;
    newChild.parent = this;
    this.children.splice(idx, 1, newChild);
  }
  // ── Prop helpers ────────────────────────────────────────────────────────────
  setProp(key, value) {
    this.props = { ...this.props, [key]: value };
  }
  getProp(key) {
    return this.props[key];
  }
  // ── Event helpers ───────────────────────────────────────────────────────────
  addEvent(descriptor) {
    this.events.push(descriptor);
  }
  removeEvent(type) {
    this.events = this.events.filter((e) => e.type !== type);
  }
  // ── Queries ─────────────────────────────────────────────────────────────────
  get isLeaf() {
    return this.children.length === 0;
  }
  get depth() {
    let d = 0;
    let node = this.parent;
    while (node !== null) {
      d++;
      node = node.parent;
    }
    return d;
  }
  get root() {
    let node = this;
    while (node.parent !== null) {
      node = node.parent;
    }
    return node;
  }
  /** Shallow clone — does not clone children. */
  shallowClone() {
    const opts = {
      props: { ...this.props },
      events: [...this.events],
      stateRefs: [...this.stateRefs]
    };
    if (this.key !== void 0) opts.key = this.key;
    return new _GraphNode(this.type, opts);
  }
};

// ../graph/src/graph.ts
var ApplicationGraph = class {
  root;
  name;
  version;
  _nodeIndex = /* @__PURE__ */ new Map();
  /** Handler registry — maps handlerKey → actual function */
  handlers = /* @__PURE__ */ new Map();
  constructor(options) {
    this.name = options.name;
    this.version = options.version ?? "0.0.1";
    this.root = new GraphNode("application", { props: { name: options.name } });
    this._nodeIndex.set(this.root.id, this.root);
  }
  // ── Node creation & attachment ────────────────────────────────────────────
  createNode(type, options = {}) {
    const nodeOpts = {};
    if (options.key !== void 0) nodeOpts.key = options.key;
    if (options.props !== void 0) nodeOpts.props = options.props;
    const node = new GraphNode(type, nodeOpts);
    this._nodeIndex.set(node.id, node);
    if (options.parent !== void 0) {
      options.parent.appendChild(node);
    }
    return node;
  }
  attachNode(node, parent) {
    this._nodeIndex.set(node.id, node);
    parent.appendChild(node);
  }
  detachNode(node) {
    if (node.parent !== null) {
      node.parent.removeChild(node);
    }
    this._removeFromIndex(node);
  }
  _removeFromIndex(node) {
    this._nodeIndex.delete(node.id);
    this._unregisterNodeHandlers(node);
    for (const child of node.children) {
      this._removeFromIndex(child);
    }
  }
  /**
   * Remove every handler-registry entry owned by a single node. A node owns:
   *  - one entry per event descriptor (its `handlerKey`),
   *  - one `__signal__<signalId>` entry per state ref (signalIds are namespaced
   *    by node id, so they are never shared between nodes), and
   *  - a `__listbuild__<id>` entry if it is a reactive-list.
   * Called for every node in a detached subtree so removing list items (or
   * discarding freshly-built-but-unadopted item subtrees) leaves no stale
   * registrations behind.
   */
  _unregisterNodeHandlers(node) {
    for (const event of node.events) {
      this.handlers.delete(event.handlerKey);
    }
    for (const ref of node.stateRefs) {
      this.handlers.delete(`__signal__${ref.signalId}`);
    }
    this.handlers.delete(`__listbuild__${node.id}`);
    this.handlers.delete(`__listplan__${node.id}`);
  }
  // ── Handler registry ──────────────────────────────────────────────────────
  registerHandler(key, fn) {
    this.handlers.set(key, fn);
  }
  getHandler(key) {
    return this.handlers.get(key);
  }
  /** True if a handler is currently registered under `key`. Inspection helper. */
  hasHandler(key) {
    return this.handlers.has(key);
  }
  /** Number of currently-registered handlers. Inspection helper. */
  get handlerCount() {
    return this.handlers.size;
  }
  // ── Lookup ────────────────────────────────────────────────────────────────
  findById(id) {
    return this._nodeIndex.get(id);
  }
  findAll(predicate) {
    const results = [];
    this._walk(this.root, (node) => {
      if (predicate(node)) results.push(node);
    });
    return results;
  }
  findByType(type) {
    return this.findAll((n) => n.type === type);
  }
  // ── Traversal ─────────────────────────────────────────────────────────────
  walk(visitor) {
    this._walk(this.root, visitor, 0);
  }
  _walk(node, visitor, depth = 0) {
    visitor(node, depth);
    for (const child of node.children) {
      this._walk(child, visitor, depth + 1);
    }
  }
  get nodeCount() {
    return this._nodeIndex.size;
  }
  // ── Validation ────────────────────────────────────────────────────────────
  validate() {
    const dc = new DiagnosticCollector();
    this.walk((node) => {
      for (const event of node.events) {
        if (!this.handlers.has(event.handlerKey)) {
          dc.warn(
            "GRAPH_MISSING_HANDLER",
            `Node "${node.id}" references handler "${event.handlerKey}" which is not registered`,
            { nodeId: node.id }
          );
        }
      }
      if (node.type === "page" && node.parent?.type !== "application") {
        dc.error(
          "GRAPH_PAGE_DEPTH",
          `Page node "${node.id}" must be a direct child of the application root`,
          { nodeId: node.id }
        );
      }
    });
    return dc;
  }
  // ── Serialization ─────────────────────────────────────────────────────────
  serialize() {
    return {
      name: this.name,
      version: this.version,
      root: this._serializeNode(this.root)
    };
  }
  _serializeNode(node) {
    const result = {
      id: node.id,
      type: node.type,
      key: node.key,
      props: node.props,
      events: node.events,
      stateRefs: node.stateRefs,
      children: node.children.map((c) => this._serializeNode(c))
    };
    return result;
  }
};

// ../dsl/src/builders.ts
function isSignal(v) {
  return v !== null && typeof v === "object" && typeof v["get"] === "function" && typeof v["subscribe"] === "function";
}
function bindValue(graph, node, propKey, value) {
  if (isSignal(value)) {
    const signalId = `${node.id}:${propKey}`;
    node.stateRefs.push({ signalId, propKey });
    graph.registerHandler(`__signal__${signalId}`, value);
    return value.peek();
  }
  return value;
}
function applyA11yProps(props, options) {
  if (options.role !== void 0) props["role"] = options.role;
  if (options.tabIndex !== void 0) props["tabindex"] = String(options.tabIndex);
  if (options.ariaLabel !== void 0) props["aria-label"] = options.ariaLabel;
  if (options.ariaLabelledBy !== void 0) props["aria-labelledby"] = options.ariaLabelledBy;
  if (options.ariaDescribedBy !== void 0) props["aria-describedby"] = options.ariaDescribedBy;
  if (options.ariaExpanded !== void 0) props["aria-expanded"] = String(options.ariaExpanded);
  if (options.ariaControls !== void 0) props["aria-controls"] = options.ariaControls;
  if (options.ariaHidden !== void 0) props["aria-hidden"] = String(options.ariaHidden);
  if (options.ariaLive !== void 0) props["aria-live"] = options.ariaLive;
  if (options.ariaCurrent !== void 0) props["aria-current"] = String(options.ariaCurrent);
  if (options.ariaInvalid !== void 0) props["aria-invalid"] = String(options.ariaInvalid);
  if (options.ariaRequired !== void 0) props["aria-required"] = String(options.ariaRequired);
}
function containerProps(options) {
  const props = {};
  if (options.class !== void 0) props["class"] = options.class;
  if (options.id !== void 0) props["id"] = options.id;
  if (options.key !== void 0) props["key"] = options.key;
  applyA11yProps(props, options);
  return props;
}
function itemIdentity(item, index) {
  if (item !== null && typeof item === "object") {
    const obj = item;
    if ("id" in obj) return `id:${String(obj["id"])}`;
    if ("key" in obj) return `key:${String(obj["key"])}`;
    return `idx:${index}`;
  }
  return `val:${String(item)}`;
}
function itemValueSignature(item) {
  try {
    return JSON.stringify(item) ?? String(item);
  } catch {
    return String(item);
  }
}
function reactiveListItemSignature(item) {
  return itemValueSignature(item);
}
function reactiveListItemKey(item, index) {
  return itemIdentity(item, index);
}
var ContentBuilderBase = class {
  constructor(_node, _graph) {
    this._node = _node;
    this._graph = _graph;
  }
  heading(text, options = {}) {
    const props = { level: options.level ?? 1 };
    if (options.class !== void 0) props["class"] = options.class;
    if (options.id !== void 0) props["id"] = options.id;
    applyA11yProps(props, options);
    const node = this._graph.createNode("heading", { parent: this._node, props });
    const resolved = bindValue(this._graph, node, "text", text);
    node.setProp("text", resolved);
  }
  text(content, options = {}) {
    const props = {};
    if (options.class !== void 0) props["class"] = options.class;
    if (options.id !== void 0) props["id"] = options.id;
    applyA11yProps(props, options);
    const node = this._graph.createNode("text", { parent: this._node, props });
    const resolved = bindValue(this._graph, node, "text", content);
    node.setProp("text", resolved);
  }
  button(label, options = {}) {
    const props = {};
    if (options.class !== void 0) props["class"] = options.class;
    if (options.id !== void 0) props["id"] = options.id;
    applyA11yProps(props, options);
    const node = this._graph.createNode("button", { parent: this._node, props });
    const resolved = bindValue(this._graph, node, "label", label);
    node.setProp("label", resolved);
    if (options.disabled !== void 0) {
      const resolvedDisabled = bindValue(this._graph, node, "disabled", options.disabled);
      node.setProp("disabled", resolvedDisabled);
    }
    if (options.onClick !== void 0) {
      const handlerKey = `click:${node.id}`;
      this._graph.registerHandler(handlerKey, options.onClick);
      node.addEvent({ type: "click", handlerKey });
    }
  }
  input(options = {}) {
    const props = {};
    props["inputType"] = options.type ?? "text";
    if (options.placeholder !== void 0) props["placeholder"] = options.placeholder;
    if (options.class !== void 0) props["class"] = options.class;
    if (options.id !== void 0) props["id"] = options.id;
    applyA11yProps(props, options);
    const nodeOpts = {
      props,
      parent: this._node
    };
    if (options.id !== void 0) nodeOpts.key = options.id;
    const node = this._graph.createNode("input", nodeOpts);
    const bindSignal = options.bind;
    const valueBindable = bindSignal !== void 0 ? bindSignal : options.value;
    const inputHandler = bindSignal !== void 0 ? (v) => bindSignal.set(v) : options.onInput;
    if (valueBindable !== void 0) {
      const resolved = bindValue(this._graph, node, "value", valueBindable);
      node.setProp("value", resolved);
    }
    if (options.disabled !== void 0) {
      const resolved = bindValue(this._graph, node, "disabled", options.disabled);
      node.setProp("disabled", resolved);
    }
    if (inputHandler !== void 0) {
      const handlerKey = `input:${node.id}`;
      this._graph.registerHandler(handlerKey, inputHandler);
      node.addEvent({ type: "input", handlerKey });
    }
    if (options.onChange !== void 0) {
      const handlerKey = `change:${node.id}`;
      this._graph.registerHandler(handlerKey, options.onChange);
      node.addEvent({ type: "change", handlerKey });
    }
  }
  image(options) {
    const props = {
      src: options.src,
      alt: options.alt
    };
    if (options.width !== void 0) props["width"] = options.width;
    if (options.height !== void 0) props["height"] = options.height;
    if (options.class !== void 0) props["class"] = options.class;
    if (options.id !== void 0) props["id"] = options.id;
    applyA11yProps(props, options);
    const nodeOpts = {
      props,
      parent: this._node
    };
    if (options.id !== void 0) nodeOpts.key = options.id;
    this._graph.createNode("image", nodeOpts);
  }
  link(label, options) {
    const props = {
      href: options.href,
      external: options.external ?? false
    };
    if (options.class !== void 0) props["class"] = options.class;
    if (options.id !== void 0) props["id"] = options.id;
    applyA11yProps(props, options);
    const node = this._graph.createNode("link", { parent: this._node, props });
    const resolved = bindValue(this._graph, node, "label", label);
    node.setProp("label", resolved);
    if (options.onClick !== void 0) {
      const handlerKey = `click:${node.id}`;
      this._graph.registerHandler(handlerKey, options.onClick);
      node.addEvent({ type: "click", handlerKey });
    }
  }
};
var ContainerBuilderBase = class extends ContentBuilderBase {
  section(key, builder, options = {}) {
    const node = this._graph.createNode("section", {
      key,
      parent: this._node,
      props: containerProps(options)
    });
    builder(new SectionBuilderImpl(node, this._graph));
  }
  container(key, builder, options = {}) {
    const node = this._graph.createNode("container", {
      key,
      parent: this._node,
      props: containerProps(options)
    });
    builder(new ContainerBuilderImpl(node, this._graph));
  }
  list(key, builder, options = {}) {
    const node = this._graph.createNode("list", {
      key,
      parent: this._node,
      props: containerProps(options)
    });
    builder(new ListBuilderImpl(node, this._graph));
  }
  listOf(key, items, renderItem, options = {}) {
    const graph = this._graph;
    const node = graph.createNode("reactive-list", {
      key,
      parent: this._node,
      props: containerProps(options)
    });
    const signalId = `${node.id}:items`;
    node.stateRefs.push({ signalId, propKey: "items" });
    graph.registerHandler(`__signal__${signalId}`, items);
    const buildItem = (item, index) => {
      const itemKey = reactiveListItemKey(item, index);
      const itemNode = graph.createNode("list-item", {
        key: itemKey,
        // `_item` records the source item *reference* so the reconciler can
        // short-circuit unchanged rows by identity (no signature hashing); `_sig`
        // is the content signature used to detect an in-place data change when the
        // reference differs. Both are internal metadata (leading `_`) and never
        // reach the DOM.
        props: {
          key: itemKey,
          _sig: reactiveListItemSignature(item),
          // The item reference is stored as opaque internal metadata (never
          // rendered); cast through `unknown` since `T` is not a `PropValue`.
          _item: item
        }
      });
      renderItem(item, index, new ContainerBuilderImpl(itemNode, graph));
      return itemNode;
    };
    const buildPlan = (raw) => {
      const arr = Array.isArray(raw) ? raw : [];
      const plan = new Array(arr.length);
      for (let i = 0; i < arr.length; i++) {
        const item = arr[i];
        const index = i;
        plan[i] = {
          key: reactiveListItemKey(item, index),
          item,
          sig: () => reactiveListItemSignature(item),
          build: () => buildItem(item, index)
        };
      }
      return plan;
    };
    graph.registerHandler(`__listplan__${node.id}`, buildPlan);
    const current = isSignal(items) ? items.peek() : items;
    const initial = Array.isArray(current) ? current : [];
    initial.forEach((item, i) => {
      node.appendChild(buildItem(item, i));
    });
  }
  form(key, builder, options = {}) {
    const props = containerProps(options);
    const node = this._graph.createNode("form", {
      key,
      parent: this._node,
      props
    });
    if (options.onSubmit !== void 0) {
      const handlerKey = `submit:${node.id}`;
      this._graph.registerHandler(handlerKey, options.onSubmit);
      node.addEvent({ type: "submit", handlerKey });
    }
    builder(new FormBuilderImpl(node, this._graph));
  }
  when(condition, builder, elseBuilder) {
    const graph = this._graph;
    const node = graph.createNode("conditional", {
      parent: this._node,
      props: containerProps({})
    });
    const buildBranch = (build, tag) => {
      const branchKey = `when-${tag}:${node.id}`;
      const branch = graph.createNode("container", {
        key: branchKey,
        props: { key: branchKey }
      });
      build(new ContainerBuilderImpl(branch, graph));
      return branch;
    };
    const buildAll = (raw) => {
      if (raw) return [buildBranch(builder, "then")];
      return elseBuilder !== void 0 ? [buildBranch(elseBuilder, "else")] : [];
    };
    if (isSignal(condition)) {
      const signalId = `${node.id}:items`;
      node.stateRefs.push({ signalId, propKey: "items" });
      graph.registerHandler(`__signal__${signalId}`, condition);
      graph.registerHandler(`__listbuild__${node.id}`, buildAll);
      const current = condition.peek();
      for (const child of buildAll(current)) node.appendChild(child);
    } else {
      for (const child of buildAll(condition)) node.appendChild(child);
    }
  }
  errorBoundary(id, builder, options) {
    const sources = options.source === void 0 ? [] : Array.isArray(options.source) ? [...options.source] : [options.source];
    const localError = signal(void 0);
    const retryNonce = signal(0);
    const readError = () => {
      const local = localError.peek();
      if (local !== void 0 && local !== null) return local;
      for (const s of sources) {
        const e = s.peek();
        if (e !== void 0 && e !== null) return e;
      }
      return void 0;
    };
    const hasError = derived(() => {
      retryNonce.get();
      localError.get();
      for (const s of sources) s.get();
      return readError() !== void 0;
    });
    const retry = () => {
      localError.set(void 0);
      options.onRetry?.();
      retryNonce.update((n) => n + 1);
    };
    this.container(id, (c) => {
      c.when(
        hasError,
        // Error state → fallback.
        (fb) => options.fallback(fb, readError(), retry),
        // Healthy state → body, guarded against synchronous build throws.
        (body) => {
          try {
            builder(body);
          } catch (err) {
            queueMicrotask(() => localError.set(err));
          }
        }
      );
    }, { id });
  }
};
var SectionBuilderImpl = class extends ContainerBuilderBase {
};
var ContainerBuilderImpl = class extends ContainerBuilderBase {
};
var FormBuilderImpl = class extends ContainerBuilderBase {
};
var ListBuilderImpl = class extends ContentBuilderBase {
  item(key, builder, options = {}) {
    const node = this._graph.createNode("list-item", {
      key,
      parent: this._node,
      props: containerProps(options)
    });
    builder(new ContainerBuilderImpl(node, this._graph));
  }
};
var PageBuilderImpl = class extends ContainerBuilderBase {
};
var AppBuilder = class {
  constructor(_graph) {
    this._graph = _graph;
  }
  page(key, builder) {
    const node = this._graph.createNode("page", {
      key,
      parent: this._graph.root,
      props: { key }
    });
    builder(new PageBuilderImpl(node, this._graph));
  }
};

// ../dsl/src/dsl.ts
var StreetApp = class {
  _graph;
  _builder;
  constructor(options) {
    const graphOpts = { name: options.name };
    if (options.version !== void 0) graphOpts.version = options.version;
    this._graph = new ApplicationGraph(graphOpts);
    this._builder = new AppBuilder(this._graph);
  }
  page(key, builder) {
    this._builder.page(key, builder);
    return this;
  }
  /** Compile to ApplicationGraph — validates and returns the graph. */
  build() {
    const dc = this._graph.validate();
    dc.throwIfErrors();
    return this._graph;
  }
  /** Access graph before building (useful for inspection). */
  get graph() {
    return this._graph;
  }
};
var streetui = {
  app(options) {
    return new StreetApp(options);
  }
};

// ../compiler/src/validation/validator.ts
function validateGraph(graph) {
  const dc = new DiagnosticCollector();
  dc.merge(graph.validate());
  const pages = graph.findByType("page");
  if (pages.length === 0) {
    dc.warn(
      "COMPILER_NO_PAGES",
      "Application has no pages defined. At least one page is recommended."
    );
  }
  graph.walk((node) => {
    validateNode(node, dc);
  });
  return dc;
}
function validateNode(node, dc) {
  switch (node.type) {
    case "heading": {
      const text = node.getProp("text");
      if (text === void 0 || text === "") {
        dc.warn("COMPILER_EMPTY_HEADING", `Heading node "${node.id}" has no text content`, {
          nodeId: node.id
        });
      }
      break;
    }
    case "image": {
      const src = node.getProp("src");
      const alt = node.getProp("alt");
      if (!src) {
        dc.error("COMPILER_IMAGE_NO_SRC", `Image node "${node.id}" is missing src`, {
          nodeId: node.id
        });
      }
      if (!alt) {
        dc.warn("COMPILER_IMAGE_NO_ALT", `Image node "${node.id}" is missing alt text`, {
          nodeId: node.id
        });
      }
      break;
    }
    case "link": {
      const href = node.getProp("href");
      if (!href) {
        dc.error("COMPILER_LINK_NO_HREF", `Link node "${node.id}" is missing href`, {
          nodeId: node.id
        });
      }
      break;
    }
    default:
      break;
  }
}

// ../compiler/src/transform/transform.ts
function transformGraph(graph) {
  graph.walk((node, depth) => {
    applyDefaults(node);
    ensureRenderKey(node, depth);
  });
}
function applyDefaults(node) {
  switch (node.type) {
    case "heading": {
      if (node.getProp("level") === void 0) {
        node.setProp("level", 1);
      }
      break;
    }
    case "input": {
      if (node.getProp("inputType") === void 0) {
        node.setProp("inputType", "text");
      }
      break;
    }
    case "link": {
      if (node.getProp("external") === void 0) {
        node.setProp("external", false);
      }
      break;
    }
    default:
      break;
  }
}
function ensureRenderKey(node, depth) {
  if (node.getProp("_renderKey") === void 0) {
    const key = node.key ?? `${node.type}:${node.id}:${depth}`;
    node.setProp("_renderKey", key);
  }
}

// ../compiler/src/compile.ts
function compile(app, options = {}) {
  const strict = options.strict ?? true;
  const strictWarnings = options.strictWarnings ?? false;
  const dc = new DiagnosticCollector();
  const graph = app.graph;
  const validationDc = validateGraph(graph);
  dc.merge(validationDc);
  if (strict && dc.hasErrors) {
    dc.throwIfErrors();
  }
  if (strictWarnings && dc.hasWarnings) {
    throw new Error(
      `[StreetUI Compiler] Compilation failed: warnings treated as errors.
` + dc.diagnostics.filter((d) => d.severity === "warning").map((d) => `  [${d.code}] ${d.message}`).join("\n")
    );
  }
  transformGraph(graph);
  return {
    graph,
    diagnostics: dc,
    name: graph.name,
    version: graph.version,
    compiledAt: Date.now()
  };
}
function compileGraph(graph, options = {}) {
  const strict = options.strict ?? true;
  const dc = new DiagnosticCollector();
  const validationDc = validateGraph(graph);
  dc.merge(validationDc);
  if (strict && dc.hasErrors) {
    dc.throwIfErrors();
  }
  transformGraph(graph);
  return {
    graph,
    diagnostics: dc,
    name: graph.name,
    version: graph.version,
    compiledAt: Date.now()
  };
}

// ../runtime/src/node-instance.ts
var RuntimeNodeInstance = class {
  graphNode;
  domNode;
  children = [];
  cleanup = new CleanupRegistry();
  _mounted = false;
  constructor(options) {
    this.graphNode = options.graphNode;
    this.domNode = options.domNode;
  }
  get isMounted() {
    return this._mounted;
  }
  mount() {
    this._mounted = true;
  }
  unmount() {
    if (!this._mounted) return;
    this._mounted = false;
    for (const child of this.children) {
      child.unmount();
    }
    this.cleanup.run();
  }
  addChild(instance) {
    this.children.push(instance);
  }
  /** Subscribe to a signal and register the unsubscribe for cleanup. */
  trackSignal(signal2, handler) {
    const unsub = signal2.subscribe(handler);
    this.cleanup.add(unsub);
  }
  /** Register an arbitrary cleanup function (e.g. DOM event removal). */
  trackCleanup(fn) {
    this.cleanup.add(fn);
  }
};

// ../scheduler/src/scheduler.ts
var PRIORITY_ORDER = {
  immediate: 0,
  normal: 1,
  idle: 2
};
var Scheduler = class {
  _queue = /* @__PURE__ */ new Map();
  _flushScheduled = false;
  _flushing = false;
  _diagnostics = void 0;
  /**
   * Install an optional diagnostic sink for swallowed job errors. Pass
   * `undefined` to restore the default `console.error` reporting. Additive and
   * opt-in — the scheduler never sends anything anywhere on its own.
   */
  setDiagnostics(sink) {
    this._diagnostics = sink;
  }
  /** Total jobs currently queued. */
  get size() {
    return this._queue.size;
  }
  /** True if a flush has been scheduled but not yet executed. */
  get isPending() {
    return this._flushScheduled;
  }
  /**
   * Enqueue a job. If a job with the same key exists, the new one replaces it
   * (allowing callers to coalesce repeated updates for the same node).
   */
  schedule(job) {
    this._queue.set(job.key, job);
    if (!this._flushScheduled && !this._flushing) {
      this._flushScheduled = true;
      this._scheduleMicrotask();
    }
  }
  /** Schedule multiple jobs atomically. */
  scheduleAll(jobs) {
    for (const job of jobs) {
      this._queue.set(job.key, job);
    }
    if (!this._flushScheduled && !this._flushing && this._queue.size > 0) {
      this._flushScheduled = true;
      this._scheduleMicrotask();
    }
  }
  /**
   * Cancel a queued job by key. No-op if not queued.
   */
  cancel(key) {
    this._queue.delete(key);
  }
  /**
   * Synchronously flush all queued jobs (sorted by priority).
   * Useful in tests and for immediate rendering.
   */
  flush() {
    if (this._flushing) return;
    this._flushScheduled = false;
    this._flushing = true;
    const jobs = Array.from(this._queue.values()).sort(
      (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
    );
    this._queue.clear();
    try {
      for (const job of jobs) {
        try {
          job.fn();
        } catch (err) {
          if (this._diagnostics?.error) {
            this._diagnostics.error(`Scheduler job "${job.key}" threw`, err);
          } else {
            console.error(`[Scheduler] Job "${job.key}" threw:`, err);
          }
        }
      }
    } finally {
      this._flushing = false;
    }
  }
  /** Clear all pending jobs without executing them. */
  clear() {
    this._queue.clear();
    this._flushScheduled = false;
  }
  _scheduleMicrotask() {
    Promise.resolve().then(() => {
      if (this._flushScheduled) {
        this.flush();
      }
    });
  }
};
var scheduler = new Scheduler();
function scheduleUpdate(key, fn) {
  scheduler.schedule({ key, priority: "normal", fn });
}
function scheduleImmediate(key, fn) {
  scheduler.schedule({ key, priority: "immediate", fn });
}
function flushSync() {
  scheduler.flush();
}

// ../runtime/src/runtime.ts
var Runtime = class {
  _renderer;
  _scheduler;
  _cleanup = new CleanupRegistry();
  _renderHandle = null;
  _mounted = false;
  constructor(options) {
    this._renderer = options.renderer;
    this._scheduler = options.scheduler ?? new Scheduler();
  }
  get isMounted() {
    return this._mounted;
  }
  /**
   * Mount the compiled application into the given DOM container.
   */
  mount(compiled, container) {
    if (this._mounted) {
      throw new Error("[Runtime] Already mounted. Call unmount() first.");
    }
    this._renderHandle = this._renderer.mount(compiled, container);
    this._mounted = true;
    this._bindSignals(compiled.graph);
    const self2 = this;
    return {
      renderHandle: this._renderHandle,
      runtime: this,
      unmount() {
        self2.unmount();
      },
      flush() {
        self2._scheduler.flush();
      }
    };
  }
  unmount() {
    if (!this._mounted) return;
    this._mounted = false;
    this._renderHandle?.unmount();
    this._renderHandle = null;
    this._cleanup.run();
  }
  /**
   * Hydrate a container that already holds server-rendered HTML for this
   * application. Delegates to the renderer's `hydrate` (adopting the existing
   * DOM instead of recreating it) and falls back to `mount` for renderers that
   * cannot hydrate. Signal binding is identical to `mount`, so the live client
   * lifecycle is established the same way.
   */
  hydrate(compiled, container) {
    if (this._mounted) {
      throw new Error("[Runtime] Already mounted. Call unmount() first.");
    }
    this._renderHandle = this._renderer.hydrate !== void 0 ? this._renderer.hydrate(compiled, container) : this._renderer.mount(compiled, container);
    this._mounted = true;
    this._bindSignals(compiled.graph);
    const self2 = this;
    return {
      renderHandle: this._renderHandle,
      runtime: this,
      unmount() {
        self2.unmount();
      },
      flush() {
        self2._scheduler.flush();
      }
    };
  }
  /**
   * Walk the graph and subscribe to all signal-bound nodes.
   * When a signal changes, schedule a renderer update for that node.
   */
  _bindSignals(graph) {
    graph.walk((node) => {
      for (const stateRef of node.stateRefs) {
        const signalKey = `__signal__${stateRef.signalId}`;
        const maybeSignal = graph.getHandler(signalKey);
        if (maybeSignal === void 0 || typeof maybeSignal.subscribe !== "function") continue;
        const unsub = maybeSignal.subscribe(() => {
          this._scheduler.schedule({
            key: `update:${node.id}:${stateRef.propKey}`,
            priority: "normal",
            fn: () => {
              this._renderHandle?.flush();
            }
          });
        });
        this._cleanup.add(unsub);
      }
    });
  }
};
function createRuntime(options) {
  return new Runtime(options);
}

// ../events/src/event-types.ts
function createStreetEvent(type, target, data, originalEvent) {
  let _stopped = false;
  const ev = {
    type,
    target,
    data,
    originalEvent,
    timestamp: Date.now(),
    defaultPrevented: false,
    stopPropagation() {
      _stopped = true;
    },
    preventDefault() {
      ev.defaultPrevented = true;
    }
  };
  return ev;
}

// ../events/src/event-bus.ts
var EventBus = class {
  _handlers = /* @__PURE__ */ new Map();
  on(type, handler) {
    let set = this._handlers.get(type);
    if (set === void 0) {
      set = /* @__PURE__ */ new Set();
      this._handlers.set(type, set);
    }
    set.add(handler);
    return () => this.off(type, handler);
  }
  off(type, handler) {
    this._handlers.get(type)?.delete(handler);
  }
  once(type, handler) {
    const wrapped = (event) => {
      handler(event);
      this.off(type, wrapped);
    };
    return this.on(type, wrapped);
  }
  emit(event) {
    const handlers = this._handlers.get(event.type);
    if (handlers === void 0) return;
    for (const h of handlers) {
      h(event);
    }
  }
  clear(type) {
    if (type !== void 0) {
      this._handlers.delete(type);
    } else {
      this._handlers.clear();
    }
  }
  listenerCount(type) {
    return this._handlers.get(type)?.size ?? 0;
  }
};
var globalEventBus = new EventBus();

// ../events/src/dom-bridge.ts
function bindDomEvent(element, domEventType, handler, options) {
  const listener = (e) => {
    const streetEvent = createStreetEvent(domEventType, element, void 0, e);
    handler(streetEvent);
  };
  element.addEventListener(domEventType, listener, options);
  return {
    remove() {
      element.removeEventListener(domEventType, listener, options);
    }
  };
}
var DomEventRegistry = class {
  _bindings = [];
  bind(element, type, handler, options) {
    this._bindings.push(bindDomEvent(element, type, handler, options));
  }
  removeAll() {
    for (const b of this._bindings) {
      b.remove();
    }
    this._bindings.length = 0;
  }
  get count() {
    return this._bindings.length;
  }
};

// ../dom/src/browser-adapter.ts
var BrowserDOMAdapter = class {
  createElement(tag, ns) {
    if (ns !== void 0) {
      return document.createElementNS(ns, tag);
    }
    return document.createElement(tag);
  }
  createTextNode(data) {
    return document.createTextNode(data);
  }
  createComment(data) {
    return document.createComment(data);
  }
  createFragment() {
    return document.createDocumentFragment();
  }
  appendChild(parent, child) {
    parent.appendChild(child);
  }
  insertBefore(parent, child, reference) {
    parent.insertBefore(child, reference);
  }
  removeChild(parent, child) {
    parent.removeChild(child);
  }
  replaceChild(parent, newChild, oldChild) {
    parent.replaceChild(newChild, oldChild);
  }
  setAttribute(element, name, value) {
    element.setAttribute(name, value);
  }
  removeAttribute(element, name) {
    element.removeAttribute(name);
  }
  getAttribute(element, name) {
    return element.getAttribute(name);
  }
  setProperty(element, name, value) {
    element[name] = value;
  }
  setTextContent(node, text) {
    node.textContent = text;
  }
  getTextContent(node) {
    return node.textContent;
  }
  addEventListener(target, type, handler, options) {
    target.addEventListener(type, handler, options);
  }
  removeEventListener(target, type, handler, options) {
    target.removeEventListener(type, handler, options);
  }
  querySelector(root, selector) {
    return root.querySelector(selector);
  }
  querySelectorAll(root, selector) {
    return root.querySelectorAll(selector);
  }
  getElementById(id) {
    return document.getElementById(id);
  }
  focus(element) {
    element.focus?.();
  }
  isElement(node) {
    return node.nodeType === Node.ELEMENT_NODE;
  }
  isTextNode(node) {
    return node.nodeType === Node.TEXT_NODE;
  }
  tagName(element) {
    return element.tagName.toLowerCase();
  }
  parentNode(node) {
    return node.parentNode;
  }
  nextSibling(node) {
    return node.nextSibling;
  }
  firstChild(node) {
    return node.firstChild;
  }
  childNodes(node) {
    return Array.from(node.childNodes);
  }
};
var browserDOMAdapter = /* @__PURE__ */ new BrowserDOMAdapter();

// ../dom/src/server-node.ts
var ServerStyle = class {
  declarations = /* @__PURE__ */ new Map();
  setProperty(name, value) {
    this.declarations.set(name, value);
  }
  get isEmpty() {
    return this.declarations.size === 0;
  }
  toCss() {
    return [...this.declarations.entries()].map(([k, v]) => `${k}: ${v}`).join("; ");
  }
};
var ServerText = class {
  kind = "text";
  parent = null;
  data;
  constructor(data) {
    this.data = data;
  }
};
var ServerComment = class {
  kind = "comment";
  parent = null;
  data;
  constructor(data) {
    this.data = data;
  }
};
var ServerFragment = class {
  kind = "fragment";
  parent = null;
  children = [];
};
var ServerElement = class {
  kind = "element";
  parent = null;
  tagName;
  attributes = /* @__PURE__ */ new Map();
  children = [];
  // Lazily-allocated stores. On the 10k-row SSR corpus ~0% of elements carry JS
  // properties or inline styles (measured, §5: 1 of 80,029 elements uses
  // `properties`, 0 use `style`), so eagerly allocating a `properties` Map plus
  // a `ServerStyle` (which itself holds a Map) per element wasted ~240k
  // allocations per /users render — all in the dominant mount phase. These are
  // created on first WRITE via the `properties`/`style` getters; the serializer
  // reads the raw `_properties`/`_style` fields so a READ never forces an
  // allocation. Output is byte-identical: an unset store previously serialized
  // to nothing (empty `properties.has(...)` / `style.isEmpty`), and a null store
  // is skipped the same way.
  _properties = null;
  _style = null;
  constructor(tagName) {
    this.tagName = tagName.toLowerCase();
  }
  /** JS properties set via `setProperty` (e.g. input `value`, `checked`). Allocated on first access. */
  get properties() {
    return this._properties ??= /* @__PURE__ */ new Map();
  }
  /** Inline-style holder mirroring `element.style`. Allocated on first access. */
  get style() {
    return this._style ??= new ServerStyle();
  }
};
var VOID_ELEMENTS = /* @__PURE__ */ new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr"
]);
var SERIALIZED_PROPERTIES = {
  value: "attr",
  checked: "boolean",
  selected: "boolean"
};
var SERIALIZED_PROPERTY_ENTRIES = Object.entries(SERIALIZED_PROPERTIES);
var TEXT_SPECIAL = /[&<>]/;
var ATTR_SPECIAL = /[&<>"]/;
function escapeHtmlText(value) {
  if (!TEXT_SPECIAL.test(value)) return value;
  let out = "";
  let last = 0;
  for (let i = 0; i < value.length; i++) {
    let esc;
    switch (value.charCodeAt(i)) {
      case 38:
        esc = "&amp;";
        break;
      // &
      case 60:
        esc = "&lt;";
        break;
      // <
      case 62:
        esc = "&gt;";
        break;
      // >
      default:
        continue;
    }
    out += value.slice(last, i) + esc;
    last = i + 1;
  }
  return out + value.slice(last);
}
function escapeHtmlAttr(value) {
  if (!ATTR_SPECIAL.test(value)) return value;
  let out = "";
  let last = 0;
  for (let i = 0; i < value.length; i++) {
    let esc;
    switch (value.charCodeAt(i)) {
      case 38:
        esc = "&amp;";
        break;
      // &
      case 60:
        esc = "&lt;";
        break;
      // <
      case 62:
        esc = "&gt;";
        break;
      // >
      case 34:
        esc = "&quot;";
        break;
      // "
      default:
        continue;
    }
    out += value.slice(last, i) + esc;
    last = i + 1;
  }
  return out + value.slice(last);
}
function serializeAttributes(el) {
  const parts = [];
  for (const [name, value] of el.attributes) {
    if (value === "") {
      parts.push(` ${name}`);
    } else {
      parts.push(` ${name}="${escapeHtmlAttr(value)}"`);
    }
  }
  const props = el._properties;
  if (props !== null) {
    for (const [name, kind] of SERIALIZED_PROPERTY_ENTRIES) {
      if (!props.has(name)) continue;
      if (el.attributes.has(name)) continue;
      const raw = props.get(name);
      if (kind === "boolean") {
        if (raw === true) parts.push(` ${name}`);
      } else {
        if (raw !== void 0 && raw !== null) {
          parts.push(` ${name}="${escapeHtmlAttr(String(raw))}"`);
        }
      }
    }
  }
  const style = el._style;
  if (style !== null && !style.isEmpty && !el.attributes.has("style")) {
    parts.push(` style="${escapeHtmlAttr(style.toCss())}"`);
  }
  return parts.join("");
}
function serializeServerNode(node) {
  switch (node.kind) {
    case "text":
      return escapeHtmlText(node.data);
    case "comment":
      return `<!--${node.data}-->`;
    case "fragment":
      return serializeChildren(node);
    case "element": {
      const el = node;
      const tag = el.tagName;
      const attrs = serializeAttributes(el);
      if (VOID_ELEMENTS.has(tag)) {
        return `<${tag}${attrs}>`;
      }
      return `<${tag}${attrs}>${serializeChildren(el)}</${tag}>`;
    }
  }
}
function serializeChildren(node) {
  let out = "";
  for (const child of node.children) {
    out += serializeServerNode(child);
  }
  return out;
}

// ../dom/src/server-adapter.ts
function asServer(node) {
  return node;
}
function asParent(node) {
  return node;
}
var ServerDOMAdapter = class {
  createElement(tag, _ns) {
    return new ServerElement(tag);
  }
  createTextNode(data) {
    return new ServerText(data);
  }
  createComment(data) {
    return new ServerComment(data);
  }
  createFragment() {
    return new ServerFragment();
  }
  appendChild(parent, child) {
    const p = asParent(parent);
    const c = asServer(child);
    this._detach(c);
    c.parent = p;
    p.children.push(c);
  }
  insertBefore(parent, child, reference) {
    const p = asParent(parent);
    const c = asServer(child);
    this._detach(c);
    c.parent = p;
    if (reference === null) {
      p.children.push(c);
      return;
    }
    const ref = asServer(reference);
    const idx = p.children.indexOf(ref);
    if (idx === -1) p.children.push(c);
    else p.children.splice(idx, 0, c);
  }
  removeChild(parent, child) {
    const p = asParent(parent);
    const c = asServer(child);
    const idx = p.children.indexOf(c);
    if (idx !== -1) {
      p.children.splice(idx, 1);
      c.parent = null;
    }
  }
  replaceChild(parent, newChild, oldChild) {
    const p = asParent(parent);
    const nc = asServer(newChild);
    const oc = asServer(oldChild);
    const idx = p.children.indexOf(oc);
    if (idx === -1) return;
    this._detach(nc);
    nc.parent = p;
    p.children.splice(idx, 1, nc);
    oc.parent = null;
  }
  _detach(node) {
    if (node.parent !== null) {
      const siblings = node.parent.children;
      const idx = siblings.indexOf(node);
      if (idx !== -1) siblings.splice(idx, 1);
      node.parent = null;
    }
  }
  setAttribute(element, name, value) {
    element.attributes.set(name, value);
  }
  removeAttribute(element, name) {
    element.attributes.delete(name);
  }
  getAttribute(element, name) {
    return element.attributes.get(name) ?? null;
  }
  setProperty(element, name, value) {
    element.properties.set(name, value);
  }
  setTextContent(node, text) {
    const n = asServer(node);
    if (n.kind === "element" || n.kind === "fragment") {
      const el = n;
      el.children.length = 0;
      const t = new ServerText(text);
      t.parent = el;
      el.children.push(t);
    } else if (n.kind === "text") {
      n.data = text;
    }
  }
  getTextContent(node) {
    const n = asServer(node);
    if (n.kind === "text") return n.data;
    if (n.kind === "element" || n.kind === "fragment") {
      let out = "";
      for (const c of n.children) {
        out += this.getTextContent(c) ?? "";
      }
      return out;
    }
    return null;
  }
  // Server nodes never dispatch events — listeners are a no-op on the server.
  addEventListener() {
  }
  removeEventListener() {
  }
  querySelector() {
    return null;
  }
  querySelectorAll() {
    return [];
  }
  getElementById() {
    return null;
  }
  focus() {
  }
  isElement(node) {
    return asServer(node).kind === "element";
  }
  isTextNode(node) {
    return asServer(node).kind === "text";
  }
  tagName(element) {
    return element.tagName;
  }
  parentNode(node) {
    return asServer(node).parent ?? null;
  }
  nextSibling(node) {
    const n = asServer(node);
    const parent = n.parent;
    if (parent === null) return null;
    const idx = parent.children.indexOf(n);
    if (idx === -1 || idx + 1 >= parent.children.length) return null;
    return parent.children[idx + 1];
  }
  firstChild(node) {
    const n = asServer(node);
    if (n.kind === "element" || n.kind === "fragment") {
      const el = n;
      return el.children[0] ?? null;
    }
    return null;
  }
  childNodes(node) {
    const n = asServer(node);
    if (n.kind === "element" || n.kind === "fragment") {
      return n.children;
    }
    return [];
  }
  // ── Server-only ────────────────────────────────────────────────────────────
  /** Serialize a node's children ("inner HTML") to an HTML string. */
  serializeInner(node) {
    const n = asServer(node);
    if (n.kind === "element" || n.kind === "fragment") {
      return serializeChildren(n);
    }
    return "";
  }
  /** Serialize a node (including itself) to an HTML string. */
  serializeOuter(node) {
    return serializeServerNode(asServer(node));
  }
};
var serverDOMAdapter = /* @__PURE__ */ new ServerDOMAdapter();

// ../dom/src/focus.ts
var FOCUSABLE_SELECTOR = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
function focusById(dom, root, id) {
  const el = dom.querySelector(root, `[id="${id}"]`);
  if (el === null) return false;
  dom.focus(el);
  return true;
}
function focusFirst(dom, container, selector = FOCUSABLE_SELECTOR) {
  const el = dom.querySelector(container, selector);
  if (el === null) return false;
  dom.focus(el);
  return true;
}

// ../renderer/src/render-context.ts
function createRenderContext(dom, graph, container, hydrationDiagnostics) {
  return {
    dom,
    graph,
    instances: /* @__PURE__ */ new Map(),
    container,
    ...hydrationDiagnostics !== void 0 ? { hydrationDiagnostics } : {}
  };
}

// ../renderer/src/node-instance.ts
var NodeInstance = class {
  graphNode;
  /** The primary DOM node for this instance (element or text node). */
  domNode;
  children = [];
  cleanup = new CleanupRegistry();
  constructor(graphNode, domNode) {
    this.graphNode = graphNode;
    this.domNode = domNode;
  }
  addChild(child) {
    this.children.push(child);
  }
  /** Subscribe to a signal; auto-cleanup on unmount. */
  trackSignal(sig, handler) {
    const unsub = sig.subscribe(handler);
    this.cleanup.add(unsub);
  }
  /** Register a raw cleanup fn (DOM event removal, etc.). */
  trackCleanup(fn) {
    this.cleanup.add(fn);
  }
  dispose() {
    for (const child of this.children) {
      child.dispose();
    }
    this.cleanup.run();
  }
};

// ../renderer/src/attributes.ts
var DOM_PROPERTIES = /* @__PURE__ */ new Set([
  "value",
  "checked",
  "selected",
  "indeterminate",
  "innerHTML",
  "textContent",
  "innerText",
  "scrollTop",
  "scrollLeft"
]);
var BOOLEAN_ATTRS = /* @__PURE__ */ new Set([
  "disabled",
  "readonly",
  "required",
  "checked",
  "selected",
  "multiple",
  "autofocus",
  "autoplay",
  "controls",
  "default",
  "defer",
  "formnovalidate",
  "hidden",
  "ismap",
  "loop",
  "novalidate",
  "open",
  "reversed",
  "scoped",
  "seamless"
]);
function applyProp(dom, element, name, value) {
  if (name.startsWith("_")) return;
  if (name.startsWith("on")) return;
  if (DOM_PROPERTIES.has(name)) {
    dom.setProperty(element, name, value);
    return;
  }
  if (BOOLEAN_ATTRS.has(name)) {
    if (value === true || value === "" || value === name) {
      dom.setAttribute(element, name, "");
    } else {
      dom.removeAttribute(element, name);
    }
    return;
  }
  if (name === "class" || name === "className") {
    dom.setAttribute(element, "class", String(value ?? ""));
    return;
  }
  if (name === "style" && typeof value === "object" && value !== null) {
    const el = element;
    const styles = value;
    for (const [k, v] of Object.entries(styles)) {
      el.style.setProperty(k, v);
    }
    return;
  }
  if (value === null || value === void 0 || value === false) {
    dom.removeAttribute(element, name);
    return;
  }
  dom.setAttribute(element, name, String(value));
}
function patchProp(dom, element, name, oldValue, newValue) {
  if (Object.is(oldValue, newValue)) return;
  applyProp(dom, element, name, newValue);
}

// ../renderer/src/events.ts
function wireEvents(dom, graph, node, element, instance) {
  if (node.events.length === 0) return;
  for (const eventDesc of node.events) {
    const handler = graph.getHandler(eventDesc.handlerKey);
    if (handler === void 0) continue;
    const domListener = (domEvent) => {
      if (eventDesc.type === "input" || eventDesc.type === "change") {
        const input = domEvent.target;
        handler(input.value);
      } else if (eventDesc.type === "submit") {
        domEvent.preventDefault();
        handler(domEvent);
      } else {
        handler();
      }
    };
    dom.addEventListener(element, eventDesc.type, domListener);
    instance.trackCleanup(() => {
      dom.removeEventListener(element, eventDesc.type, domListener);
    });
  }
}

// ../renderer/src/tag-map.ts
var TAG_MAP = {
  application: "div",
  page: "div",
  section: "section",
  container: "div",
  heading: "h1",
  text: "span",
  button: "button",
  input: "input",
  form: "form",
  list: "ul",
  "list-item": "li",
  image: "img",
  link: "a",
  component: "div",
  slot: "div",
  fragment: "div",
  "reactive-list": "ul"
};
function resolveTag(type) {
  return TAG_MAP[type] ?? "div";
}

// ../renderer/src/patch.ts
function patchNode(ctx, graphNode, propKey, newValue) {
  const instance = ctx.instances.get(graphNode.id);
  if (instance === void 0) return;
  const domNode = instance.domNode;
  if (!ctx.dom.isElement(domNode)) return;
  const oldValue = graphNode.getProp(propKey);
  switch (propKey) {
    case "text":
      if (!Object.is(oldValue, newValue)) {
        ctx.dom.setTextContent(domNode, String(newValue ?? ""));
        graphNode.setProp("text", String(newValue ?? ""));
      }
      break;
    case "label":
      if (!Object.is(oldValue, newValue)) {
        ctx.dom.setTextContent(domNode, String(newValue ?? ""));
        graphNode.setProp("label", String(newValue ?? ""));
      }
      break;
    case "disabled":
      if (newValue === true) {
        ctx.dom.setAttribute(domNode, "disabled", "");
      } else {
        ctx.dom.removeAttribute(domNode, "disabled");
      }
      graphNode.setProp("disabled", Boolean(newValue));
      break;
    case "value":
      if (!Object.is(oldValue, newValue)) {
        ctx.dom.setProperty(domNode, "value", String(newValue ?? ""));
        graphNode.setProp("value", String(newValue ?? ""));
      }
      break;
    default:
      patchProp(ctx.dom, domNode, propKey, oldValue, newValue);
      graphNode.setProp(propKey, newValue);
      break;
  }
}

// ../renderer/src/reconciliation.ts
function reconcileChildren(ctx, parentDom, oldInstances, newNodes, mountFn) {
  const oldByKey = /* @__PURE__ */ new Map();
  for (const inst of oldInstances) {
    const key = inst.graphNode.key ?? inst.graphNode.id;
    oldByKey.set(key, inst);
  }
  const newInstances = [];
  const usedKeys = /* @__PURE__ */ new Set();
  for (const newNode of newNodes) {
    const key = newNode.key ?? newNode.id;
    const existing = oldByKey.get(key);
    if (existing !== void 0) {
      usedKeys.add(key);
      const oldSig = existing.graphNode.getProp("_sig");
      const newSig = newNode.getProp("_sig");
      patchExistingInstance(ctx, existing, newNode);
      if (!Object.is(oldSig, newSig)) {
        reconcileItemChildren(ctx, existing, newNode, mountFn);
      }
      newInstances.push(existing);
    } else {
      const inst = mountFn(newNode, parentDom);
      newInstances.push(inst);
    }
  }
  const removed = [];
  for (const inst of oldInstances) {
    const key = inst.graphNode.key ?? inst.graphNode.id;
    if (!usedKeys.has(key)) {
      removed.push(inst);
    }
  }
  for (const inst of removed) {
    const parent = ctx.dom.parentNode(inst.domNode);
    if (parent !== null) {
      ctx.dom.removeChild(parent, inst.domNode);
    }
    inst.dispose();
  }
  reorderDom(ctx, parentDom, newInstances);
  return { instances: newInstances, removed };
}
function reconcileChildrenByPlan(ctx, parentDom, oldInstances, plan, mountFn) {
  const oldByKey = /* @__PURE__ */ new Map();
  for (const inst of oldInstances) {
    oldByKey.set(inst.graphNode.key ?? inst.graphNode.id, inst);
  }
  const newInstances = [];
  const usedKeys = /* @__PURE__ */ new Set();
  const built = [];
  for (const entry of plan) {
    const existing = oldByKey.get(entry.key);
    if (existing !== void 0) {
      usedKeys.add(entry.key);
      const oldItem = existing.graphNode.getProp("_item");
      if (!Object.is(oldItem, entry.item)) {
        const newSig = entry.sig();
        const oldSig = existing.graphNode.getProp("_sig");
        if (!Object.is(oldSig, newSig)) {
          const freshNode = entry.build();
          built.push(freshNode);
          patchExistingInstance(ctx, existing, freshNode);
          reconcileItemChildren(ctx, existing, freshNode, mountFn);
          existing.graphNode.setProp("_sig", newSig);
        }
        existing.graphNode.setProp("_item", entry.item);
      }
      newInstances.push(existing);
    } else {
      const freshNode = entry.build();
      built.push(freshNode);
      const inst = mountFn(freshNode, parentDom);
      newInstances.push(inst);
    }
  }
  const removed = [];
  for (const inst of oldInstances) {
    const key = inst.graphNode.key ?? inst.graphNode.id;
    if (!usedKeys.has(key)) removed.push(inst);
  }
  for (const inst of removed) {
    const parent = ctx.dom.parentNode(inst.domNode);
    if (parent !== null) ctx.dom.removeChild(parent, inst.domNode);
    inst.dispose();
  }
  reorderDomMinimal(ctx, parentDom, oldInstances, newInstances);
  return { instances: newInstances, removed, built };
}
function reorderDomMinimal(ctx, parentDom, oldInstances, newInstances) {
  const n = newInstances.length;
  if (n === 0) return;
  const oldIndexOf = /* @__PURE__ */ new Map();
  for (let i = 0; i < oldInstances.length; i++) oldIndexOf.set(oldInstances[i], i);
  const source = new Array(n);
  let moved = false;
  let lastSeen = -1;
  for (let i = 0; i < n; i++) {
    const oi = oldIndexOf.get(newInstances[i]);
    if (oi === void 0) {
      source[i] = -1;
      moved = true;
    } else {
      source[i] = oi;
      if (oi < lastSeen) moved = true;
      else lastSeen = oi;
    }
  }
  if (!moved) return;
  const keep = longestIncreasingSubsequence(source);
  let refNode = null;
  for (let i = n - 1; i >= 0; i--) {
    const domNode = newInstances[i].domNode;
    if (source[i] === -1 || !keep.has(i)) {
      if (ctx.dom.nextSibling(domNode) !== refNode) {
        ctx.dom.insertBefore(parentDom, domNode, refNode);
      }
    }
    refNode = domNode;
  }
}
function longestIncreasingSubsequence(source) {
  const keep = /* @__PURE__ */ new Set();
  const n = source.length;
  const tails = [];
  const prev = new Array(n).fill(-1);
  for (let i = 0; i < n; i++) {
    const v = source[i];
    if (v < 0) continue;
    let lo = 0;
    let hi = tails.length;
    while (lo < hi) {
      const mid = lo + hi >> 1;
      if (source[tails[mid]] < v) lo = mid + 1;
      else hi = mid;
    }
    if (lo > 0) prev[i] = tails[lo - 1];
    tails[lo] = i;
  }
  let idx = tails.length > 0 ? tails[tails.length - 1] : -1;
  while (idx >= 0) {
    keep.add(idx);
    idx = prev[idx];
  }
  return keep;
}
function reconcileItemChildren(ctx, itemInstance, newItemNode, mountFn) {
  const el = itemInstance.domNode;
  if (!ctx.dom.isElement(el)) return;
  const oldChildren = [...itemInstance.children];
  const newChildNodes = [...newItemNode.children];
  const nextChildren = [];
  const kept = /* @__PURE__ */ new Set();
  for (let i = 0; i < newChildNodes.length; i++) {
    const newChild = newChildNodes[i];
    const oldChild = oldChildren[i];
    if (oldChild !== void 0 && oldChild.graphNode.type === newChild.type) {
      patchExistingInstance(ctx, oldChild, newChild);
      reconcileItemChildren(ctx, oldChild, newChild, mountFn);
      nextChildren.push(oldChild);
      kept.add(oldChild);
    } else {
      itemInstance.graphNode.appendChild(newChild);
      const inst = mountFn(newChild, el);
      nextChildren.push(inst);
    }
  }
  for (const old of oldChildren) {
    if (kept.has(old)) continue;
    const parent = ctx.dom.parentNode(old.domNode);
    if (parent !== null) ctx.dom.removeChild(parent, old.domNode);
    old.dispose();
    forgetInstanceTree(ctx, old);
    ctx.graph.detachNode(old.graphNode);
  }
  reorderDom(ctx, el, nextChildren);
  itemInstance.children.length = 0;
  for (const c of nextChildren) itemInstance.children.push(c);
  for (const c of [...itemInstance.graphNode.children]) {
    itemInstance.graphNode.removeChild(c);
  }
  for (const c of nextChildren) itemInstance.graphNode.appendChild(c.graphNode);
}
function reorderDom(ctx, parentDom, instances) {
  let referenceNode = null;
  for (let i = instances.length - 1; i >= 0; i--) {
    const inst = instances[i];
    if (inst === void 0) continue;
    const domNode = inst.domNode;
    const currentNext = ctx.dom.nextSibling(domNode);
    if (currentNext !== referenceNode) {
      ctx.dom.insertBefore(parentDom, domNode, referenceNode);
    }
    referenceNode = domNode;
  }
}
function forgetInstanceTree(ctx, instance) {
  ctx.instances.delete(instance.graphNode.id);
  for (const child of instance.children) forgetInstanceTree(ctx, child);
}
function patchExistingInstance(ctx, instance, newNode) {
  const oldNode = instance.graphNode;
  for (const [key, newVal] of Object.entries(newNode.props)) {
    const oldVal = oldNode.getProp(key);
    if (!Object.is(oldVal, newVal)) {
      patchNode(ctx, instance.graphNode, key, newVal);
    }
  }
}

// ../renderer/src/mount.ts
var SKIP_PROP_KEYS = /* @__PURE__ */ new Set([
  "text",
  "label",
  "level",
  "inputType",
  "src",
  "alt",
  "href",
  "external",
  "value",
  "placeholder",
  "disabled",
  "_renderKey",
  "key",
  "name"
]);
function mountGraph(ctx) {
  return mountNode(ctx, ctx.graph.root, ctx.container);
}
function mountNode(ctx, graphNode, parentDom) {
  const { dom, graph } = ctx;
  if (graphNode.type === "application") {
    const instance2 = new NodeInstance(graphNode, parentDom);
    ctx.instances.set(graphNode.id, instance2);
    for (const child of graphNode.children) {
      const childInstance = mountNode(ctx, child, parentDom);
      instance2.addChild(childInstance);
    }
    return instance2;
  }
  if (graphNode.type === "text") {
    const text = String(graphNode.getProp("text") ?? "");
    const el2 = dom.createElement("span");
    const textNode = dom.createTextNode(text);
    dom.appendChild(el2, textNode);
    applyNodeProps(ctx, graphNode, el2);
    const instance2 = new NodeInstance(graphNode, el2);
    ctx.instances.set(graphNode.id, instance2);
    wireEvents(dom, graph, graphNode, el2, instance2);
    if (graphNode.stateRefs.length !== 0) {
      wireSignalBindings(ctx, graphNode, instance2, textUpdate(dom, el2, textNode));
    }
    dom.appendChild(parentDom, el2);
    return instance2;
  }
  if (graphNode.type === "heading") {
    const level = graphNode.getProp("level") ?? 1;
    const tag2 = `h${level}`;
    const el2 = dom.createElement(tag2);
    const text = String(graphNode.getProp("text") ?? "");
    dom.setTextContent(el2, text);
    applyNodeProps(ctx, graphNode, el2);
    const instance2 = new NodeInstance(graphNode, el2);
    ctx.instances.set(graphNode.id, instance2);
    wireEvents(dom, graph, graphNode, el2, instance2);
    if (graphNode.stateRefs.length !== 0) {
      wireSignalBindings(ctx, graphNode, instance2, headingUpdate(dom, el2));
    }
    dom.appendChild(parentDom, el2);
    return instance2;
  }
  if (graphNode.type === "input") {
    const el2 = dom.createElement("input");
    const inputType = String(graphNode.getProp("inputType") ?? "text");
    dom.setAttribute(el2, "type", inputType);
    const placeholder = graphNode.getProp("placeholder");
    if (placeholder !== void 0) dom.setAttribute(el2, "placeholder", String(placeholder));
    const value = graphNode.getProp("value");
    if (value !== void 0) dom.setProperty(el2, "value", String(value));
    applyNodeProps(ctx, graphNode, el2);
    const instance2 = new NodeInstance(graphNode, el2);
    ctx.instances.set(graphNode.id, instance2);
    wireEvents(dom, graph, graphNode, el2, instance2);
    if (graphNode.stateRefs.length !== 0) {
      wireSignalBindings(ctx, graphNode, instance2, inputUpdate(dom, el2));
    }
    dom.appendChild(parentDom, el2);
    return instance2;
  }
  if (graphNode.type === "image") {
    const el2 = dom.createElement("img");
    const src = graphNode.getProp("src");
    const alt = graphNode.getProp("alt");
    if (src !== void 0) dom.setAttribute(el2, "src", String(src));
    if (alt !== void 0) dom.setAttribute(el2, "alt", String(alt));
    const width = graphNode.getProp("width");
    const height = graphNode.getProp("height");
    if (width !== void 0) dom.setAttribute(el2, "width", String(width));
    if (height !== void 0) dom.setAttribute(el2, "height", String(height));
    applyNodeProps(ctx, graphNode, el2);
    const instance2 = new NodeInstance(graphNode, el2);
    ctx.instances.set(graphNode.id, instance2);
    dom.appendChild(parentDom, el2);
    return instance2;
  }
  if (graphNode.type === "link") {
    const el2 = dom.createElement("a");
    const href = graphNode.getProp("href");
    const label = graphNode.getProp("label");
    const external = graphNode.getProp("external");
    if (href !== void 0) dom.setAttribute(el2, "href", String(href));
    if (label !== void 0) dom.setTextContent(el2, String(label));
    if (external === true) {
      dom.setAttribute(el2, "target", "_blank");
      dom.setAttribute(el2, "rel", "noopener noreferrer");
    }
    applyNodeProps(ctx, graphNode, el2);
    const instance2 = new NodeInstance(graphNode, el2);
    ctx.instances.set(graphNode.id, instance2);
    wireEvents(dom, graph, graphNode, el2, instance2);
    dom.appendChild(parentDom, el2);
    return instance2;
  }
  if (graphNode.type === "button") {
    const el2 = dom.createElement("button");
    const label = graphNode.getProp("label");
    if (label !== void 0) dom.setTextContent(el2, String(label));
    const disabled = graphNode.getProp("disabled");
    if (disabled === true) dom.setAttribute(el2, "disabled", "");
    applyNodeProps(ctx, graphNode, el2);
    const instance2 = new NodeInstance(graphNode, el2);
    ctx.instances.set(graphNode.id, instance2);
    wireEvents(dom, graph, graphNode, el2, instance2);
    if (graphNode.stateRefs.length !== 0) {
      wireSignalBindings(ctx, graphNode, instance2, buttonUpdate(dom, el2));
    }
    dom.appendChild(parentDom, el2);
    return instance2;
  }
  if (graphNode.type === "reactive-list" || graphNode.type === "conditional") {
    const tag2 = resolveTag(graphNode.type);
    const el2 = dom.createElement(tag2);
    applyNodeProps(ctx, graphNode, el2);
    const instance2 = new NodeInstance(graphNode, el2);
    ctx.instances.set(graphNode.id, instance2);
    for (const child of graphNode.children) {
      const childInstance = mountNode(ctx, child, el2);
      instance2.addChild(childInstance);
    }
    dom.appendChild(parentDom, el2);
    wireReactiveList(ctx, graphNode, instance2, el2);
    return instance2;
  }
  const tag = resolveTag(graphNode.type);
  const el = dom.createElement(tag);
  applyNodeProps(ctx, graphNode, el);
  if (graphNode.type === "list-item") {
    const itemKey = graphNode.getProp("key");
    if (itemKey !== void 0) {
      dom.setAttribute(el, "data-streetui-key", String(itemKey));
    }
  }
  const instance = new NodeInstance(graphNode, el);
  ctx.instances.set(graphNode.id, instance);
  if (graphNode.type === "form") {
    wireEvents(dom, graph, graphNode, el, instance);
  }
  for (const child of graphNode.children) {
    const childInstance = mountNode(ctx, child, el);
    instance.addChild(childInstance);
  }
  dom.appendChild(parentDom, el);
  return instance;
}
function textUpdate(dom, el, textNode) {
  return (propKey, value) => {
    if (propKey === "text") {
      dom.setTextContent(textNode, String(value ?? ""));
    } else {
      applyProp(dom, el, propKey, value);
    }
  };
}
function headingUpdate(dom, el) {
  return (propKey, value) => {
    if (propKey === "text") {
      dom.setTextContent(el, String(value ?? ""));
    } else {
      applyProp(dom, el, propKey, value);
    }
  };
}
function inputUpdate(dom, el) {
  return (propKey, value) => {
    if (propKey === "value") {
      dom.setProperty(el, "value", String(value ?? ""));
    } else {
      applyProp(dom, el, propKey, value);
    }
  };
}
function buttonUpdate(dom, el) {
  return (propKey, value) => {
    if (propKey === "label") {
      dom.setTextContent(el, String(value ?? ""));
    } else if (propKey === "disabled") {
      if (value === true) {
        dom.setAttribute(el, "disabled", "");
      } else {
        dom.removeAttribute(el, "disabled");
      }
    } else {
      applyProp(dom, el, propKey, value);
    }
  };
}
function applyNodeProps(ctx, graphNode, el) {
  const props = graphNode.props;
  for (const key in props) {
    if (!Object.hasOwn(props, key)) continue;
    if (SKIP_PROP_KEYS.has(key)) continue;
    applyProp(ctx.dom, el, key, props[key]);
  }
}
function wireSignalBindings(ctx, graphNode, instance, onUpdate) {
  if (graphNode.stateRefs.length === 0) return;
  for (const stateRef of graphNode.stateRefs) {
    const signalKey = `__signal__${stateRef.signalId}`;
    const maybeSig = ctx.graph.getHandler(signalKey);
    if (maybeSig === void 0 || typeof maybeSig.subscribe !== "function") continue;
    const unsub = maybeSig.subscribe((value) => {
      onUpdate(stateRef.propKey, value);
    });
    instance.trackCleanup(unsub);
  }
}
function wireReactiveList(ctx, graphNode, instance, el) {
  const plan = ctx.graph.getHandler(`__listplan__${graphNode.id}`);
  const build = ctx.graph.getHandler(`__listbuild__${graphNode.id}`);
  if (plan === void 0 && build === void 0) return;
  for (const stateRef of graphNode.stateRefs) {
    if (stateRef.propKey !== "items") continue;
    const sig = ctx.graph.getHandler(`__signal__${stateRef.signalId}`);
    if (sig === void 0 || typeof sig.subscribe !== "function") continue;
    const unsub = sig.subscribe((value) => {
      if (plan !== void 0) {
        reconcileReactiveListByPlan(ctx, graphNode, instance, el, plan(value));
      } else {
        reconcileReactiveList(ctx, graphNode, instance, el, build(value));
      }
    });
    instance.trackCleanup(unsub);
  }
}
function reconcileReactiveListByPlan(ctx, listNode, listInstance, listEl, plan) {
  const oldInstances = [...listInstance.children];
  const result = reconcileChildrenByPlan(
    ctx,
    listEl,
    oldInstances,
    plan,
    (node, parent) => mountNode(ctx, node, parent)
  );
  listInstance.children.length = 0;
  for (const inst of result.instances) listInstance.children.push(inst);
  for (const removed of result.removed) {
    forgetInstance(ctx, removed);
    ctx.graph.detachNode(removed.graphNode);
  }
  const adopted = new Set(result.instances.map((i) => i.graphNode));
  for (const node of result.built ?? []) {
    if (!adopted.has(node)) ctx.graph.detachNode(node);
  }
  for (const child of [...listNode.children]) listNode.removeChild(child);
  for (const inst of result.instances) listNode.appendChild(inst.graphNode);
}
function reconcileReactiveList(ctx, listNode, listInstance, listEl, newNodes) {
  const oldInstances = [...listInstance.children];
  const result = reconcileChildren(
    ctx,
    listEl,
    oldInstances,
    newNodes,
    (node, parent) => mountNode(ctx, node, parent)
  );
  listInstance.children.length = 0;
  for (const inst of result.instances) listInstance.children.push(inst);
  for (const removed of result.removed) {
    forgetInstance(ctx, removed);
    ctx.graph.detachNode(removed.graphNode);
  }
  const adopted = new Set(result.instances.map((i) => i.graphNode));
  for (const built of newNodes) {
    if (!adopted.has(built)) ctx.graph.detachNode(built);
  }
  for (const child of [...listNode.children]) listNode.removeChild(child);
  for (const inst of result.instances) listNode.appendChild(inst.graphNode);
}
function forgetInstance(ctx, instance) {
  ctx.instances.delete(instance.graphNode.id);
  for (const child of instance.children) forgetInstance(ctx, child);
}

// ../renderer/src/hydration-diagnostics.ts
function formatHydrationDiagnostic(d) {
  const at = ` at ${d.path}`;
  switch (d.type) {
    case "tag-mismatch":
      return `Hydration mismatch${at} \u2014 Expected: ${d.expected} / Found: ${d.found} / Action: ${d.action}`;
    case "missing-element":
      return `Hydration mismatch${at} \u2014 Expected: ${d.expected} / Found: (nothing) / Action: ${d.action}`;
    case "surplus-element":
      return `Hydration mismatch${at} \u2014 Expected: (nothing) / Found: ${d.found} / Action: ${d.action}`;
  }
}
function createHydrationDiagnosticCollector() {
  const diagnostics = [];
  return {
    diagnostics,
    sink: {
      report(d) {
        diagnostics.push(d);
      }
    }
  };
}
function consoleHydrationDiagnosticSink(logger = console) {
  return {
    report(d) {
      logger.warn(d.message);
    }
  };
}

// ../renderer/src/hydrate.ts
function hydrateGraph(ctx) {
  const root = ctx.graph.root;
  const instance = new NodeInstance(root, ctx.container);
  ctx.instances.set(root.id, instance);
  hydrateChildren(ctx, root, instance, ctx.container, "app");
  return instance;
}
function hydrateNode(ctx, graphNode, domNode, path) {
  const { dom, graph } = ctx;
  switch (graphNode.type) {
    case "text": {
      let textNode = dom.firstChild(domNode);
      if (textNode === null || !dom.isTextNode(textNode)) {
        const created = dom.createTextNode(String(graphNode.getProp("text") ?? ""));
        dom.appendChild(domNode, created);
        textNode = created;
      }
      const instance = new NodeInstance(graphNode, domNode);
      ctx.instances.set(graphNode.id, instance);
      wireEvents(dom, graph, graphNode, domNode, instance);
      if (graphNode.stateRefs.length !== 0) {
        wireSignalBindings(ctx, graphNode, instance, textUpdate(dom, domNode, textNode));
      }
      return instance;
    }
    case "heading": {
      const instance = new NodeInstance(graphNode, domNode);
      ctx.instances.set(graphNode.id, instance);
      wireEvents(dom, graph, graphNode, domNode, instance);
      if (graphNode.stateRefs.length !== 0) {
        wireSignalBindings(ctx, graphNode, instance, headingUpdate(dom, domNode));
      }
      return instance;
    }
    case "input": {
      const instance = new NodeInstance(graphNode, domNode);
      ctx.instances.set(graphNode.id, instance);
      const value = graphNode.getProp("value");
      if (value !== void 0) dom.setProperty(domNode, "value", String(value));
      wireEvents(dom, graph, graphNode, domNode, instance);
      if (graphNode.stateRefs.length !== 0) {
        wireSignalBindings(ctx, graphNode, instance, inputUpdate(dom, domNode));
      }
      return instance;
    }
    case "button": {
      const instance = new NodeInstance(graphNode, domNode);
      ctx.instances.set(graphNode.id, instance);
      wireEvents(dom, graph, graphNode, domNode, instance);
      if (graphNode.stateRefs.length !== 0) {
        wireSignalBindings(ctx, graphNode, instance, buttonUpdate(dom, domNode));
      }
      return instance;
    }
    case "image":
    case "link": {
      const instance = new NodeInstance(graphNode, domNode);
      ctx.instances.set(graphNode.id, instance);
      if (graphNode.type === "link") wireEvents(dom, graph, graphNode, domNode, instance);
      return instance;
    }
    case "reactive-list":
    case "conditional": {
      const instance = new NodeInstance(graphNode, domNode);
      ctx.instances.set(graphNode.id, instance);
      hydrateChildren(ctx, graphNode, instance, domNode, path);
      wireReactiveList(ctx, graphNode, instance, domNode);
      return instance;
    }
    default: {
      const instance = new NodeInstance(graphNode, domNode);
      ctx.instances.set(graphNode.id, instance);
      if (graphNode.type === "form") {
        wireEvents(dom, graph, graphNode, domNode, instance);
      }
      if (graphNode.getProp("_hydrationBoundary") === true) {
        return instance;
      }
      hydrateChildren(ctx, graphNode, instance, domNode, path);
      return instance;
    }
  }
}
function hydrateChildren(ctx, parentGraphNode, parentInstance, parentDom, parentPath) {
  const expected = parentGraphNode.children;
  const actual = elementChildren(ctx, parentDom);
  let cursor = 0;
  const diag = ctx.hydrationDiagnostics !== void 0;
  for (let i = 0; i < expected.length; i++) {
    const childNode = expected[i];
    const want = expectedTag(ctx, childNode);
    const childPath = diag ? `${parentPath} / ${childNode.type}[${i}]` : parentPath;
    const actualEl = actual[cursor];
    if (actualEl !== void 0 && ctx.dom.isElement(actualEl) && ctx.dom.tagName(actualEl) === want) {
      const inst = hydrateNode(ctx, childNode, actualEl, childPath);
      parentInstance.addChild(inst);
      cursor++;
    } else {
      const ref = actualEl ?? null;
      const inst = mountFreshAt(ctx, childNode, parentDom, ref);
      parentInstance.addChild(inst);
      if (actualEl !== void 0) {
        const found = ctx.dom.isElement(actualEl) ? ctx.dom.tagName(actualEl) : null;
        reportHydrationDiagnostic(ctx, {
          type: "tag-mismatch",
          expected: want,
          found,
          path: childPath,
          nodeId: childNode.id,
          nodeType: childNode.type,
          action: "mounted fresh subtree in place"
        });
        ctx.dom.removeChild(parentDom, actualEl);
        cursor++;
      } else {
        reportHydrationDiagnostic(ctx, {
          type: "missing-element",
          expected: want,
          found: null,
          path: childPath,
          nodeId: childNode.id,
          nodeType: childNode.type,
          action: "mounted fresh subtree"
        });
      }
    }
  }
  for (let i = cursor; i < actual.length; i++) {
    const surplus = actual[i];
    reportHydrationDiagnostic(ctx, {
      type: "surplus-element",
      expected: null,
      found: ctx.dom.isElement(surplus) ? ctx.dom.tagName(surplus) : null,
      path: `${parentPath} / [surplus ${i}]`,
      nodeId: null,
      nodeType: null,
      action: "removed surplus server element"
    });
    ctx.dom.removeChild(parentDom, surplus);
  }
}
function reportHydrationDiagnostic(ctx, d) {
  const sink = ctx.hydrationDiagnostics;
  if (sink === void 0) return;
  sink.report({ ...d, message: formatHydrationDiagnostic(d) });
}
function mountFreshAt(ctx, node, parentDom, ref) {
  const inst = mountNode(ctx, node, parentDom);
  if (ref !== null) {
    ctx.dom.insertBefore(parentDom, inst.domNode, ref);
  }
  return inst;
}
function elementChildren(ctx, parent) {
  const out = [];
  for (const node of ctx.dom.childNodes(parent)) {
    if (ctx.dom.isElement(node)) out.push(node);
  }
  return out;
}
function expectedTag(ctx, graphNode) {
  switch (graphNode.type) {
    case "text":
      return "span";
    case "heading": {
      const level = graphNode.getProp("level") ?? 1;
      return `h${level}`;
    }
    case "input":
      return "input";
    case "image":
      return "img";
    case "link":
      return "a";
    case "button":
      return "button";
    default:
      return resolveTag(graphNode.type);
  }
}

// ../renderer/src/render-handle.ts
var StreetRenderHandle = class {
  _disposed = false;
  _ctx;
  _rootInstance;
  constructor(ctx, rootInstance) {
    this._ctx = ctx;
    this._rootInstance = rootInstance;
  }
  flush() {
    if (this._disposed) return;
  }
  unmount() {
    if (this._disposed) return;
    this._disposed = true;
    this._rootInstance.dispose();
    const dom = this._ctx.dom;
    const container = this._ctx.container;
    for (const child of dom.childNodes(container)) {
      dom.removeChild(container, child);
    }
    this._ctx.instances.clear();
  }
};

// ../renderer/src/renderer.ts
var StreetRendererImpl = class {
  _dom;
  _hydrationDiagnostics;
  constructor(options = {}) {
    this._dom = options.domAdapter ?? new BrowserDOMAdapter();
    if (options.hydrationDiagnostics !== void 0) {
      this._hydrationDiagnostics = options.hydrationDiagnostics;
    }
  }
  mount(compiled, container) {
    const ctx = createRenderContext(this._dom, compiled.graph, container);
    const rootInstance = mountGraph(ctx);
    this._wireSignals(ctx, rootInstance);
    return new StreetRenderHandle(ctx, rootInstance);
  }
  /**
   * Hydrate a container that already holds server-rendered HTML for this
   * application. Instead of recreating the DOM, it walks the semantic graph
   * against the existing nodes, adopting matching elements and attaching
   * behavior (events + signal subscriptions). Mismatched subtrees are locally
   * replaced. Returns the same handle type as `mount`.
   */
  hydrate(compiled, container) {
    const ctx = createRenderContext(
      this._dom,
      compiled.graph,
      container,
      this._hydrationDiagnostics
    );
    const rootInstance = hydrateGraph(ctx);
    this._wireSignals(ctx, rootInstance);
    return new StreetRenderHandle(ctx, rootInstance);
  }
  _wireSignals(ctx, rootInstance) {
  }
};
function createRenderer(options) {
  return new StreetRendererImpl(options);
}

// ../renderer/src/dehydrate.ts
var STATE_MARKER_ATTR = "data-streetui-state";
function escapeForScript(json) {
  let out = "";
  for (const ch of json) {
    const code = ch.charCodeAt(0);
    if (ch === "<") out += "\\u003c";
    else if (ch === ">") out += "\\u003e";
    else if (ch === "&") out += "\\u0026";
    else if (code === 8232) out += "\\u2028";
    else if (code === 8233) out += "\\u2029";
    else out += ch;
  }
  return out;
}
function serializeState(state) {
  if (Object.keys(state).length === 0) return "";
  const json = escapeForScript(JSON.stringify(state));
  return `<script type="application/json" ${STATE_MARKER_ATTR}>${json}</script>`;
}
function readState(dom, root) {
  const el = dom.querySelector(root, `script[${STATE_MARKER_ATTR}]`);
  if (el === null) return {};
  const text = dom.getTextContent(el);
  if (text === null || text.length === 0) return {};
  try {
    const parsed = JSON.parse(text);
    if (parsed !== null && typeof parsed === "object") {
      return parsed;
    }
    return {};
  } catch {
    return {};
  }
}

// ../renderer/src/ssr.ts
function renderToString(compiled, options = {}) {
  const dom = options.domAdapter ?? new ServerDOMAdapter();
  const container = dom.createElement("div");
  const ctx = createRenderContext(dom, compiled.graph, container);
  const rootInstance = mountGraph(ctx);
  const html = dom.serializeInner(container);
  rootInstance.dispose();
  ctx.instances.clear();
  return html;
}

// ../router/src/matching.ts
function segments(path) {
  return path.split("/").filter((s) => s.length > 0);
}
function normalizePath(path) {
  let p = path.trim();
  if (p === "") return "/";
  if (!p.startsWith("/")) p = `/${p}`;
  if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
  return p;
}
function matchPattern(pattern2, pathname) {
  if (pattern2 === "*") {
    return { "*": normalizePath(pathname).slice(1) };
  }
  const patSegs = segments(pattern2);
  const pathSegs = segments(normalizePath(pathname));
  const params = {};
  for (let i = 0; i < patSegs.length; i++) {
    const patSeg = patSegs[i];
    if (patSeg === "*") {
      params["*"] = pathSegs.slice(i).map((s) => decodeURIComponent(s)).join("/");
      return params;
    }
    const pathSeg = pathSegs[i];
    if (pathSeg === void 0) return null;
    if (patSeg.startsWith(":")) {
      const name = patSeg.slice(1);
      if (name === "") return null;
      params[name] = decodeURIComponent(pathSeg);
      continue;
    }
    if (patSeg !== pathSeg) return null;
  }
  if (pathSegs.length !== patSegs.length) return null;
  return params;
}
function matchRoutes(routes, pathname) {
  for (const route of routes) {
    const params = matchPattern(route.path, pathname);
    if (params !== null) return { route, params };
  }
  return null;
}
function splitTarget(to) {
  const hashIndex = to.indexOf("#");
  const withoutHash = hashIndex >= 0 ? to.slice(0, hashIndex) : to;
  const qIndex = withoutHash.indexOf("?");
  if (qIndex < 0) return { pathname: normalizePath(withoutHash), search: "" };
  return {
    pathname: normalizePath(withoutHash.slice(0, qIndex)),
    search: withoutHash.slice(qIndex + 1)
  };
}

// ../router/src/history.ts
function buildLocation(pathname, search) {
  return { pathname, search };
}
function toUrl(pathname, search) {
  return search.length > 0 ? `${pathname}?${search}` : pathname;
}
function createBrowserHistory() {
  const listeners = /* @__PURE__ */ new Set();
  const notify = () => {
    for (const cb of listeners) cb();
  };
  const onPopState = () => notify();
  window.addEventListener("popstate", onPopState);
  const current = () => {
    const loc = window.location;
    return buildLocation(loc.pathname, loc.search.replace(/^\?/, ""));
  };
  return {
    location: current,
    push(pathname, search) {
      window.history.pushState({}, "", toUrl(pathname, search));
      notify();
    },
    replace(pathname, search) {
      window.history.replaceState({}, "", toUrl(pathname, search));
      notify();
    },
    back() {
      window.history.back();
    },
    forward() {
      window.history.forward();
    },
    listen(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    dispose() {
      window.removeEventListener("popstate", onPopState);
      listeners.clear();
    }
  };
}
function createMemoryHistory(initial = "/") {
  const listeners = /* @__PURE__ */ new Set();
  const notify = () => {
    for (const cb of listeners) cb();
  };
  const parse = (entry) => {
    const qIndex = entry.indexOf("?");
    if (qIndex < 0) return buildLocation(entry, "");
    return buildLocation(entry.slice(0, qIndex), entry.slice(qIndex + 1));
  };
  const stack = [initial];
  let index = 0;
  return {
    location() {
      return parse(stack[index]);
    },
    push(pathname, search) {
      stack.splice(index + 1);
      stack.push(toUrl(pathname, search));
      index = stack.length - 1;
      notify();
    },
    replace(pathname, search) {
      stack[index] = toUrl(pathname, search);
      notify();
    },
    back() {
      if (index > 0) {
        index--;
        notify();
      }
    },
    forward() {
      if (index < stack.length - 1) {
        index++;
        notify();
      }
    },
    listen(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    dispose() {
      listeners.clear();
    }
  };
}

// ../router/src/router.ts
var DEFAULT_NOT_FOUND = {
  path: "*",
  builder: (page) => {
    page.section("not-found", (s) => {
      s.heading("404 \u2014 Page not found", { level: 1, id: "not-found-title" });
      s.text("The page you were looking for does not exist.", { id: "not-found-text" });
      s.link("Go home", { href: "/", id: "not-found-home" });
    }, { id: "not-found" });
  }
};
function createRouter(options) {
  const routes = options.routes;
  const history = options.history ?? createBrowserHistory();
  const fallback = options.notFound ?? DEFAULT_NOT_FOUND;
  const resolve = () => {
    const loc = history.location();
    const pathname = normalizePath(loc.pathname);
    const query = new URLSearchParams(loc.search);
    const matched = matchRoutes(routes, pathname);
    if (matched !== null) {
      return {
        path: pathname,
        pattern: matched.route.path,
        params: matched.params,
        query,
        route: matched.route,
        // A catch-all `*` match is the 404 route whether user-supplied or built-in.
        isFallback: matched.route.path === "*"
      };
    }
    const fallbackParams = matchRoutes([fallback], pathname)?.params ?? {};
    return {
      path: pathname,
      pattern: fallback.path,
      params: fallbackParams,
      query,
      route: fallback,
      isFallback: true
    };
  };
  const current = signal(resolve());
  const stopListening = history.listen(() => {
    current.set(resolve());
  });
  const navigate = (to, opts = {}) => {
    const { pathname, search } = splitTarget(to);
    if (opts.replace === true) history.replace(pathname, search);
    else history.push(pathname, search);
  };
  const isActive = (path, opts = {}) => {
    const target = normalizePath(path);
    const exact = opts.exact === true;
    return derived(() => {
      const activePath = current.get().path;
      if (activePath === target) return true;
      if (exact || target === "/") return false;
      return activePath.startsWith(`${target}/`);
    });
  };
  return {
    currentRoute: current,
    navigate,
    back: () => history.back(),
    forward: () => history.forward(),
    isActive,
    destroy: () => {
      stopListening();
      history.dispose();
    }
  };
}

// ../router/src/mount-router.ts
var ROUTER_OUTLET_ID = "streetui-router-outlet";
function routerOutlet(scope, id = ROUTER_OUTLET_ID) {
  scope.container("router-outlet", () => {
  }, { id });
}
function isExternalHref(href) {
  return /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(href) || // scheme: http:, https:, mailto:, tel:
  href.startsWith("//");
}
function mountRouter(router, options) {
  const { container } = options;
  const renderer = options.renderer ?? createRenderer();
  const outletId = options.outletId ?? ROUTER_OUTLET_ID;
  const interceptLinks = options.interceptLinks ?? true;
  const hydrateMode = options.hydrate ?? false;
  let shellMounted = null;
  let outlet;
  if (options.shell !== void 0) {
    const shellApp = streetui.app({ name: "router-shell" });
    const shellBuilder = options.shell;
    shellApp.page("shell", (page) => shellBuilder(page, router));
    const shellRuntime = createRuntime({ renderer });
    const shellCompiled = compile(shellApp);
    if (hydrateMode) {
      for (const node of shellCompiled.graph.findAll((n) => n.getProp("id") === outletId)) {
        node.setProp("_hydrationBoundary", true);
      }
    }
    shellMounted = hydrateMode ? shellRuntime.hydrate(shellCompiled, container) : shellRuntime.mount(shellCompiled, container);
    const found = container.querySelector(`[id="${outletId}"]`);
    if (found === null) {
      throw new Error(
        `[Router] The shell must contain a route outlet. Call routerOutlet(scope) (or add a container with id="${outletId}") inside your shell builder.`
      );
    }
    outlet = found;
  } else {
    outlet = container;
  }
  let active = null;
  let firstRender = hydrateMode;
  const disposeActive = () => {
    if (active === null) return;
    active.registry.run();
    active.mounted.unmount();
    active = null;
  };
  const renderRoute = (match) => {
    disposeActive();
    const registry = new CleanupRegistry();
    const ctx = {
      path: match.path,
      pattern: match.pattern,
      params: match.params,
      query: match.query,
      onCleanup: (fn) => registry.add(fn)
    };
    const routeApp = streetui.app({ name: `route:${match.pattern}` });
    routeApp.page("route", (page) => match.route.builder(page, ctx));
    const runtime = createRuntime({ renderer });
    const routeCompiled = compile(routeApp);
    const mounted = firstRender ? runtime.hydrate(routeCompiled, outlet) : runtime.mount(routeCompiled, outlet);
    firstRender = false;
    active = { registry, mounted };
  };
  renderRoute(router.currentRoute.peek());
  const stopRouteSub = router.currentRoute.subscribe((match) => renderRoute(match));
  const onClick = (event) => {
    if (event.defaultPrevented) return;
    const mouse = event;
    if (typeof mouse.button === "number" && mouse.button !== 0) return;
    if (mouse.metaKey || mouse.ctrlKey || mouse.shiftKey || mouse.altKey) return;
    const target = event.target;
    const anchor = target?.closest?.("a") ?? null;
    if (anchor === null) return;
    const targetAttr = anchor.getAttribute("target");
    if (targetAttr !== null && targetAttr !== "_self") return;
    const href = anchor.getAttribute("href");
    if (href === null || href === "" || href.startsWith("#")) return;
    if (isExternalHref(href)) return;
    event.preventDefault();
    router.navigate(href);
  };
  if (interceptLinks) {
    container.addEventListener("click", onClick);
  }
  return {
    outlet,
    unmount() {
      if (interceptLinks) container.removeEventListener("click", onClick);
      stopRouteSub();
      disposeActive();
      shellMounted?.unmount();
      router.destroy();
    }
  };
}

// ../forms/src/validators.ts
function required(message = "This field is required") {
  return (value) => value.trim().length === 0 ? message : void 0;
}
function minLength(length, message) {
  return (value) => value.length < length ? message ?? `Must be at least ${length} characters` : void 0;
}
function maxLength(length, message) {
  return (value) => value.length > length ? message ?? `Must be at most ${length} characters` : void 0;
}
var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function email(message = "Enter a valid email address") {
  return (value) => value.length === 0 || EMAIL_RE.test(value) ? void 0 : message;
}
function pattern(regex, message = "Invalid format") {
  return (value) => value.length === 0 || regex.test(value) ? void 0 : message;
}
function runValidators(value, validators) {
  if (validators === void 0) return void 0;
  const list = Array.isArray(validators) ? validators : [validators];
  for (const validate of list) {
    const error = validate(value);
    if (error !== void 0) return error;
  }
  return void 0;
}

// ../forms/src/form.ts
function createForm(config) {
  const names = Object.keys(config.initialValues);
  const validators = config.validators ?? {};
  let programmatic = false;
  const fields = /* @__PURE__ */ new Map();
  for (const name of names) {
    const initial = config.initialValues[name];
    const value = signal(initial);
    const touched = signal(false);
    const error = derived(
      () => runValidators(value.get(), validators[name])
    );
    const valid2 = derived(() => error.get() === void 0);
    const dirty2 = derived(() => value.get() !== initial);
    const unsub = value.subscribe(() => {
      if (!programmatic) touched.set(true);
    });
    const api = {
      name,
      value,
      error,
      touched,
      dirty: dirty2,
      valid: valid2,
      setValue(next) {
        value.set(next);
      },
      markTouched(next = true) {
        touched.set(next);
      },
      reset() {
        programmatic = true;
        try {
          batch(() => {
            value.set(initial);
            touched.set(false);
          });
        } finally {
          programmatic = false;
        }
      }
    };
    fields.set(name, { api, value, touched, error, valid: valid2, dirty: dirty2, initial, unsub });
  }
  const field = (name) => {
    const f = fields.get(name);
    if (f === void 0) throw new Error(`Unknown form field: ${name}`);
    return f;
  };
  const values = derived(() => {
    const out = {};
    for (const name of names) out[name] = field(name).value.get();
    return out;
  });
  const errors = derived(() => {
    const out = {};
    for (const name of names) {
      const e = field(name).error.get();
      if (e !== void 0) out[name] = e;
    }
    return out;
  });
  const touchedMap = derived(() => {
    const out = {};
    for (const name of names) out[name] = field(name).touched.get();
    return out;
  });
  const dirty = derived(() => names.some((n) => field(n).dirty.get()));
  const valid = derived(() => names.every((n) => field(n).valid.get()));
  const status = signal("idle");
  const submitting = derived(() => status.get() === "submitting");
  const submitted = derived(() => status.get() === "success");
  const submitError = signal(void 0);
  function setValues(partial) {
    programmatic = true;
    try {
      batch(() => {
        for (const name of names) {
          const next = partial[name];
          if (next !== void 0) field(name).value.set(next);
        }
      });
    } finally {
      programmatic = false;
    }
  }
  function reset() {
    programmatic = true;
    try {
      batch(() => {
        for (const name of names) {
          const f = field(name);
          f.value.set(f.initial);
          f.touched.set(false);
        }
        status.set("idle");
        submitError.set(void 0);
      });
    } finally {
      programmatic = false;
    }
  }
  async function submit() {
    batch(() => {
      for (const name of names) field(name).touched.set(true);
    });
    if (!valid.peek()) {
      return;
    }
    submitError.set(void 0);
    status.set("submitting");
    try {
      await config.onSubmit?.(values.peek());
      status.set("success");
    } catch (err) {
      submitError.set(err);
      status.set("error");
    }
  }
  function dispose() {
    for (const f of fields.values()) {
      f.unsub();
      f.error.dispose();
      f.valid.dispose();
      f.dirty.dispose();
    }
    values.dispose();
    errors.dispose();
    touchedMap.dispose();
    dirty.dispose();
    valid.dispose();
    submitting.dispose();
    submitted.dispose();
  }
  return {
    values,
    errors,
    touched: touchedMap,
    dirty,
    valid,
    submitting,
    submitted,
    status,
    submitError,
    field: (name) => field(name).api,
    setValues,
    submit,
    reset,
    dispose
  };
}

// ../context/src/context.ts
function createContext(defaultValue, description) {
  const id = Symbol(description ?? "streetui.context");
  const stack = [];
  return {
    id,
    defaultValue,
    provide(value, run) {
      stack.push(value);
      try {
        return run();
      } finally {
        stack.pop();
      }
    },
    consume() {
      return stack.length > 0 ? stack[stack.length - 1] : defaultValue;
    },
    hasProvider() {
      return stack.length > 0;
    }
  };
}

// ../i18n/src/i18n.ts
var INTERPOLATION = /\{(\w+)\}/g;
function interpolate(template, params) {
  if (params === void 0) return template;
  return template.replace(INTERPOLATION, (whole, name) => {
    const value = params[name];
    return value === void 0 ? whole : String(value);
  });
}
function createI18n(config) {
  const messages = config.messages;
  const fallback = config.fallbackLocale;
  const localeSignal = signal(config.locale);
  const locales = Object.keys(messages);
  function lookup(loc, key) {
    const active = messages[loc];
    const hit = active === void 0 ? void 0 : active[key];
    if (hit !== void 0) return hit;
    if (fallback !== void 0 && fallback !== loc) {
      const fb = messages[fallback];
      if (fb !== void 0) return fb[key];
    }
    return void 0;
  }
  function resolve(loc, key, params) {
    const template = lookup(loc, key);
    return template === void 0 ? key : interpolate(template, params);
  }
  function pluralKey(loc, key, count) {
    const category = new Intl.PluralRules(loc).select(count);
    if (lookup(loc, `${key}.${category}`) !== void 0) return `${key}.${category}`;
    return `${key}.other`;
  }
  return {
    locale: localeSignal,
    locales,
    setLocale(loc) {
      localeSignal.set(loc);
    },
    t(key, params) {
      return derived(() => resolve(localeSignal.get(), key, params));
    },
    translate(key, params) {
      return resolve(localeSignal.peek(), key, params);
    },
    plural(key, count, params) {
      const merged = { count, ...params ?? {} };
      return derived(() => {
        const loc = localeSignal.get();
        return resolve(loc, pluralKey(loc, key, count), merged);
      });
    },
    has(key) {
      return lookup(localeSignal.peek(), key) !== void 0;
    }
  };
}

// ../devtools/src/inspector.ts
function inspectGraph(graph) {
  return inspectNode(graph.root, 0);
}
function inspectNode(node, depth) {
  return {
    id: node.id,
    type: node.type,
    key: node.key,
    props: { ...node.props },
    eventTypes: node.events.map((e) => e.type),
    stateBindings: node.stateRefs.map((r) => `${r.propKey}\u2192${r.signalId}`),
    depth,
    children: node.children.map((c) => inspectNode(c, depth + 1))
  };
}
function printGraph(graph) {
  const lines = [];
  graph.walk((node, depth) => {
    const indent = "  ".repeat(depth);
    const props = Object.entries(node.props).filter(([k]) => !k.startsWith("_")).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(", ");
    const events = node.events.length > 0 ? ` [events: ${node.events.map((e) => e.type).join(", ")}]` : "";
    const stateRefs = node.stateRefs.length > 0 ? ` [signals: ${node.stateRefs.map((r) => r.propKey).join(", ")}]` : "";
    lines.push(`${indent}<${node.type}${props ? ` ${props}` : ""}${events}${stateRefs}>`);
  });
  return lines.join("\n");
}
function printDiagnostics(compiled) {
  if (compiled.diagnostics.diagnostics.length === 0) {
    return "(no diagnostics)";
  }
  return compiled.diagnostics.diagnostics.map(formatDiagnostic).join("\n");
}
function nodeTypeStats(graph) {
  const counts = {};
  graph.walk((node) => {
    counts[node.type] = (counts[node.type] ?? 0) + 1;
  });
  return counts;
}

// ../devtools/src/application.ts
function collectPerf(node, distinctSignals, acc) {
  acc.totalNodes += 1;
  if (node.depth > acc.maxDepth) acc.maxDepth = node.depth;
  acc.eventHandlers += node.eventTypes.length;
  acc.stateBindings += node.stateBindings.length;
  if (node.children.length > acc.largestChildCount) acc.largestChildCount = node.children.length;
  for (const child of node.children) collectPerf(child, distinctSignals, acc);
}
function collectSignals(node, into) {
  for (const binding of node.stateBindings) {
    const arrow = binding.indexOf("\u2192");
    const signalId = arrow >= 0 ? binding.slice(arrow + 1) : binding;
    if (signalId.length > 0) into.add(signalId);
  }
  for (const child of node.children) collectSignals(child, into);
}
function inspectApplication(compiled) {
  const graph = inspectGraph(compiled.graph);
  const signals = /* @__PURE__ */ new Set();
  collectSignals(graph, signals);
  const pages = graph.children.filter((child) => child.type === "page").map((child) => ({ id: child.id, key: child.key }));
  const diags = compiled.diagnostics.diagnostics;
  const errors = diags.filter((d) => d.severity === "error").length;
  const perfAcc = { totalNodes: 0, maxDepth: 0, eventHandlers: 0, stateBindings: 0, largestChildCount: 0 };
  collectPerf(graph, signals.size, perfAcc);
  let reactiveLists = 0;
  for (const key of compiled.graph.handlers.keys()) {
    if (key.startsWith("__listplan__")) reactiveLists += 1;
  }
  return {
    identity: {
      name: compiled.name,
      version: compiled.version,
      compiledAt: compiled.compiledAt
    },
    graph,
    nodeStats: nodeTypeStats(compiled.graph),
    signals: [...signals].sort(),
    pages,
    diagnostics: {
      errors,
      warnings: diags.length - errors,
      messages: diags.map(formatDiagnostic)
    },
    perf: {
      totalNodes: perfAcc.totalNodes,
      maxDepth: perfAcc.maxDepth,
      eventHandlers: perfAcc.eventHandlers,
      stateBindings: perfAcc.stateBindings,
      distinctSignals: signals.size,
      largestChildCount: perfAcc.largestChildCount,
      reactiveLists
    }
  };
}

// ../devtools/src/diagnostics.ts
var DEFAULT_PERF_THRESHOLDS = {
  maxNodes: 5e3,
  maxDepth: 32,
  maxChildCount: 1e3,
  maxSignals: 1e3
};
function diagnosePerformance(compiled, thresholds = {}) {
  const t = { ...DEFAULT_PERF_THRESHOLDS, ...thresholds };
  const { perf } = inspectApplication(compiled);
  const out = [];
  if (perf.totalNodes > t.maxNodes) {
    out.push({
      code: "large-graph",
      message: `Graph has ${perf.totalNodes} nodes (> ${t.maxNodes}); consider splitting the view or paginating.`,
      observed: perf.totalNodes,
      threshold: t.maxNodes
    });
  }
  if (perf.maxDepth > t.maxDepth) {
    out.push({
      code: "deep-tree",
      message: `Graph nests ${perf.maxDepth} levels deep (> ${t.maxDepth}); deep trees slow mount and reconciliation.`,
      observed: perf.maxDepth,
      threshold: t.maxDepth
    });
  }
  if (perf.largestChildCount > t.maxChildCount) {
    out.push({
      code: "large-list",
      message: `A single node has ${perf.largestChildCount} children (> ${t.maxChildCount}); large un-windowed lists dominate DOM cost.`,
      observed: perf.largestChildCount,
      threshold: t.maxChildCount
    });
  }
  if (perf.distinctSignals > t.maxSignals) {
    out.push({
      code: "high-signal-fanout",
      message: `${perf.distinctSignals} distinct signals are bound (> ${t.maxSignals}); heavy reactive fan-out increases update overhead.`,
      observed: perf.distinctSignals,
      threshold: t.maxSignals
    });
  }
  return out;
}

// ../devtools/src/inspect-reactive.ts
function inspectSignal(source, options = {}) {
  const raw = source.peek();
  let value = raw;
  if (options.redact === true) value = "[redacted]";
  else if (typeof options.redact === "function") value = options.redact(raw);
  return {
    kind: signalKind(source),
    value,
    observerCount: observerCount(source)
  };
}
function inspectResource(resource2, options = {}) {
  const error = resource2.error.peek();
  const hasError = error !== void 0 && error !== null;
  const base = {
    status: resource2.status.peek(),
    loading: resource2.loading.peek(),
    isRefetching: resource2.isRefetching.peek(),
    hasData: resource2.data.peek() !== void 0,
    hasError,
    errorName: hasError ? errorConstructorName(error) : void 0
  };
  if (options.includeData !== true) return base;
  return {
    ...base,
    data: resource2.data.peek(),
    ...hasError ? { errorMessage: errorMessageOf(error) } : {}
  };
}
function errorConstructorName(error) {
  if (error instanceof Error) return error.name;
  return typeof error;
}
function errorMessageOf(error) {
  if (error instanceof Error) return error.message;
  return String(error);
}
function inspectRouter(router) {
  const match = router.currentRoute.peek();
  const query = {};
  for (const [k, v] of match.query.entries()) query[k] = v;
  return {
    path: match.path,
    pattern: match.pattern,
    params: { ...match.params },
    query,
    isFallback: match.isFallback === true
  };
}
function inspectForm(form, options = {}) {
  const values = form.values.peek();
  const errorsRaw = form.errors.peek();
  const touchedRaw = form.touched.peek();
  const errors = {};
  for (const [k, v] of Object.entries(errorsRaw)) if (v !== void 0) errors[k] = v;
  const touched = {};
  for (const [k, v] of Object.entries(touchedRaw)) touched[k] = v === true;
  const base = {
    fields: Object.keys(values),
    errors,
    touched,
    dirty: form.dirty.peek(),
    valid: form.valid.peek(),
    status: form.status.peek()
  };
  if (options.includeValues !== true) return base;
  return { ...base, values: { ...values } };
}
function inspectContext(context) {
  return {
    description: context.id.description ?? "streetui.context",
    hasProvider: context.hasProvider()
  };
}
function inspectI18n(i18n, options = {}) {
  const base = {
    locale: i18n.locale.peek(),
    locales: [...i18n.locales]
  };
  if (options.checkKeys === void 0) return base;
  const missingKeys = options.checkKeys.filter((k) => !i18n.has(k));
  return { ...base, missingKeys };
}

// ../devtools/src/panels.ts
function createDevTools(compiled, sources = {}, options = {}) {
  let current = capture(compiled, sources, options);
  return {
    get snapshot() {
      return current;
    },
    refresh() {
      current = capture(compiled, sources, options);
      return current;
    },
    selectNode(id) {
      return findNode(current.graph, id);
    },
    format() {
      return formatSnapshot(current);
    }
  };
}
function capture(compiled, sources, options) {
  const app = inspectApplication(compiled);
  const application = {
    identity: app.identity,
    nodeCount: app.perf.totalNodes,
    maxDepth: app.perf.maxDepth,
    pages: app.pages,
    signalCount: app.signals.length,
    eventHandlers: app.perf.eventHandlers,
    stateBindings: app.perf.stateBindings,
    errors: app.diagnostics.errors,
    warnings: app.diagnostics.warnings
  };
  const live = {};
  if (sources.signals !== void 0) {
    for (const [label, sig] of Object.entries(sources.signals)) {
      live[label] = inspectSignal(
        sig,
        options.redactSignals !== void 0 ? { redact: options.redactSignals } : {}
      );
    }
  }
  const signals = { boundSignalIds: app.signals, live };
  const performance = {
    snapshot: app.perf,
    diagnostics: diagnosePerformance(compiled, options.perfThresholds)
  };
  const snapshot = {
    application,
    graph: app.graph,
    signals,
    performance,
    ...sources.router !== void 0 ? { router: inspectRouter(sources.router) } : {},
    ...sources.resources !== void 0 ? { resources: mapInspect(sources.resources, (r) => inspectResource(r)) } : {},
    ...sources.forms !== void 0 ? { forms: mapInspect(sources.forms, (f) => inspectForm(f)) } : {},
    ...sources.contexts !== void 0 ? { contexts: mapInspect(sources.contexts, (c) => inspectContext(c)) } : {},
    ...sources.i18n !== void 0 ? {
      i18n: inspectI18n(
        sources.i18n,
        options.i18nCheckKeys !== void 0 ? { checkKeys: options.i18nCheckKeys } : {}
      )
    } : {}
  };
  return snapshot;
}
function mapInspect(source, inspect) {
  const out = {};
  for (const [label, value] of Object.entries(source)) out[label] = inspect(value);
  return out;
}
function findNode(node, id) {
  if (node.id === id) return node;
  for (const child of node.children) {
    const found = findNode(child, id);
    if (found !== void 0) return found;
  }
  return void 0;
}
function formatSnapshot(s) {
  const lines = [];
  const app = s.application;
  lines.push(`StreetUI DevTools \u2014 ${app.identity.name} v${app.identity.version}`);
  lines.push(
    `Application: ${app.nodeCount} nodes, depth ${app.maxDepth}, ${app.pages.length} page(s)`
  );
  lines.push(
    `  signals ${app.signalCount} \xB7 handlers ${app.eventHandlers} \xB7 bindings ${app.stateBindings} \xB7 errors ${app.errors} \xB7 warnings ${app.warnings}`
  );
  lines.push(`Signals: ${s.signals.boundSignalIds.length} bound in graph`);
  for (const [label, sig] of Object.entries(s.signals.live)) {
    lines.push(`  ${label} [${sig.kind}] = ${format(sig.value)} \xB7 observers ${sig.observerCount ?? "?"}`);
  }
  if (s.router !== void 0) {
    lines.push(`Router: ${s.router.path} (${s.router.pattern})${s.router.isFallback ? " [fallback]" : ""}`);
  }
  if (s.resources !== void 0) {
    lines.push("Resources:");
    for (const [label, r] of Object.entries(s.resources)) {
      lines.push(`  ${label}: ${r.status}${r.loading ? " (loading)" : ""}${r.hasError ? ` !${r.errorName}` : ""}`);
    }
  }
  if (s.forms !== void 0) {
    lines.push("Forms:");
    for (const [label, f] of Object.entries(s.forms)) {
      lines.push(`  ${label}: ${f.valid ? "valid" : "invalid"} \xB7 ${f.status} \xB7 fields ${f.fields.length}`);
    }
  }
  if (s.contexts !== void 0) {
    lines.push("Contexts:");
    for (const [label, c] of Object.entries(s.contexts)) {
      lines.push(`  ${label} (${c.description}): ${c.hasProvider ? "provided" : "no provider"}`);
    }
  }
  if (s.i18n !== void 0) {
    const missing = s.i18n.missingKeys;
    lines.push(
      `i18n: ${s.i18n.locale} of [${s.i18n.locales.join(", ")}]${missing !== void 0 ? ` \xB7 missing ${missing.length}` : ""}`
    );
  }
  lines.push(
    `Performance: ${s.performance.diagnostics.length} diagnostic(s), ${s.performance.snapshot.totalNodes} nodes`
  );
  for (const d of s.performance.diagnostics) {
    lines.push(`  ${d.code}: ${d.message}`);
  }
  return lines.join("\n");
}
function format(value) {
  if (typeof value === "string") return JSON.stringify(value);
  if (value === null || value === void 0) return String(value);
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "[object]";
    }
  }
  return String(value);
}

// src/config.ts
function defineConfig(config) {
  return config;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  AppBuilder,
  Application,
  ApplicationGraph,
  BaseNode,
  BrowserDOMAdapter,
  CleanupRegistry,
  ContainerBuilderImpl,
  DEFAULT_PERF_THRESHOLDS,
  DerivedSignal,
  DiagnosticCollector,
  DiagnosticError,
  DomEventRegistry,
  Environment,
  EventBus,
  FOCUSABLE_SELECTOR,
  FormBuilderImpl,
  GraphNode,
  Lifecycle,
  ListBuilderImpl,
  NodeInstance,
  PageBuilderImpl,
  ROUTER_OUTLET_ID,
  Runtime,
  RuntimeNodeInstance,
  STATE_MARKER_ATTR,
  Scheduler,
  SectionBuilderImpl,
  ServerComment,
  ServerDOMAdapter,
  ServerElement,
  ServerFragment,
  ServerStyle,
  ServerText,
  Signal,
  Store,
  StreetApp,
  StreetFrameworkError,
  StreetRenderHandle,
  StreetRendererImpl,
  VERSION,
  a11yIds,
  applyNodeProps,
  applyProp,
  batch,
  bindDomEvent,
  browserDOMAdapter,
  buttonUpdate,
  compile,
  compileGraph,
  consoleDiagnosticSink,
  consoleHydrationDiagnosticSink,
  createApplication,
  createBrowserHistory,
  createContext,
  createDevTools,
  createForm,
  createHydrationDiagnosticCollector,
  createI18n,
  createMemoryHistory,
  createNodeId,
  createRenderContext,
  createRenderer,
  createRouter,
  createRuntime,
  createStore,
  createStreetEvent,
  defineConfig,
  derived,
  diagnosePerformance,
  effect,
  email,
  environment,
  escapeHtmlAttr,
  escapeHtmlText,
  flushSync,
  focusById,
  focusFirst,
  formatDiagnostic,
  formatDiagnosticContext,
  formatHydrationDiagnostic,
  frameworkError,
  generateApplicationId,
  generateNodeId,
  globalEventBus,
  headingUpdate,
  hydrateGraph,
  inputUpdate,
  inspectApplication,
  inspectContext,
  inspectForm,
  inspectGraph,
  inspectI18n,
  inspectResource,
  inspectRouter,
  inspectSignal,
  interpolate,
  isBatching,
  matchPattern,
  matchRoutes,
  maxLength,
  minLength,
  mountGraph,
  mountNode,
  mountRouter,
  nextId,
  nodeIdPrefix,
  nodeTypeStats,
  normalizePath,
  observerCount,
  patchNode,
  patchProp,
  pattern,
  printDiagnostics,
  printGraph,
  reactiveListItemKey,
  reactiveListItemSignature,
  readState,
  reconcileChildren,
  reconcileChildrenByPlan,
  renderToString,
  reportDiagnostic,
  required,
  resetIdCounter,
  resolveTag,
  resource,
  routerOutlet,
  runValidators,
  scheduleImmediate,
  scheduleUpdate,
  scheduler,
  serializeChildren,
  serializeServerNode,
  serializeState,
  serverDOMAdapter,
  signal,
  signalKind,
  splitTarget,
  streetui,
  textUpdate,
  toIdToken,
  transformGraph,
  validateGraph,
  wireEvents,
  wireReactiveList,
  wireSignalBindings
});
//# sourceMappingURL=index.cjs.map