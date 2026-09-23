import { describe, it, expect } from 'vitest';
import { a11yIds, toIdToken } from './a11y-ids.js';

describe('a11yIds', () => {
  it('derives a stable set of ids from a base', () => {
    const ids = a11yIds('email');
    expect(ids.base).toBe('email');
    expect(ids.input).toBe('email-input');
    expect(ids.label).toBe('email-label');
    expect(ids.description).toBe('email-description');
    expect(ids.error).toBe('email-error');
    expect(ids.title).toBe('email-title');
  });

  it('is fully deterministic — repeated calls yield identical ids (SSR-safe)', () => {
    expect(a11yIds('email').input).toBe(a11yIds('email').input);
    expect(a11yIds('confirm password').label).toBe(a11yIds('confirm password').label);
  });

  it('normalises unsafe characters into a token', () => {
    expect(toIdToken('confirm password')).toBe('confirm-password');
    expect(toIdToken('  user@name!  ')).toBe('user-name');
    expect(toIdToken('')).toBe('field');
    expect(a11yIds('user@email').input).toBe('user-email-input');
  });

  it('derives arbitrary suffixed ids', () => {
    const ids = a11yIds('dialog');
    expect(ids.id('close')).toBe('dialog-close');
    expect(ids.id('OK Button')).toBe('dialog-OK-Button');
  });
});
