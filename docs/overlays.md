# Overlays

```
npm install streetui
```

StreetUI ships five first-class overlay builders — `dialog`, `popover`,
`tooltip`, `dropdown`, and `toast`. Each is a thin, accessible composition of
primitives you already have: a **portal** (relocates content to `document.body`
to escape overflow/stacking contexts) plus a reactive **`when(open, …)`** panel
with the correct ARIA role, focus behavior, and Escape handling for its kind.
There is no separate overlay runtime.

## Common shape

Every overlay takes a `key`, an `OverlayOptions` object, and a builder that
fills the panel:

```ts
import { signal } from 'streetui';

const open = signal(false);

page.dialog('confirm', {
  open,                       // Bindable<boolean> — flips mount/unmount
  onClose: () => open.set(false),
  restoreFocus: true,         // restore focus to the trigger on close (per-kind default)
  initialFocusId: 'ok-btn',   // element to focus on open (else first focusable)
  closeOnEscape: true,        // Escape invokes onClose (per-kind default)
}, (panel) => {
  panel.heading('Delete item?');
  panel.button('OK', { id: 'ok-btn', onClick: () => open.set(false) });
});
```

`OverlayOptions`: `open` (required, `Bindable<boolean>`), `onClose`,
`restoreFocus`, `initialFocusId`, `closeOnEscape`. Defaults for `restoreFocus`
and `closeOnEscape` are per-kind (see below).

## The five kinds

| Builder | Role | Modal | Focus behavior | Escape |
| --- | --- | --- | --- | --- |
| `dialog` | `role="dialog"` `aria-modal="true"` | yes | trap **and** contain focus; restore on close | closes by default |
| `popover` | `role="dialog"` | no | move focus in on open, restore on close; no trap | closes by default |
| `tooltip` | `role="tooltip"` | no | does not steal focus (describes another element) | none by default |
| `dropdown` | `role="menu"` | no | move focus in on open, restore on close | closes by default |
| `toast` | `role="status"` `aria-live="polite"` | no | never steals focus | none by default |

## The portal underneath

If you need to relocate arbitrary content (not an overlay) out of the current
DOM position, use `portal` directly:

```ts
page.portal('layer', (c) => c.text('rendered into document.body'));
```

On the server there is no `document.body`, so portal content renders **inline**;
hydration then relocates it to a body container to match the browser. This keeps
SSR output complete and byte-stable, and cleanup removes the body container.

## SSR & hydration

Because overlays are `portal` + `when()`, the server renders whichever state the
`open` signal currently holds (typically closed → nothing), and hydration
adopts the server markup and wires the reactive open/close, focus, and Escape
behavior without duplicate work.

See also: [Accessibility](accessibility.md) for the focus utilities overlays are
built on, and [Application platform](application-platform.md) for the full
overlay/focus design notes.
