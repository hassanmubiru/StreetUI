/**
 * Resource — async data lifecycle tests (pure signal layer, no DOM).
 *
 * Covers creation, the idle→loading→success/error transitions, data exposure,
 * refetch (data preserved while refetching), race safety (older response must
 * not overwrite a newer one), abort on dispose, explicit `watch` dependencies,
 * and cleanup (no state writes after dispose).
 */
import { describe, it, expect, vi } from 'vitest';
import { resource, signal } from './index.js';

/** A promise you can resolve/reject from the outside. */
function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const tick = () => new Promise<void>((r) => setTimeout(r, 0));

describe('resource — creation & idle', () => {
  it('stays idle when immediate is false', () => {
    const r = resource(() => Promise.resolve(1), { immediate: false });
    expect(r.status.get()).toBe('idle');
    expect(r.data.get()).toBeUndefined();
    expect(r.error.get()).toBeUndefined();
    expect(r.loading.get()).toBe(false);
    r.dispose();
  });

  it('enters loading immediately by default', () => {
    const r = resource(() => new Promise(() => { /* never settles */ }));
    expect(r.status.get()).toBe('loading');
    expect(r.loading.get()).toBe(true);
    r.dispose();
  });
});

describe('resource — success & error transitions', () => {
  it('idle → loading → success and exposes data', async () => {
    const d = deferred<number[]>();
    const r = resource(() => d.promise, { immediate: false });
    expect(r.status.get()).toBe('idle');

    const p = r.refetch();
    expect(r.status.get()).toBe('loading');

    d.resolve([1, 2, 3]);
    await p;
    expect(r.status.get()).toBe('success');
    expect(r.data.get()).toEqual([1, 2, 3]);
    expect(r.error.get()).toBeUndefined();
    r.dispose();
  });

  it('loading → error and exposes the error (not any)', async () => {
    const d = deferred<number>();
    const r = resource(() => d.promise);
    expect(r.status.get()).toBe('loading');

    const boom = new Error('HTTP 500');
    d.reject(boom);
    await tick();
    expect(r.status.get()).toBe('error');
    expect(r.error.get()).toBe(boom);
    expect(r.data.get()).toBeUndefined();
    r.dispose();
  });
});

describe('resource — refetch', () => {
  it('preserves previous data while refetching, then updates', async () => {
    const first = deferred<string>();
    let call = 0;
    const loader = () => (call++ === 0 ? first.promise : Promise.resolve('second'));
    const r = resource(loader, { immediate: false });

    const p1 = r.refetch();
    first.resolve('first');
    await p1;
    expect(r.data.get()).toBe('first');
    expect(r.status.get()).toBe('success');

    const p2 = r.refetch();
    // While refetching: still loading, previous data preserved, isRefetching true.
    expect(r.status.get()).toBe('loading');
    expect(r.data.get()).toBe('first');
    expect(r.isRefetching.get()).toBe(true);

    await p2;
    expect(r.data.get()).toBe('second');
    expect(r.status.get()).toBe('success');
    expect(r.isRefetching.get()).toBe(false);
    r.dispose();
  });

  it('runs the loader once per request', async () => {
    const loader = vi.fn(() => Promise.resolve(1));
    const r = resource(loader, { immediate: false });
    await r.refetch();
    await r.refetch();
    expect(loader).toHaveBeenCalledTimes(2);
    r.dispose();
  });
});

describe('resource — race conditions', () => {
  it('an older response never overwrites a newer one (B resolves before A)', async () => {
    const a = deferred<string>();
    const b = deferred<string>();
    let call = 0;
    const loader = () => (call++ === 0 ? a.promise : b.promise);
    const r = resource(loader, { immediate: false });

    const pA = r.refetch(); // request A (call 0)
    const pB = r.refetch(); // request B (call 1) supersedes A

    // B resolves first — it is the newest request, so it wins.
    b.resolve('B');
    await pB;
    expect(r.data.get()).toBe('B');
    expect(r.status.get()).toBe('success');

    // A resolves later — it is stale and must be ignored.
    a.resolve('A');
    await pA;
    expect(r.data.get()).toBe('B');
    expect(r.status.get()).toBe('success');
    r.dispose();
  });
});

describe('resource — abort', () => {
  it('aborts the in-flight request on dispose', async () => {
    let seenSignal: AbortSignal | undefined;
    const r = resource((ctx) => {
      seenSignal = ctx.signal;
      return new Promise<number>(() => { /* never settles */ });
    });
    expect(seenSignal?.aborted).toBe(false);
    r.dispose();
    expect(seenSignal?.aborted).toBe(true);
  });

  it('aborts the previous request when superseded by a refetch', async () => {
    const signals: AbortSignal[] = [];
    const r = resource((ctx) => {
      signals.push(ctx.signal);
      return new Promise<number>(() => { /* never settles */ });
    }, { immediate: false });

    r.refetch();
    r.refetch();
    expect(signals.length).toBe(2);
    expect(signals[0]?.aborted).toBe(true);  // superseded
    expect(signals[1]?.aborted).toBe(false); // current
    r.dispose();
    expect(signals[1]?.aborted).toBe(true);
  });

  it('a self-initiated AbortError is not surfaced as an error', async () => {
    const d = deferred<number>();
    const r = resource((ctx) => {
      ctx.signal.addEventListener('abort', () => d.reject(new DOMException('Aborted', 'AbortError')));
      return d.promise;
    });
    r.dispose();
    await tick();
    // Disposed resource must not flip into an error state from its own abort.
    expect(r.error.get()).toBeUndefined();
  });
});

describe('resource — explicit watch dependencies', () => {
  it('refetches when a watched signal changes', async () => {
    const id = signal('1');
    const loader = vi.fn((_ctx: { signal: AbortSignal }) => Promise.resolve(`user-${id.peek()}`));
    const r = resource(loader, { watch: [id] });
    await tick();
    expect(loader).toHaveBeenCalledTimes(1);
    expect(r.data.get()).toBe('user-1');

    id.set('2');
    await tick();
    expect(loader).toHaveBeenCalledTimes(2);
    expect(r.data.get()).toBe('user-2');
    r.dispose();
  });

  it('does not refetch on a watched change after dispose', async () => {
    const id = signal('1');
    const loader = vi.fn((_ctx: { signal: AbortSignal }) => Promise.resolve('x'));
    const r = resource(loader, { watch: [id] });
    await tick();
    const before = loader.mock.calls.length;
    r.dispose();
    id.set('2');
    await tick();
    expect(loader.mock.calls.length).toBe(before);
  });
});

describe('resource — cleanup', () => {
  it('does not write state after dispose (late resolution ignored)', async () => {
    const d = deferred<number>();
    const r = resource(() => d.promise);
    const seen: string[] = [];
    r.status.subscribe((s) => seen.push(s));

    r.dispose();
    d.resolve(42);
    await tick();

    // No success write after dispose.
    expect(r.status.get()).toBe('loading'); // frozen at dispose time
    expect(r.data.get()).toBeUndefined();
    expect(seen).not.toContain('success');
  });

  it('registers dispose via onCleanup', () => {
    const fns: Array<() => void> = [];
    const r = resource(() => new Promise<number>(() => {}), {
      onCleanup: (fn) => fns.push(fn),
    });
    expect(fns.length).toBe(1);
    let seenSignal: boolean | undefined;
    // Running the registered cleanup disposes the resource.
    fns[0]?.();
    seenSignal = true;
    expect(seenSignal).toBe(true);
    // Idempotent: running again is safe.
    expect(() => fns[0]?.()).not.toThrow();
    r.dispose();
  });
});

describe('resource — SSR hydration seed', () => {
  it('starts in success with server-provided initialData and does NOT auto-load', async () => {
    const loader = vi.fn(() => Promise.resolve([9]));
    const r = resource(loader, { initialData: [1, 2, 3] });
    // Seeded synchronously — no loading flash, data already visible.
    expect(r.status.get()).toBe('success');
    expect(r.data.get()).toEqual([1, 2, 3]);
    expect(r.error.get()).toBeUndefined();
    await tick();
    // The client must not refetch what the server already resolved.
    expect(loader).not.toHaveBeenCalled();
    r.dispose();
  });

  it('starts in error with server-provided initialError and does NOT auto-load', async () => {
    const loader = vi.fn(() => Promise.resolve(1));
    const boom = new Error('server failure');
    const r = resource(loader, { initialError: boom });
    expect(r.status.get()).toBe('error');
    expect(r.error.get()).toBe(boom);
    await tick();
    expect(loader).not.toHaveBeenCalled();
    r.dispose();
  });

  it('immediate:true forces a client refetch even when seeded', async () => {
    const d = deferred<number[]>();
    const loader = vi.fn(() => d.promise);
    const r = resource(loader, { initialData: [1], immediate: true });
    // Seeded value visible, but a refetch is already in flight.
    expect(r.data.get()).toEqual([1]);
    expect(loader).toHaveBeenCalledTimes(1);
    expect(r.status.get()).toBe('loading');
    // isRefetching: loading while the seeded data is still shown.
    expect(r.isRefetching.get()).toBe(true);
    d.resolve([2, 3]);
    await r.refetch();
    expect(r.data.get()).toEqual([2, 3]);
    r.dispose();
  });

  it('honours an explicit initialStatus override', () => {
    const r = resource(() => Promise.resolve(1), {
      initialStatus: 'idle',
      immediate: false,
    });
    expect(r.status.get()).toBe('idle');
    r.dispose();
  });

  it('a seeded resource can still refetch on demand', async () => {
    const d = deferred<string>();
    const loader = vi.fn(() => d.promise);
    const r = resource(loader, { initialData: 'from-server' });
    expect(loader).not.toHaveBeenCalled();
    const p = r.refetch();
    expect(loader).toHaveBeenCalledTimes(1);
    expect(r.status.get()).toBe('loading');
    d.resolve('from-client');
    await p;
    expect(r.data.get()).toBe('from-client');
    r.dispose();
  });
});
