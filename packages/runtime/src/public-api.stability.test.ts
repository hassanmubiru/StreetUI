/**
 * v1.0 public API contract — @streetui/runtime.
 */
import { describe, it, expect } from 'vitest';
import * as API from './index.js';

const FROZEN_VALUE_EXPORTS = ['createRuntime', 'Runtime', 'RuntimeNodeInstance'] as const;

describe('@streetui/runtime — public API contract (v1.0 frozen surface)', () => {
  it('exports every frozen public value', () => {
    for (const name of FROZEN_VALUE_EXPORTS) {
      expect(name in API, `missing public export: ${name}`).toBe(true);
      expect((API as Record<string, unknown>)[name]).toBeDefined();
    }
    expect(API.createRuntime).toBeTypeOf('function');
  });
});
