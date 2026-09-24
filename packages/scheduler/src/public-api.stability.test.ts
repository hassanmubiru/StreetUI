/**
 * v1.0 public API contract — @streetui/scheduler.
 */
import { describe, it, expect } from 'vitest';
import * as API from './index.js';

const FROZEN_VALUE_EXPORTS = [
  'flushSync', 'scheduleImmediate', 'scheduler', 'Scheduler', 'scheduleUpdate',
] as const;

describe('@streetui/scheduler — public API contract (v1.0 frozen surface)', () => {
  it('exports every frozen public value', () => {
    for (const name of FROZEN_VALUE_EXPORTS) {
      expect(name in API, `missing public export: ${name}`).toBe(true);
      expect((API as Record<string, unknown>)[name]).toBeDefined();
    }
    expect(API.flushSync).toBeTypeOf('function');
    expect(API.scheduleUpdate).toBeTypeOf('function');
  });
});
