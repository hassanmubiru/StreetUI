# Migration guide: React, Vue, and Svelte concepts

StreetUI does not provide compatibility components for other frameworks. This
guide maps common concepts to the native StreetUI model so an application can be
rewritten deliberately rather than translated mechanically.

| Common concept | StreetUI equivalent |
|---|---|
| Component | `component()` or a builder function |
| Local state | `signal()` |
| Computed state | `derived()` |
| Effect/watch | `effect()` |
| Conditional rendering | `when()` |
| Keyed list | `listOf()` |
| Event handler | Element builder `onClick`, `onInput`, etc. |
| Router | `createRouter()` + `mountRouter()` |
| Async query | `resource()` |
| Mutation | `mutation()` or `createClient().mutation()` |
| Form model | `createForm()` |
| Context/provider | `createContext()` and `provide()` / `consume()` |
| SSR | `renderToString()` |
| Hydration | `hydrate()` or `mountRouter({ hydrate: true })` |
| Testing Library queries | `streetui/testing` |

## Recommended migration order

1. Move the route shell and static pages into StreetUI builders.
2. Replace mutable component state with `signal()` and `derived()`.
3. Move async loading into `resource()` and mutations into `mutation()`.
4. Move forms to `createForm()` and keep validation in the form model.
5. Add SSR and hydration only after the client flow is stable.
6. Replace framework-specific styling with `style()`, tokens, and presets.
7. Use `streetui/testing` for user-visible assertions.

Do not recreate a second reactive system inside a StreetUI application. The main
benefit of the platform is that rendering, routing, async state, forms, and
cleanup share one lifecycle.
