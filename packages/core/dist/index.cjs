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
var index_exports = {};
__export(index_exports, {
  Application: () => Application,
  BaseNode: () => BaseNode,
  CleanupRegistry: () => CleanupRegistry,
  DiagnosticCollector: () => DiagnosticCollector,
  DiagnosticError: () => DiagnosticError,
  Environment: () => Environment,
  Lifecycle: () => Lifecycle,
  createApplication: () => createApplication,
  createNodeId: () => createNodeId,
  environment: () => environment,
  formatDiagnostic: () => formatDiagnostic,
  generateApplicationId: () => generateApplicationId,
  generateNodeId: () => generateNodeId,
  nextId: () => nextId,
  nodeIdPrefix: () => nodeIdPrefix,
  resetIdCounter: () => resetIdCounter
});
module.exports = __toCommonJS(index_exports);

// src/identity.ts
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

// src/lifecycle.ts
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

// src/environment.ts
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

// src/diagnostics.ts
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

// src/application.ts
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

// src/node.ts
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  Application,
  BaseNode,
  CleanupRegistry,
  DiagnosticCollector,
  DiagnosticError,
  Environment,
  Lifecycle,
  createApplication,
  createNodeId,
  environment,
  formatDiagnostic,
  generateApplicationId,
  generateNodeId,
  nextId,
  nodeIdPrefix,
  resetIdCounter
});
//# sourceMappingURL=index.cjs.map