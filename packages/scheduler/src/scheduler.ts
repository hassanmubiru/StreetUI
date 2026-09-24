/**
 * StreetUI update scheduler.
 *
 * Responsibilities:
 *  - Queue update callbacks
 *  - Batch synchronous enqueues into a single microtask flush
 *  - Guarantee ordering: higher priority jobs flush first
 *  - Prevent duplicate work for the same job key
 *  - Allow synchronous flush for tests
 */

export type Priority = 'immediate' | 'normal' | 'idle';

const PRIORITY_ORDER: Record<Priority, number> = {
  immediate: 0,
  normal: 1,
  idle: 2,
};

export interface Job {
  /** Unique key — if another job with the same key is already queued, it is replaced. */
  readonly key: string;
  readonly priority: Priority;
  readonly fn: () => void;
}

/**
 * Optional error-reporting hook (v0.9 §26/§27). Structurally compatible with
 * `@streetui/core`'s `DiagnosticSink` (the `error` method) so an application can
 * route swallowed scheduler-job failures through its own logger instead of the
 * default `console.error`. Kept as a local structural type so the scheduler
 * stays dependency-free; no network, no telemetry. When unset, behaviour is
 * exactly as before.
 */
export interface SchedulerDiagnostics {
  error?(message: string, context?: unknown): void;
}

export class Scheduler {
  private readonly _queue: Map<string, Job> = new Map();
  private _flushScheduled = false;
  private _flushing = false;
  private _diagnostics: SchedulerDiagnostics | undefined = undefined;

  /**
   * Install an optional diagnostic sink for swallowed job errors. Pass
   * `undefined` to restore the default `console.error` reporting. Additive and
   * opt-in — the scheduler never sends anything anywhere on its own.
   */
  setDiagnostics(sink: SchedulerDiagnostics | undefined): void {
    this._diagnostics = sink;
  }

  /** Total jobs currently queued. */
  get size(): number {
    return this._queue.size;
  }

  /** True if a flush has been scheduled but not yet executed. */
  get isPending(): boolean {
    return this._flushScheduled;
  }

  /**
   * Enqueue a job. If a job with the same key exists, the new one replaces it
   * (allowing callers to coalesce repeated updates for the same node).
   */
  schedule(job: Job): void {
    this._queue.set(job.key, job);
    if (!this._flushScheduled && !this._flushing) {
      this._flushScheduled = true;
      this._scheduleMicrotask();
    }
  }

  /** Schedule multiple jobs atomically. */
  scheduleAll(jobs: readonly Job[]): void {
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
  cancel(key: string): void {
    this._queue.delete(key);
  }

  /**
   * Synchronously flush all queued jobs (sorted by priority).
   * Useful in tests and for immediate rendering.
   */
  flush(): void {
    if (this._flushing) return;
    this._flushScheduled = false;
    this._flushing = true;

    const jobs = Array.from(this._queue.values()).sort(
      (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority],
    );
    this._queue.clear();

    try {
      for (const job of jobs) {
        try {
          job.fn();
        } catch (err) {
          // Isolate job failures — report and continue so remaining jobs still run.
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
  clear(): void {
    this._queue.clear();
    this._flushScheduled = false;
  }

  private _scheduleMicrotask(): void {
    Promise.resolve().then(() => {
      if (this._flushScheduled) {
        this.flush();
      }
    });
  }
}

/** The shared global scheduler instance. */
export const scheduler = new Scheduler();

/** Convenience: schedule a normal-priority job. */
export function scheduleUpdate(key: string, fn: () => void): void {
  scheduler.schedule({ key, priority: 'normal', fn });
}

/** Convenience: schedule an immediate-priority job. */
export function scheduleImmediate(key: string, fn: () => void): void {
  scheduler.schedule({ key, priority: 'immediate', fn });
}

/** Convenience: flush the global scheduler synchronously. */
export function flushSync(): void {
  scheduler.flush();
}
