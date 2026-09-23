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
  Runtime: () => Runtime,
  RuntimeNodeInstance: () => RuntimeNodeInstance,
  createRuntime: () => createRuntime
});
module.exports = __toCommonJS(index_exports);

// src/node-instance.ts
var import_core = require("@streetui/core");
var RuntimeNodeInstance = class {
  graphNode;
  domNode;
  children = [];
  cleanup = new import_core.CleanupRegistry();
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
  trackSignal(signal, handler) {
    const unsub = signal.subscribe(handler);
    this.cleanup.add(unsub);
  }
  /** Register an arbitrary cleanup function (e.g. DOM event removal). */
  trackCleanup(fn) {
    this.cleanup.add(fn);
  }
};

// src/runtime.ts
var import_core2 = require("@streetui/core");
var import_scheduler = require("@streetui/scheduler");
var Runtime = class {
  _renderer;
  _scheduler;
  _cleanup = new import_core2.CleanupRegistry();
  _renderHandle = null;
  _mounted = false;
  constructor(options) {
    this._renderer = options.renderer;
    this._scheduler = options.scheduler ?? new import_scheduler.Scheduler();
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
    const self = this;
    return {
      renderHandle: this._renderHandle,
      runtime: this,
      unmount() {
        self.unmount();
      },
      flush() {
        self._scheduler.flush();
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  Runtime,
  RuntimeNodeInstance,
  createRuntime
});
//# sourceMappingURL=index.cjs.map