# Why StreetUI?

StreetUI is for teams that want a TypeScript-first application framework with a
small number of coherent runtime concepts instead of a collection of unrelated
libraries.

## What is distinctive

- **One reactive system:** signals, derived state, resources, forms, router state,
  and styling updates use the same primitives.
- **One semantic graph:** the DSL, compiler, renderer, SSR, hydration, and
  DevTools inspect the same application representation.
- **Direct DOM rendering:** StreetUI does not maintain a virtual DOM tree.
- **One install surface:** application code installs `streetui`; internal modules
  remain an implementation detail.
- **SSR and hydration are first-class:** server output and client adoption are
  designed together rather than added as a separate rendering mode.

## Honest tradeoffs

StreetUI is not the best fit for every project:

- The DSL is intentionally TypeScript-based and does not use JSX.
- The ecosystem is smaller than React, Vue, or Svelte.
- The renderer and compiler are framework-owned, so teams adopt StreetUI's
  conventions instead of assembling independent libraries.
- Browser and assistive-technology validation still require a real-browser
  environment; happy-dom is not a substitute for paint, layout, or screen-reader
  testing.

## A good fit

StreetUI is a strong fit for applications that need several of these together:

- SSR plus hydration
- fine-grained reactive updates
- typed forms and async data
- deterministic accessibility behavior
- framework-owned styling and document metadata
- a small, inspectable runtime with no virtual DOM

Start with [Getting started](./getting-started.md), then use the
[application platform example](./application-platform.md) as the complete
reference flow.
