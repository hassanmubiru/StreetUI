# Transitions

```
npm install streetui
```

StreetUI animates elements entering and leaving the DOM with a **CSS
class-based** transition engine. It toggles well-known classes across the enter
and leave phases (the same pattern Vue popularized) and defers an element's
removal until its leave transition completes. There is no JavaScript animation
runtime and no per-frame reactivity involved — your CSS owns the timing.

## Where transitions attach

A transition is configured with a `TransitionConfig` and attached wherever an
element conditionally mounts/unmounts:

- On a `when(cond, builder, else?, { transition })` block.
- On an overlay via its `OverlayOptions` (overlays extend `ContainerOptions`,
  which carries `transition`).
- On keyed list items, so inserts/removals/reorders animate.

```ts
page.when(open, (c) => c.text('Now you see me'), undefined, {
  transition: {
    name: 'fade',      // shorthand → fade-enter-from, fade-enter-active, …
    duration: 200,     // safety-net completion timeout (ms)
  },
});
```

## `TransitionConfig`

You can use the `name` shorthand or specify classes explicitly:

```ts
{
  name?: string;        // expands to `${name}-enter-from`, `-enter-active`, -enter-to, and leave-*
  enter?: string;       // present for the whole enter phase
  enterFrom?: string;   // applied at enter start, removed next frame
  enterActive?: string; // whole enter phase — put the CSS `transition` here
  enterTo?: string;     // added next frame, removed when enter completes
  leave?: string;       // present for the whole leave phase
  leaveFrom?: string;   // applied at leave start, removed next frame
  leaveActive?: string; // whole leave phase
  leaveTo?: string;     // added next frame, removed when leave completes
  appear?: boolean;     // also animate the initial mount (default false)
  duration?: number;    // fallback completion timeout in ms (default 1000)
}
```

Matching CSS for the `fade` example:

```css
.fade-enter-active, .fade-leave-active { transition: opacity 200ms ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
```

## Completion, `duration`, and tests

A transition normally completes on the element's `transitionend` /
`animationend` event. The `duration` timeout is the safety net for (a)
transitions that fire no such event and (b) test DOMs such as happy-dom that
dispatch **no** transition events at all. That makes transitions deterministic
in tests without a real browser: use a small `duration` (or `0` → next
macrotask) in unit tests.

> **Honest scope.** The engine emits and removes the correct classes and defers
> removal until completion; this is verified in the test DOM. Whether the
> resulting animation is visually smooth at 60fps has **not** been verified here
> — real-browser rendering is reported as `browser = BLOCKED`, not simulated.

## `appear` and hydration

Set `appear: true` to animate an element's very first appearance on a fresh
browser mount. Hydration never animates appear — the server-rendered DOM is
already present and correct, so animating it would be wrong.

## Lower-level API

For custom cases the engine's building blocks are exported: `resolveTransition`
/ `getResolvedTransition` (normalize a config to concrete classes),
`isTransitionConfig` (type guard), `runElementTransition` (drive one element's
phase), and `TransitionController`.

See also: [Overlays](overlays.md) and
[Application platform](application-platform.md).
