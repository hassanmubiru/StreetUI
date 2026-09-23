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
  Scheduler: () => Scheduler,
  flushSync: () => flushSync,
  scheduleImmediate: () => scheduleImmediate,
  scheduleUpdate: () => scheduleUpdate,
  scheduler: () => scheduler
});
module.exports = __toCommonJS(index_exports);

// src/scheduler.ts
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
function scheduleUpdate(key, fn) {
  scheduler.schedule({ key, priority: "normal", fn });
}
function scheduleImmediate(key, fn) {
  scheduler.schedule({ key, priority: "immediate", fn });
}
function flushSync() {
  scheduler.flush();
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  Scheduler,
  flushSync,
  scheduleImmediate,
  scheduleUpdate,
  scheduler
});
//# sourceMappingURL=index.cjs.map