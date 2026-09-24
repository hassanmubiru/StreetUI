/**
 * StreetUI Docs — a real multi-page application built entirely on the public
 * StreetUI API plus @streetui/router. No fake framework calls, no virtual DOM.
 *
 * Pipeline per route:
 *   DSL → Compiler → Semantic Application Graph → Runtime → Renderer → real DOM
 *
 * Routes:
 *   /                 Home
 *   /docs             Docs index (links to sections)
 *   /docs/:section    A docs section  (getting-started | architecture | api)
 *   /examples         Filterable example list (reactive list + bound input + ?q=)
 *   /about            About
 *   *                 404 (a normal StreetUI page tree)
 *
 * Demonstrates: a reusable shell layout, active navigation links, a dynamic
 * route param, a query parameter, a 404 page, StreetUI signals, `when()`,
 * reactive lists (`listOf`) and a two-way bound input (`bind`).
 */

import { signal, derived, type Signal } from 'streetui';
import type { ContainerDSL, PageDSL } from 'streetui';
import {
  createRouter,
  mountRouter,
  routerOutlet,
  type Router,
  type RouteDefinition,
  type RouteContext,
  type RouterHistory,
} from 'streetui';

// ── Static content data ────────────────────────────────────────────────────────
interface DocSection {
  readonly slug: string;
  readonly title: string;
  readonly body: string;
}

const DOC_SECTIONS: readonly DocSection[] = [
  {
    slug: 'getting-started',
    title: 'Getting Started',
    body: 'Install StreetUI, define an app with streetui.app(), add pages, compile and mount.',
  },
  {
    slug: 'architecture',
    title: 'Architecture',
    body: 'DSL compiles to a semantic application graph; the runtime binds signals; the renderer patches real DOM.',
  },
  {
    slug: 'api',
    title: 'API',
    body: 'Signals, derived, effect, when(), listOf, bound inputs, and the router: createRouter + mountRouter.',
  },
];

function findSection(slug: string): DocSection | undefined {
  return DOC_SECTIONS.find((s) => s.slug === slug);
}

interface Example {
  readonly id: number;
  readonly name: string;
  readonly tag: string;
}

const EXAMPLES: readonly Example[] = [
  { id: 1, name: 'Counter', tag: 'state' },
  { id: 2, name: 'Reactive list', tag: 'list' },
  { id: 3, name: 'Contact form', tag: 'forms' },
  { id: 4, name: 'Conditional panel', tag: 'when' },
  { id: 5, name: 'Docs router', tag: 'router' },
];

export interface DocsState {
  /** Filter text for the examples page (two-way bound to the input). */
  readonly filter: Signal<string>;
}

// ── Reusable layout ─────────────────────────────────────────────────────────────
/**
 * A consistent page shell used by every route: a titled `<section>` wrapping a
 * content container the caller fills. This is composition, not a second render
 * path — it is ordinary DSL nesting (shell → page layout → content).
 */
function pageLayout(
  page: PageDSL,
  opts: { id: string; title: string },
  body: (content: ContainerDSL) => void,
): void {
  page.section(opts.id, (s) => {
    s.heading(opts.title, { level: 1, id: `${opts.id}-title` });
    s.container(`${opts.id}-body`, (content) => body(content), { id: `${opts.id}-body` });
  }, { id: `page-${opts.id}` });
}

// ── Shell (persistent layout + navigation) ──────────────────────────────────────
/** A navigation link that shows an "(active)" marker when its route is active. */
function navLink(
  scope: ContainerDSL,
  router: Router,
  label: string,
  href: string,
  id: string,
  exact = false,
): void {
  scope.link(label, { href, id });
  // Active state is a reactive StreetUI signal; when() mounts/removes the marker.
  scope.when(router.isActive(href, { exact }), (c) => {
    c.text(' (active)', { id: `${id}-active` });
  });
}

export function docsShell(shell: PageDSL, router: Router): void {
  shell.section('nav', (n) => {
    n.heading('StreetUI', { level: 1, id: 'brand' });
    navLink(n, router, 'Home', '/', 'nav-home', true);
    navLink(n, router, 'Docs', '/docs', 'nav-docs');
    navLink(n, router, 'Examples', '/examples', 'nav-examples');
    navLink(n, router, 'About', '/about', 'nav-about');
    // An external link keeps normal browser behaviour (not intercepted).
    n.link('GitHub', { href: 'https://example.com/streetui', external: true, id: 'nav-github' });
  }, { id: 'site-nav' });

  // The router renders the active route into this outlet; the shell persists.
  routerOutlet(shell);

  shell.section('footer', (f) => {
    f.text('Built with StreetUI + @streetui/router.', { id: 'footer-text' });
  }, { id: 'site-footer' });
}

// ── Route builders ──────────────────────────────────────────────────────────────
function buildRoutes(state: DocsState): RouteDefinition[] {
  const home: RouteDefinition = {
    path: '/',
    builder: (page) =>
      pageLayout(page, { id: 'home', title: 'Build UIs from a semantic graph' }, (c) => {
        c.text('A TypeScript-first UI framework with its own reactivity and a keyed real-DOM reconciler.', {
          id: 'home-tagline',
        });
        c.link('Read the docs', { href: '/docs', id: 'home-docs-link' });
        c.link('See examples', { href: '/examples', id: 'home-examples-link' });
      }),
  };

  const docsIndex: RouteDefinition = {
    path: '/docs',
    builder: (page) =>
      pageLayout(page, { id: 'docs', title: 'Documentation' }, (c) => {
        c.text('Choose a section:', { id: 'docs-intro' });
        for (const section of DOC_SECTIONS) {
          c.link(section.title, { href: `/docs/${section.slug}`, id: `docs-link-${section.slug}` });
        }
      }),
  };

  const docsSection: RouteDefinition = {
    path: '/docs/:section',
    builder: (page, ctx: RouteContext) => {
      const slug = ctx.params.section ?? '';
      const section = findSection(slug);
      pageLayout(page, { id: 'docsection', title: section?.title ?? 'Unknown section' }, (c) => {
        if (section !== undefined) {
          c.text(section.body, { id: 'docsection-body-text' });
        } else {
          c.text(`No documentation section named "${slug}".`, { id: 'docsection-missing' });
        }
        c.link('Back to docs', { href: '/docs', id: 'docsection-back' });
      });
    },
  };

  const examples: RouteDefinition = {
    path: '/examples',
    builder: (page, ctx: RouteContext) => {
      // Seed the filter from the ?q= query parameter on each mount.
      state.filter.set(ctx.query.get('q') ?? '');
      const filtered = derived(() => {
        const q = state.filter.get().trim().toLowerCase();
        if (q === '') return EXAMPLES.slice();
        return EXAMPLES.filter(
          (e) => e.name.toLowerCase().includes(q) || e.tag.toLowerCase().includes(q),
        );
      });

      pageLayout(page, { id: 'examples', title: 'Examples' }, (c) => {
        c.text('Filter the examples:', { id: 'examples-hint' });
        c.input({ id: 'examples-filter', type: 'search', placeholder: 'Filter…', bind: state.filter });
        c.listOf('examples', filtered, (item, _i, content) => {
          content.text(`${item.name} — ${item.tag}`, { id: `example-${item.id}` });
        }, { id: 'examples-list' });
        // Empty-state via when(): shown only when nothing matches.
        c.when(derived(() => filtered.get().length === 0), (empty) => {
          empty.text('No examples match your filter.', { id: 'examples-empty' });
        });
      });
    },
  };

  const about: RouteDefinition = {
    path: '/about',
    builder: (page) =>
      pageLayout(page, { id: 'about', title: 'About' }, (c) => {
        c.text('StreetUI is a semantic UI framework. This docs site is built with it.', {
          id: 'about-text',
        });
      }),
  };

  const notFound: RouteDefinition = {
    path: '*',
    builder: (page, ctx: RouteContext) =>
      pageLayout(page, { id: 'notfound', title: '404 — Not found' }, (c) => {
        c.text(`Nothing here at ${ctx.path}.`, { id: 'notfound-text' });
        c.link('Go home', { href: '/', id: 'notfound-home' });
      }),
  };

  return [home, docsIndex, docsSection, examples, about, notFound];
}

// ── App factory + mount ─────────────────────────────────────────────────────────
export interface DocsApp {
  readonly router: Router;
  readonly state: DocsState;
}

export function createDocsApp(history?: RouterHistory): DocsApp {
  const state: DocsState = { filter: signal('') };
  const routesConfig = history !== undefined ? { routes: buildRoutes(state), history } : { routes: buildRoutes(state) };
  const router = createRouter(routesConfig);
  return { router, state };
}

export interface MountedDocsApp extends DocsApp {
  unmount(): void;
}

export function mountDocsApp(container: Element, history?: RouterHistory): MountedDocsApp {
  const { router, state } = createDocsApp(history);
  const mounted = mountRouter(router, {
    container,
    shell: (shell) => docsShell(shell, router),
  });
  return { router, state, unmount: () => mounted.unmount() };
}

