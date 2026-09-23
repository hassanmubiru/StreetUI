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

import { signal, derived, type Signal } from '@streetui/state';
import type { ContainerDSL, PageDSL } from '@streetui/dsl';
import {
  createRouter,
  mountRouter,
  routerOutlet,
  type Router,
  type RouteDefinition,
  type RouteContext,
  type RouterHistory,
} from '@streetui/router';

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
