import { ReadonlySignal } from '@streetui/state';

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

/** A flat dictionary of message templates for a single locale. */
type MessageMap = Record<string, string>;
/** Values allowed in interpolation params. */
type InterpolationParams = Record<string, string | number>;
interface I18nConfig<M extends MessageMap> {
    /** The initial (and server-rendered) locale. */
    readonly locale: string;
    /** Messages keyed by locale, e.g. `{ en: {...}, fr: {...} }`. */
    readonly messages: Readonly<Record<string, M>>;
    /** Locale consulted when a key is absent from the active locale. */
    readonly fallbackLocale?: string;
}
interface I18n<M extends MessageMap> {
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
/** Replace `{name}` placeholders using `params`; unknown names are left intact. */
declare function interpolate(template: string, params?: InterpolationParams): string;
declare function createI18n<M extends MessageMap>(config: I18nConfig<M>): I18n<M>;

export { type I18n, type I18nConfig, type InterpolationParams, type MessageMap, createI18n, interpolate };
