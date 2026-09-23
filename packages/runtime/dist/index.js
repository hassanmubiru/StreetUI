// src/node-instance.ts
import { CleanupRegistry } from "@streetui/core";
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
import { CleanupRegistry as CleanupRegistry2 } from "@streetui/core";
import { Scheduler } from "@streetui/scheduler";
var Runtime = class {
  _renderer;
  _scheduler;
  _cleanup = new CleanupRegistry2();
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
export {
  Runtime,
  RuntimeNodeInstance,
  createRuntime
};
//# sourceMappingURL=index.js.map