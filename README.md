# StreetUI

**StreetUI is a complete TypeScript application framework.** It ships its own
reactivity, a semantic UI DSL, a compiler, a semantic application graph, a
direct DOM renderer (no virtual DOM), a router, async resources, data mutations,
first-class components, overlays with portals and focus management, CSS
transitions, a unified styling system, an accessibility platform, forms,
context, i18n, SSR with static-plan acceleration, hydration, testing utilities,
DevTools, and a CLI — as **one package, one import**.

No React. No Vue. No virtual DOM. No JSX. No second reactive system.

```
DSL → Compiler → Semantic Application Graph → Runtime → Renderer → DOM
```

Current version: **3.0.2** · [Changelog](CHANGELOG.md) · [npm](https://www.npmjs.com/package/streetui) · [GitHub](https://github.com/hassanmubiru/StreetUI)

---

## Install

```bash
npm install streetui
```

Everything comes from one package:

```ts
import {
  signal, derived, effect, batch,
  streetui, compile,
  createRenderer, BrowserDOMAdapter,
  component, resource, createForm,
  createRouter, mountRouter, routerOutlet,
  dialog, portal,
  style, cx, createThemeTokens, tokens,
} from 'streetui';
```

Two curated subpaths (still just `npm install streetui`):

- `streetui/server` — `renderToString`, `renderHead`, `ServerDOMAdapter`, `inspectComponents`, `inspectInteractions`, `renderDevToolsReport`
- `streetui/testing` — `render`, `findByRole`, `waitFor`, `renderServerThenHydrate`, `renderComponent`, `findComponent`, `trigger`

---

## Create a new app

```bash
npx streetui create my-app     # templates: basic, ssr
cd my-app && npm install
npm run dev
```

CLI commands: `streetui create | dev | build | start` (flags `--port`, `--host`, `--help`, `--version`).

---

## The full platform

### Reactivity

Signals, derived state, effects, and batched updates — the reactive core that
drives every framework layer.

```ts
const count = signal(0);
const doubled = derived(() => count.get() * 2);
effect(() => console.log(doubled.get()));
count.set(5); // logs 10
```

### DSL + compiler

A typed semantic DSL that compiles to an immutable Application Graph. The graph
is the single source of truth for SSR, hydration, and client rendering.

```ts
const app = streetui.app({ name: 'Counter' });
app.page('home', (page) => {
  page.heading('Counter');
  page.text(count);
  page.button('Increment', { onClick: () => count.update(n => n + 1) });
});
const compiled = compile(app);
```

### Components

First-class components with typed props, reactive updates without re-running
`setup`, native slots, lifecycle cleanup, and full ecosystem integration.

```ts
import { component } from 'streetui';

const Card = component<{ title: Signal<string>; count: Signal<number> }>(
  (props, ctx) => (scope) => {
    scope.heading(props.title);
    scope.text(derived(() => `Count: ${props.count.get()}`));
    ctx.onCleanup(() => console.log('Card unmounted'));
  },
  { name: 'Card' },
);

page.component('my-card', Card, { title: signal('Hello'), count });
```

### Styling

A first-class, unified styling system — build polished, responsive, themeable
interfaces using StreetUI itself, with no external CSS framework required.

```ts
import { style, cx, createThemeTokens, tokens, layout, text } from 'streetui';

const t = tokens.ref;

// Design tokens — light + dark in one call
const brand = createThemeTokens({
  light: { surface: { background: '#f8fafc' }, accent: { primary: '#2563eb' } },
  dark:  { surface: { background: '#0b1020' }, accent: { primary: '#60a5fa' } },
});

// Deduped, atomic class tokens
const card = style({
  background: t.surface.background,
  borderRadius: t.radius.lg,
  padding: t.space['5'],
  on: { hover: { boxShadow: t.shadow.md } },
});

// Responsive layouts with the preset helpers
const grid = layout.grid({ cols: { base: 1, md: 2, lg: 3 }, gap: '6' });

// Typography presets
const heading = cx(text.heading({ level: 2 }), style({ color: t.content.primary }));
```

- `style()` — deduped, atomic class tokens (computed at module load, SSR-safe)
- `cx()` — merge class tokens
- `styleVariants()` — type-safe variant maps
- `createThemeTokens()` — light/dark CSS custom properties, single `data-theme` flip
- `layout.*` — container, stack, row, grid, center presets
- `text.*` — heading, body, caption, code, blockquote presets
- `form.*` — input, label, field, error presets
- `a11y.*` — focus ring, visually-hidden, skip-link presets
- `animation.*` — transition helpers, keyframe declarations

### Router

Client-side routing built on StreetUI signals — no virtual DOM, no third-party
deps. Route state, active links, and teardown all flow through the same
primitives.

```ts
const router = createRouter({
  routes: [
    { path: '/',       builder: (page) => page.heading('Home') },
    { path: '/about',  builder: (page) => page.heading('About') },
    { path: '*',       builder: (page) => page.heading('404') },
  ],
});

mountRouter(router, {
  container: document.getElementById('app')!,
  shell: (shell) => {
    shell.link('Home', { href: '/' });
    routerOutlet(shell);
  },
});
```

### Data: resources & mutations

Framework-native async primitives. `resource()` exposes Promise results as
signals; `mutation()` + `createClient()` handle write operations.

```ts
import { resource, mutation, createClient } from 'streetui';

const client = createClient({ baseUrl: '/api' });

const products = resource<Product[]>(({ signal }) =>
  fetch('/api/products', { signal }).then(r => r.json()),
);

const addProduct = mutation(async (data: Partial<Product>) => {
  await client.post('/products', data);
  products.refetch();
});

page.when(products.loading, (l) => l.text('Loading…'));
page.listOf('items', derived(() => products.data.get() ?? []), (p, _i, c) =>
  c.text(p.name),
);
```

### Overlays, portals & focus

Production-grade overlay system — dialog, popover, tooltip, dropdown, toast —
each a portal + reactive panel + full ARIA + focus management.

```ts
const open = signal(false);

page.dialog('confirm', {
  open,
  onClose: () => open.set(false),
  closeOnEscape: true,
  restoreFocus: true,
}, (panel) => {
  panel.heading('Confirm');
  panel.text('Are you sure?');
  panel.button('Cancel', { onClick: () => open.set(false) });
  panel.button('OK',     { onClick: () => { doAction(); open.set(false); } });
});
```

| Kind | Role | aria-modal | Focus trap | Escape closes | Restore focus |
|---|---|---|---|---|---|
| `dialog` | dialog | ✅ | ✅ | ✅ | ✅ |
| `popover` | dialog | ❌ | ❌ | ✅ | ✅ |
| `dropdown` | menu | ❌ | ❌ | ✅ | ✅ |
| `tooltip` | tooltip | ❌ | ❌ | ❌ | ❌ |
| `toast` | status | ❌ | ❌ | ❌ | ❌ |

### CSS transitions

Class-based enter/leave transitions on `when()` branches, list items, overlays,
and router navigation — no WAAPI, browser-only, SSR-inert.

```ts
page.when(visible, (panel) => {
  panel.text('I animate in and out');
}, {
  transition: {
    enterFrom: 'opacity-0',
    enterActive: 'transition-opacity duration-300',
    enterTo: 'opacity-100',
    leaveFrom: 'opacity-100',
    leaveActive: 'transition-opacity duration-300',
    leaveTo: 'opacity-0',
  },
});
```

### Accessibility

Semantic-first: use real elements, add ARIA only when needed. Keyboard
navigation, focus trapping, live regions, and deterministic id helpers baked in.

```ts
import { a11yIds, createAnnouncer } from 'streetui';

const ids = a11yIds('email');
group.text('Email', { id: ids.label });
group.input({ bind, id: ids.input, ariaLabelledBy: ids.label, ariaRequired: true });

const announcer = createAnnouncer(dom);
announcer.polite('3 results found');
```

### Forms

Reactive form model built on signals — no second state system, same binding as
everything else.

```ts
import { createForm, required, email, minLength } from 'streetui';

const form = createForm({
  initialValues: { email: '', password: '' },
  validators: {
    email:    [required(), email()],
    password: [required(), minLength(8)],
  },
  onSubmit: async (values) => createAccount(values),
});

page.input({ bind: form.field('email').value, type: 'email' });
page.button(
  derived(() => form.submitting.get() ? 'Creating…' : 'Create account'),
  { disabled: form.submitting, onClick: () => void form.submit() },
);
```

### SSR, hydration & head

Server rendering with static-plan acceleration, zero-node hydration (adopts
server DOM in place), and per-route `<head>` metadata.

```ts
// server
import { renderToString, renderHead } from 'streetui/server';

const compiled = compile(app);
const html = renderToString(compiled);
const head = renderHead(compiled, { title: 'My App' });

// client — adopts server DOM, no recreation
import { hydrate } from 'streetui';
hydrate(compiled, document.getElementById('app')!);
```

### DevTools

Non-instrumenting, pull-based graph inspection. Runs in Node, a worker, or a
browser — zero production cost.

```ts
import { inspectComponents, renderDevToolsReport } from 'streetui/server';

const report = renderDevToolsReport(compiled);
// → complete self-contained HTML document
```

---

## Real-browser benchmark results

Measured with Google Chrome 155 via Playwright. All numbers are from a real
browser engine, not happy-dom.

| Scenario | Result |
|---|---|
| Initial mount 10k rows | 210.7 ms · 80,031 DOM nodes |
| Hydrate 10k rows | 149.7 ms · **0 nodes recreated** |
| Reactive search narrow (10k) | 189.6 ms · 10,004 mutations |
| Fine-grained toggle 1 of 1,000 | **0 mutations** (only the subscribed node) |
| Router navigations (4 routes) | 32.9 / 415.7 / 50.0 / 33.4 ms |

**Keyed list reorder (10k rows):**

| Operation | Duration |
|---|---|
| create 10k | 174.4 ms |
| append 1k | 99.3 ms |
| swap ends | 32.9 ms |
| reverse | 183.0 ms |
| shuffle | 200.0 ms |
| update every 10th | 100.6 ms |

---

## Architecture

```
packages/
  core/        Styling system, tokens, typography, animation, diagnostics, environment
  dsl/         Semantic TypeScript DSL (the authoring surface)
  compiler/    DSL → validation → graph compilation; static SSR plan analysis
  graph/       Semantic Application Graph (nodes, traversal, validation)
  runtime/     Application mounting, lifecycle, signal/event integration
  state/       Reactive signals, derived state, resources, mutations, stores
  events/      Event bus, DOM event bridge
  scheduler/   Microtask update scheduler
  dom/         DOM adapter abstraction (BrowserDOMAdapter, ServerDOMAdapter)
  renderer/    StreetUI's own DOM renderer — mount, patch, reconcile, SSR, hydrate
  testing/     Test renderer, query helpers, component helpers
  devtools/    Graph inspector, interaction inspector, DevTools report generator
  router/      Client-side routing, navigation, route lifecycle
  forms/       Reactive form model + synchronous validators
  context/     Build-time provider/consumer scoping (no prop drilling)
  i18n/        Reactive, typed internationalization
  cli/         Developer CLI — create/dev/build/start + project tooling
  streetui/    Public barrel — one install, one import

examples/
  basic-app/                Counter app — full end-to-end
  streetui-account/         Full platform: router + resources + forms + context + i18n + a11y + SSR
  streetui-data/            Resources + error boundaries against a real HTTP API
  streetui-ssr/             SSR + hydration
  streetui-showcase/        Overlays, transitions, components, a11y, all together
  streetui-stress-app/      10k-row keyed list, fine-grained reactivity, router
  streetui-website/         Framework documentation site built entirely with StreetUI
  streetjs-website/         StreetJS docs site — live at streetjs-website.netlify.app
```

---

## Development

```bash
pnpm install
pnpm build        # build all 18 packages
pnpm test         # 1,148+ tests across all packages
pnpm typecheck    # strict TypeScript across all packages
```

---

## Versioning & release

Every public package shares one coordinated version. The v1.0 public surface is
frozen; every addition since then is purely additive.

```bash
npm install streetui            # latest (3.0.2)
npm install streetui@3.0.2
```

- [Changelog](CHANGELOG.md)
- [Public API statement](docs/api-v1.0.md)
- [npm package](https://www.npmjs.com/package/streetui)

---

## License

MIT — see [LICENSE](./LICENSE).
