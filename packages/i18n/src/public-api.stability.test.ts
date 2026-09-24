/**
 * v1.0 public API contract — @streetui/i18n.
 */
import { describe, it, expect } from 'vitest';
import * as API from './index.js';
import { createI18n, interpolate } from './index.js';

describe('@streetui/i18n — public API contract (v1.0 frozen surface)', () => {
  it('exports the frozen public values', () => {
    for (const name of ['createI18n', 'interpolate'] as const) {
      expect(name in API).toBe(true);
      expect((API as Record<string, unknown>)[name]).toBeDefined();
    }
  });
});

describe('@streetui/i18n — behavior stability', () => {
  it('interpolate replaces {name} tokens and leaves unknowns intact', () => {
    expect(interpolate('Hi {name}', { name: 'Ada' })).toBe('Hi Ada');
    expect(interpolate('count={count}', { count: 3 })).toBe('count=3');
    expect(interpolate('no tokens')).toBe('no tokens');
    expect(interpolate('{missing}', {})).toBe('{missing}');
  });

  it('createI18n resolves, switches locale reactively, and reports key presence', () => {
    const i = createI18n({
      locale: 'en',
      messages: {
        en: { greet: 'Hello {name}' },
        fr: { greet: 'Bonjour {name}' },
      },
      fallbackLocale: 'en',
    });
    expect(i.locale.get()).toBe('en');
    expect(i.translate('greet', { name: 'Ada' })).toBe('Hello Ada');
    const reactive = i.t('greet', { name: 'Bo' });
    expect(reactive.get()).toBe('Hello Bo');
    i.setLocale('fr');
    expect(i.locale.get()).toBe('fr');
    expect(i.translate('greet', { name: 'Ada' })).toBe('Bonjour Ada');
    expect(reactive.get()).toBe('Bonjour Bo'); // recomputed on locale change
    expect(i.has('greet')).toBe(true);
    expect(i.has('nope')).toBe(false);
  });
});
