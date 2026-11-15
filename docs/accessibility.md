# Accessibility

```
npm install streetui
```

StreetUI's overlays ship with correct ARIA roles and focus management out of the
box (see [Overlays](overlays.md)). For everything else, the framework exposes a
small set of framework-agnostic focus and announcement utilities you can use to
build accessible interactions yourself.

> **Honest scope.** These utilities emit and manage the DOM structure and focus
> state that assistive technology relies on. The current run captured a live
> AT-SPI tree with Orca/pyatspi, but did not capture literal speech-dispatcher
> utterances. Screen-reader evidence is therefore reported as AT-SPI tree
> observation with spoken output still not measured; availability alone is not
> treated as a pass.

## Focus utilities

```ts
import {
  getFocusable, focusFirst, focusInitial, focusById,
  trapFocus, containFocus, saveFocus, restoreFocus,
  FOCUSABLE_SELECTOR,
} from 'streetui';
```

- `getFocusable(container)` — the ordered list of focusable elements within a
  container (using `FOCUSABLE_SELECTOR`).
- `focusFirst(container)` — focus the first focusable descendant.
- `focusInitial(container, id?)` — focus the element with `id`, else the first
  focusable (what overlays use on open).
- `focusById(id)` — focus a specific element by id.
- `trapFocus(container)` — keep Tab/Shift+Tab cycling **within** the container
  (modal dialogs). Returns a disposer.
- `containFocus(container)` — pull focus back if it escapes the container.
- `saveFocus()` / `restoreFocus(el)` — remember the active element before
  opening an overlay and restore it on close.

These are the exact primitives the overlay builders compose, exposed so you can
build custom accessible widgets with the same behavior.

## Announcements

`createAnnouncer()` creates a polite live-region announcer for status messages
that should reach a screen reader without moving focus:

```ts
import { createAnnouncer } from 'streetui';

const announcer = createAnnouncer();
announcer.announce('Saved.');   // spoken politely
announcer.dispose();            // remove the live region
```

## Stable ids and roving focus

- `a11yIds(prefix?)` — generate stable, collision-free ids for wiring
  `aria-labelledby` / `aria-describedby` / `aria-controls` relationships.
- `rovingMenu(container)` — arrow-key roving tabindex management for menu/listbox
  patterns (one tab stop, arrows move the active item).

See also: [Overlays](overlays.md), [Components](components.md), and
[Application platform](application-platform.md) for the full focus/a11y design.
