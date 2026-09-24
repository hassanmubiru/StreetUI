/**
 * v1.0 public API contract — @streetui/context.
 */
import { describe, it, expect } from 'vitest';
import * as API from './index.js';
import { createContext } from './index.js';

describe('@streetui/context — public API contract (v1.0 frozen surface)', () => {
  it('exports createContext', () => {
    expect('createContext' in API).toBe(true);
    expect(createContext).toBeTypeOf('function');
  });

  it('provides a scoped value and restores the default afterwards', () => {
    const ctx = createContext(10, 'test-ctx');
    expect(ctx.consume()).toBe(10);
    expect(ctx.hasProvider()).toBe(false);
    const inner = ctx.provide(20, () => {
      expect(ctx.hasProvider()).toBe(true);
      return ctx.consume();
    });
    expect(inner).toBe(20);
    expect(ctx.consume()).toBe(10); // popped back to default
    expect(ctx.hasProvider()).toBe(false);
  });
});
