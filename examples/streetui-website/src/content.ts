/**
 * StreetUI Website — content model.
 *
 * Pure data (no framework calls) describing every documentation section, the
 * navigation tree, the examples gallery, changelog entries and blog posts. The
 * route builders in `routes.ts` turn this data into real StreetUI page trees.
 *
 * Keeping content as plain, typed data (not hand-written per-page builders) is
 * itself a dogfooding decision: it lets ONE `/docs/:section` route render all
 * sections, lets the search index be derived mechanically, and keeps the DSL
 * code free of prose. Every code snippet below is real, runnable StreetUI
 * public API — the site documents the framework it is built with.
 */

export interface CodeSample {
  readonly label: string;
  /** Source text rendered by the first-class `code()` primitive as a semantic
   * `<pre><code>` block (escaped at the renderer boundary). */
  readonly code: string;
  /** Optional language hint, emitted as `data-language` on the `<pre>`. */
  readonly language?: string;
}

export interface DocSection {
  readonly slug: string;
  readonly title: string;
  /** Grouping shown in the docs sidebar. */
  readonly group: 'Introduction' | 'Core' | 'Routing & Data' | 'UI' | 'Rendering' | 'Tooling';
  readonly summary: string;
  readonly paragraphs: readonly string[];
  readonly code?: CodeSample;
}

/**
 * The 18 documentation sections. Order is the sidebar order; `group` buckets
 * them. Bodies are intentionally concise — the point of the site is to exercise
 * StreetUI, and every snippet is drawn from the real public API surface
 * (`import { … } from 'streetui'`).
 */
export const DOC_SECTIONS: readonly DocSection[] = [
  {
    slug: 'introduction',
    title: 'Introduction',
    group: 'Introduction',
    summary: 'What StreetUI is and the pipeline every app flows through.',
    paragraphs: [
      'StreetUI is a TypeScript-first UI framework with its own fine-grained reactivity and a keyed real-DOM reconciler. There is no virtual DOM and no second runtime.',
      'Every application flows through one pipeline: a semantic TypeScript DSL compiles to a semantic application graph, the runtime binds signals to that graph, and the renderer patches the real DOM directly.',
      'You install and import exactly one package: streetui. Server-only helpers live at streetui/server and test utilities at streetui/testing.',
    ],
    code: {
      label: 'Install',
      code: 'npm install streetui',
    },
  },
  {
    slug: 'core-concepts',
    title: 'Core Concepts',
    group: 'Core',
    summary: 'Apps, pages, sections, and the builder DSL.',
    paragraphs: [
      'An app is created with streetui.app({ name, version }) and declares pages with app.page(id, build). Inside a page you compose sections and containers, and inside those you place headings, text, links, buttons, inputs, forms and lists.',
      'The DSL is a builder: you receive a scope object and call methods on it, rather than returning element trees. Every builder call takes a stable id so the compiler, renderer and tests can address the node deterministically.',
    ],
    code: {
      label: 'A page',
      code: [
        "import { streetui, compile } from 'streetui';",
        '',
        "const app = streetui.app({ name: 'Hello', version: '1.0.0' });",
        "app.page('home', (page) => {",
        "  page.section('hero', (s) => {",
        "    s.heading('Hello StreetUI', { level: 1, id: 'title' });",
        "    s.text('Built from a semantic graph.', { id: 'tagline' });",
        '  }, { id: \'hero\' });',
        '});',
        '',
        'const compiled = compile(app);',
      ].join('\n'),
    },
  },
  {
    slug: 'architecture',
    title: 'Architecture',
    group: 'Core',
    summary: 'DSL → compiler → semantic graph → runtime → renderer.',
    paragraphs: [
      'The compiler turns the DSL into a semantic application graph: a serializable description of nodes, their props, their reactive bindings and their event wiring.',
      'The runtime walks that graph once to mount it, subscribing DOM updates to the exact signals they read. The renderer owns the real DOM and performs keyed reconciliation; element identity is preserved across updates.',
      'Because the graph is explicit, the same compiled app can be mounted in a browser, rendered to a string on the server, or hydrated against server HTML — no separate code path per target.',
    ],
  },
  {
    slug: 'components',
    title: 'Components',
    group: 'Core',
    summary: 'First-class component() definitions on the same pipeline.',
    paragraphs: [
      'component() defines a reusable unit with its own setup that runs once at build time. Components receive props (plain values or signals) and compose the same builder DSL as pages — they are not a second rendering system.',
      'Signal-valued props stay reactive without re-running setup, so a component updates in place through the keyed reconciler.',
    ],
  },
  {
    slug: 'reactivity',
    title: 'Reactivity',
    group: 'Core',
    summary: 'signal, derived, effect and batch.',
    paragraphs: [
      'State lives in signals. signal(value) returns a handle with get/set/update/peek. derived(fn) is a cached computation that tracks the signals it reads. effect(fn) runs a side effect and re-runs when its dependencies change, returning a cleanup function.',
      'Reads inside text(), when() and listOf() subscribe automatically, so updating a signal patches exactly the DOM that depends on it.',
    ],
    code: {
      label: 'Signals',
      code: [
        "import { signal, derived, effect } from 'streetui';",
        '',
        'const count = signal(0);',
        'const doubled = derived(() => count.get() * 2);',
        'const stop = effect(() => console.log(doubled.get()));',
        '',
        'count.update((n) => n + 1); // doubled recomputes, effect re-runs',
        'stop(); // dispose the effect',
      ].join('\n'),
    },
  },
  {
    slug: 'routing',
    title: 'Routing',
    group: 'Routing & Data',
    summary: 'createRouter, mountRouter, outlets, params and active links.',
    paragraphs: [
      'The router maps path patterns to route builders. createRouter({ routes, history }) builds it; mountRouter(router, { container, shell, hydrate }) mounts a persistent shell and renders the active route into routerOutlet(shell).',
      'A builder receives (page, ctx) where ctx.params holds dynamic segments and ctx.query is the parsed query string. router.isActive(href, { exact }) is a signal you can drive active-link styling with, and router.navigate(path) changes routes without a full reload.',
    ],
    code: {
      label: 'Routes',
      code: [
        "import { createRouter, mountRouter, routerOutlet } from 'streetui';",
        '',
        'const routes = [',
        "  { path: '/', builder: (page) => page.section('h', (s) => s.heading('Home', { id: 'h', level: 1 })) },",
        "  { path: '/docs/:section', builder: (page, ctx) =>",
        "      page.section('d', (s) => s.text(ctx.params.section ?? '', { id: 'sec' })) },",
        "  { path: '*', builder: (page) => page.section('nf', (s) => s.heading('404', { id: 'nf', level: 1 })) },",
        '];',
      ].join('\n'),
    },
  },
  {
    slug: 'data',
    title: 'Data',
    group: 'Routing & Data',
    summary: 'resource() for reads, mutation() for writes.',
    paragraphs: [
      'resource(loader) models asynchronous reads: it exposes loading, error and data as signals and refetches on demand. mutation() models writes and invalidates the resources it affects by explicit local refetch — there is no hidden global cache.',
      'Both are plain reactive primitives, so the same when()/listOf() wiring that renders synchronous state renders async state too.',
    ],
  },
  {
    slug: 'forms',
    title: 'Forms',
    group: 'Routing & Data',
    summary: 'Controlled inputs, two-way bind, and validators.',
    paragraphs: [
      'form(id, build, { onSubmit }) wraps controlled inputs. An input can be fully controlled with value + onInput, or two-way bound with bind: aSignal. Validation state is just derived() over the field signals.',
      'Because validity is a signal, you render errors and enable/disable submit with the same when() primitive used everywhere else.',
    ],
    code: {
      label: 'Bound input',
      code: [
        "import { signal, derived } from 'streetui';",
        '',
        "const email = signal('');",
        "const valid = derived(() => /.+@.+\\..+/.test(email.get()));",
        '// in a form builder:',
        "// form.input({ id: 'email', type: 'email', bind: email });",
        "// form.when(derived(() => !valid.get()), (c) => c.text('Invalid email', { id: 'err' }));",
      ].join('\n'),
    },
  },
  {
    slug: 'async-ui',
    title: 'Async UI',
    group: 'Routing & Data',
    summary: 'asyncBoundary and errorBoundary as sugar over resource + when.',
    paragraphs: [
      'asyncBoundary renders loading, error and success branches from a resource. It is sugar over resource + when() with three exhaustive branches — not a second async system.',
      'errorBoundary provides an onError hook so a failing subtree degrades to a fallback instead of tearing down the page.',
    ],
  },
  {
    slug: 'overlays',
    title: 'Overlays',
    group: 'UI',
    summary: 'Dialog, popover, tooltip, dropdown and toast via portals.',
    paragraphs: [
      'Overlays render through a portal node that relocates to document.body, stays inline during SSR and re-locates on hydration. Visibility is app-owned state — a plain boolean signal — so opening an overlay is set(true).',
      'Each overlay carries a descriptor (modal, menu, takesFocus, closeOnEscape, restoreFocus) that drives focus management and keyboard behavior.',
    ],
  },
  {
    slug: 'accessibility',
    title: 'Accessibility',
    group: 'UI',
    summary: 'Deterministic a11y ids, roles, and focus utilities.',
    paragraphs: [
      'StreetUI assigns deterministic ids (resetIdCounter in tests) so labels, controls and ARIA relationships line up between server and client. Overlays wire focus entry and restoration; the focus utilities expose the trap/restore seams.',
      'Accessibility is validated in four separate layers — structural, behavioral, visual and assistive-technology — and never collapsed into a single score.',
    ],
  },
  {
    slug: 'transitions',
    title: 'Transitions',
    group: 'UI',
    summary: 'CSS-class transition engine with correct leave-teardown.',
    paragraphs: [
      'Transitions attach enter/leave CSS classes around mount and unmount. Leave is deferred until transitionend (or a fallback timeout) and then the element is removed, disposed, forgotten and detached — in that order — so nothing leaks.',
      'Transitions are keyed by identity, so a reordered list animates moves rather than destroying and recreating nodes.',
    ],
  },
  {
    slug: 'ssr',
    title: 'Server-Side Rendering',
    group: 'Rendering',
    summary: 'renderToString and serializeState on the server.',
    paragraphs: [
      'renderToString(compile(app)) produces HTML from the ServerDOMAdapter. serializeState embeds the reactive state so the client can resume without re-fetching. SSR output is byte-identical for a given app and seed, which is asserted route-by-route.',
      'Server-only helpers import from streetui/server so the SSR serializer never leaks into client bundles.',
    ],
    code: {
      label: 'Render on the server',
      code: [
        "import { compile } from 'streetui';",
        "import { renderToString } from 'streetui/server';",
        '',
        'const html = renderToString(compile(app));',
      ].join('\n'),
    },
  },
  {
    slug: 'hydration',
    title: 'Hydration',
    group: 'Rendering',
    summary: 'Adopt server HTML without re-creating the DOM.',
    paragraphs: [
'Mounting with hydrate: true (mountRouter) — or hydrateGraph for a single graph — walks the existing server DOM and attaches reactivity in place instead of rebuilding it. Deterministic ids make server and client graphs align; mismatches are reported as diagnostics rather than silently patched.',
      'Static subtrees detected at compile time are serialized once and adopted wholesale, so hydration cost scales with the dynamic parts of the page.',
    ],
  },
  {
    slug: 'testing',
    title: 'Testing',
    group: 'Tooling',
    summary: 'render, findByRole, waitFor and renderServerThenHydrate.',
    paragraphs: [
      'streetui/testing renders a real app into happy-dom with the same renderer production uses. render(app) returns query helpers; findByRole/findByText locate nodes; waitFor polls async state; renderServerThenHydrate runs the full SSR→hydrate path and can assert zero mismatches.',
      'There is no private-graph access and no second assertion framework — tests drive the app exactly as a user would.',
    ],
    code: {
      label: 'A test',
      code: [
        "import { render, findByRole } from 'streetui/testing';",
        '',
        'const { container, unmount } = render(app);',
        "const btn = findByRole(container, 'button', { name: 'Increment' });",
        'unmount();',
      ].join('\n'),
    },
  },
  {
    slug: 'devtools',
    title: 'DevTools',
    group: 'Tooling',
    summary: 'Headless inspection snapshot + 12 panels.',
    paragraphs: [
      'DevTools build a snapshot of the running app — components, reactive state, signal graph, router, resources, mutations, events, overlays, performance, diagnostics and SSR/hydration — exposed as data and as a DOM-free, host-injectable view.',
      'The production runtime never imports DevTools; inspection is strictly additive and sensitive values are redacted by default.',
    ],
  },
  {
    slug: 'cli',
    title: 'CLI',
    group: 'Tooling',
    summary: 'Scaffold, build and serve from one binary.',
    paragraphs: [
      'The streetui CLI scaffolds projects, builds them with esbuild, and serves them. esbuild is the only runtime dependency and is used solely by the CLI binaries — never pulled into an application bundle.',
      'Project configuration is declared with defineConfig in streetui.config.ts.',
    ],
  },
  {
    slug: 'deployment',
    title: 'Deployment',
    group: 'Tooling',
    summary: 'Ship a server-rendered, hydrating app.',
    paragraphs: [
      'A deployed StreetUI app renders each route to HTML on the server, serializes state, and ships a client bundle that hydrates the markup. The public install stays npm install streetui; nothing about distribution fragments the package.',
      'Because SSR output is deterministic, caching and byte-identity checks are straightforward in CI.',
    ],
  },
];

/** Look up a documentation section by slug. */
export function findDoc(slug: string): DocSection | undefined {
  return DOC_SECTIONS.find((d) => d.slug === slug);
}

/** The sidebar groups, in display order, with their sections. */
export const DOC_GROUPS: readonly DocSection['group'][] = [
  'Introduction',
  'Core',
  'Routing & Data',
  'UI',
  'Rendering',
  'Tooling',
];

export function docsInGroup(group: DocSection['group']): DocSection[] {
  return DOC_SECTIONS.filter((d) => d.group === group);
}

// ── Top-level navigation ────────────────────────────────────────────────────
export interface NavItem {
  readonly label: string;
  readonly href: string;
  readonly id: string;
  /** Active match is exact (used for "/" so it isn't active everywhere). */
  readonly exact?: boolean;
}

export const PRIMARY_NAV: readonly NavItem[] = [
  { label: 'Home', href: '/', id: 'nav-home', exact: true },
  { label: 'Getting Started', href: '/getting-started', id: 'nav-start' },
  { label: 'Docs', href: '/docs', id: 'nav-docs' },
  { label: 'API', href: '/api', id: 'nav-api' },
  { label: 'Examples', href: '/examples', id: 'nav-examples' },
  { label: 'Playground', href: '/playground', id: 'nav-playground' },
  { label: 'Benchmarks', href: '/benchmarks', id: 'nav-benchmarks' },
  { label: 'Blog', href: '/blog', id: 'nav-blog' },
  { label: 'Changelog', href: '/changelog', id: 'nav-changelog' },
];

// ── Examples gallery ────────────────────────────────────────────────────────
export interface ExampleEntry {
  readonly id: number;
  readonly name: string;
  readonly tag: string;
  readonly blurb: string;
}

export const EXAMPLES: readonly ExampleEntry[] = [
  { id: 1, name: 'Counter', tag: 'state', blurb: 'A signal, three buttons, bound text.' },
  { id: 2, name: 'Reactive list', tag: 'list', blurb: 'listOf over a signal with keyed reconciliation.' },
  { id: 3, name: 'Contact form', tag: 'forms', blurb: 'Controlled inputs, derived validity, submit.' },
  { id: 4, name: 'Conditional panel', tag: 'when', blurb: 'when() mounts/removes a subtree.' },
  { id: 5, name: 'Router', tag: 'router', blurb: 'Nested shell, params, active links, 404.' },
  { id: 6, name: 'Resource fetch', tag: 'data', blurb: 'Async read with loading/error/success.' },
  { id: 7, name: 'Dialog overlay', tag: 'overlays', blurb: 'Portal, focus trap, Escape to close.' },
  { id: 8, name: 'SSR + hydrate', tag: 'ssr', blurb: 'Byte-identical server HTML, resumed on the client.' },
];

// ── API reference (grouped export listing, grounded in the real surface) ─────
export interface ApiGroup {
  readonly title: string;
  readonly exports: readonly string[];
}

export const API_GROUPS: readonly ApiGroup[] = [
  { title: 'Reactivity', exports: ['signal', 'derived', 'effect', 'batch', 'resource'] },
  { title: 'DSL', exports: ['streetui', 'compile'] },
  { title: 'Runtime & Renderer', exports: ['createRuntime', 'createRenderer', 'BrowserDOMAdapter', 'ServerDOMAdapter'] },
  { title: 'SSR', exports: ['renderToString', 'serializeState', 'readState'] },
  { title: 'Router', exports: ['createRouter', 'mountRouter', 'routerOutlet', 'createBrowserHistory', 'createMemoryHistory'] },
  { title: 'Testing', exports: ['render', 'renderServerThenHydrate', 'findByRole', 'findByText', 'waitFor'] },
];

// ── Changelog ───────────────────────────────────────────────────────────────
export interface ChangelogEntry {
  readonly version: string;
  readonly date: string;
  readonly highlights: readonly string[];
}

export const CHANGELOG: readonly ChangelogEntry[] = [
  { version: '2.5.0', date: '2026', highlights: ['Official website built entirely in StreetUI', 'Per-route SEO/document metadata via head()', 'Published to npm'] },
  { version: '2.4.0', date: '2026', highlights: ['Final validation completion', 'Firefox performance baseline', 'Real AT + visual a11y harnesses'] },
  { version: '2.2.0', date: '2026', highlights: ['Interactive 12-panel DevTools', 'Accessibility regression gate', 'Stress suites'] },
  { version: '2.0.0', date: '2026', highlights: ['Application platform: head, async boundaries, mutations', 'DevTools UI panels'] },
  { version: '1.0.0', date: '2026', highlights: ['Stable, frozen public API', 'Single streetui package'] },
];

// ── Blog ────────────────────────────────────────────────────────────────────
export interface BlogPost {
  readonly slug: string;
  readonly title: string;
  readonly date: string;
  readonly body: readonly string[];
}

export const BLOG_POSTS: readonly BlogPost[] = [
  {
    slug: 'dogfooding-the-website',
    title: 'This website is built with StreetUI',
    date: '2026',
    body: [
      'The site you are reading is a StreetUI application. Every page is a route; the nav, theme toggle and docs search are StreetUI signals and builders.',
      'Building it is how we find the framework’s rough edges before you do.',
    ],
  },
  {
    slug: 'no-virtual-dom',
    title: 'Why there is no virtual DOM',
    date: '2026',
    body: [
      'StreetUI compiles your app to a semantic graph and binds updates to the exact signals they read, so the renderer patches only what changed.',
      'That makes reconciliation keyed and identity-preserving without a diff of a shadow tree.',
    ],
  },
];

export function findPost(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((p) => p.slug === slug);
}

// ── Search index (derived mechanically from the content above) ───────────────
export interface SearchDoc {
  readonly title: string;
  readonly href: string;
  readonly kind: 'doc' | 'example' | 'blog' | 'api';
  readonly haystack: string;
}

export const SEARCH_INDEX: readonly SearchDoc[] = [
  ...DOC_SECTIONS.map((d): SearchDoc => ({
    title: d.title,
    href: `/docs/${d.slug}`,
    kind: 'doc',
    haystack: `${d.title} ${d.summary} ${d.paragraphs.join(' ')}`.toLowerCase(),
  })),
  ...EXAMPLES.map((e): SearchDoc => ({
    title: e.name,
    href: '/examples',
    kind: 'example',
    haystack: `${e.name} ${e.tag} ${e.blurb}`.toLowerCase(),
  })),
  ...BLOG_POSTS.map((p): SearchDoc => ({
    title: p.title,
    href: `/blog/${p.slug}`,
    kind: 'blog',
    haystack: `${p.title} ${p.body.join(' ')}`.toLowerCase(),
  })),
  ...API_GROUPS.flatMap((g): SearchDoc[] =>
    g.exports.map((name) => ({
      title: name,
      href: '/api',
      kind: 'api',
      haystack: `${name} ${g.title}`.toLowerCase(),
    })),
  ),
];

/** Case-insensitive substring search over the derived index. */
export function searchContent(query: string): SearchDoc[] {
  const q = query.trim().toLowerCase();
  if (q === '') return [];
  return SEARCH_INDEX.filter((d) => d.haystack.includes(q)).slice(0, 10);
}
