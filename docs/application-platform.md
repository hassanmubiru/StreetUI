# Application platform

StreetUI 2.0 adds the pieces a real application needs — overlays, transitions,
async and error boundaries, and document metadata — on top of the same pipeline
(DSL → compiler → semantic graph → runtime → renderer → DOM). Everything below
is imported from the single `streetui` package and rendered by the one renderer.
There is no virtual DOM, no second reactive system, and no second renderer.

The primary end-to-end reference is `examples/streetui-showcase`
(`platform-showcase.ts` + `platform-showcase.test.ts`): a multi-route app that
exercises routing, overlays, transitions, async data, error handling, the
form → mutation → refetch write path, per-route metadata, i18n, a11y roles, and
SSR + hydration together.

## Overlays

Overlays are container-DSL methods backed by the portal system: `dialog`,
`popover`, `tooltip`, `dropdown`, and `toast`. Their panels render into
`document.body` (in tests, query `document`, not the mount container). Opening
and closing is **cooperative** — you own a `boolean` signal and flip it:

```ts
const open = signal(false);

s.button('Edit', { id: 'edit-btn', onClick: () => open.set(true) });
s.dialog('edit', {
  open,
  onClose: () => open.set(false),   // called on Escape / outside-click
  ariaLabel: 'Edit user',
  initialFocusId: 'edit-name',      // focus moves here on open, restores on close
}, (d) => {
  d.form('edit-form', (f) => {
    f.input({ id: 'edit-name', type: 'text', bind: form.field('name').value });
    f.button('Save', { id: 'edit-save' });
  }, { id: 'edit-form', onSubmit: () => form.submit() });
});
```

`OverlayOptions` covers `open`, `onClose`, `restoreFocus`, `initialFocusId`,
`closeOnEscape`, `role`, `transition`, and the `aria*` props. A modal `dialog`
traps focus and restores it to the trigger on close; the other overlays are
non-modal. Because closing is a signal you control, you decide whether an action
inside the overlay (like a successful save) also closes it.

<!-- APPEND-MARKER -->

## Transitions

Pass a `transition` on a container, on `when`, or on a list (`itemTransition`
for list items). The engine toggles CSS classes across the enter/leave
lifecycle and **defers node removal** until the leave transition completes, so
exiting content animates out instead of vanishing:

```ts
const open = signal(false);

s.button('Toggle', { id: 'toggle', onClick: () => open.update((v) => !v) });
s.when(
  open,
  (b) => b.text('Now you see me', { id: 'details' }),
  undefined,
  { transition: { name: 'fade', duration: 150 } },
);
```

`TransitionConfig` is `{ name?, enter*/leave* classes, appear?, duration? }`.
Transitions are a browser concern: under happy-dom no `transitionend` fires, so
tests give a small `duration` and wait for the timer (see the disclosure test in
the showcase). Keys stay identity-only — a transition never changes reconciliation.

## Async and error boundaries

`asyncBoundary` renders loading / error / success branches for a `resource`
directly, so you don't hand-wire `when` chains:

```ts
const usersRes = resource<User[]>(() => data.loadUsers());
ctx.onCleanup(() => usersRes.dispose());

s.asyncBoundary('users', usersRes, {
  loading: (c) => c.text('Loading…', { id: 'users-loading' }),
  error:   (c, e, retry) => c.button('Retry', { id: 'users-retry', onClick: retry }),
  success: (c, users) => c.listOf('list', users, (u, _i, item) =>
    item.link(u.name, { href: `/users/${u.id}` })),
});
```

`errorBoundary` catches thrown builders and, via its `source` option, a
resource's error signal — rendering a `fallback` with a retry control. See
[Data](./data.md) for the full read/write story and
[Components](./components.md) for `when` / `listOf`.

## Document metadata (head)

Call `page.head({ ... })` — inside a route builder for per-route metadata. On the
browser it reconciles `document.head` (title, meta, link, Open Graph, Twitter);
on the server `renderHead(compiled)` emits the merged metadata as a string, and
hydration adopts the server tags with no duplicates:

```ts
page.head({
  title: i18n.t('dash.title'),                 // reactive values are allowed
  description: 'StreetUI platform showcase',
  canonical: 'https://example.com/',
  openGraph: { title: 'Dashboard', type: 'website' },
});
```

```ts
// server
import { renderToString } from 'streetui/server';
import { renderHead } from 'streetui';

const body = renderToString(compiled);
const head = renderHead(compiled); // '<title …>…</title><meta …>' etc.
```

## Internationalization

`createI18n({ locale, messages, fallbackLocale })` gives reactive translations:
`i18n.t(key, params?)` returns a `ReadonlySignal<string>` you bind directly into
the DSL (headings, text, button and link labels), `i18n.translate(...)` returns a
one-shot string, and `i18n.setLocale(l)` re-translates every bound node in place
— including navigation links.

## Putting it together

`examples/streetui-showcase` composes all of the above into one application and
is the project's primary integration test. Read it alongside these guides:
[Routing](./routing.md), [Forms](./forms.md), [Data](./data.md),
[Components](./components.md), [SSR](./ssr.md), and [Hydration](./hydration.md).

