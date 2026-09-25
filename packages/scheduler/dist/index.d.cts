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
type Priority = 'immediate' | 'normal' | 'idle';
interface Job {
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
interface SchedulerDiagnostics {
    error?(message: string, context?: unknown): void;
}
declare class Scheduler {
    private readonly _queue;
    private _flushScheduled;
    private _flushing;
    private _diagnostics;
    /**
     * Install an optional diagnostic sink for swallowed job errors. Pass
     * `undefined` to restore the default `console.error` reporting. Additive and
     * opt-in — the scheduler never sends anything anywhere on its own.
     */
    setDiagnostics(sink: SchedulerDiagnostics | undefined): void;
    /** Total jobs currently queued. */
    get size(): number;
    /** True if a flush has been scheduled but not yet executed. */
    get isPending(): boolean;
    /**
     * Enqueue a job. If a job with the same key exists, the new one replaces it
     * (allowing callers to coalesce repeated updates for the same node).
     */
    schedule(job: Job): void;
    /** Schedule multiple jobs atomically. */
    scheduleAll(jobs: readonly Job[]): void;
    /**
     * Cancel a queued job by key. No-op if not queued.
     */
    cancel(key: string): void;
    /**
     * Synchronously flush all queued jobs (sorted by priority).
     * Useful in tests and for immediate rendering.
     */
    flush(): void;
    /** Clear all pending jobs without executing them. */
    clear(): void;
    private _scheduleMicrotask;
}
/** The shared global scheduler instance. */
declare const scheduler: Scheduler;
/** Convenience: schedule a normal-priority job. */
declare function scheduleUpdate(key: string, fn: () => void): void;
/** Convenience: schedule an immediate-priority job. */
declare function scheduleImmediate(key: string, fn: () => void): void;
/** Convenience: flush the global scheduler synchronously. */
declare function flushSync(): void;

export { type Job, type Priority, Scheduler, type SchedulerDiagnostics, flushSync, scheduleImmediate, scheduleUpdate, scheduler };
