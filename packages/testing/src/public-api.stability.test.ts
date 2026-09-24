/**
 * v1.0 public API contract — @streetui/testing.
 */
import { describe, it, expect } from 'vitest';
import * as API from './index.js';

const FROZEN_VALUE_EXPORTS = [
  'findAllByRole', 'findByRole', 'findByText', 'flushUpdates',
  'render', 'renderOnce', 'renderServerThenHydrate', 'waitFor',
] as const;

describe('@streetui/testing — public API contract (v1.0 frozen surface)', () => {
  it('exports every frozen public helper as a function', () => {
    for (const name of FROZEN_VALUE_EXPORTS) {
      expect(name in API, `missing public export: ${name}`).toBe(true);
      expect((API as Record<string, unknown>)[name]).toBeTypeOf('function');
    }
  });
});
