# Forms

StreetUI forms are built on the same signals as everything else. `createForm`
gives you per-field value/validity/touched/dirty state as reactive signals, so a
form binds into the DSL without any special data flow.

## Creating a form

```ts
import { createForm, required, minLength, email } from 'streetui';

const form = createForm<{ displayName: string; contactEmail: string }>({
  initialValues: { displayName: '', contactEmail: '' },
  validators: {
    displayName: [required(), minLength(2)],
    contactEmail: [required(), email()],
  },
});
```

Built-in validators include `required`, `minLength`, `maxLength`, `email`, and
`pattern`. A validator is a function, so you can write your own with the same
shape and add it to the array.

## Field state

`form.field(name)` returns a handle whose pieces are all reactive:

```ts
const name = form.field('displayName');

name.value;      // Signal<string> — two-way bindable
name.error;      // ReadonlySignal<string | null>
name.valid;      // ReadonlySignal<boolean>
name.touched;    // ReadonlySignal<boolean>
name.dirty;      // ReadonlySignal<boolean>
name.setValue('Ada');
name.markTouched();
name.reset();
```

The form as a whole exposes `form.valid` (a `ReadonlySignal<boolean>`),
`form.submit()`, `form.reset()`, and `form.dispose()`.

## Binding fields in the DSL

Bind an input to a field's `value` signal with `bind`. Show a validation message
conditionally with `when`, and disable submit until the form is valid with a
reactive `disabled`:

```ts
import { derived } from 'streetui';

s.form('settings-form', (f) => {
  const name = form.field('displayName');
  const contact = form.field('contactEmail');

  f.input({ id: 'displayName', bind: name.value, placeholder: 'display name' });
  f.when(derived(() => name.touched.get() && !name.valid.get()), (b) =>
    b.text(derived(() => name.error.get() ?? ''), { id: 'displayName-error' }));

  f.input({ id: 'contactEmail', bind: contact.value, type: 'email', placeholder: 'email' });
  f.when(derived(() => contact.touched.get() && !contact.valid.get()), (b) =>
    b.text(derived(() => contact.error.get() ?? ''), { id: 'contactEmail-error' }));

  f.button('Save', { id: 'settings-save',
    disabled: derived(() => !form.valid.get()), onClick: () => void form.submit() });
  f.button('Reset', { id: 'settings-reset', onClick: () => form.reset() });
}, { id: 'settings-form' });
```

`bind` is two-way: typing updates `name.value`, and calling `name.setValue(...)`
updates the input. If you prefer one-way control, pass `value` + `onInput`
instead of `bind`.

## Field isolation

Because each field's DOM binds to that field's signals, typing in one field
updates only that field's nodes. The performance app proves this with DOM
mutation instrumentation: typing into `displayName` leaves the `contactEmail`
input's DOM `value` and its signal untouched, and touches only the regions the
edited field owns. See `formsFieldIsolation` in
[`streetui-node.json`](../benchmarks/results/v1.3/streetui-node.json) — the
unrelated input is verified unchanged at the DOM level, not merely assumed.

This falls out of the reactive model rather than being a special form
optimization: there is no form-wide re-render to avoid in the first place.

## Cleanup

Call `form.dispose()` when the form's owner unmounts to release its internal
subscriptions. In the performance app the route/app teardown does this alongside
disposing the resource.

Next: [Data](./data.md).
