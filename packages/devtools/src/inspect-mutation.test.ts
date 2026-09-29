/**
 * Tests for the Mutation Inspector (panel #7). The write-side counterpart to
 * inspectResource: verifies lifecycle reporting and that the result payload /
 * error message stay hidden unless the caller opts in.
 */
import { describe, it, expect } from 'vitest';
import { mutation } from '@streetui/state';
import { inspectMutation } from './inspect-reactive.js';

describe('inspectMutation (panel #7)', () => {
  it('reports the idle lifecycle before any mutate()', () => {
    const m = mutation<void, string>(() => 'ok');
    const snap = inspectMutation(m);
    expect(snap.status).toBe('idle');
    expect(snap.pending).toBe(false);
    expect(snap.hasData).toBe(false);
    expect(snap.hasError).toBe(false);
    expect(snap.data).toBeUndefined();
  });

  it('reports success and hides the payload by default', async () => {
    const m = mutation<void, string>(() => 'SENSITIVE');
    await m.mutate(undefined);
    const snap = inspectMutation(m);
    expect(snap.status).toBe('success');
    expect(snap.hasData).toBe(true);
    expect(snap.data).toBeUndefined(); // payload hidden by default
  });

  it('exposes the payload/message only when includeData is set', async () => {
    const m = mutation<void, string>(() => 'VALUE');
    await m.mutate(undefined);
    const snap = inspectMutation(m, { includeData: true });
    expect(snap.data).toBe('VALUE');
  });

  it('reports error state with a safe constructor name, message opt-in', async () => {
    const m = mutation<void, string>(() => {
      throw new TypeError('boom');
    });
    await expect(m.mutate(undefined)).rejects.toThrow();
    const safe = inspectMutation(m);
    expect(safe.status).toBe('error');
    expect(safe.hasError).toBe(true);
    expect(safe.errorName).toBe('TypeError');
    expect(safe.errorMessage).toBeUndefined();
    const full = inspectMutation(m, { includeData: true });
    expect(full.errorMessage).toBe('boom');
  });

  it('never triggers the mutation (pure peek)', () => {
    let calls = 0;
    const m = mutation<void, number>(() => ++calls);
    inspectMutation(m);
    inspectMutation(m);
    expect(calls).toBe(0);
  });
});
