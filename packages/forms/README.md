# @streetui/forms

A reactive form model and a small synchronous validation system, built
**entirely** on `@streetui/state` signals. There is no second state system: every
piece of form state — `values`, `errors`, `touched`, `dirty`, `valid`, and the
submission lifecycle — is a signal or a derived signal, so it composes with the
renderer's existing reactive bindings and needs no special integration.

```bash
# part of the StreetUI monorepo — no separate install
```

---

## The form model

`createForm<T>()` takes typed initial values, optional per-field validators, and
an `onSubmit` handler. `T` must extend `Record<string, string>` (HTML input
values are strings), and every reactive accessor is typed against it.

```ts
import { createForm, required, email, minLength } from '@streetui/forms';

interface SignupValues {
  name: string;
  email: string;
  password: string;
  [key: string]: string;
}

const form = createForm<SignupValues>({
  initialValues: { name: '', email: '', password: '' },
  validators: {
    name: required('Name is required'),
    email: [required('Email is required'), email()],   // ordered — first error wins
    password: [required(), minLength(8, 'At least 8 characters')],
  },
  onSubmit: async (values) => {
    await createAccount(values);   // any async function; may throw
  },
});
```

### Form-level reactive state

| Accessor | Type | Meaning |
|---|---|---|
| `form.values` | `ReadonlySignal<T>` | Current values of every field. |
| `form.errors` | `ReadonlySignal<Partial<Record<keyof T, string>>>` | Only the fields that currently have an error. |
| `form.touched` | `ReadonlySignal<Partial<Record<keyof T, boolean>>>` | Per-field touched flags. |
| `form.dirty` | `ReadonlySignal<boolean>` | True if any field differs from its initial value. |
| `form.valid` | `ReadonlySignal<boolean>` | True when every field passes validation. |
| `form.submitting` | `ReadonlySignal<boolean>` | True while `onSubmit` is in flight. |
| `form.submitted` | `ReadonlySignal<boolean>` | True after a successful submit. |
| `form.status` | `ReadonlySignal<'idle' \| 'submitting' \| 'success' \| 'error'>` | The submission lifecycle. |
| `form.submitError` | `ReadonlySignal<unknown>` | Whatever `onSubmit` threw, if anything. |

Because these are the same signals used everywhere else in StreetUI, they drop
straight into DSL bindings and `derived()`.

---

## Fields and input binding

`form.field(name)` returns the reactive state and setters for one field. The
field's `value` is a writable `Signal<string>` — pass it directly to the DSL's
`input({ bind })`. That is the **one** binding the renderer already wires:
typing updates form state, and programmatic updates update the input. No
duplicate event listeners are added.

```ts
const emailField = form.field('email');

page.input({ bind: emailField.value, type: 'email' });
page.when(
  derived(() => emailField.touched.get() && emailField.error.get() !== undefined),
  (err) => err.text(derived(() => emailField.error.get() ?? ''), { role: 'alert' }),
);
```

A `Field` exposes `value` (writable signal), `error`, `touched`, `dirty`, `valid`
(read-only signals), and the imperative helpers `setValue()`, `markTouched()`,
and `reset()`. Errors are computed reactively from the validators, so surfacing
them is a matter of reading `field.error` — usually gated on `field.touched` so
a pristine field is not flagged before the user has interacted with it.

---

## Submission lifecycle

`form.submit()` marks every field touched (so validation errors become visible),
then:

- if the form is **invalid**, it stays `idle` and returns without calling
  `onSubmit` — the now-visible field errors tell the user what to fix;
- if **valid**, it transitions `idle → submitting`, awaits `onSubmit(values)`,
  and settles on `success` or — if `onSubmit` throws — `error`, capturing the
  thrown value in `form.submitError`.

Wire it to both the button and the native form submit event; the renderer's
event system already calls `preventDefault()` for submit events, so no manual
handling is needed:

```ts
page.form('signup', (fb) => {
  // ...fields...
  fb.button(
    derived(() => (form.submitting.get() ? 'Creating…' : 'Create account')),
    { disabled: form.submitting, onClick: () => void form.submit() },
  );
}, { onSubmit: () => void form.submit() });
```

---

## Validators

A `Validator` is just `(value: string) => string | undefined` — return a message
to fail, `undefined` to pass. Built-ins cover the common cases; anything else is
a plain function.

| Validator | Fails when |
|---|---|
| `required(message?)` | the trimmed value is empty |
| `minLength(n, message?)` | shorter than `n` characters |
| `maxLength(n, message?)` | longer than `n` characters |
| `email(message?)` | a non-empty value is not a plausible email |
| `pattern(regex, message?)` | a non-empty value does not match `regex` |

Per-field validators run **in order and the first error wins**, so list
`required` first for mandatory fields. A custom validator needs no wrapper:

```ts
const noSpaces: Validator = (v) => (/\s/.test(v) ? 'No spaces allowed' : undefined);

createForm({ initialValues: { handle: '' }, validators: { handle: [required(), noSpaces] } });
```

### Async validation

Async validation is intentionally **not** part of this core, to keep the
validity model synchronous and predictable. Layer it on with `@streetui/state`'s
`resource()`: kick off a resource on value change and surface `resource.error`
alongside `field.error`. This keeps network-driven checks out of the synchronous
`valid` computation.

---

## Lifecycle

`createForm()` allocates field subscriptions and derived signals. Call
`form.dispose()` when the owning subtree is torn down — inside a route this is
`ctx.onCleanup(() => form.dispose())` — to release every subscription and derived
signal. `form.reset()` restores initial values and clears errors, touched, dirty,
and submission state without disposing.

A complete, runnable form (real HTTP submit, validation, error state, SSR +
hydration, i18n'd messages) lives in `examples/streetui-account`.
