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
export {
  Scheduler,
  flushSync,
  scheduleImmediate,
  scheduleUpdate,
  scheduler
};
//# sourceMappingURL=index.js.map