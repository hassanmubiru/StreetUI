import { describe, it, expect } from 'vitest';
import { createContext } from './context.js';

describe('createContext', () => {
  it('returns the default value when no provider is active', () => {
    const ctx = createContext('default');
    expect(ctx.consume()).toBe('default');
    expect(ctx.hasProvider()).toBe(false);
  });

  it('exposes a symbol id and the default value', () => {
    const ctx = createContext(42, 'count');
    expect(typeof ctx.id).toBe('symbol');
    expect(ctx.id.description).toBe('count');
    expect(ctx.defaultValue).toBe(42);
  });

  it('provides a value to consumers running inside provide()', () => {
    const ctx = createContext('default');
    const seen = ctx.provide('scoped', () => {
      expect(ctx.hasProvider()).toBe(true);
      return ctx.consume();
    });
    expect(seen).toBe('scoped');
  });

  it('pops the value again after provide() returns', () => {
    const ctx = createContext('default');
    ctx.provide('scoped', () => ctx.consume());
    expect(ctx.consume()).toBe('default');
    expect(ctx.hasProvider()).toBe(false);
  });

  it('pops the value even when the builder throws', () => {
    const ctx = createContext('default');
    expect(() =>
      ctx.provide('scoped', () => {
        throw new Error('boom');
      }),
    ).toThrow('boom');
    expect(ctx.consume()).toBe('default');
    expect(ctx.hasProvider()).toBe(false);
  });

  it('resolves the nearest provider when nested', () => {
    const ctx = createContext('root');
    const trail: string[] = [];
    ctx.provide('outer', () => {
      trail.push(ctx.consume());
      ctx.provide('inner', () => {
        trail.push(ctx.consume());
      });
      trail.push(ctx.consume());
    });
    trail.push(ctx.consume());
    expect(trail).toEqual(['outer', 'inner', 'outer', 'root']);
  });

  it('keeps distinct contexts independent', () => {
    const a = createContext('a-default');
    const b = createContext('b-default');
    a.provide('a-scoped', () => {
      expect(a.consume()).toBe('a-scoped');
      expect(b.consume()).toBe('b-default');
    });
  });

  it('can hold a reactive value (e.g. a signal-like object) without wrapping it', () => {
    const signalLike = { get: () => 7 };
    const ctx = createContext<{ get: () => number }>({ get: () => 0 });
    const resolved = ctx.provide(signalLike, () => ctx.consume());
    expect(resolved.get()).toBe(7);
  });
});
