/**
 * v1.0 public API contract — @streetui/devtools.
 */
import { describe, it, expect } from 'vitest';
import * as API from './index.js';

const FROZEN_VALUE_EXPORTS = [
  'createDevTools', 'DEFAULT_PERF_THRESHOLDS', 'diagnosePerformance', 'inspectApplication',
  'inspectContext', 'inspectForm', 'inspectGraph', 'inspectI18n', 'inspectResource',
  'inspectRouter', 'inspectSignal', 'nodeTypeStats', 'printDiagnostics', 'printGraph',
] as const;

describe('@streetui/devtools — public API contract (v1.0 frozen surface)', () => {
  it('exports every frozen public value', () => {
    for (const name of FROZEN_VALUE_EXPORTS) {
      expect(name in API, `missing public export: ${name}`).toBe(true);
      expect((API as Record<string, unknown>)[name]).toBeDefined();
    }
    expect(API.createDevTools).toBeTypeOf('function');
    expect(API.DEFAULT_PERF_THRESHOLDS).toBeTypeOf('object');
  });
});
