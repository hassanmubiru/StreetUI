/**
 * StreetUI Website — the full route tree.
 *
 * One RouteDefinition per site page. Content-driven pages (docs sections, blog
 * posts, API groups, examples) read from the typed content model so a single
 * builder renders many pages. Every builder uses only the public builder DSL.
 *
 * Benchmarks and performance numbers are NOT embedded here as claims: the
 * /benchmarks page documents the methodology and points at the measured
 * artifacts produced by the authoritative environment. The site never prints a
 * fabricated metric.
 */

import { derived, type Signal } from 'streetui';
import type { RouteContext, RouteDefinition } from 'streetui';
import { pageLayout, codeExample, breadcrumb } from './components.js';
import { buildPlayground, type PlaygroundState } from './playground.js';
import {
  DOC_GROUPS, docsInGroup, findDoc, PRIMARY_NAV, EXAMPLES, API_GROUPS,
  CHANGELOG, BLOG_POSTS, findPost, type ExampleEntry,
} from './content.js';

export interface RoutesDeps {
  /** Two-way bound filter for the examples page (seeded from ?q=). */
  readonly examplesFilter: Signal<string>;
  /** Playground state (shared so tests can drive it). */
  readonly playground: PlaygroundState;
}

export function buildRoutes(deps: RoutesDeps): RouteDefinition[] {
  const home: RouteDefinition = {
    path: '/',
    builder: (page) =>
      pageLayout(page, {
        id: 'home',
        title: 'Build UIs from a semantic graph',
        lead: 'A TypeScript-first UI framework with its own reactivity and a keyed real-DOM reconciler — no virtual DOM.',
      }, (c) => {
        c.link('Get started', { href: '/getting-started', id: 'home-start' });
        c.link('Read the docs', { href: '/docs', id: 'home-docs' });
        c.link('Try the playground', { href: '/playground', id: 'home-playground' });
        c.container('home-pillars', (p) => {
          p.heading('One package', { level: 2, id: 'home-pillar-pkg' });
          p.text('Install streetui. Server helpers at streetui/server, tests at streetui/testing.', { id: 'home-pillar-pkg-text' });
          p.heading('One pipeline', { level: 2, id: 'home-pillar-pipeline' });
          p.text('DSL → compiler → semantic graph → runtime → real-DOM renderer.', { id: 'home-pillar-pipeline-text' });
        }, { id: 'home-pillars' });
      }),
  };

  const gettingStarted: RouteDefinition = {
    path: '/getting-started',
    builder: (page) =>
      pageLayout(page, { id: 'start', title: 'Getting Started', lead: 'From install to a mounted app in four steps.' }, (c) => {
        codeExample(c, { label: '1. Install', code: 'npm install streetui' }, 'start-install');
        codeExample(c, {
          label: '2. Define an app',
          code: [
            "import { streetui } from 'streetui';",
            "const app = streetui.app({ name: 'My App', version: '1.0.0' });",
            "app.page('home', (page) => page.section('h', (s) => s.heading('Hello', { id: 'h', level: 1 })));",
          ].join('\n'),
        }, 'start-define');
        codeExample(c, {
          label: '3. Compile & mount',
          code: [
            "import { compile, createRuntime, createRenderer, BrowserDOMAdapter } from 'streetui';",
            'const renderer = createRenderer({ domAdapter: new BrowserDOMAdapter() });',
            'const runtime = createRuntime({ renderer });',
            "runtime.mount(compile(app), document.getElementById('app'));",
          ].join('\n'),
        }, 'start-mount');
        c.link('Next: Core Concepts', { href: '/docs/core-concepts', id: 'start-next' });
      }),
  };

  const docsIndex: RouteDefinition = {
    path: '/docs',
    builder: (page) =>
      pageLayout(page, { id: 'docs', title: 'Documentation', lead: 'Eighteen sections across the framework.' }, (c) => {
        for (const group of DOC_GROUPS) {
          c.container(`docs-group-${slug(group)}`, (g) => {
            g.heading(group, { level: 2, id: `docs-group-${slug(group)}-title` });
            for (const doc of docsInGroup(group)) {
              g.link(doc.title, { href: `/docs/${doc.slug}`, id: `docs-link-${doc.slug}` });
            }
          }, { id: `docs-group-${slug(group)}` });
        }
      }),
  };

  const docsSection: RouteDefinition = {
    path: '/docs/:section',
    builder: (page, ctx: RouteContext) => {
      const slugParam = ctx.params.section ?? '';
      const doc = findDoc(slugParam);
      pageLayout(page, {
        id: 'docsection',
        title: doc?.title ?? 'Unknown section',
        lead: doc?.summary,
      }, (c) => {
        breadcrumb(c, [
          { label: 'Home', href: '/' },
          { label: 'Docs', href: '/docs' },
          { label: doc?.title ?? slugParam },
        ], 'docsection-crumbs');
        if (doc !== undefined) {
          doc.paragraphs.forEach((para, i) => {
            c.text(para, { id: `docsection-p-${i}` });
          });
          if (doc.code !== undefined) {
            codeExample(c, doc.code, 'docsection-code');
          }
        } else {
          c.text(`No documentation section named "${slugParam}".`, { id: 'docsection-missing' });
        }
        c.link('Back to docs', { href: '/docs', id: 'docsection-back' });
      });
    },
  };

  // __MORE_ROUTES__

  return [
    home, gettingStarted, docsIndex, docsSection,
    // __ROUTE_LIST__
  ];
}

/** Stable id fragment from a group/label. */
function slug(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}
