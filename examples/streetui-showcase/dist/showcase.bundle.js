// ../../packages/state/dist/index.js
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
function signal(initial) {
  return new Signal(initial);
}
function derived(fn) {
  return new DerivedSignal(fn);
}

// ../../packages/core/dist/index.js
var _counter = 0;
function nextId() {
  return ++_counter;
}
function createNodeId(value) {
  return value;
}
function generateNodeId(prefix = "node") {
  return createNodeId(`${prefix}:${nextId()}`);
}
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
function detectEnvironment() {
  try {
    if (typeof process !== "undefined" && process !== null && typeof process === "object" && process.env?.["VITEST"] === "true") {
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

// ../../packages/graph/dist/index.js
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

// ../../packages/dsl/dist/index.js
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
function containerProps(options) {
  const props = {};
  if (options.class !== void 0) props["class"] = options.class;
  if (options.id !== void 0) props["id"] = options.id;
  if (options.key !== void 0) props["key"] = options.key;
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
    const nodeOpts = {
      props: {
        level: options.level ?? 1,
        ...options.class !== void 0 ? { class: options.class } : {},
        ...options.id !== void 0 ? { id: options.id } : {}
      }
    };
    const node = this._graph.createNode("heading", { parent: this._node, ...nodeOpts });
    const resolved = bindValue(this._graph, node, "text", text);
    node.setProp("text", resolved);
  }
  text(content, options = {}) {
    const props = {};
    if (options.class !== void 0) props["class"] = options.class;
    if (options.id !== void 0) props["id"] = options.id;
    const node = this._graph.createNode("text", { parent: this._node, props });
    const resolved = bindValue(this._graph, node, "text", content);
    node.setProp("text", resolved);
  }
  button(label, options = {}) {
    const props = {};
    if (options.class !== void 0) props["class"] = options.class;
    if (options.id !== void 0) props["id"] = options.id;
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
    const nodeOpts = {
      props,
      parent: this._node
    };
    if (options.id !== void 0) nodeOpts.key = options.id;
    const node = this._graph.createNode("input", nodeOpts);
    if (options.value !== void 0) {
      const resolved = bindValue(this._graph, node, "value", options.value);
      node.setProp("value", resolved);
    }
    if (options.disabled !== void 0) {
      const resolved = bindValue(this._graph, node, "disabled", options.disabled);
      node.setProp("disabled", resolved);
    }
    if (options.onInput !== void 0) {
      const handlerKey = `input:${node.id}`;
      this._graph.registerHandler(handlerKey, options.onInput);
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
        props: { key: itemKey, _sig: reactiveListItemSignature(item) }
      });
      renderItem(item, index, new ContainerBuilderImpl(itemNode, graph));
      return itemNode;
    };
    const buildAll = (raw) => {
      const arr = Array.isArray(raw) ? raw : [];
      return arr.map((item, i) => buildItem(item, i));
    };
    graph.registerHandler(`__listbuild__${node.id}`, buildAll);
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

// ../../packages/compiler/dist/index.js
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

// ../../packages/scheduler/dist/index.js
var PRIORITY_ORDER = {
  immediate: 0,
  normal: 1,
  idle: 2
};
var Scheduler = class {
  _queue = /* @__PURE__ */ new Map();
  _flushScheduled = false;
  _flushing = false;
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
          console.error(`[Scheduler] Job "${job.key}" threw:`, err);
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

// ../../packages/runtime/dist/index.js
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

// ../../packages/dom/dist/index.js
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
  isElement(node) {
    return node.nodeType === Node.ELEMENT_NODE;
  }
  isTextNode(node) {
    return node.nodeType === Node.TEXT_NODE;
  }
  parentNode(node) {
    return node.parentNode;
  }
  nextSibling(node) {
    return node.nextSibling;
  }
};
var browserDOMAdapter = new BrowserDOMAdapter();

// ../../packages/renderer/dist/index.js
function createRenderContext(dom, graph, container) {
  return {
    dom,
    graph,
    instances: /* @__PURE__ */ new Map(),
    container
  };
}
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
function wireEvents(dom, graph, node, element, instance) {
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
function patchNode(ctx, graphNode, propKey, newValue) {
  const instance = ctx.instances.get(graphNode.id);
  if (instance === void 0) return;
  const domNode = instance.domNode;
  if (!(domNode instanceof Element)) return;
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
function reconcileItemChildren(ctx, itemInstance, newItemNode, mountFn) {
  const el = itemInstance.domNode;
  if (!(el instanceof Element)) return;
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
    wireEvents(dom, graph, graphNode, el2, new NodeInstance(graphNode, el2));
    const instance2 = new NodeInstance(graphNode, el2);
    ctx.instances.set(graphNode.id, instance2);
    wireSignalBindings(ctx, graphNode, instance2, (propKey, value) => {
      if (propKey === "text") {
        dom.setTextContent(textNode, String(value ?? ""));
      } else {
        applyProp(dom, el2, propKey, value);
      }
    });
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
    wireSignalBindings(ctx, graphNode, instance2, (propKey, value) => {
      if (propKey === "text") {
        dom.setTextContent(el2, String(value ?? ""));
      } else {
        applyProp(dom, el2, propKey, value);
      }
    });
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
    wireSignalBindings(ctx, graphNode, instance2, (propKey, value2) => {
      if (propKey === "value") {
        dom.setProperty(el2, "value", String(value2 ?? ""));
      } else {
        applyProp(dom, el2, propKey, value2);
      }
    });
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
    wireSignalBindings(ctx, graphNode, instance2, (propKey, value) => {
      if (propKey === "label") {
        dom.setTextContent(el2, String(value ?? ""));
      } else if (propKey === "disabled") {
        if (value === true) {
          dom.setAttribute(el2, "disabled", "");
        } else {
          dom.removeAttribute(el2, "disabled");
        }
      } else {
        applyProp(dom, el2, propKey, value);
      }
    });
    dom.appendChild(parentDom, el2);
    return instance2;
  }
  if (graphNode.type === "reactive-list") {
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
  if (graphNode.type === "form") {
    wireEvents(dom, graph, graphNode, el, new NodeInstance(graphNode, el));
  }
  const instance = new NodeInstance(graphNode, el);
  ctx.instances.set(graphNode.id, instance);
  for (const child of graphNode.children) {
    const childInstance = mountNode(ctx, child, el);
    instance.addChild(childInstance);
  }
  dom.appendChild(parentDom, el);
  return instance;
}
function applyNodeProps(ctx, graphNode, el) {
  const skipKeys = /* @__PURE__ */ new Set([
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
  for (const [key, value] of Object.entries(graphNode.props)) {
    if (skipKeys.has(key)) continue;
    applyProp(ctx.dom, el, key, value);
  }
}
function wireSignalBindings(ctx, graphNode, instance, onUpdate) {
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
  const build = ctx.graph.getHandler(`__listbuild__${graphNode.id}`);
  if (build === void 0) return;
  for (const stateRef of graphNode.stateRefs) {
    if (stateRef.propKey !== "items") continue;
    const sig = ctx.graph.getHandler(`__signal__${stateRef.signalId}`);
    if (sig === void 0 || typeof sig.subscribe !== "function") continue;
    const unsub = sig.subscribe((value) => {
      reconcileReactiveList(ctx, graphNode, instance, el, build(value));
    });
    instance.trackCleanup(unsub);
  }
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
var StreetRendererImpl = class {
  _dom;
  constructor(options = {}) {
    this._dom = options.domAdapter ?? new BrowserDOMAdapter();
  }
  mount(compiled, container) {
    const ctx = createRenderContext(this._dom, compiled.graph, container);
    const rootInstance = mountGraph(ctx);
    this._wireSignals(ctx, rootInstance);
    return new StreetRenderHandle(ctx, rootInstance);
  }
  _wireSignals(ctx, rootInstance) {
  }
};
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
    const container = this._ctx.container;
    while (container.firstChild !== null) {
      container.removeChild(container.firstChild);
    }
    this._ctx.instances.clear();
  }
};
function createRenderer(options) {
  return new StreetRendererImpl(options);
}

// src/showcase-app.ts
function isValidEmail(email) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
}
function createShowcaseApp() {
  const count = signal(0);
  const features = signal([
    { id: 1, name: "Core" },
    { id: 2, name: "Renderer" },
    { id: 3, name: "Runtime" }
  ]);
  const formName = signal("");
  const formEmail = signal("");
  const formMessage = signal("");
  const submitted = signal(false);
  const showDetails = signal(false);
  const lastEvent = signal("none");
  let nextId2 = 4;
  const countText = derived(() => String(count.get()));
  const featureCountText = derived(() => `${features.get().length} package(s)`);
  const toggleLabel = derived(() => showDetails.get() ? "Hide details" : "Show details");
  const detailsItems = derived(
    () => showDetails.get() ? [{
      id: "details",
      text: "StreetUI compiles a semantic graph, binds signals in the runtime, and a keyed reconciler patches the real DOM \u2014 no virtual DOM."
    }] : []
  );
  const validationText = derived(() => {
    const n = formName.get().trim();
    const e = formEmail.get().trim();
    const m = formMessage.get().trim();
    if (n === "" || e === "" || m === "") return "All fields are required.";
    if (!isValidEmail(e)) return "Please enter a valid email address.";
    return "Looks good.";
  });
  const isValid = derived(() => validationText.get() === "Looks good.");
  const submittedText = derived(
    () => submitted.get() ? `Thanks ${formName.peek()}, your message was submitted.` : ""
  );
  const lastEventText = derived(() => `Last event: ${lastEvent.get()}`);
  const actions = {
    increment() {
      count.update((n) => n + 1);
      lastEvent.set("click:increment");
    },
    decrement() {
      count.update((n) => n - 1);
      lastEvent.set("click:decrement");
    },
    reset() {
      count.set(0);
      lastEvent.set("click:reset");
    },
    addFeature(name = "New Package") {
      const id = nextId2++;
      features.update((arr) => [...arr, { id, name }]);
      lastEvent.set("click:add-feature");
    },
    removeLastFeature() {
      features.update((arr) => arr.slice(0, Math.max(0, arr.length - 1)));
      lastEvent.set("click:remove-feature");
    },
    removeFeatureById(id) {
      features.update((arr) => arr.filter((f) => f.id !== id));
    },
    reorderFeatures() {
      features.update((arr) => arr.length > 1 ? [...arr.slice(1), arr[0]] : arr);
      lastEvent.set("click:reorder");
    },
    renameFeature(id, name) {
      features.update((arr) => arr.map((f) => f.id === id ? { ...f, name } : f));
      lastEvent.set("click:rename");
    },
    clearFeatures() {
      features.set([]);
      lastEvent.set("click:clear");
    },
    toggleDetails() {
      showDetails.update((v) => !v);
      lastEvent.set("click:toggle-details");
    },
    submitForm() {
      lastEvent.set("submit:form");
      submitted.set(isValid.peek());
    }
  };
  const app = streetui.app({ name: "StreetUI Showcase", version: "1.0.0" });
  app.page("home", (page) => {
    page.section("nav", (nav) => {
      nav.heading("StreetUI", { level: 1, id: "brand" });
      nav.link("Home", { href: "#home", id: "nav-home" });
      nav.link("Features", { href: "#features", id: "nav-features" });
      nav.link("GitHub", { href: "https://example.com", external: true, id: "nav-github" });
    }, { id: "navbar" });
    page.section("hero", (hero) => {
      hero.heading("Build UIs from a semantic graph", { level: 1, id: "hero-title" });
      hero.text(
        "A TypeScript-first framework with its own reactivity and a keyed real-DOM reconciler \u2014 no virtual DOM.",
        { id: "hero-tagline" }
      );
      hero.button("Get started", { id: "hero-cta", onClick: () => actions.increment() });
    }, { id: "hero" });
    page.section("about", (about) => {
      about.heading("Why StreetUI", { level: 2 });
      about.text(
        "Your app compiles into a semantic application graph. The runtime binds signals; the renderer patches only what changed.",
        {}
      );
    }, { id: "about" });
    page.section("features", (fs) => {
      fs.heading("Feature sections", { level: 2 });
      fs.container("feature-reactivity", (c) => {
        c.heading("Framework-owned reactivity", { level: 3 });
        c.text("Signals, derived values, effects and batching ship in @streetui/state.", {});
      });
      fs.container("feature-renderer", (c) => {
        c.heading("Real-DOM renderer", { level: 3 });
        c.text("A keyed reconciler updates the actual DOM and preserves element identity.", {});
      });
    }, { id: "feature-list" });
    page.section("counter", (c) => {
      c.heading("Interactive counter", { level: 2 });
      c.text(countText, { id: "counter-value" });
      c.button("Increment", { id: "btn-increment", onClick: () => actions.increment() });
      c.button("Decrement", { id: "btn-decrement", onClick: () => actions.decrement() });
      c.button("Reset", { id: "btn-reset", onClick: () => actions.reset() });
    }, { id: "counter" });
    page.section("reactive-list", (c) => {
      c.heading("Reactive list", { level: 2 });
      c.text(featureCountText, { id: "feature-count" });
      c.listOf("features", features, (item, _i, content) => {
        content.text(item.name, { id: `feature-${item.id}` });
        content.button("Remove", {
          id: `feature-remove-${item.id}`,
          onClick: () => actions.removeFeatureById(item.id)
        });
      }, { id: "features-list" });
      c.button("Add", { id: "btn-add", onClick: () => actions.addFeature() });
      c.button("Remove", { id: "btn-remove", onClick: () => actions.removeLastFeature() });
      c.button("Reorder", { id: "btn-reorder", onClick: () => actions.reorderFeatures() });
      c.button("Update item", {
        id: "btn-update",
        onClick: () => actions.renameFeature(1, "Core (updated)")
      });
      c.button("Clear", { id: "btn-clear", onClick: () => actions.clearFeatures() });
    }, { id: "list-demo" });
    page.section("contact", (c) => {
      c.heading("Contact form", { level: 2 });
      c.form("contact-form", (form) => {
        form.input({
          id: "field-name",
          type: "text",
          placeholder: "Name",
          value: formName,
          onInput: (v) => {
            formName.set(v);
            lastEvent.set("input:name");
          }
        });
        form.input({
          id: "field-email",
          type: "email",
          placeholder: "Email",
          value: formEmail,
          onInput: (v) => formEmail.set(v),
          onChange: (v) => {
            formEmail.set(v);
            lastEvent.set("change:email");
          }
        });
        form.input({
          id: "field-message",
          type: "text",
          placeholder: "Message",
          value: formMessage,
          onInput: (v) => {
            formMessage.set(v);
            lastEvent.set("input:message");
          }
        });
        form.text(validationText, { id: "form-validation" });
        form.text(submittedText, { id: "form-submitted" });
        form.button("Submit", { id: "btn-submit" });
      }, { id: "the-form", onSubmit: () => actions.submitForm() });
    }, { id: "contact" });
    page.section("conditional", (c) => {
      c.heading("Conditional rendering", { level: 2 });
      c.button(toggleLabel, { id: "btn-toggle", onClick: () => actions.toggleDetails() });
      c.listOf("details", detailsItems, (item, _i, content) => {
        content.text(item.text, { id: "details-text" });
      }, { id: "details-region" });
    }, { id: "conditional" });
    page.section("events", (c) => {
      c.heading("Events", { level: 2 });
      c.text(lastEventText, { id: "event-readout" });
    }, { id: "events" });
    page.section("footer", (c) => {
      c.text("StreetUI Showcase \u2014 built entirely with the StreetUI public API.", {
        id: "footer-text"
      });
    }, { id: "site-footer" });
  });
  const compiled = compile(app);
  const state = {
    count,
    features,
    formName,
    formEmail,
    formMessage,
    submitted,
    showDetails,
    lastEvent
  };
  return { compiled, state, actions };
}
function mountShowcaseApp(container) {
  const { compiled, state, actions } = createShowcaseApp();
  const renderer = createRenderer({ domAdapter: new BrowserDOMAdapter() });
  const runtime = createRuntime({ renderer });
  const mounted = runtime.mount(compiled, container);
  return { compiled, state, actions, mounted, unmount: () => mounted.unmount() };
}

// src/index.ts
if (typeof document !== "undefined") {
  const container = document.getElementById("app");
  if (container !== null) {
    mountShowcaseApp(container);
  }
}
export {
  createShowcaseApp,
  mountShowcaseApp
};
//# sourceMappingURL=showcase.bundle.js.map
