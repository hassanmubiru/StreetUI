// src/version.ts
var VERSION = "2.0.0";

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

// ../state/src/mutation.ts
function mutation(mutator, options = {}) {
  const status = signal("idle");
  const data = signal(void 0);
  const error = signal(void 0);
  const pending = derived(() => status.get() === "loading");
  let disposed = false;
  let runId = 0;
  const mutate = async (args) => {
    if (disposed) {
      return await mutator(args);
    }
    const myRun = ++runId;
    batch(() => {
      error.set(void 0);
      status.set("loading");
    });
    try {
      const result = await mutator(args);
      if (!disposed && myRun === runId) {
        batch(() => {
          data.set(result);
          error.set(void 0);
          status.set("success");
        });
      }
      if (!disposed && myRun === runId) {
        await options.onSuccess?.(result, args);
        await options.onSettled?.(args);
      }
      return result;
    } catch (err) {
      if (!disposed && myRun === runId) {
        batch(() => {
          error.set(err);
          status.set("error");
        });
        await options.onError?.(err, args);
        await options.onSettled?.(args);
      }
      throw err;
    }
  };
  const reset = () => {
    batch(() => {
      status.set("idle");
      data.set(void 0);
      error.set(void 0);
    });
  };
  const dispose = () => {
    disposed = true;
  };
  if (options.onCleanup !== void 0) options.onCleanup(dispose);
  return { status, data, error, pending, mutate, reset, dispose };
}

// ../state/src/client.ts
var HttpError = class extends Error {
  status;
  statusText;
  url;
  body;
  constructor(status, statusText, url, body) {
    super(`HTTP ${status} ${statusText} for ${url}`);
    this.name = "HttpError";
    this.status = status;
    this.statusText = statusText;
    this.url = url;
    this.body = body;
  }
};
function joinUrl(baseUrl, path) {
  if (baseUrl === void 0 || baseUrl === "") return path;
  const b = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${b}${p}`;
}
function withQuery(url, query) {
  if (query === void 0) return url;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) params.set(k, String(v));
  const qs = params.toString();
  if (qs === "") return url;
  return url.includes("?") ? `${url}&${qs}` : `${url}?${qs}`;
}
function createClient(config = {}) {
  const doFetch = config.fetch ?? ((input, init) => {
    if (typeof fetch === "undefined") {
      throw new Error("createClient: no global fetch; pass { fetch } explicitly");
    }
    return fetch(input, init);
  });
  async function request(method, path, body, reqConfig = {}) {
    const url = withQuery(joinUrl(config.baseUrl, path), reqConfig.query);
    const headers = { ...config.headers, ...reqConfig.headers };
    const init = { method, headers };
    if (reqConfig.signal !== void 0) init.signal = reqConfig.signal;
    if (body !== void 0) {
      if (headers["Content-Type"] === void 0) headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(body);
    }
    const response = await doFetch(url, init);
    const parsed = await parseBody(response);
    if (!response.ok) {
      throw new HttpError(response.status, response.statusText, url, parsed);
    }
    return parsed;
  }
  return {
    request,
    get: (path, c) => request("GET", path, void 0, c),
    post: (path, b, c) => request("POST", path, b, c),
    put: (path, b, c) => request("PUT", path, b, c),
    patch: (path, b, c) => request("PATCH", path, b, c),
    del: (path, c) => request("DELETE", path, void 0, c),
    resource: (path, options = {}) => {
      const { query, ...resourceOptions } = options;
      return resource(
        (ctx) => request("GET", path, void 0, { signal: ctx.signal, ...query !== void 0 ? { query } : {} }),
        resourceOptions
      );
    },
    mutation: (method, path, options) => mutation((args) => request(method, path, args), options ?? {})
  };
}
async function parseBody(response) {
  const text = await response.text();
  if (text === "") return void 0;
  const type = response.headers.get("content-type") ?? "";
  if (type.includes("application/json")) {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
  return text;
}

// ../state/src/auth.ts
function createAuthSession(config) {
  const session = resource(
    (ctx) => config.loadUser(ctx),
    {
      ...config.immediate !== void 0 ? { immediate: config.immediate } : {},
      ...config.onCleanup !== void 0 ? { onCleanup: config.onCleanup } : {}
    }
  );
  const status = derived(() => {
    const s = session.status.get();
    const d = session.data.get();
    if (s === "error") return "error";
    if (s === "idle" || s === "loading" && d === void 0) return "loading";
    return d === null || d === void 0 ? "unauthenticated" : "authenticated";
  });
  const user = derived(() => {
    const d = session.data.get();
    return d === null ? void 0 : d;
  });
  const authenticated = derived(() => status.get() === "authenticated");
  const unauthenticated = derived(() => status.get() === "unauthenticated");
  const loading = derived(() => status.get() === "loading");
  const logoutMutation = mutation(
    async () => {
      await config.logout?.();
    },
    { onSuccess: () => session.refetch() }
  );
  const dispose = () => {
    session.dispose();
    status.dispose();
    user.dispose();
    authenticated.dispose();
    unauthenticated.dispose();
    loading.dispose();
    logoutMutation.dispose();
  };
  return {
    status,
    user,
    error: session.error,
    authenticated,
    unauthenticated,
    loading,
    loggingOut: logoutMutation.pending,
    refresh: () => session.refetch(),
    logout: () => logoutMutation.mutate(void 0),
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
    trigger: `${token}-trigger`,
    controls: `${token}-controls`,
    owns: `${token}-owns`,
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
  if (context.component !== void 0) parts.push(`component=${context.component}`);
  if (context.phase !== void 0) parts.push(`phase=${context.phase}`);
  if (context.nodeId !== void 0) parts.push(`node=${context.nodeId}`);
  if (context.element !== void 0) parts.push(`element=${context.element}`);
  if (context.route !== void 0) parts.push(`route=${context.route}`);
  if (context.resource !== void 0) parts.push(`resource=${context.resource}`);
  if (context.signal !== void 0) parts.push(`signal=${context.signal}`);
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
function describeErrorAt(error, context, options, depth) {
  const isError = error instanceof Error;
  const name = isError ? error.name : "Error";
  const message = isError ? error.message : safeStringify(error);
  const report = { name, message, isError };
  if (context !== void 0) report.context = context;
  if (options.includeStack === true && isError && typeof error.stack === "string") {
    report.stack = error.stack;
  }
  if (options.includeCause === true && isError && depth < 4) {
    const cause = error.cause;
    if (cause !== void 0 && cause !== null) {
      report.cause = describeErrorAt(cause, void 0, options, depth + 1);
    }
  }
  return report;
}
function safeStringify(value) {
  if (typeof value === "string") return value;
  if (value === null) return "null";
  if (value === void 0) return "undefined";
  const t = typeof value;
  if (t === "number" || t === "boolean" || t === "bigint" || t === "symbol") {
    return String(value);
  }
  const ctor = t === "object" && value !== null ? value.constructor?.name ?? "Object" : t;
  return `[non-Error ${ctor}]`;
}
function describeError(error, context, options = {}) {
  return describeErrorAt(error, context, options, 0);
}
function reportError(sink, error, context, options = {}) {
  const report = describeError(error, context, options);
  reportDiagnostic(sink, "error", report.message, report.context);
  return report;
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
    this.handlers.delete(`__overlay__${node.id}`);
    this.handlers.delete(`__component__${node.id}`);
    this.handlers.delete(`__transition__${node.id}`);
    this.handlers.delete(`__head__${node.id}`);
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

// ../dsl/src/transition.ts
function classes(value) {
  if (value === void 0) return [];
  const out = [];
  for (const token of value.split(/\s+/)) {
    if (token.length > 0 && !out.includes(token)) out.push(token);
  }
  return out;
}
function merge(a, b) {
  const out = [...a];
  for (const token of b) if (!out.includes(token)) out.push(token);
  return out;
}
function resolveTransition(config) {
  const n = config.name;
  const enterActive = merge(
    classes(config.enter),
    classes(config.enterActive ?? (n !== void 0 ? `${n}-enter-active` : void 0))
  );
  const leaveActive = merge(
    classes(config.leave),
    classes(config.leaveActive ?? (n !== void 0 ? `${n}-leave-active` : void 0))
  );
  return {
    enterActive,
    enterFrom: classes(config.enterFrom ?? (n !== void 0 ? `${n}-enter-from` : void 0)),
    enterTo: classes(config.enterTo ?? (n !== void 0 ? `${n}-enter-to` : void 0)),
    leaveActive,
    leaveFrom: classes(config.leaveFrom ?? (n !== void 0 ? `${n}-leave-from` : void 0)),
    leaveTo: classes(config.leaveTo ?? (n !== void 0 ? `${n}-leave-to` : void 0)),
    appear: config.appear ?? false,
    duration: config.duration ?? 1e3
  };
}
function isTransitionConfig(value) {
  if (value === null || typeof value !== "object") return false;
  const o = value;
  return typeof o["name"] === "string" || typeof o["enter"] === "string" || typeof o["enterActive"] === "string" || typeof o["enterFrom"] === "string" || typeof o["leave"] === "string" || typeof o["leaveActive"] === "string" || typeof o["leaveFrom"] === "string";
}

// ../dsl/src/head.ts
function metaDedupKey(m) {
  if (m.charset !== void 0) return "meta:charset";
  if (m.name !== void 0) return `meta:name=${m.name}`;
  if (m.property !== void 0) return `meta:property=${m.property}`;
  if (m.httpEquiv !== void 0) return `meta:http-equiv=${m.httpEquiv}`;
  return void 0;
}
function metaAttrs(m) {
  const attrs = {};
  if (m.charset !== void 0) attrs["charset"] = m.charset;
  if (m.name !== void 0) attrs["name"] = m.name;
  if (m.property !== void 0) attrs["property"] = m.property;
  if (m.httpEquiv !== void 0) attrs["http-equiv"] = m.httpEquiv;
  if (m.content !== void 0) attrs["content"] = m.content;
  return attrs;
}
function linkAttrs(l) {
  const attrs = { rel: l.rel, href: l.href };
  if (l.sizes !== void 0) attrs["sizes"] = l.sizes;
  if (l.type !== void 0) attrs["type"] = l.type;
  if (l.media !== void 0) attrs["media"] = l.media;
  if (l.as !== void 0) attrs["as"] = l.as;
  if (l.crossorigin !== void 0) attrs["crossorigin"] = l.crossorigin;
  if (l.hreflang !== void 0) attrs["hreflang"] = l.hreflang;
  return attrs;
}
function resolveHead(config) {
  const entries = [];
  if (config.charset !== void 0) {
    entries.push({ tag: "meta", dedupKey: "meta:charset", attrs: { charset: config.charset } });
  }
  if (config.base !== void 0) {
    entries.push({ tag: "base", dedupKey: "base", attrs: { href: config.base } });
  }
  if (config.title !== void 0) {
    entries.push({ tag: "title", dedupKey: "title", attrs: {}, text: config.title });
  }
  if (config.description !== void 0) {
    entries.push({
      tag: "meta",
      dedupKey: "meta:name=description",
      attrs: { name: "description", content: config.description }
    });
  }
  if (config.canonical !== void 0) {
    entries.push({
      tag: "link",
      dedupKey: "link:rel=canonical",
      attrs: { rel: "canonical", href: config.canonical }
    });
  }
  if (config.robots !== void 0) {
    entries.push({
      tag: "meta",
      dedupKey: "meta:name=robots",
      attrs: { name: "robots", content: config.robots }
    });
  }
  if (config.themeColor !== void 0) {
    entries.push({
      tag: "meta",
      dedupKey: "meta:name=theme-color",
      attrs: { name: "theme-color", content: config.themeColor }
    });
  }
  if (config.viewport !== void 0) {
    entries.push({
      tag: "meta",
      dedupKey: "meta:name=viewport",
      attrs: { name: "viewport", content: config.viewport }
    });
  }
  if (config.favicon !== void 0) {
    const l = typeof config.favicon === "string" ? { rel: "icon", href: config.favicon } : config.favicon;
    entries.push({ tag: "link", dedupKey: `link:rel=${l.rel}`, attrs: linkAttrs(l) });
  }
  if (config.openGraph !== void 0) {
    for (const key of Object.keys(config.openGraph)) {
      const property = `og:${key}`;
      entries.push({
        tag: "meta",
        dedupKey: `meta:property=${property}`,
        attrs: { property, content: config.openGraph[key] }
      });
    }
  }
  if (config.twitter !== void 0) {
    for (const key of Object.keys(config.twitter)) {
      const name = `twitter:${key}`;
      entries.push({
        tag: "meta",
        dedupKey: `meta:name=${name}`,
        attrs: { name, content: config.twitter[key] }
      });
    }
  }
  if (config.meta !== void 0) {
    for (const m of config.meta) {
      const key = metaDedupKey(m);
      if (key === void 0) continue;
      entries.push({ tag: "meta", dedupKey: key, attrs: metaAttrs(m) });
    }
  }
  if (config.link !== void 0) {
    for (const l of config.link) {
      entries.push({ tag: "link", dedupKey: `link:rel=${l.rel}:href=${l.href}`, attrs: linkAttrs(l) });
    }
  }
  return { entries };
}
function isHeadContribution(value) {
  return value !== null && typeof value === "object" && Array.isArray(value["entries"]);
}

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
  if (options.ariaModal !== void 0) props["aria-modal"] = String(options.ariaModal);
  if (options.ariaOwns !== void 0) props["aria-owns"] = options.ariaOwns;
  if (options.ariaActiveDescendant !== void 0) props["aria-activedescendant"] = options.ariaActiveDescendant;
  if (options.ariaHasPopup !== void 0) props["aria-haspopup"] = String(options.ariaHasPopup);
  if (options.ariaSelected !== void 0) props["aria-selected"] = String(options.ariaSelected);
}
function registerTransition(graph, node, config) {
  if (config === void 0) return;
  const resolved = resolveTransition(config);
  graph.registerHandler(
    `__transition__${node.id}`,
    () => resolved
  );
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
var OVERLAY_KINDS = {
  dialog: {
    role: "dialog",
    modal: true,
    takesFocus: true,
    ariaModal: true,
    defaultCloseOnEscape: true,
    defaultRestoreFocus: true
  },
  popover: {
    role: "dialog",
    modal: false,
    takesFocus: true,
    ariaModal: false,
    defaultCloseOnEscape: true,
    defaultRestoreFocus: true
  },
  tooltip: {
    role: "tooltip",
    modal: false,
    takesFocus: false,
    ariaModal: false,
    defaultCloseOnEscape: false,
    defaultRestoreFocus: false
  },
  dropdown: {
    role: "menu",
    modal: false,
    takesFocus: true,
    menu: true,
    ariaModal: false,
    defaultCloseOnEscape: true,
    defaultRestoreFocus: true
  },
  toast: {
    role: "status",
    modal: false,
    takesFocus: false,
    ariaModal: false,
    ariaLive: "polite",
    defaultCloseOnEscape: false,
    defaultRestoreFocus: false
  }
};
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
    registerTransition(this._graph, node, options.transition);
    builder(new SectionBuilderImpl(node, this._graph));
  }
  container(key, builder, options = {}) {
    const node = this._graph.createNode("container", {
      key,
      parent: this._node,
      props: containerProps(options)
    });
    registerTransition(this._graph, node, options.transition);
    builder(new ContainerBuilderImpl(node, this._graph));
  }
  list(key, builder, options = {}) {
    const node = this._graph.createNode("list", {
      key,
      parent: this._node,
      props: containerProps(options)
    });
    registerTransition(this._graph, node, options.transition);
    builder(new ListBuilderImpl(node, this._graph));
  }
  listOf(key, items, renderItem, options = {}) {
    const graph = this._graph;
    const node = graph.createNode("reactive-list", {
      key,
      parent: this._node,
      props: containerProps(options)
    });
    registerTransition(graph, node, options.transition);
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
      registerTransition(graph, itemNode, options.itemTransition);
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
    registerTransition(this._graph, node, options.transition);
    if (options.onSubmit !== void 0) {
      const handlerKey = `submit:${node.id}`;
      this._graph.registerHandler(handlerKey, options.onSubmit);
      node.addEvent({ type: "submit", handlerKey });
    }
    builder(new FormBuilderImpl(node, this._graph));
  }
  when(condition, builder, elseBuilder, options = {}) {
    const graph = this._graph;
    const node = graph.createNode("conditional", {
      parent: this._node,
      props: containerProps({})
    });
    const branchTransition = options.transition !== void 0 && options.appear === true ? { ...options.transition, appear: true } : options.transition;
    const buildBranch = (build, tag) => {
      const branchKey = `when-${tag}:${node.id}`;
      const branch = graph.createNode("container", {
        key: branchKey,
        props: { key: branchKey }
      });
      registerTransition(graph, branch, branchTransition);
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
        // Error state → fallback. The fallback branch mounts exactly when the
        // boundary enters its error state, so this is also where the optional
        // `onError` reporting hook fires (observe-only; §6/§7).
        (fb) => {
          const currentError = readError();
          options.onError?.(currentError);
          options.fallback(fb, currentError, retry);
        },
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
  asyncBoundary(key, res, branches) {
    const isError = derived(() => res.status.get() === "error");
    const showSuccess = derived(
      () => res.status.get() !== "error" && res.data.get() !== void 0
    );
    const showLoading = derived(
      () => res.status.get() !== "error" && res.data.get() === void 0
    );
    const dataSignal = derived(() => res.data.get());
    const retry = () => {
      void res.refetch();
    };
    this.container(key, (c) => {
      c.when(isError, (fb) => branches.error?.(fb, res.error.peek(), retry));
      c.when(showSuccess, (sb) => branches.success(sb, dataSignal));
      c.when(showLoading, (lb) => branches.loading?.(lb));
    }, { key });
  }
  // ── Portals & overlays ──────────────────────────────────────────────────────
  portal(key, builder, options = {}) {
    const node = this._graph.createNode("portal", {
      key,
      parent: this._node,
      props: containerProps(options)
    });
    builder(new ContainerBuilderImpl(node, this._graph));
  }
  /**
   * Declare document metadata (2.0 §1–§3). Creates a `'head'` node — a neutral,
   * empty inline anchor at this position (one node / one element, so positional
   * hydration is preserved) — and registers a `__head__<id>` descriptor holding
   * this call's normalized, dedup-keyed {@link resolveHead} contribution. The
   * renderer applies it to `document.head` on the browser (adopting server tags
   * on hydration, cleaning up on unmount / route change) and emits the active
   * graph's merged metadata as a string on the server (`renderHead`).
   *
   * Multiple `head()` nodes may be live at once (app default + route + component)
   * — the renderer merges them and, per dedup key, the last in document order
   * wins (see head.ts). No new render path: this reuses the same graph-node +
   * handler-registry convention as overlays/transitions/components.
   */
  head(metadata) {
    const node = this._graph.createNode("head", {
      parent: this._node,
      props: { "data-streetui-head-anchor": "" }
    });
    const contribution = resolveHead(metadata);
    this._graph.registerHandler(
      `__head__${node.id}`,
      () => contribution
    );
  }
  /**
   * Shared assembly for every overlay kind: a `portal` node whose single child
   * is a `when(open, panel)` conditional. The panel container carries the
   * kind's ARIA semantics; `builder` fills it. An `__overlay__<portalId>`
   * descriptor is registered so the renderer wires focus/keyboard behavior to
   * the same `open` signal that drives the panel. Reuses existing primitives
   * (portal + when + container) — no new render path.
   */
  _overlay(kind, key, options, builder) {
    const graph = this._graph;
    const portalNode = graph.createNode("portal", {
      key,
      parent: this._node,
      props: { key }
    });
    const openBindable = options.open;
    const openSignal = isSignal(openBindable) ? openBindable : signal(openBindable);
    const panelOptions = {
      role: options.role ?? kind.role,
      ...kind.ariaModal ? { ariaModal: true } : {},
      ...kind.ariaLive !== void 0 ? { ariaLive: kind.ariaLive } : {},
      ...options.class !== void 0 ? { class: options.class } : {},
      ...options.ariaLabel !== void 0 ? { ariaLabel: options.ariaLabel } : {},
      ...options.ariaLabelledBy !== void 0 ? { ariaLabelledBy: options.ariaLabelledBy } : {},
      ...options.ariaDescribedBy !== void 0 ? { ariaDescribedBy: options.ariaDescribedBy } : {}
    };
    const portalBuilder = new ContainerBuilderImpl(portalNode, graph);
    portalBuilder.when(
      openSignal,
      (panelHost) => {
        panelHost.container(`${key}__panel`, builder, panelOptions);
      },
      void 0,
      // Overlay open/close rides the panel's `when`; a transition animates the
      // panel in on open and — via the reconciler's deferred-leave — plays the
      // leave before the panel is removed (§10). Focus is restored at close-
      // request time (see wireOverlayBehavior), so it never stays trapped inside
      // a panel that is animating away.
      options.transition !== void 0 ? { transition: options.transition } : {}
    );
    const descriptor = {
      open: openSignal,
      modal: kind.modal,
      takesFocus: kind.takesFocus,
      menu: kind.menu ?? false,
      closeOnEscape: options.closeOnEscape ?? kind.defaultCloseOnEscape,
      restoreFocus: options.restoreFocus ?? kind.defaultRestoreFocus,
      ...options.initialFocusId !== void 0 ? { initialFocusId: options.initialFocusId } : {},
      ...options.onClose !== void 0 ? { onClose: options.onClose } : {}
    };
    graph.registerHandler(
      `__overlay__${portalNode.id}`,
      () => descriptor
    );
  }
  dialog(key, options, builder) {
    this._overlay(OVERLAY_KINDS.dialog, key, options, builder);
  }
  popover(key, options, builder) {
    this._overlay(OVERLAY_KINDS.popover, key, options, builder);
  }
  tooltip(key, options, builder) {
    this._overlay(OVERLAY_KINDS.tooltip, key, options, builder);
  }
  dropdown(key, options, builder) {
    this._overlay(OVERLAY_KINDS.dropdown, key, options, builder);
  }
  toast(key, options, builder) {
    this._overlay(OVERLAY_KINDS.toast, key, options, builder);
  }
  // ── Components ────────────────────────────────────────────────────────────
  /**
   * Instantiate a reusable component (§3–§9). Creates a `'component'` node
   * (rendered as a `<div>` wrapper — preserves the one-node/one-element
   * positional-hydration invariant), then runs `def.setup(props, ctx)`
   * synchronously to obtain the render function and fills the component's own
   * container scope with it — structurally identical to `container`/
   * `errorBoundary`. Cleanups the setup registers via `ctx.effect`/
   * `ctx.onCleanup` are collected into a closure and exposed to the renderer
   * through a `__component__<id>` handler (mirroring `__overlay__`); the mount/
   * hydrate paths read it and route each into `NodeInstance.trackCleanup`, so
   * teardown runs (children-first) when the component leaves the graph.
   *
   * `setup` runs once per instance here at build time. When this component sits
   * inside a keyed list / conditional, a rebuild disposes the old instance
   * (running its cleanups + pruning its `__component__` entry) and re-runs this
   * method for the new node — so re-invocation is safe and leak-free.
   */
  component(key, def, props, children) {
    const graph = this._graph;
    const node = graph.createNode("component", {
      key,
      parent: this._node,
      // `data-streetui-component` is a non-underscore prop, so it reaches the
      // DOM as an attribute and is visible to DevTools (§21) — unlike the
      // internal `_`-prefixed metadata the renderer hides.
      props: { key, "data-streetui-component": def.name }
    });
    const cleanups = [];
    const ctx = {
      key,
      onCleanup(fn) {
        cleanups.push(fn);
      },
      effect(fn) {
        cleanups.push(effect(fn));
      },
      renderChildren(content) {
        if (children !== void 0) children(content);
      }
    };
    let render;
    try {
      render = def.setup(props, ctx);
      render(new ContainerBuilderImpl(node, graph));
    } catch (err) {
      queueMicrotask(() => {
        throw err;
      });
    }
    if (cleanups.length > 0) {
      graph.registerHandler(
        `__component__${node.id}`,
        () => cleanups
      );
    }
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
    registerTransition(this._graph, node, options.transition);
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

// ../dsl/src/component.ts
function component(setup, options = {}) {
  return {
    __streetui_component: true,
    name: options.name ?? setup.name ?? "Component",
    setup
  };
}
function isComponentDefinition(value) {
  return value !== null && typeof value === "object" && value.__streetui_component === true;
}

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
  trackSignal(signal3, handler) {
    const unsub = signal3.subscribe(handler);
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
  body() {
    return document.body ?? null;
  }
  head() {
    return document.head ?? null;
  }
  activeElement() {
    return document.activeElement ?? null;
  }
  contains(ancestor, node) {
    return ancestor.contains(node);
  }
  matches(element, selector) {
    return typeof element.matches === "function" && element.matches(selector);
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
var ServerRawHTML = class {
  kind = "raw";
  parent = null;
  html;
  constructor(html) {
    this.html = html;
  }
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
    case "raw":
      return node.html;
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
  /**
   * Create a verbatim pre-serialized HTML node (v1.7 static SSR plan, §6).
   * Server-only: the browser adapter does not implement this, and the renderer
   * fast path only invokes it when a static SSR plan is present (SSR). The
   * stored HTML was produced by this same serializer, so it is emitted as-is.
   */
  createRawHTML(html) {
    return new ServerRawHTML(html);
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
  body() {
    return null;
  }
  head() {
    return null;
  }
  activeElement() {
    return null;
  }
  contains(_ancestor, _node) {
    return false;
  }
  matches(_element, _selector) {
    return false;
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
function getFocusable(dom, container, selector = FOCUSABLE_SELECTOR) {
  return Array.from(dom.querySelectorAll(container, selector)).filter(
    (el) => dom.matches(el, selector)
  );
}
function saveFocus(dom) {
  return dom.activeElement();
}
function restoreFocus(dom, saved) {
  if (saved !== null) dom.focus(saved);
}
function focusInitial(dom, container, initialFocusId) {
  if (initialFocusId !== void 0 && focusById(dom, container, initialFocusId)) return;
  focusFirst(dom, container);
}
function trapFocus(dom, container) {
  const onKeydown = (event) => {
    if (event.key !== "Tab") return;
    const items = getFocusable(dom, container);
    if (items.length === 0) {
      event.preventDefault();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const active = dom.activeElement();
    if (active === null || !dom.contains(container, active)) {
      event.preventDefault();
      dom.focus(first);
    } else if (event.shiftKey && active === first) {
      event.preventDefault();
      dom.focus(last);
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      dom.focus(first);
    }
  };
  dom.addEventListener(container, "keydown", onKeydown);
  return () => dom.removeEventListener(container, "keydown", onKeydown);
}
var containmentStack = [];
function containFocus(dom, container) {
  const body = dom.body();
  if (body === null) return () => {
  };
  containmentStack.push(container);
  const onFocusIn = (event) => {
    if (containmentStack[containmentStack.length - 1] !== container) return;
    const target = event.target;
    if (target !== null && !dom.contains(container, target)) {
      focusFirst(dom, container);
    }
  };
  dom.addEventListener(body, "focusin", onFocusIn);
  return () => {
    dom.removeEventListener(body, "focusin", onFocusIn);
    const index = containmentStack.lastIndexOf(container);
    if (index !== -1) containmentStack.splice(index, 1);
  };
}
function onEscape(dom, target, handler) {
  const onKeydown = (event) => {
    if (event.key === "Escape") handler();
  };
  dom.addEventListener(target, "keydown", onKeydown);
  return () => dom.removeEventListener(target, "keydown", onKeydown);
}
function rovingMenu(dom, container, selector = FOCUSABLE_SELECTOR) {
  const onKeydown = (event) => {
    const key = event.key;
    const isActivate = key === "Enter" || key === " " || key === "Spacebar";
    const isMove = key === "ArrowDown" || key === "ArrowUp" || key === "Home" || key === "End";
    if (!isActivate && !isMove) return;
    const items = getFocusable(dom, container, selector);
    if (items.length === 0) return;
    const active = dom.activeElement();
    const index = active === null ? -1 : items.indexOf(active);
    if (isActivate) {
      if (index < 0) return;
      event.preventDefault();
      items[index].click?.();
      return;
    }
    event.preventDefault();
    let next;
    if (key === "Home") next = 0;
    else if (key === "End") next = items.length - 1;
    else if (key === "ArrowDown") next = index < 0 ? 0 : (index + 1) % items.length;
    else next = index <= 0 ? items.length - 1 : index - 1;
    dom.focus(items[next]);
  };
  dom.addEventListener(container, "keydown", onKeydown);
  return () => dom.removeEventListener(container, "keydown", onKeydown);
}

// ../dom/src/live-region.ts
var VISUALLY_HIDDEN = "position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0;";
function makeRegion(dom, politeness) {
  const el = dom.createElement("div");
  dom.setAttribute(el, "aria-live", politeness);
  dom.setAttribute(el, "aria-atomic", "true");
  dom.setAttribute(el, "role", politeness === "assertive" ? "alert" : "status");
  dom.setAttribute(el, "data-streetui-live", politeness);
  dom.setAttribute(el, "style", VISUALLY_HIDDEN);
  return el;
}
function createAnnouncer(dom) {
  const body = dom.body();
  if (body === null) {
    return { announce() {
    }, clear() {
    }, destroy() {
    } };
  }
  const polite = makeRegion(dom, "polite");
  const assertive = makeRegion(dom, "assertive");
  dom.appendChild(body, polite);
  dom.appendChild(body, assertive);
  let destroyed = false;
  const write = (region, message) => {
    dom.setTextContent(region, "");
    void Promise.resolve().then(() => {
      if (!destroyed) dom.setTextContent(region, message);
    });
  };
  return {
    announce(message, options) {
      if (destroyed) return;
      write(options?.assertive === true ? assertive : polite, message);
    },
    clear() {
      if (destroyed) return;
      dom.setTextContent(polite, "");
      dom.setTextContent(assertive, "");
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      for (const region of [polite, assertive]) {
        const parent = dom.parentNode(region);
        if (parent !== null) dom.removeChild(parent, region);
      }
    }
  };
}

// ../renderer/src/render-context.ts
function createRenderContext(dom, graph, container, hydrationDiagnostics, staticHTML) {
  return {
    dom,
    graph,
    instances: /* @__PURE__ */ new Map(),
    container,
    ...hydrationDiagnostics !== void 0 ? { hydrationDiagnostics } : {},
    ...staticHTML !== void 0 ? { staticHTML } : {}
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
  "reactive-list": "ul",
  // A portal renders as a neutral inline anchor <div> at its declaration site;
  // its children are relocated to a document.body container on the browser
  // (see the portal branch in mount.ts). On the server (no body) it renders
  // inline, so the anchor tag is what SSR/hydration positionally match on.
  portal: "div",
  // A `head()` node renders as a neutral, empty inline anchor <div> at its
  // declaration site (like a portal anchor). Its actual contribution — title/
  // meta/link/etc. — is applied to `document.head` by `wireHeadBehavior` on the
  // browser, and emitted separately by `renderHead()` on the server. Keeping a
  // one-node/one-element anchor preserves positional hydration.
  head: "div"
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
function reconcileChildren(ctx, parentDom, oldInstances, newNodes, mountFn, hooks) {
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
      const reclaimed = hooks?.takeLeaving(key);
      if (reclaimed !== void 0) {
        patchExistingInstance(ctx, reclaimed, newNode);
        reconcileItemChildren(ctx, reclaimed, newNode, mountFn);
        hooks?.onEnter(reclaimed);
        newInstances.push(reclaimed);
      } else {
        const inst = mountFn(newNode, parentDom);
        hooks?.onEnter(inst);
        newInstances.push(inst);
      }
    }
  }
  const removed = [];
  for (const inst of oldInstances) {
    const key = inst.graphNode.key ?? inst.graphNode.id;
    if (usedKeys.has(key)) continue;
    if (hooks !== void 0 && hooks.beginLeave(inst)) continue;
    const parent = ctx.dom.parentNode(inst.domNode);
    if (parent !== null) ctx.dom.removeChild(parent, inst.domNode);
    inst.dispose();
    removed.push(inst);
  }
  reorderDom(ctx, parentDom, newInstances);
  return { instances: newInstances, removed };
}
function reconcileChildrenByPlan(ctx, parentDom, oldInstances, plan, mountFn, hooks) {
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
      const reclaimed = hooks?.takeLeaving(entry.key);
      if (reclaimed !== void 0) {
        const freshNode = entry.build();
        built.push(freshNode);
        patchExistingInstance(ctx, reclaimed, freshNode);
        reconcileItemChildren(ctx, reclaimed, freshNode, mountFn);
        reclaimed.graphNode.setProp("_sig", freshNode.getProp("_sig"));
        reclaimed.graphNode.setProp("_item", entry.item);
        hooks?.onEnter(reclaimed);
        newInstances.push(reclaimed);
      } else {
        const freshNode = entry.build();
        built.push(freshNode);
        const inst = mountFn(freshNode, parentDom);
        hooks?.onEnter(inst);
        newInstances.push(inst);
      }
    }
  }
  const removed = [];
  for (const inst of oldInstances) {
    const key = inst.graphNode.key ?? inst.graphNode.id;
    if (usedKeys.has(key)) continue;
    if (hooks !== void 0 && hooks.beginLeave(inst)) continue;
    const parent = ctx.dom.parentNode(inst.domNode);
    if (parent !== null) ctx.dom.removeChild(parent, inst.domNode);
    inst.dispose();
    removed.push(inst);
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

// ../renderer/src/transition.ts
function getResolvedTransition(graph, nodeId) {
  const fn = graph.getHandler(`__transition__${nodeId}`);
  return fn === void 0 ? void 0 : fn();
}
function host() {
  return globalThis;
}
function nextFrame(cb) {
  const h = host();
  const raf = h.requestAnimationFrame;
  if (typeof raf === "function") {
    raf(() => raf(cb));
  } else {
    h.setTimeout(cb, 0);
  }
}
function splitClass(value) {
  if (value === null) return [];
  const out = [];
  for (const t of value.split(/\s+/)) if (t.length > 0) out.push(t);
  return out;
}
function addClasses(dom, el, classes2) {
  if (classes2.length === 0) return;
  const current = splitClass(dom.getAttribute(el, "class"));
  let changed = false;
  for (const c of classes2) {
    if (!current.includes(c)) {
      current.push(c);
      changed = true;
    }
  }
  if (changed) dom.setAttribute(el, "class", current.join(" "));
}
function removeClasses(dom, el, classes2) {
  if (classes2.length === 0) return;
  const current = splitClass(dom.getAttribute(el, "class"));
  const next = current.filter((c) => !classes2.includes(c));
  if (next.length !== current.length) {
    if (next.length === 0) dom.removeAttribute(el, "class");
    else dom.setAttribute(el, "class", next.join(" "));
  }
}
function startRun(dom, el, active, from, to, duration, onDone) {
  const h = host();
  let finished = false;
  let timer = null;
  const onEvent = (e) => {
    if (e.target !== el) return;
    finish();
  };
  const detach = () => {
    dom.removeEventListener(el, "transitionend", onEvent);
    dom.removeEventListener(el, "animationend", onEvent);
    if (timer !== null) {
      h.clearTimeout(timer);
      timer = null;
    }
  };
  const finish = () => {
    if (finished) return;
    finished = true;
    detach();
    removeClasses(dom, el, active);
    removeClasses(dom, el, to);
    removeClasses(dom, el, from);
    onDone();
  };
  addClasses(dom, el, from);
  addClasses(dom, el, active);
  dom.addEventListener(el, "transitionend", onEvent);
  dom.addEventListener(el, "animationend", onEvent);
  timer = h.setTimeout(finish, duration);
  nextFrame(() => {
    if (finished) return;
    removeClasses(dom, el, from);
    addClasses(dom, el, to);
  });
  return {
    cancel: () => {
      if (finished) return;
      finished = true;
      detach();
      removeClasses(dom, el, active);
      removeClasses(dom, el, to);
      removeClasses(dom, el, from);
    }
  };
}
function runElementTransition(dom, el, rt, phase, onDone) {
  if (dom.body() === null || !dom.isElement(el)) {
    onDone();
    return { cancel: () => {
    } };
  }
  const active = phase === "enter" ? rt.enterActive : rt.leaveActive;
  const from = phase === "enter" ? rt.enterFrom : rt.leaveFrom;
  const to = phase === "enter" ? rt.enterTo : rt.leaveTo;
  return startRun(dom, el, active, from, to, rt.duration, onDone);
}
var TransitionController = class {
  constructor(dom, graph, finalize) {
    this.dom = dom;
    this.graph = graph;
    this.finalize = finalize;
  }
  leaving = /* @__PURE__ */ new Map();
  /** True only in a real DOM environment (browser). */
  get browser() {
    return this.dom.body() !== null;
  }
  keyOf(inst) {
    return inst.graphNode.key ?? inst.graphNode.id;
  }
  resolved(node) {
    return getResolvedTransition(this.graph, node.id);
  }
  /** Run the enter animation for `inst` if it carries a transition (browser only). */
  enter(inst) {
    if (!this.browser) return;
    const rt = this.resolved(inst.graphNode);
    if (rt === void 0) return;
    const el = inst.domNode;
    if (!this.dom.isElement(el)) return;
    startRun(this.dom, el, rt.enterActive, rt.enterFrom, rt.enterTo, rt.duration, () => {
    });
  }
  /**
   * Play `appear` for any initial child that opted into it (fresh browser mount
   * only — hydration must never animate appear, §22, and this is called only on
   * the mount path).
   */
  appear(children) {
    if (!this.browser) return;
    for (const child of children) {
      const rt = this.resolved(child.graphNode);
      if (rt !== void 0 && rt.appear) this.enter(child);
    }
  }
  hooks() {
    return {
      takeLeaving: (key) => {
        const entry = this.leaving.get(key);
        if (entry === void 0) return void 0;
        entry.run.cancel();
        this.leaving.delete(key);
        return entry.inst;
      },
      beginLeave: (inst) => {
        if (!this.browser) return false;
        const rt = this.resolved(inst.graphNode);
        if (rt === void 0) return false;
        const el = inst.domNode;
        if (!this.dom.isElement(el)) return false;
        const key = this.keyOf(inst);
        const prior = this.leaving.get(key);
        if (prior !== void 0) prior.run.cancel();
        const run = startRun(
          this.dom,
          el,
          rt.leaveActive,
          rt.leaveFrom,
          rt.leaveTo,
          rt.duration,
          () => {
            const current = this.leaving.get(key);
            if (current !== void 0 && current.run === run) {
              this.leaving.delete(key);
              this.finalize(inst);
            }
          }
        );
        this.leaving.set(key, { inst, run });
        return true;
      },
      onEnter: (inst) => this.enter(inst)
    };
  }
};

// ../renderer/src/head.ts
var HEAD_MARKER = "data-streetui-head";
var HEAD_KEY = "data-streetui-head-key";
function isSignalLike(v) {
  return v !== null && typeof v === "object" && typeof v["subscribe"] === "function" && typeof v["peek"] === "function";
}
function readValue(v) {
  if (isSignalLike(v)) return String(v.peek() ?? "");
  return String(v ?? "");
}
function resolveEntry(entry) {
  const attrs = {};
  for (const key of Object.keys(entry.attrs)) {
    attrs[key] = readValue(entry.attrs[key]);
  }
  const resolved = { tag: entry.tag, attrs };
  if (entry.tag === "title") {
    return { ...resolved, text: readValue(entry.text) };
  }
  return resolved;
}
var HeadManager = class {
  _dom;
  _head;
  _contributions = /* @__PURE__ */ new Map();
  _applied = /* @__PURE__ */ new Map();
  _order = 0;
  _adopted = false;
  constructor(dom, head) {
    this._dom = dom;
    this._head = head;
  }
  /** Register (or replace) a node's contribution and re-apply the merged result. */
  register(nodeId, entries) {
    this._contributions.set(nodeId, { order: this._order++, entries });
    this.apply();
  }
  /** Withdraw a node's contribution (unmount / route change) and re-apply. */
  unregister(nodeId) {
    if (this._contributions.delete(nodeId)) this.apply();
  }
  /** Recompute the merged head and patch `document.head` to match. */
  apply() {
    if (!this._adopted) {
      this._adoptServerTags();
      this._adopted = true;
    }
    const ordered = [...this._contributions.values()].sort((a, b) => a.order - b.order);
    const merged = /* @__PURE__ */ new Map();
    for (const contribution of ordered) {
      for (const entry of contribution.entries) {
        merged.set(entry.dedupKey, resolveEntry(entry));
      }
    }
    for (const [key, desired] of merged) {
      const existing = this._applied.get(key);
      if (existing !== void 0 && existing.tag === desired.tag) {
        this._reconcileAttrs(existing, desired);
      } else {
        if (existing !== void 0) {
          this._dom.removeChild(this._head, existing.el);
          this._applied.delete(key);
        }
        const el = this._createTag(key, desired);
        this._dom.appendChild(this._head, el);
        this._applied.set(key, { el, attrKeys: new Set(Object.keys(desired.attrs)), tag: desired.tag });
      }
    }
    for (const [key, record] of [...this._applied]) {
      if (!merged.has(key)) {
        this._dom.removeChild(this._head, record.el);
        this._applied.delete(key);
      }
    }
  }
  _createTag(key, desired) {
    const el = this._dom.createElement(desired.tag);
    this._dom.setAttribute(el, HEAD_MARKER, "");
    this._dom.setAttribute(el, HEAD_KEY, key);
    for (const attr of Object.keys(desired.attrs)) {
      this._dom.setAttribute(el, attr, desired.attrs[attr]);
    }
    if (desired.tag === "title") this._dom.setTextContent(el, desired.text ?? "");
    return el;
  }
  _reconcileAttrs(record, desired) {
    const nextKeys = new Set(Object.keys(desired.attrs));
    for (const attr of record.attrKeys) {
      if (!nextKeys.has(attr)) this._dom.removeAttribute(record.el, attr);
    }
    for (const attr of nextKeys) {
      this._dom.setAttribute(record.el, attr, desired.attrs[attr]);
    }
    if (desired.tag === "title") this._dom.setTextContent(record.el, desired.text ?? "");
    record.attrKeys = nextKeys;
  }
  /**
   * Seed `_applied` from server-emitted `[data-streetui-head-key]` tags already
   * in `document.head`. The subsequent diff reuses these elements when the
   * client desires the same key (no duplicate), rewrites them if the value
   * changed, or removes them if the client graph no longer wants them.
   */
  _adoptServerTags() {
    for (const child of this._dom.childNodes(this._head)) {
      if (!this._dom.isElement(child)) continue;
      const el = child;
      const key = this._dom.getAttribute(el, HEAD_KEY);
      if (key === null) continue;
      this._applied.set(key, {
        el,
        attrKeys: new Set(this._attrNames(el)),
        tag: this._dom.tagName(el)
      });
    }
  }
  /** The framework-managed attribute names currently on a server tag. */
  _attrNames(el) {
    const names = [];
    if (this._dom.getAttribute(el, HEAD_MARKER) !== null) names.push(HEAD_MARKER);
    if (this._dom.getAttribute(el, HEAD_KEY) !== null) names.push(HEAD_KEY);
    return names;
  }
};
function getHeadManager(ctx) {
  const head = ctx.dom.head();
  if (head === null) return null;
  const mutable = ctx;
  if (mutable.head === void 0) mutable.head = new HeadManager(ctx.dom, head);
  return mutable.head;
}
function wireHeadBehavior(ctx, graphNode, instance) {
  const manager = getHeadManager(ctx);
  if (manager === null) return;
  const descFn = ctx.graph.getHandler(`__head__${graphNode.id}`);
  if (descFn === void 0) return;
  const contribution = descFn();
  const nodeId = graphNode.id;
  manager.register(nodeId, contribution.entries);
  for (const entry of contribution.entries) {
    for (const attrKey of Object.keys(entry.attrs)) {
      const v = entry.attrs[attrKey];
      if (isSignalLike(v)) {
        instance.trackCleanup(v.subscribe(() => manager.apply()));
      }
    }
    if (isSignalLike(entry.text)) {
      instance.trackCleanup(entry.text.subscribe(() => manager.apply()));
    }
  }
  instance.trackCleanup(() => manager.unregister(nodeId));
}
function renderHead(compiled) {
  const graph = compiled.graph;
  const merged = /* @__PURE__ */ new Map();
  graph.walk((node) => {
    if (node.type !== "head") return;
    const descFn = graph.getHandler(`__head__${node.id}`);
    if (descFn === void 0) return;
    for (const entry of descFn().entries) {
      merged.set(entry.dedupKey, resolveEntry(entry));
    }
  });
  if (merged.size === 0) return "";
  const dom = new ServerDOMAdapter();
  let out = "";
  for (const [key, desired] of merged) {
    const el = dom.createElement(desired.tag);
    dom.setAttribute(el, HEAD_MARKER, "");
    dom.setAttribute(el, HEAD_KEY, key);
    for (const attr of Object.keys(desired.attrs)) {
      dom.setAttribute(el, attr, desired.attrs[attr]);
    }
    if (desired.tag === "title") dom.setTextContent(el, desired.text ?? "");
    out += dom.serializeOuter(el);
  }
  return out;
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
  const staticHTML = ctx.staticHTML;
  if (staticHTML !== void 0 && dom.createRawHTML !== void 0) {
    const precomputed = staticHTML.get(graphNode.id);
    if (precomputed !== void 0) {
      const raw = dom.createRawHTML(precomputed);
      dom.appendChild(parentDom, raw);
      const instance2 = new NodeInstance(graphNode, raw);
      ctx.instances.set(graphNode.id, instance2);
      return instance2;
    }
  }
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
    if (graphNode.stateRefs.length !== 0) {
      wireSignalBindings(ctx, graphNode, instance2, linkUpdate(dom, el2));
    }
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
    wireReactiveList(ctx, graphNode, instance2, el2, true);
    return instance2;
  }
  if (graphNode.type === "portal") {
    const anchor = dom.createElement(resolveTag("portal"));
    dom.setAttribute(anchor, "data-streetui-portal", "");
    applyNodeProps(ctx, graphNode, anchor);
    const instance2 = new NodeInstance(graphNode, anchor);
    ctx.instances.set(graphNode.id, instance2);
    const body = dom.body();
    let target = anchor;
    if (body !== null) {
      const portalContainer = dom.createElement("div");
      dom.setAttribute(portalContainer, "data-streetui-portal-container", "");
      dom.appendChild(body, portalContainer);
      instance2.trackCleanup(() => dom.removeChild(body, portalContainer));
      target = portalContainer;
    }
    for (const child of graphNode.children) {
      instance2.addChild(mountNode(ctx, child, target));
    }
    dom.appendChild(parentDom, anchor);
    wireOverlayBehavior(ctx, graphNode, instance2, target);
    return instance2;
  }
  if (graphNode.type === "head") {
    const anchor = dom.createElement(resolveTag("head"));
    dom.setAttribute(anchor, "data-streetui-head-anchor", "");
    applyNodeProps(ctx, graphNode, anchor);
    const instance2 = new NodeInstance(graphNode, anchor);
    ctx.instances.set(graphNode.id, instance2);
    dom.appendChild(parentDom, anchor);
    wireHeadBehavior(ctx, graphNode, instance2);
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
  if (graphNode.type === "component") wireComponentBehavior(ctx, graphNode, instance);
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
function linkUpdate(dom, el) {
  return (propKey, value) => {
    if (propKey === "label") {
      dom.setTextContent(el, String(value ?? ""));
    } else if (propKey === "href") {
      dom.setAttribute(el, "href", String(value ?? ""));
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
function wireReactiveList(ctx, graphNode, instance, el, runAppear = false) {
  const plan = ctx.graph.getHandler(`__listplan__${graphNode.id}`);
  const build = ctx.graph.getHandler(`__listbuild__${graphNode.id}`);
  if (plan === void 0 && build === void 0) return;
  const controller = new TransitionController(ctx.dom, ctx.graph, (leaving) => {
    const parent = ctx.dom.parentNode(leaving.domNode);
    if (parent !== null) ctx.dom.removeChild(parent, leaving.domNode);
    leaving.dispose();
    forgetInstance(ctx, leaving);
    ctx.graph.detachNode(leaving.graphNode);
  });
  const hooks = controller.hooks();
  if (runAppear) controller.appear(instance.children);
  for (const stateRef of graphNode.stateRefs) {
    if (stateRef.propKey !== "items") continue;
    const sig = ctx.graph.getHandler(`__signal__${stateRef.signalId}`);
    if (sig === void 0 || typeof sig.subscribe !== "function") continue;
    const unsub = sig.subscribe((value) => {
      if (plan !== void 0) {
        reconcileReactiveListByPlan(ctx, graphNode, instance, el, plan(value), hooks);
      } else {
        reconcileReactiveList(ctx, graphNode, instance, el, build(value), hooks);
      }
    });
    instance.trackCleanup(unsub);
  }
}
function reconcileReactiveListByPlan(ctx, listNode, listInstance, listEl, plan, hooks) {
  const oldInstances = [...listInstance.children];
  const result = reconcileChildrenByPlan(
    ctx,
    listEl,
    oldInstances,
    plan,
    (node, parent) => mountNode(ctx, node, parent),
    hooks
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
function reconcileReactiveList(ctx, listNode, listInstance, listEl, newNodes, hooks) {
  const oldInstances = [...listInstance.children];
  const result = reconcileChildren(
    ctx,
    listEl,
    oldInstances,
    newNodes,
    (node, parent) => mountNode(ctx, node, parent),
    hooks
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
function wireOverlayBehavior(ctx, graphNode, instance, target) {
  const { dom, graph } = ctx;
  if (dom.body() === null) return;
  const descFn = graph.getHandler(`__overlay__${graphNode.id}`);
  if (descFn === void 0) return;
  const desc = descFn();
  const openSig = desc.open;
  if (openSig === void 0 || typeof openSig.subscribe !== "function") return;
  let active = [];
  let saved = null;
  const teardown = () => {
    for (const fn of active) fn();
    active = [];
  };
  const onOpenChange = (isOpen) => {
    if (isOpen) {
      if (desc.restoreFocus) saved = saveFocus(dom);
      if (desc.modal) {
        active.push(trapFocus(dom, target));
        active.push(containFocus(dom, target));
      }
      if (desc.menu) {
        active.push(rovingMenu(dom, target));
      }
      if (desc.takesFocus) focusInitial(dom, target, desc.initialFocusId);
      if (desc.closeOnEscape && desc.onClose !== void 0) {
        active.push(onEscape(dom, target, desc.onClose));
      }
    } else {
      teardown();
      if (desc.restoreFocus && saved !== null) {
        restoreFocus(dom, saved);
        saved = null;
      }
    }
  };
  const unsub = openSig.subscribe(onOpenChange);
  instance.trackCleanup(unsub);
  instance.trackCleanup(teardown);
  if (openSig.peek() === true) onOpenChange(true);
}
function wireComponentBehavior(ctx, graphNode, instance) {
  const fn = ctx.graph.getHandler(`__component__${graphNode.id}`);
  if (fn === void 0) return;
  for (const cleanup of fn()) instance.trackCleanup(cleanup);
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
      if (graphNode.type === "link") {
        wireEvents(dom, graph, graphNode, domNode, instance);
        if (graphNode.stateRefs.length !== 0) {
          wireSignalBindings(ctx, graphNode, instance, linkUpdate(dom, domNode));
        }
      }
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
    case "portal": {
      const instance = new NodeInstance(graphNode, domNode);
      ctx.instances.set(graphNode.id, instance);
      const body = dom.body();
      let target = domNode;
      if (body !== null) {
        const portalContainer = dom.createElement("div");
        dom.setAttribute(portalContainer, "data-streetui-portal-container", "");
        for (const child of dom.childNodes(domNode)) {
          dom.appendChild(portalContainer, child);
        }
        dom.appendChild(body, portalContainer);
        instance.trackCleanup(() => dom.removeChild(body, portalContainer));
        target = portalContainer;
      }
      hydrateChildren(ctx, graphNode, instance, target, path);
      wireOverlayBehavior(ctx, graphNode, instance, target);
      return instance;
    }
    case "head": {
      const instance = new NodeInstance(graphNode, domNode);
      ctx.instances.set(graphNode.id, instance);
      wireHeadBehavior(ctx, graphNode, instance);
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
      if (graphNode.type === "component") wireComponentBehavior(ctx, graphNode, instance);
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

// ../compiler/dist/diagnostics.js
var TEXT_PROP_KEYS = /* @__PURE__ */ new Set(["text", "label", "value"]);
function analyzeGraph(graph) {
  const nodes = /* @__PURE__ */ new Map();
  const summary = {
    totalNodes: 0,
    staticNodes: 0,
    staticSubtrees: 0,
    dynamicTextNodes: 0,
    dynamicAttrNodes: 0,
    eventNodes: 0,
    lists: 0,
    conditionals: 0
  };
  const visit = (node) => {
    let allChildrenStatic = true;
    for (const child of node.children) {
      const childSubtreeStatic = visit(child);
      if (!childSubtreeStatic) allChildrenStatic = false;
    }
    let hasDynamicText = false;
    let hasDynamicAttr = false;
    for (const ref of node.stateRefs) {
      if (TEXT_PROP_KEYS.has(ref.propKey)) hasDynamicText = true;
      else hasDynamicAttr = true;
    }
    const hasEvents = node.events.length > 0;
    const isList = node.type === "reactive-list";
    const isConditional = node.type === "conditional";
    const isPortal = node.type === "portal";
    const isComponent = node.type === "component";
    const isHead = node.type === "head";
    const isStatic = node.stateRefs.length === 0 && !hasEvents && !isList && !isConditional && !isPortal && !isComponent && !isHead;
    const isStaticSubtree = isStatic && allChildrenStatic;
    nodes.set(node.id, {
      isStatic,
      isStaticSubtree,
      hasDynamicText,
      hasDynamicAttr,
      hasEvents,
      isList,
      isConditional
    });
    summary.totalNodes += 1;
    if (isStatic) summary.staticNodes += 1;
    if (isStaticSubtree) summary.staticSubtrees += 1;
    if (hasDynamicText) summary.dynamicTextNodes += 1;
    if (hasDynamicAttr) summary.dynamicAttrNodes += 1;
    if (hasEvents) summary.eventNodes += 1;
    if (isList) summary.lists += 1;
    if (isConditional) summary.conditionals += 1;
    return isStaticSubtree;
  };
  visit(graph.root);
  return { nodes, summary };
}

// ../renderer/src/static-ssr-plan.ts
function collectMaximalStaticRoots(graph) {
  const analysis = analyzeGraph(graph);
  const roots = [];
  const walk = (node) => {
    if (node.type !== "application") {
      const a = analysis.nodes.get(node.id);
      if (a !== void 0 && a.isStaticSubtree) {
        roots.push(node);
        return;
      }
    }
    for (const child of node.children) walk(child);
  };
  walk(graph.root);
  return roots;
}
function serializeStaticSubtree(dom, graph, root) {
  const container = dom.createElement("div");
  const ctx = createRenderContext(dom, graph, container);
  const instance = mountNode(ctx, root, container);
  const html = dom.serializeInner(container);
  instance.dispose();
  ctx.instances.clear();
  return html;
}
function buildStaticSSRPlan(compiled) {
  const graph = compiled.graph;
  const roots = collectMaximalStaticRoots(graph);
  const plan = /* @__PURE__ */ new Map();
  if (roots.length === 0) return plan;
  const dom = new ServerDOMAdapter();
  for (const root of roots) {
    plan.set(root.id, serializeStaticSubtree(dom, graph, root));
  }
  return plan;
}
var PLAN_CACHE = /* @__PURE__ */ new WeakMap();
function getStaticSSRPlan(compiled) {
  let plan = PLAN_CACHE.get(compiled);
  if (plan === void 0) {
    plan = buildStaticSSRPlan(compiled);
    PLAN_CACHE.set(compiled, plan);
  }
  return plan;
}

// ../renderer/src/ssr.ts
function renderToString(compiled, options = {}) {
  const dom = options.domAdapter ?? new ServerDOMAdapter();
  const plan = options.staticPlan === null ? void 0 : options.staticPlan ?? getStaticSSRPlan(compiled);
  const staticHTML = plan !== void 0 && plan.size > 0 ? plan : void 0;
  const container = dom.createElement("div");
  const ctx = createRenderContext(dom, compiled.graph, container, void 0, staticHTML);
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
  const routeTransition = options.transition !== void 0 ? resolveTransition(options.transition) : void 0;
  const txDom = routeTransition !== void 0 ? new BrowserDOMAdapter() : void 0;
  let active = null;
  const pendingLeaves = /* @__PURE__ */ new Map();
  let firstRender = hydrateMode;
  const teardownRoute = (route) => {
    route.registry.run();
    route.mounted.unmount();
    if (route.host !== null && txDom !== void 0) {
      const parent = txDom.parentNode(route.host);
      if (parent !== null) txDom.removeChild(parent, route.host);
    }
  };
  const disposeActive = () => {
    if (active === null) return;
    teardownRoute(active);
    active = null;
  };
  const wrapOutletChildren = (dom) => {
    const host2 = dom.createElement("div");
    dom.setAttribute(host2, "data-streetui-route", "");
    const moved = [];
    let child = dom.firstChild(outlet);
    while (child !== null) {
      moved.push(child);
      child = dom.nextSibling(child);
    }
    for (const n of moved) dom.appendChild(host2, n);
    dom.appendChild(outlet, host2);
    return host2;
  };
  const buildRoute = (match, target, hydrate) => {
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
    const mounted = hydrate ? runtime.hydrate(routeCompiled, target) : runtime.mount(routeCompiled, target);
    return { registry, mounted, host: null, enterRun: null };
  };
  const renderRoute = (match) => {
    if (routeTransition === void 0 || txDom === void 0) {
      disposeActive();
      active = buildRoute(match, outlet, firstRender);
      firstRender = false;
      return;
    }
    if (active === null) {
      if (firstRender) {
        active = buildRoute(match, outlet, true);
        active.host = wrapOutletChildren(txDom);
      } else {
        const host2 = txDom.createElement("div");
        txDom.setAttribute(host2, "data-streetui-route", "");
        txDom.appendChild(outlet, host2);
        active = buildRoute(match, host2, false);
        active.host = host2;
      }
      firstRender = false;
      return;
    }
    firstRender = false;
    const leaving = active;
    leaving.enterRun?.cancel();
    leaving.enterRun = null;
    const leaveHost = leaving.host;
    const enterHost = txDom.createElement("div");
    txDom.setAttribute(enterHost, "data-streetui-route", "");
    txDom.appendChild(outlet, enterHost);
    const next = buildRoute(match, enterHost, false);
    next.host = enterHost;
    next.enterRun = runElementTransition(txDom, enterHost, routeTransition, "enter", () => {
      next.enterRun = null;
    });
    active = next;
    if (leaveHost !== null) {
      const run = runElementTransition(txDom, leaveHost, routeTransition, "leave", () => {
        pendingLeaves.delete(leaving);
        teardownRoute(leaving);
      });
      pendingLeaves.set(leaving, run);
    } else {
      teardownRoute(leaving);
    }
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
      for (const [route, run] of pendingLeaves) {
        run.cancel();
        teardownRoute(route);
      }
      pendingLeaves.clear();
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
function inspectComponents(graph) {
  const out = [];
  graph.walk((node, depth) => {
    if (node.type !== "component") return;
    const name = node.props["data-streetui-component"];
    out.push({
      id: node.id,
      key: node.key,
      name: typeof name === "string" ? name : "Component",
      depth,
      childCount: node.children.length
    });
  });
  return out;
}
function inspectInteractions(graph) {
  const overlays = [];
  const transitions = [];
  graph.walk((node, depth) => {
    const overlayFn = graph.getHandler(`__overlay__${node.id}`);
    if (overlayFn !== void 0) {
      const d = overlayFn();
      overlays.push({
        id: node.id,
        key: node.key,
        open: d.open.peek(),
        modal: d.modal,
        takesFocus: d.takesFocus,
        menu: d.menu,
        closeOnEscape: d.closeOnEscape,
        restoreFocus: d.restoreFocus,
        depth
      });
    }
    const transitionFn = graph.getHandler(`__transition__${node.id}`);
    if (transitionFn !== void 0) {
      const t = transitionFn();
      transitions.push({
        id: node.id,
        key: node.key,
        nodeType: node.type,
        duration: t.duration,
        appear: t.appear,
        depth
      });
    }
  });
  return { overlays, transitions };
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
  const components = inspectComponents(compiled.graph);
  const interactions = inspectInteractions(compiled.graph);
  const diagnostics = {
    errors: app.diagnostics.errors,
    warnings: app.diagnostics.warnings,
    messages: app.diagnostics.messages
  };
  const snapshot = {
    application,
    graph: app.graph,
    signals,
    performance,
    components,
    overlays: interactions.overlays,
    transitions: interactions.transitions,
    diagnostics,
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
  if (s.components.length > 0) {
    lines.push(`Components: ${s.components.length}`);
    for (const c of s.components) {
      lines.push(`  ${"  ".repeat(c.depth)}${c.name}${c.key !== void 0 ? ` (#${c.key})` : ""} \xB7 children ${c.childCount}`);
    }
  }
  if (s.overlays.length > 0) {
    lines.push(`Overlays: ${s.overlays.length}`);
    for (const o of s.overlays) {
      const kind = o.modal ? "modal" : o.menu ? "menu" : o.takesFocus ? "focusable" : "non-modal";
      lines.push(`  ${o.key ?? o.id} [${kind}] ${o.open ? "open" : "closed"}`);
    }
  }
  if (s.transitions.length > 0) {
    lines.push(`Transitions: ${s.transitions.length}`);
    for (const t of s.transitions) {
      lines.push(`  ${t.key ?? t.id} on <${t.nodeType}> \xB7 ${t.duration}ms${t.appear ? " \xB7 appear" : ""}`);
    }
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
  lines.push(
    `Diagnostics: ${s.diagnostics.errors} error(s), ${s.diagnostics.warnings} warning(s)`
  );
  for (const m of s.diagnostics.messages) {
    lines.push(`  ${m}`);
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

// ../devtools/src/view.ts
function escapeHtml(value) {
  const s = typeof value === "string" ? value : stringifyValue(value);
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function stringifyValue(value) {
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
function section(title, count, body) {
  const badge = count === void 0 ? "" : ` <span class="st-count">${count}</span>`;
  return `<section class="st-panel"><h2>${escapeHtml(title)}${badge}</h2>${body}</section>`;
}
function ul(items) {
  if (items.length === 0) return '<p class="st-empty">(none)</p>';
  return `<ul>${items.map((i) => `<li>${i}</li>`).join("")}</ul>`;
}
function renderDevToolsHTML(s) {
  const app = s.application;
  const parts = [];
  parts.push(
    section(
      "Application",
      void 0,
      `<p>${escapeHtml(app.identity.name)} <span class="st-dim">v${escapeHtml(app.identity.version)}</span></p><p class="st-dim">${app.nodeCount} nodes \xB7 depth ${app.maxDepth} \xB7 ${app.pages.length} page(s) \xB7 ${app.signalCount} signals \xB7 ${app.eventHandlers} handlers \xB7 ${app.stateBindings} bindings</p>`
    )
  );
  parts.push(
    section(
      "Components",
      s.components.length,
      ul(
        s.components.map(
          (c) => `<span class="st-depth" style="--d:${c.depth}"></span><code>${escapeHtml(c.name)}</code>` + (c.key !== void 0 ? ` <span class="st-key">#${escapeHtml(c.key)}</span>` : "") + ` <span class="st-dim">${c.childCount} child(ren)</span>`
        )
      )
    )
  );
  parts.push(section("Graph", void 0, `<pre class="st-tree">${escapeHtml(renderNodeTree(s.graph))}</pre>`));
  parts.push(
    section(
      "Signals",
      s.signals.boundSignalIds.length,
      `<p class="st-dim">${s.signals.boundSignalIds.length} bound in graph \xB7 effects shown as observer counts (no global effect registry)</p>` + ul(
        Object.entries(s.signals.live).map(
          ([label, sig]) => `<code>${escapeHtml(label)}</code> <span class="st-key">[${escapeHtml(sig.kind)}]</span> = <code>${escapeHtml(sig.value)}</code> <span class="st-dim">observers ${escapeHtml(sig.observerCount ?? "?")}</span>`
        )
      )
    )
  );
  if (s.router !== void 0) {
    parts.push(
      section(
        "Router",
        void 0,
        `<p><code>${escapeHtml(s.router.path)}</code> <span class="st-dim">(${escapeHtml(s.router.pattern)})${s.router.isFallback ? " \xB7 fallback" : ""}</span></p>`
      )
    );
  }
  if (s.resources !== void 0) {
    parts.push(
      section(
        "Resources",
        Object.keys(s.resources).length,
        ul(
          Object.entries(s.resources).map(
            ([label, r]) => `<code>${escapeHtml(label)}</code>: ${escapeHtml(r.status)}` + (r.loading ? ' <span class="st-dim">(loading)</span>' : "") + (r.hasError ? ` <span class="st-err">!${escapeHtml(r.errorName)}</span>` : "")
          )
        )
      )
    );
  }
  parts.push(
    section(
      "Overlays",
      s.overlays.length,
      ul(
        s.overlays.map((o) => {
          const kind = o.modal ? "modal" : o.menu ? "menu" : o.takesFocus ? "focusable" : "non-modal";
          return `<code>${escapeHtml(o.key ?? o.id)}</code> <span class="st-key">[${kind}]</span> <span class="st-dim">${o.open ? "open" : "closed"}${o.closeOnEscape ? " \xB7 esc" : ""}${o.restoreFocus ? " \xB7 restore" : ""}</span>`;
        })
      )
    )
  );
  parts.push(
    section(
      "Transitions",
      s.transitions.length,
      ul(
        s.transitions.map(
          (t) => `<code>${escapeHtml(t.key ?? t.id)}</code> on <code>&lt;${escapeHtml(t.nodeType)}&gt;</code> <span class="st-dim">${t.duration}ms${t.appear ? " \xB7 appear" : ""}</span>`
        )
      )
    )
  );
  if (s.forms !== void 0) {
    parts.push(
      section(
        "Forms",
        Object.keys(s.forms).length,
        ul(
          Object.entries(s.forms).map(
            ([label, f]) => `<code>${escapeHtml(label)}</code>: ${f.valid ? "valid" : "invalid"} \xB7 ${escapeHtml(f.status)} \xB7 ${f.fields.length} field(s)`
          )
        )
      )
    );
  }
  if (s.i18n !== void 0) {
    const missing = s.i18n.missingKeys;
    parts.push(
      section(
        "i18n",
        void 0,
        `<p><code>${escapeHtml(s.i18n.locale)}</code> of [${s.i18n.locales.map(escapeHtml).join(", ")}]${missing !== void 0 ? ` <span class="st-dim">\xB7 missing ${missing.length}</span>` : ""}</p>`
      )
    );
  }
  parts.push(
    section(
      "Performance",
      s.performance.diagnostics.length,
      `<p class="st-dim">Structural counts, not runtime timings \u2014 not a production profiler.</p>` + ul(s.performance.diagnostics.map((d) => `<code>${escapeHtml(d.code)}</code>: ${escapeHtml(d.message)}`))
    )
  );
  parts.push(
    section(
      "Diagnostics",
      s.diagnostics.errors + s.diagnostics.warnings,
      `<p class="st-dim">${s.diagnostics.errors} error(s) \xB7 ${s.diagnostics.warnings} warning(s)</p>` + ul(s.diagnostics.messages.map((m) => escapeHtml(m)))
    )
  );
  const title = `StreetUI DevTools \u2014 ${escapeHtml(app.identity.name)}`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title}</title><style>${DEVTOOLS_CSS}</style></head><body class="st-devtools"><header class="st-header"><h1>${title} <span class="st-dim">v${escapeHtml(app.identity.version)}</span></h1></header><main>${parts.join("")}</main></body></html>`;
}
function renderNodeTree(node) {
  const lines = [];
  const walk = (n) => {
    const indent = "  ".repeat(n.depth);
    const key = n.key !== void 0 ? ` #${n.key}` : "";
    lines.push(`${indent}<${n.type}${key}> ${n.id}`);
    for (const c of n.children) walk(c);
  };
  walk(node);
  return lines.join("\n");
}
var DEVTOOLS_CSS = [
  ".st-devtools{font:13px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;margin:0;color:#e6e6e6;background:#1e1e28}",
  ".st-header{padding:12px 16px;border-bottom:1px solid #333;background:#15151c}",
  ".st-header h1{font-size:14px;margin:0}",
  "main{padding:8px 16px}",
  ".st-panel{margin:12px 0;border:1px solid #2c2c38;border-radius:6px;overflow:hidden}",
  ".st-panel h2{font-size:12px;text-transform:uppercase;letter-spacing:.04em;margin:0;padding:6px 10px;background:#23232e}",
  ".st-panel ul{list-style:none;margin:0;padding:6px 10px}",
  ".st-panel li{padding:1px 0}",
  ".st-panel p{margin:6px 10px}",
  ".st-count{background:#3a3a4a;border-radius:10px;padding:0 7px;font-size:11px;float:right}",
  ".st-dim{color:#8a8a9a}.st-key{color:#7db4ff}.st-err{color:#ff8a8a}.st-empty{color:#6a6a7a}",
  ".st-tree{margin:6px 10px;white-space:pre;overflow:auto;color:#c8c8d4}",
  ".st-depth{display:inline-block}.st-depth{width:calc(var(--d,0)*12px)}",
  "code{color:#d7d7e0}"
].join("");

// src/config.ts
function defineConfig(config) {
  return config;
}
export {
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
  HeadManager,
  HttpError,
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
  ServerRawHTML,
  ServerStyle,
  ServerText,
  Signal,
  Store,
  StreetApp,
  StreetFrameworkError,
  StreetRenderHandle,
  StreetRendererImpl,
  TransitionController,
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
  component,
  consoleDiagnosticSink,
  consoleHydrationDiagnosticSink,
  containFocus,
  createAnnouncer,
  createApplication,
  createAuthSession,
  createBrowserHistory,
  createClient,
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
  describeError,
  diagnosePerformance,
  effect,
  email,
  environment,
  escapeHtml,
  escapeHtmlAttr,
  escapeHtmlText,
  flushSync,
  focusById,
  focusFirst,
  focusInitial,
  formatDiagnostic,
  formatDiagnosticContext,
  formatHydrationDiagnostic,
  frameworkError,
  generateApplicationId,
  generateNodeId,
  getFocusable,
  getResolvedTransition,
  globalEventBus,
  headingUpdate,
  hydrateGraph,
  inputUpdate,
  inspectApplication,
  inspectComponents,
  inspectContext,
  inspectForm,
  inspectGraph,
  inspectI18n,
  inspectInteractions,
  inspectResource,
  inspectRouter,
  inspectSignal,
  interpolate,
  isBatching,
  isComponentDefinition,
  isHeadContribution,
  isTransitionConfig,
  linkUpdate,
  matchPattern,
  matchRoutes,
  maxLength,
  minLength,
  mountGraph,
  mountNode,
  mountRouter,
  mutation,
  nextId,
  nodeIdPrefix,
  nodeTypeStats,
  normalizePath,
  observerCount,
  onEscape,
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
  renderDevToolsHTML,
  renderHead,
  renderToString,
  reportDiagnostic,
  reportError,
  required,
  resetIdCounter,
  resolveHead,
  resolveTag,
  resolveTransition,
  resource,
  restoreFocus,
  routerOutlet,
  rovingMenu,
  runElementTransition,
  runValidators,
  saveFocus,
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
  trapFocus,
  validateGraph,
  wireComponentBehavior,
  wireEvents,
  wireHeadBehavior,
  wireOverlayBehavior,
  wireReactiveList,
  wireSignalBindings
};
//# sourceMappingURL=index.js.map