/**
 * Minimal, framework-native internationalization for StreetUI.
 *
 * Built entirely on `@streetui/state` signals — there is no second reactive
 * system. The active locale is a writable signal; `t()` returns a derived
 * signal that recomputes when the locale changes, so translations plug
 * straight into the DSL's reactive text bindings (`text(() => i18n.t(...).get())`
 * or `text(i18n.t(...))`).
 *
 * Translation is deterministic: a missing key resolves to the key itself, and
 * the same (locale, key, params) always produces the same string on the server
 * and the client. That determinism is what keeps `renderToString()` and
 * `hydrate()` in agreement — provided the app boots the client with the same
 * initial locale it rendered with on the server.
 */

import {
  signal,
  derived,
  type ReadonlySignal,
  type DerivedSignal,
} from '@streetui/state';

/** A flat dictionary of message templates for a single locale. */
export type MessageMap = Record<string, string>;

/** Values allowed in interpolation params. */
export type InterpolationParams = Record<string, string | number>;

export interface I18nConfig<M extends MessageMap> {
  /** The initial (and server-rendered) locale. */
  readonly locale: string;
  /** Messages keyed by locale, e.g. `{ en: {...}, fr: {...} }`. */
  readonly messages: Readonly<Record<string, M>>;
  /** Locale consulted when a key is absent from the active locale. */
  readonly fallbackLocale?: string;
}

export interface I18n<M extends MessageMap> {
  /** The active locale as a reactive, read-only signal. */
  readonly locale: ReadonlySignal<string>;
  /** Switch the active locale; all `t()`/`plural()` signals recompute. */
  setLocale(locale: string): void;
  /** The locales that have a message map, in declaration order. */
  readonly locales: ReadonlyArray<string>;
  /** Reactive translation. Returns a derived signal — call `.get()` to read. */
  t(key: keyof M & string, params?: InterpolationParams): ReadonlySignal<string>;
  /** Non-reactive translation for the current locale (a one-shot read). */
  translate(key: keyof M & string, params?: InterpolationParams): string;
  /**
   * Reactive pluralization via `Intl.PluralRules`. Selects the message whose
   * key is `${key}.${category}` (e.g. `items.one`), falling back to
   * `${key}.other`. `count` is available to interpolation as `{count}`.
   */
  plural(key: string, count: number, params?: InterpolationParams): ReadonlySignal<string>;
  /** True when the active (or fallback) locale defines `key`. */
  has(key: string): boolean;
}

const INTERPOLATION = /\{(\w+)\}/g;

/** Replace `{name}` placeholders using `params`; unknown names are left intact. */
export function interpolate(template: string, params?: InterpolationParams): string {
  if (params === undefined) return template;
  return template.replace(INTERPOLATION, (whole, name: string) => {
    const value = params[name];
    return value === undefined ? whole : String(value);
  });
}

export function createI18n<M extends MessageMap>(config: I18nConfig<M>): I18n<M> {
  const messages = config.messages;
  const fallback = config.fallbackLocale;
  const localeSignal = signal<string>(config.locale);
  const locales = Object.keys(messages);

  /** Resolve a raw template for `key` in `loc`, then the fallback locale. */
  function lookup(loc: string, key: string): string | undefined {
    const active = messages[loc];
    const hit = active === undefined ? undefined : active[key];
    if (hit !== undefined) return hit;
    if (fallback !== undefined && fallback !== loc) {
      const fb = messages[fallback];
      if (fb !== undefined) return fb[key];
    }
    return undefined;
  }

  function resolve(loc: string, key: string, params?: InterpolationParams): string {
    const template = lookup(loc, key);
    // Deterministic miss: echo the key so output is stable server/client.
    return template === undefined ? key : interpolate(template, params);
  }

  function pluralKey(loc: string, key: string, count: number): string {
    const category = new Intl.PluralRules(loc).select(count);
    if (lookup(loc, `${key}.${category}`) !== undefined) return `${key}.${category}`;
    return `${key}.other`;
  }

  return {
    locale: localeSignal,
    locales,
    setLocale(loc: string): void {
      localeSignal.set(loc);
    },
    t(key, params): DerivedSignal<string> {
      return derived<string>(() => resolve(localeSignal.get(), key, params));
    },
    translate(key, params): string {
      return resolve(localeSignal.peek(), key, params);
    },
    plural(key, count, params): DerivedSignal<string> {
      const merged: InterpolationParams = { count, ...(params ?? {}) };
      return derived<string>(() => {
        const loc = localeSignal.get();
        return resolve(loc, pluralKey(loc, key, count), merged);
      });
    },
    has(key: string): boolean {
      return lookup(localeSignal.peek(), key) !== undefined;
    },
  };
}
