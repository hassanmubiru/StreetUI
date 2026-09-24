/**
 * v1.0 public API contract — @streetui/events.
 */
import { describe, it, expect } from 'vitest';
import * as API from './index.js';

const FROZEN_VALUE_EXPORTS = [
  'bindDomEvent', 'createStreetEvent', 'DomEventRegistry', 'EventBus', 'globalEventBus',
] as const;

describe('@streetui/events — public API contract (v1.0 frozen surface)', () => {
  it('exports every frozen public value', () => {
    for (const name of FROZEN_VALUE_EXPORTS) {
      expect(name in API, `missing public export: ${name}`).toBe(true);
      expect((API as Record<string, unknown>)[name]).toBeDefined();
    }
  });
});
