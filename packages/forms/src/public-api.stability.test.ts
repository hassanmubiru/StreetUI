/**
 * v1.0 public API contract — @streetui/forms.
 */
import { describe, it, expect } from 'vitest';
import * as API from './index.js';
import { required, minLength, maxLength, email, pattern, runValidators, createForm } from './index.js';

const FROZEN_VALUE_EXPORTS = [
  'createForm', 'email', 'maxLength', 'minLength', 'pattern', 'required', 'runValidators',
] as const;

describe('@streetui/forms — public API contract (v1.0 frozen surface)', () => {
  it('exports every frozen public value', () => {
    for (const name of FROZEN_VALUE_EXPORTS) {
      expect(name in API, `missing public export: ${name}`).toBe(true);
      expect((API as Record<string, unknown>)[name]).toBeDefined();
    }
  });
});

describe('@streetui/forms — validator behavior stability', () => {
  it('required fails on blank, passes otherwise', () => {
    expect(typeof required()('')).toBe('string');
    expect(required()('x')).toBeUndefined();
  });

  it('minLength / maxLength enforce bounds', () => {
    expect(typeof minLength(3)('ab')).toBe('string');
    expect(minLength(3)('abc')).toBeUndefined();
    expect(typeof maxLength(2)('abc')).toBe('string');
    expect(maxLength(2)('ab')).toBeUndefined();
  });

  it('email / pattern validate format', () => {
    expect(typeof email()('nope')).toBe('string');
    expect(email()('a@b.co')).toBeUndefined();
    const digits = pattern(/^\d+$/, 'digits only');
    expect(typeof digits('abc')).toBe('string');
    expect(digits('123')).toBeUndefined();
  });

  it('runValidators returns the first failure, else undefined', () => {
    expect(runValidators('', [required()])).toBe(required()(''));
    expect(runValidators('ok', [required(), minLength(1)])).toBeUndefined();
    expect(runValidators('x', undefined)).toBeUndefined();
  });

  it('createForm is a factory function', () => {
    expect(createForm).toBeTypeOf('function');
  });
});
