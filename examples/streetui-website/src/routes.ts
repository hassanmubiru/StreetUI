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

  const api: RouteDefinition = {
    path: '/api',
    builder: (page) =>
      pageLayout(page, { id: 'api', title: 'API Reference', lead: 'The public surface, grouped. Everything imports from streetui.' }, (c) => {
        for (const group of API_GROUPS) {
          c.container(`api-group-${slug(group.title)}`, (g) => {
            g.heading(group.title, { level: 2, id: `api-group-${slug(group.title)}-title` });
            for (const name of group.exports) {
              g.text(name, { id: `api-export-${slug(name)}` });
            }
          }, { id: `api-group-${slug(group.title)}` });
        }
      }),
  };

  const examples: RouteDefinition = {
    path: '/examples',
    builder: (page, ctx: RouteContext) => {
      // Seed the two-way filter from ?q= on first render for this route.
      const q = ctx.query.get('q');
      if (q !== null && q !== deps.examplesFilter.get()) {
        deps.examplesFilter.set(q);
      }
      const filtered = derived<ExampleEntry[]>(() => {
        const needle = deps.examplesFilter.get().trim().toLowerCase();
        if (needle === '') return [...EXAMPLES];
        return EXAMPLES.filter((e) =>
          `${e.name} ${e.tag} ${e.blurb}`.toLowerCase().includes(needle),
        );
      });
      pageLayout(page, { id: 'examples', title: 'Examples', lead: 'Small apps, each exercising one framework feature.' }, (c) => {
        c.input({ id: 'examples-filter', type: 'search', placeholder: 'Filter examples…', bind: deps.examplesFilter });
        c.listOf('examples-list', filtered, (item, _i, row) => {
          row.heading(item.name, { level: 2, id: `example-${item.id}-name` });
          row.text(`${item.tag} — ${item.blurb}`, { id: `example-${item.id}-blurb` });
        }, { id: 'examples-list' });
        c.when(
          derived(() => filtered.get().length === 0),
          (empty) => { empty.text('No examples match that filter.', { id: 'examples-empty' }); },
        );
      });
    },
  };

  const playground: RouteDefinition = {
    path: '/playground',
    builder: (page) =>
      pageLayout(page, { id: 'playground', title: 'Playground', lead: 'Live demos built in StreetUI itself — real signals, real event handlers.' }, (c) => {
        buildPlayground(c, deps.playground);
      }),
  };

  const benchmarks: RouteDefinition = {
    path: '/benchmarks',
    builder: (page) =>
      pageLayout(page, { id: 'benchmarks', title: 'Benchmarks', lead: 'Methodology, not marketing.' }, (c) => {
        c.text('Performance numbers are measured in the authoritative benchmark environment (real Chrome and Firefox builds, a reachable registry, controlled hardware). This page documents how those measurements are produced; it never prints a number that was not measured there.', { id: 'benchmarks-intro' });
        c.heading('What is measured', { level: 2, id: 'benchmarks-what' });
        c.text('Initial render, keyed-list operations (append, prepend, reorder, update, reverse), SSR serialize cost, hydration cost, and client bundle size — each against a committed, reproducible harness.', { id: 'benchmarks-what-text' });
        c.heading('What is not claimed', { level: 2, id: 'benchmarks-not' });
        c.text('No first/second/third ranking against other frameworks is printed here, and no third party’s published figures are reused. Results come only from the measured artifacts of the authoritative run.', { id: 'benchmarks-not-text' });
        c.link('See the changelog', { href: '/changelog', id: 'benchmarks-changelog' });
      }),
  };

  const changelog: RouteDefinition = {
    path: '/changelog',
    builder: (page) =>
      pageLayout(page, { id: 'changelog', title: 'Changelog', lead: 'Notable releases.' }, (c) => {
        for (const entry of CHANGELOG) {
          c.container(`changelog-${slug(entry.version)}`, (e) => {
            e.heading(`v${entry.version}`, { level: 2, id: `changelog-${slug(entry.version)}-title` });
            e.text(entry.date, { id: `changelog-${slug(entry.version)}-date` });
            for (let i = 0; i < entry.highlights.length; i++) {
              e.text(entry.highlights[i]!, { id: `changelog-${slug(entry.version)}-h-${i}` });
            }
          }, { id: `changelog-${slug(entry.version)}` });
        }
      }),
  };

  const blogIndex: RouteDefinition = {
    path: '/blog',
    builder: (page) =>
      pageLayout(page, { id: 'blog', title: 'Blog', lead: 'Notes from building the framework.' }, (c) => {
        for (const post of BLOG_POSTS) {
          c.container(`blog-${post.slug}`, (p) => {
            p.link(post.title, { href: `/blog/${post.slug}`, id: `blog-link-${post.slug}` });
            p.text(post.date, { id: `blog-date-${post.slug}` });
          }, { id: `blog-${post.slug}` });
        }
      }),
  };

  const blogPost: RouteDefinition = {
    path: '/blog/:slug',
    builder: (page, ctx: RouteContext) => {
      const slugParam = ctx.params.slug ?? '';
      const post = findPost(slugParam);
      pageLayout(page, {
        id: 'blogpost',
        title: post?.title ?? 'Unknown post',
        lead: post?.date,
      }, (c) => {
        breadcrumb(c, [
          { label: 'Home', href: '/' },
          { label: 'Blog', href: '/blog' },
          { label: post?.title ?? slugParam },
        ], 'blogpost-crumbs');
        if (post !== undefined) {
          post.body.forEach((para, i) => c.text(para, { id: `blogpost-p-${i}` }));
        } else {
          c.text(`No blog post named "${slugParam}".`, { id: 'blogpost-missing' });
        }
        c.link('Back to blog', { href: '/blog', id: 'blogpost-back' });
      });
    },
  };

  const about: RouteDefinition = {
    path: '/about',
    builder: (page) =>
      pageLayout(page, { id: 'about', title: 'About', lead: 'StreetUI is MIT-licensed and open source.' }, (c) => {
        c.text('StreetUI is a TypeScript-first UI framework. This website is itself a StreetUI application, used to dogfood the framework end to end.', { id: 'about-text' });
        c.link('GitHub', { href: 'https://example.com/streetui', external: true, id: 'about-github' });
      }),
  };

  const notFound: RouteDefinition = {
    path: '*',
    builder: (page, ctx: RouteContext) =>
      pageLayout(page, { id: 'notfound', title: 'Page not found', lead: 'That route does not exist.' }, (c) => {
        c.text(`No page at ${ctx.path}.`, { id: 'notfound-path' });
        c.link('Go home', { href: '/', id: 'notfound-home' });
      }),
  };

  return [
    home, gettingStarted, docsIndex, docsSection,
    api, examples, playground, benchmarks, changelog,
    blogIndex, blogPost, about, notFound,
  ];
}

/** Stable id fragment from a group/label. */
function slug(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}
