/**
 * StreetUI async resources — framework-native asynchronous data.
 *
 * A `resource` wraps a Promise-returning loader and exposes its lifecycle as
 * ordinary StreetUI signals (status / data / error), so it composes with
 * `derived`, `effect`, `when()`, `listOf` and the renderer with no second
 * reactive system.
 *
 * State machine:
 *
 *   idle ──(load)──▶ loading ──(resolve)──▶ success
 *                      │
 *                      └────(reject)──────▶ error
 *
 * Refetch keeps the previously-loaded `data` visible while `status` is
 * `'loading'` again (see `isRefetching`) — there is no separate `'refetching'`
 * status; it is expressed through `status === 'loading'` with `data` still set.
 *
 * The resource is transport-agnostic: the loader is any function returning a
 * value or a Promise. When it accepts the provided `AbortSignal`, in-flight
 * work is cancelled on `dispose()` or when a newer request supersedes it.
 */

import { signal, derived, batch, type ReadonlySignal, type Unsubscribe } from './signal.js';

export type ResourceStatus = 'idle' | 'loading' | 'success' | 'error';

/** Context handed to the loader; carries an AbortSignal for cancellation. */
export interface ResourceLoaderContext {
  readonly signal: AbortSignal;
}

/** Any value-or-Promise producing function. Receives an abort-aware context. */
export type ResourceLoader<T> = (ctx: ResourceLoaderContext) => Promise<T> | T;

export interface ResourceOptions {
  /** Load immediately on creation. Defaults to `true`. When `false`, stays `idle` until `refetch()`. */
  readonly immediate?: boolean;
  /**
   * Explicit reactive dependencies. When any listed signal changes, the
   * resource refetches. Dependencies are explicit (not auto-tracked from the
   * loader body) so there is no risk of an accidental infinite refetch loop.
   */
  readonly watch?: ReadonlyArray<ReadonlySignal<unknown>>;
  /**
   * Optional teardown registrar (e.g. a route's `ctx.onCleanup`). When given,
   * the resource registers its own `dispose` so it is cleaned up automatically
   * when its owner is removed.
   */
  readonly onCleanup?: (fn: () => void) => void;
}

export interface Resource<T> {
  /** Reactive lifecycle status. */
  readonly status: ReadonlySignal<ResourceStatus>;
  /** The last successfully-loaded value, or `undefined` before first success. */
  readonly data: ReadonlySignal<T | undefined>;
  /** The most recent error, or `undefined` when there is none. Typed `unknown` — never `any`. */
  readonly error: ReadonlySignal<unknown>;
  /** Convenience: `status === 'loading'`. */
  readonly loading: ReadonlySignal<boolean>;
  /** Convenience: loading while previously-loaded data is still present (a refetch). */
  readonly isRefetching: ReadonlySignal<boolean>;
  /** Trigger a new request. Resolves when the request settles (or is superseded). */
  refetch(): Promise<void>;
  /** Cancel in-flight work, drop watchers, and ignore any late results. Idempotent. */
  dispose(): void;
}

/** True for an abort we initiated (so it is not surfaced as a real error). */
function isAbortError(err: unknown): boolean {
  return (
    err instanceof Error && err.name === 'AbortError'
  ) || (
    typeof DOMException !== 'undefined' && err instanceof DOMException && err.name === 'AbortError'
  );
}

export function resource<T>(loader: ResourceLoader<T>, options: ResourceOptions = {}): Resource<T> {
  const status = signal<ResourceStatus>('idle');
  const data = signal<T | undefined>(undefined);
  const error = signal<unknown>(undefined);

  const loading = derived<boolean>(() => status.get() === 'loading');
  const isRefetching = derived<boolean>(() => status.get() === 'loading' && data.get() !== undefined);

  let disposed = false;
  /** Monotonic request id — only the newest request may write state (race guard). */
  let runId = 0;
  let controller: AbortController | null = null;

  const load = async (): Promise<void> => {
    if (disposed) return;

    // Supersede any in-flight request: abort it and bump the run id so its
    // eventual resolution is ignored.
    controller?.abort();
    const myRun = ++runId;
    const myController = new AbortController();
    controller = myController;

    // Enter loading. Preserve `data` (so a refetch keeps showing the old value)
    // and clear any previous error.
    batch(() => {
      error.set(undefined);
      status.set('loading');
    });

    try {
      const result = await loader({ signal: myController.signal });
      // Ignore stale or cancelled resolutions.
      if (disposed || myRun !== runId) return;
      batch(() => {
        data.set(result);
        error.set(undefined);
        status.set('success');
      });
    } catch (err) {
      if (disposed || myRun !== runId) return;
      // A self-initiated abort is not a user-visible error.
      if (isAbortError(err)) return;
      batch(() => {
        error.set(err);
        status.set('error');
      });
    }
  };

  const refetch = (): Promise<void> => load();

  // Explicit reactive dependencies: refetch when any watched signal changes.
  const watchUnsubs: Unsubscribe[] = [];
  if (options.watch !== undefined) {
    for (const dep of options.watch) {
      watchUnsubs.push(
        dep.subscribe(() => {
          if (!disposed) void load();
        }),
      );
    }
  }

  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    controller?.abort();
    controller = null;
    for (const unsub of watchUnsubs) unsub();
    watchUnsubs.length = 0;
  };

  if (options.onCleanup !== undefined) {
    options.onCleanup(dispose);
  }

  if (options.immediate !== false) {
    void load();
  }

  return {
    status,
    data,
    error,
    loading,
    isRefetching,
    refetch,
    dispose,
  };
}
