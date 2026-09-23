import { describe, it, expect } from 'vitest';
import {
  required,
  minLength,
  maxLength,
  email,
  pattern,
  runValidators,
} from './validators.js';

describe('validators', () => {
  it('required fails on empty/whitespace, passes otherwise', () => {
    expect(required()('')).toBe('This field is required');
    expect(required()('   ')).toBe('This field is required');
    expect(required('Name?')('')).toBe('Name?');
    expect(required()('a')).toBeUndefined();
  });

  it('minLength enforces a lower bound', () => {
    expect(minLength(3)('ab')).toBe('Must be at least 3 characters');
    expect(minLength(3)('abc')).toBeUndefined();
    expect(minLength(3, 'too short')('a')).toBe('too short');
  });

  it('maxLength enforces an upper bound', () => {
    expect(maxLength(3)('abcd')).toBe('Must be at most 3 characters');
    expect(maxLength(3)('abc')).toBeUndefined();
    expect(maxLength(3)('')).toBeUndefined();
  });

  it('email validates plausible addresses and skips empty', () => {
    expect(email()('')).toBeUndefined();
    expect(email()('nope')).toBe('Enter a valid email address');
    expect(email()('a@b')).toBe('Enter a valid email address');
    expect(email()('a@b.com')).toBeUndefined();
  });

  it('pattern validates against a regex and skips empty', () => {
    const digits = pattern(/^\d+$/, 'digits only');
    expect(digits('')).toBeUndefined();
    expect(digits('12a')).toBe('digits only');
    expect(digits('123')).toBeUndefined();
  });

  it('runValidators returns the first error in order', () => {
    expect(runValidators('', [required(), minLength(3)])).toBe('This field is required');
    expect(runValidators('ab', [required(), minLength(3)])).toBe(
      'Must be at least 3 characters',
    );
    expect(runValidators('abc', [required(), minLength(3)])).toBeUndefined();
    expect(runValidators('x', undefined)).toBeUndefined();
    expect(runValidators('x', required())).toBeUndefined();
  });

  it('supports typed custom validators (value) => string | undefined', () => {
    const noSpaces = (v: string) => (v.includes(' ') ? 'no spaces' : undefined);
    expect(runValidators('a b', noSpaces)).toBe('no spaces');
    expect(runValidators('ab', noSpaces)).toBeUndefined();
  });
});
