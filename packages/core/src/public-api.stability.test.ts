/**
 * v1.0 public API contract — @streetui/core.
 * Imports only the public barrel; asserts the frozen 1.0.0 surface + basic behavior.
 */
import { describe, it, expect } from 'vitest';
import * as API from './index.js';
import {
  resetIdCounter, generateNodeId, createNodeId, frameworkError, StreetFrameworkError,
} from './index.js';

const FROZEN_VALUE_EXPORTS = [
  'a11yIds', 'Application', 'BaseNode', 'CleanupRegistry', 'consoleDiagnosticSink',
  'createApplication', 'createNodeId', 'DiagnosticCollector', 'DiagnosticError',
  'environment', 'Environment', 'formatDiagnostic', 'formatDiagnosticContext',
  'frameworkError', 'generateApplicationId', 'generateNodeId', 'Lifecycle',
  'nextId', 'nodeIdPrefix', 'reportDiagnostic', 'resetIdCounter',
  'StreetFrameworkError', 'toIdToken',
] as const;

describe('@streetui/core — public API contract (v1.0 frozen surface)', () => {
  it('exports every frozen public value', () => {
    for (const name of FROZEN_VALUE_EXPORTS) {
      expect(name in API, `missing public export: ${name}`).toBe(true);
      expect((API as Record<string, unknown>)[name]).toBeDefined();
    }
  });

  it('id generation is deterministic after reset', () => {
    resetIdCounter();
    const a = generateNodeId();
    resetIdCounter();
    const b = generateNodeId();
    expect(typeof a).toBe('string');
    expect(a).toBe(b);
    expect(typeof createNodeId('x')).toBe('string');
  });

  it('frameworkError produces a StreetFrameworkError (an Error subclass)', () => {
    const err = frameworkError('boom', { package: 'core', operation: 'test' });
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(StreetFrameworkError);
    expect(err.message).toContain('boom');
  });
});
