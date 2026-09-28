/**
 * Tests for the `mutation` write primitive: lifecycle, explicit invalidation
 * via onSuccess→resource.refetch, race-guarding, reset, and dispose. These use
 * only the public reactive surface — no second state system.
 */
import { describe, it, expect, vi } from 'vitest';
import { mutation } from './mutation.js';
import { resource } from './resource.js';

describe('mutation — lifecycle', () => {
  it('starts idle and advances idle→loading→success with the result', async () => {
    const m = mutation<{ n: number }, number>(({ n }) => Promise.resolve(n * 2));
    expect(m.status.get()).toBe('idle');
    expect(m.pending.get()).toBe(false);

    const p = m.mutate({ n: 21 });
    expect(m.status.get()).toBe('loading');
    expect(m.pending.get()).toBe(true);

    await expect(p).resolves.toBe(42);
    expect(m.status.get()).toBe('success');
    expect(m.data.get()).toBe(42);
    expect(m.error.get()).toBeUndefined();
    expect(m.pending.get()).toBe(false);
  });

  it('advances to error and re-throws, exposing the error reactively', async () => {
    const boom = new Error('nope');
    const m = mutation<void, never>(() => {
      throw boom;
    });
    await expect(m.mutate(undefined)).rejects.toBe(boom);
    expect(m.status.get()).toBe('error');
    expect(m.error.get()).toBe(boom);
    expect(m.pending.get()).toBe(false);
  });
});

describe('mutation — explicit invalidation (no global cache)', () => {
  it('onSuccess can refetch a resource, and mutate() resolves only after it', async () => {
    let serverValue = 'v1';
    const read = resource<string>(() => Promise.resolve(serverValue));
    await read.refetch();
    expect(read.data.get()).toBe('v1');

    const write = mutation<string, void>(
      (next) => {
        serverValue = next;
      },
      { onSuccess: () => read.refetch() },
    );

    await write.mutate('v2');
    // Read is already up to date because onSuccess's refetch was awaited.
    expect(read.data.get()).toBe('v2');
  });

  it('fires onSuccess/onSettled on success and onError/onSettled on failure', async () => {
    const onSuccess = vi.fn();
    const onError = vi.fn();
    const onSettled = vi.fn();

    const ok = mutation<void, string>(() => 'x', { onSuccess, onError, onSettled });
    await ok.mutate(undefined);
    expect(onSuccess).toHaveBeenCalledWith('x', undefined);
    expect(onError).not.toHaveBeenCalled();
    expect(onSettled).toHaveBeenCalledTimes(1);

    const bad = mutation<void, never>(() => Promise.reject(new Error('e')), {
      onSuccess,
      onError,
      onSettled,
    });
    await expect(bad.mutate(undefined)).rejects.toThrow('e');
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onSettled).toHaveBeenCalledTimes(2);
  });
});

describe('mutation — race guard, reset, dispose', () => {
  it('only the newest run writes state when calls overlap', async () => {
    let resolveFirst!: (v: string) => void;
    const first = new Promise<string>((r) => (resolveFirst = r));
    const calls = [first, Promise.resolve('second')];
    let i = 0;
    const m = mutation<void, string>(() => calls[i++]!);

    const p1 = m.mutate(undefined);
    const p2 = m.mutate(undefined);
    await p2; // second settles first (it's already resolved)
    expect(m.data.get()).toBe('second');

    // The superseded first run resolves late and must NOT overwrite state.
    resolveFirst('first');
    await p1;
    expect(m.data.get()).toBe('second');
  });

  it('reset returns to idle with no data/error', async () => {
    const m = mutation<void, string>(() => 'done');
    await m.mutate(undefined);
    expect(m.status.get()).toBe('success');
    m.reset();
    expect(m.status.get()).toBe('idle');
    expect(m.data.get()).toBeUndefined();
    expect(m.error.get()).toBeUndefined();
  });

  it('dispose ignores late results (state stays idle)', async () => {
    let release!: (v: string) => void;
    const m = mutation<void, string>(() => new Promise<string>((r) => (release = r)));
    const p = m.mutate(undefined);
    m.dispose();
    release('late');
    await p;
    expect(m.status.get()).toBe('loading'); // never advanced after dispose
    expect(m.data.get()).toBeUndefined();
  });

  it('registers dispose with an onCleanup registrar', () => {
    let registered: (() => void) | undefined;
    const m = mutation<void, void>(() => void 0, { onCleanup: (fn) => (registered = fn) });
    expect(typeof registered).toBe('function');
    registered!();
    expect(() => m.reset()).not.toThrow();
  });
});
