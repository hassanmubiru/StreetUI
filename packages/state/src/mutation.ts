/**
 * StreetUI mutations — framework-native asynchronous *writes*.
 *
 * A `resource` models a read: a loader that runs on creation / on demand and
 * whose value the UI observes. A `mutation` is its write-side counterpart: an
 * explicit, argument-taking async action (create / update / delete, a form
 * submit, a "mark as done" click) whose lifecycle is exposed as ordinary
 * StreetUI signals so it composes with `derived`, `when()`, and the renderer
 * with NO second reactive system.
 *
 * State machine (mirrors `resource`, but only ever advances on an explicit
 * `mutate()` — a mutation never runs on its own):
 *
 *   idle ──(mutate)──▶ loading ──(resolve)──▶ success
 *                        │
 *                        └────(reject)──────▶ error
 *
 * There is deliberately NO global cache and NO automatic invalidation registry
 * (that would be a second state system with its own lifetime and coherency
 * rules). Invalidation is explicit and local: pass an `onSuccess` that calls the
 * `refetch()` of whichever resources the write affected. This keeps data flow
 * one-directional and readable — the write says exactly what it invalidates.
 */

import { signal, derived, batch, type ReadonlySignal } from './signal.js';
import type { ResourceStatus } from './resource.js';

/** A mutation shares the resource status vocabulary (idle/loading/success/error). */
export type MutationStatus = ResourceStatus;

/** The async action a mutation runs. Receives the caller's argument. */
export type Mutator<TArgs, TResult> = (args: TArgs) => Promise<TResult> | TResult;

export interface MutationOptions<TArgs, TResult> {
  /**
   * Run after a successful mutation, before `mutate()`'s promise resolves. The
   * natural place to invalidate reads: call the affected resources' `refetch()`.
   * May be async; its completion is awaited so callers can rely on reads being
   * up to date once `mutate()` resolves.
   */
  readonly onSuccess?: (result: TResult, args: TArgs) => void | Promise<void>;
  /** Run after a failed mutation (the thrown value is passed through). */
  readonly onError?: (error: unknown, args: TArgs) => void | Promise<void>;
  /** Run after success OR error, once the lifecycle has settled. */
  readonly onSettled?: (args: TArgs) => void | Promise<void>;
  /**
   * Optional teardown registrar (e.g. a component's `ctx.onCleanup`). When
   * given, the mutation registers its own `dispose` so late results from an
   * in-flight `mutate()` are ignored once the owner is removed.
   */
  readonly onCleanup?: (fn: () => void) => void;
}

export interface Mutation<TArgs, TResult> {
  /** Reactive lifecycle status. */
  readonly status: ReadonlySignal<MutationStatus>;
  /** The most recent successful result, or `undefined` before first success. */
  readonly data: ReadonlySignal<TResult | undefined>;
  /** The most recent error, or `undefined` when there is none. Typed `unknown`. */
  readonly error: ReadonlySignal<unknown>;
  /** Convenience: `status === 'loading'` (an in-flight write). */
  readonly pending: ReadonlySignal<boolean>;
  /**
   * Run the mutation. Resolves with the result on success. On failure the
   * rejection is surfaced through `error`/`status` AND re-thrown, so a caller
   * that wants to react imperatively can `try/catch`; a caller that only wants
   * the reactive state can ignore the returned promise. Superseded/disposed
   * runs never write state (race guard), matching `resource`.
   */
  mutate(args: TArgs): Promise<TResult>;
  /** Reset back to `idle` with no data/error. */
  reset(): void;
  /** Ignore any in-flight result and mark the mutation inert. Idempotent. */
  dispose(): void;
}

/**
 * Create a {@link Mutation}. The zero-argument form is written
 * `mutation<void, T>(() => …)` and invoked as `mutate(undefined)`.
 */
export function mutation<TArgs, TResult>(
  mutator: Mutator<TArgs, TResult>,
  options: MutationOptions<TArgs, TResult> = {},
): Mutation<TArgs, TResult> {
  const status = signal<MutationStatus>('idle');
  const data = signal<TResult | undefined>(undefined);
  const error = signal<unknown>(undefined);
  const pending = derived<boolean>(() => status.get() === 'loading');

  let disposed = false;
  /** Monotonic run id — only the newest mutate() may write state. */
  let runId = 0;

  const mutate = async (args: TArgs): Promise<TResult> => {
    if (disposed) {
      // Inert: run the action for its side effect but never touch state.
      return (await mutator(args)) as TResult;
    }
    const myRun = ++runId;
    batch(() => {
      error.set(undefined);
      status.set('loading');
    });

    try {
      const result = await mutator(args);
      if (!disposed && myRun === runId) {
        batch(() => {
          data.set(result);
          error.set(undefined);
          status.set('success');
        });
      }
      // Side effects run only for the newest, still-live run.
      if (!disposed && myRun === runId) {
        await options.onSuccess?.(result, args);
        await options.onSettled?.(args);
      }
      return result;
    } catch (err) {
      if (!disposed && myRun === runId) {
        batch(() => {
          error.set(err);
          status.set('error');
        });
        await options.onError?.(err, args);
        await options.onSettled?.(args);
      }
      throw err;
    }
  };

  const reset = (): void => {
    batch(() => {
      status.set('idle');
      data.set(undefined);
      error.set(undefined);
    });
  };

  const dispose = (): void => {
    disposed = true;
  };

  if (options.onCleanup !== undefined) options.onCleanup(dispose);

  return { status, data, error, pending, mutate, reset, dispose };
}
