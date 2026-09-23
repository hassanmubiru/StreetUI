# @streetui/example-full-app

A single application that exercises **every** StreetUI system at once, on both
the server and the browser, and proves they compose:

- **signals** — a live counter
- **i18n** — reactive translated title/greeting/labels with a locale switch
- **context** — `ThemeContext` consumed during build
- **forms** — a validated sign-up form (name + email) with `required`/`minLength`/`email`
- **resource** — a server-seedable async user
- **SSR** — `renderToString` on the server
- **hydration** — the browser adopts the server DOM *in place* (node identity), not a re-render
- **router** — a persistent shell + outlet with client-side navigation

## Layout

| File | Role |
| --- | --- |
| `src/deps.ts` | One reactive dependency graph, constructed identically on both sides |
| `src/app.ts` | The UI (`buildApp`), identical on server and browser |
| `src/index.ts` | `compileApp(deps, theme)` — compiles under the theme context |
| `src/browser-entry.ts` | `hydrateApp(...)` — reads the SSR island, rebuilds deps, hydrates |
| `src/routed.ts` | `mountFullApp(...)` — router shell + `/`, `/user/:id`, `*` routes |
| `src/full-app.test.ts` | Integration tests under happy-dom |

## The hydration invariant

The point of this example is that the *same node objects* survive hydration:

```ts
const serverCount = app.querySelector('#count');
hydrateApp(app, document, { name: 'dark' });
expect(app.querySelector('#count')).toBe(serverCount); // adopted, not recreated
```

After hydration, incrementing the counter or switching locale mutates those
adopted nodes in place — no server/client HTML-string comparison is involved.

## Real-browser note

These tests run under **happy-dom** in the monorepo test suite. A ready-to-run
real-Chromium harness lives in `browser/` at the repo root; it was authored and
typechecked but not executed in the build sandbox (no browser available), and no
browser performance numbers were invented. See `docs/performance-browser-v0.8.md`.
