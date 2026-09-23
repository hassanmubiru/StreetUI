# @streetui/context

Minimal build-time provider/consumer scoping for the StreetUI DSL. This is **not**
a re-implementation of React Context and it is **not** a second reactive system —
it is a tiny synchronous value stack that mirrors how StreetUI builds its
semantic tree.

```bash
# part of the StreetUI monorepo — no separate install
```

---

## Why it exists

StreetUI builds its semantic tree synchronously, top-down, when the DSL builders
run. A `Context` mirrors that shape exactly: `provide(value, run)` pushes a value
for the duration of the synchronous `run()` — during which the child DSL builders
execute and may `consume()` — then pops it again. This lets deeply nested field
helpers reach a shared form, an i18n instance, a theme, or any other ambient
value **without prop drilling**, while staying entirely inside the existing
build pass.

Because `provide()` pops its value as soon as `run()` returns (even if it
throws), the context holds no subscriptions and leaves no references behind. If
you need reactivity, put a **signal** into the context — reactivity then belongs
to that signal and is torn down by the normal node lifecycle when the consuming
subtree unmounts.

---

## API

```ts
import { createContext, type Context } from '@streetui/context';

const context = createContext<T>(defaultValue, 'optional.debug.description');
```

| Member | Description |
|---|---|
| `context.provide(value, run)` | Provide `value` to any `consume()` made synchronously inside `run`; returns `run`'s result. |
| `context.consume()` | Read the **nearest** active provider's value, or `defaultValue` when none is active. |
| `context.hasProvider()` | True while at least one provider is active. |
| `context.defaultValue` | The value `consume()` returns with no active provider. |
| `context.id` | A unique `symbol` identity (handy for debugging/inspection). |

The default value is **required**, so `consume()` always returns a `T` — never
`undefined` unless `T` itself permits it.

---

## Example — sharing a form down to field helpers

```ts
import { createContext } from '@streetui/context';

interface FormScope { form: Form<SignupValues>; i18n: AccountI18n; }
const FormContext = createContext<FormScope | null>(null, 'streetui.account.form');

function textField(scope: ContainerDSL, name: keyof SignupValues & string) {
  const scoped = FormContext.consume();
  if (scoped === null) throw new Error('textField must run inside a FormContext provider');
  const { form, i18n } = scoped;
  const field = form.field(name);
  scope.input({ bind: field.value });
}

// Provider wraps the synchronous builder run:
page.form('signup', (fb) => {
  FormContext.provide({ form, i18n }, () => {
    textField(fb, 'name');
    textField(fb, 'email');
    textField(fb, 'password');
  });
});
```

## Nested providers resolve nearest

```ts
const Theme = createContext('light');

Theme.provide('dark', () => {
  Theme.consume();                       // 'dark'
  Theme.provide('high-contrast', () => {
    Theme.consume();                     // 'high-contrast' (nearest wins)
  });
  Theme.consume();                       // 'dark' again — inner value popped
});
Theme.consume();                          // 'light' (the default)
```

---

## Reactive context

The value can be a signal (or an object holding signals). The context stores the
reference; the signal owns the reactivity:

```ts
const Locale = createContext(signal('en'));

Locale.provide(signal('fr'), () => {
  const locale = Locale.consume();       // Signal<string>
  page.text(locale);                     // reactive — re-renders when the signal changes
});
```

Consume only inside a provider's synchronous `run()`. Consuming later (e.g. from
an async callback that runs after `provide()` has returned) resolves to the
default, by design — the value has already been popped.
