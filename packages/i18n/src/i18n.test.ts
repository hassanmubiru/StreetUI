import { describe, it, expect } from 'vitest';
import { createI18n, interpolate } from './i18n.js';

const messages = {
  en: {
    welcome: 'Welcome',
    hello: 'Hello, {name}!',
    'items.one': '{count} item',
    'items.other': '{count} items',
    greetTwice: '{name}, {name}',
  },
  fr: {
    welcome: 'Bienvenue',
    hello: 'Bonjour, {name} !',
    'items.one': '{count} article',
    'items.other': '{count} articles',
    greetTwice: '{name}, {name}',
  },
} as const;

function i18n() {
  return createI18n({ locale: 'en', messages, fallbackLocale: 'en' });
}

describe('interpolate', () => {
  it('replaces named placeholders and leaves unknown ones intact', () => {
    expect(interpolate('Hi {name}', { name: 'Ada' })).toBe('Hi Ada');
    expect(interpolate('{a}+{b}={c}', { a: 1, b: 2 })).toBe('1+2={c}');
    expect(interpolate('no params here')).toBe('no params here');
  });

  it('substitutes every occurrence of a placeholder', () => {
    expect(interpolate('{name}, {name}', { name: 'Ada' })).toBe('Ada, Ada');
  });
});

describe('createI18n — translation', () => {
  it('translates typed keys for the initial locale', () => {
    const i = i18n();
    expect(i.t('welcome').get()).toBe('Welcome');
    expect(i.translate('welcome')).toBe('Welcome');
  });

  it('interpolates params', () => {
    const i = i18n();
    expect(i.t('hello', { name: 'Ada' }).get()).toBe('Hello, Ada!');
  });

  it('returns the key itself for a missing message (deterministic miss)', () => {
    const i = i18n();
    // @ts-expect-error unknown key is intentionally rejected by the type checker
    expect(i.t('does.not.exist').get()).toBe('does.not.exist');
  });

  it('exposes the declared locales', () => {
    expect(i18n().locales).toEqual(['en', 'fr']);
  });
});

describe('createI18n — reactive locale', () => {
  it('t() recomputes when the locale changes', () => {
    const i = i18n();
    const welcome = i.t('welcome');
    expect(welcome.get()).toBe('Welcome');
    i.setLocale('fr');
    expect(welcome.get()).toBe('Bienvenue');
    expect(i.locale.get()).toBe('fr');
  });

  it('notifies subscribers on locale change', () => {
    const i = i18n();
    const hello = i.t('hello', { name: 'Ada' });
    const seen: string[] = [];
    const unsub = hello.subscribe((v) => seen.push(v));
    i.setLocale('fr');
    expect(seen).toEqual(['Bonjour, Ada !']);
    unsub();
  });

  it('falls back to the fallback locale for keys missing in the active one', () => {
    const i = createI18n({
      locale: 'fr',
      messages: { en: { only: 'English only' }, fr: {} },
      fallbackLocale: 'en',
    });
    expect(i.t('only').get()).toBe('English only');
  });
});

describe('createI18n — pluralization', () => {
  it('selects the plural category and exposes {count}', () => {
    const i = i18n();
    expect(i.plural('items', 1).get()).toBe('1 item');
    expect(i.plural('items', 5).get()).toBe('5 items');
  });

  it('pluralization reacts to locale changes', () => {
    const i = i18n();
    const p = i.plural('items', 2);
    expect(p.get()).toBe('2 items');
    i.setLocale('fr');
    expect(p.get()).toBe('2 articles');
  });

  it('falls back to the .other form when a category message is absent', () => {
    const i = createI18n({
      locale: 'en',
      messages: { en: { 'x.other': '{count} x' } },
    });
    expect(i.plural('x', 1).get()).toBe('1 x');
  });
});

describe('createI18n — has', () => {
  it('reports whether a key resolves in the active or fallback locale', () => {
    const i = i18n();
    expect(i.has('welcome')).toBe(true);
    expect(i.has('nope')).toBe(false);
  });
});

describe('createI18n — determinism (SSR/hydration safety)', () => {
  it('produces identical output for the same (locale, key, params)', () => {
    const a = createI18n({ locale: 'en', messages });
    const b = createI18n({ locale: 'en', messages });
    expect(a.t('hello', { name: 'Ada' }).get()).toBe(b.t('hello', { name: 'Ada' }).get());
    expect(a.plural('items', 3).get()).toBe(b.plural('items', 3).get());
  });
});
