# @streetui/i18n

Minimal, framework-native internationalization for StreetUI. Built **entirely**
on `@streetui/state` signals — the active locale is a writable signal and `t()`
returns a derived signal, so translations plug straight into the DSL's reactive
text bindings. There is no second reactive system, no ICU parser, and no
third-party dependency.

```bash
# part of the StreetUI monorepo — no separate install
```

---

## Creating an instance

```ts
import { createI18n } from '@streetui/i18n';

const messages = {
  en: { 'app.title': 'Accounts', 'hello': 'Hello, {name}!', 'items.one': '{count} item', 'items.other': '{count} items' },
  fr: { 'app.title': 'Comptes', 'hello': 'Bonjour, {name} !', 'items.one': '{count} article', 'items.other': '{count} articles' },
} as const;

// A typed message shape keeps keys checked at compile time.
type MessageKey = keyof (typeof messages)['en'];
type Messages = Record<MessageKey, string>;

const i18n = createI18n<Messages>({
  locale: 'en',
  messages,
  fallbackLocale: 'en',   // consulted when a key is missing in the active locale
});
```

---

## Reactive vs. one-shot translation

There are two lookups, and the distinction matters:

- **`t(key, params?)` → `ReadonlySignal<string>`** — reactive. It recomputes when
  the locale changes, so it belongs in DSL bindings that should re-render on a
  locale switch.
- **`translate(key, params?)` → `string`** — a non-reactive one-shot read of the
  current locale. Use it for values captured once at build time (e.g. a
  validator message or a static `aria-label`) that should not re-render.

```ts
page.heading(i18n.t('app.title'));                 // reactive — flips on setLocale
page.button('Save', { ariaLabel: i18n.translate('actions.save') });   // one-shot
```

`key` is typed as `keyof M & string`, so unknown keys are a compile error:

```ts
i18n.t('app.title');   // ok
// @ts-expect-error — 'nope' is not a message key
i18n.t('nope');
```

---

## Reactive locale switching

`i18n.locale` is a read-only signal and `setLocale()` writes it. Every `t()` /
`plural()` signal created from the instance recomputes, so a single toggle
re-renders every bound string in place:

```ts
shell.button(derived(() => i18n.locale.get().toUpperCase()), {
  onClick: () => i18n.setLocale(i18n.locale.get() === 'en' ? 'fr' : 'en'),
});
```

`i18n.locales` lists the locales that have a message map, in declaration order.

---

## Interpolation

Placeholders use `{name}` syntax. Provide values via `params`; unknown
placeholders are left intact (never replaced with `undefined`).

```ts
i18n.t('hello', { name: 'Ada' }).get();   // "Hello, Ada!"
```

The bundled `interpolate(template, params?)` helper is exported for direct use.

---

## Pluralization

`plural(key, count, params?)` selects a message using the platform
`Intl.PluralRules` for the active locale. It looks up `${key}.${category}`
(e.g. `items.one`, `items.many`) and falls back to `${key}.other`. `count` is
automatically available to interpolation as `{count}`.

```ts
i18n.plural('items', 1).get();    // "1 item"    (en → 'one')
i18n.plural('items', 5).get();    // "5 items"   (en → 'other')
```

Because category selection is delegated to `Intl`, locale-specific plural rules
(e.g. French, Russian, Arabic) work without any custom tables.

---

## Determinism, SSR & hydration

Translation is deterministic by design:

- a **missing key resolves to the key itself** (a stable, visible marker — never
  a thrown error or a random placeholder), and
- the same `(locale, key, params)` always produces the same string.

That determinism is exactly what keeps `renderToString()` and `hydrate()` in
agreement — **provided the client boots with the same initial locale the server
rendered with.** Pass the server's locale into `createI18n({ locale })` on the
client and the hydrated markup matches byte-for-byte before any `setLocale()`.
`i18n` coexists cleanly with the router, forms, and context — see
`examples/streetui-account` for all of them in one universal app.

## Use with `has()`

`has(key)` reports whether the active (or fallback) locale defines a key —
useful for optional/feature-flagged copy without triggering the missing-key
echo.
