/**
 * StreetJS website — route table.
 *
 * Every route is a `RouteDefinition` built from the public builder DSL and
 * declares its COMPLETE head once through `pageLayout` (StreetUI finding F-7).
 * All page content comes from the typed content modules; nothing is written
 * inline that was not recorded from the StreetJS v1.2.8 type declarations.
 */

import { derived, type ReadonlySignal } from 'streetui';
import type { ContainerDSL, PageDSL, RouteContext, RouteDefinition, Router } from 'streetui';
import { breadcrumb, codeExample, navLink, pageLayout, provenanceNotice, tagRow } from './components.js';
import {
  ABOUT_FACTS, ABOUT_UNVERIFIED, API_GROUPS, BLOG_POSTS, CHANGELOG, DOCS, DOC_GROUPS, EXAMPLES, GUIDES,
  PLUGINS, PLUGINS_NOTE, docBySlug, docNeighbours, guideBySlug, postBySlug,
  type Block,
} from './content.js';
import { ds } from './design-system.js';
import type { BackendPanel, ProbeResult } from './backend.js';
import { DECODER_SAMPLE, type PlaygroundState } from './playground.js';
import { DOCS_SITE_URL } from './shell.js';

export interface RoutesDeps {
  /**
   * Lazy router accessor. Routes need the router (active-link state in the docs
   * sidebar) but the router is created FROM these routes, so it is resolved at
   * build time of a page, never at definition time.
   */
  readonly getRouter: () => Router;
  readonly playground: PlaygroundState;
  readonly backend: BackendPanel;
}

/** Paths that resolve to real content. Used by the server for the 404 status. */
export function isKnownPath(path: string): boolean {
  const clean = path.split('?')[0]!.split('#')[0]!.replace(/\/+$/, '') || '/';
  const fixed = [
    '/', '/getting-started', '/docs', '/guides', '/api', '/examples',
    '/playground', '/plugins', '/changelog', '/blog', '/about',
  ];
  if (fixed.includes(clean)) return true;
  const m = /^\/(docs|guides|blog)\/([^/]+)$/.exec(clean);
  if (m === null) return false;
  const slug = decodeURIComponent(m[2]!);
  return m[1] === 'docs' ? docBySlug(slug) !== undefined
    : m[1] === 'guides' ? guideBySlug(slug) !== undefined
    : postBySlug(slug) !== undefined;
}

/** Every indexable path, for the sitemap. Derived from content, never hand-listed. */
export function allPaths(): string[] {
  return [
    '/', '/getting-started', '/docs', '/guides', '/api', '/examples', '/playground', '/plugins', '/changelog', '/blog', '/about',
    ...DOCS.map((d) => `/docs/${d.slug}`),
    ...GUIDES.map((g) => `/guides/${g.slug}`),
    ...BLOG_POSTS.map((b) => `/blog/${b.slug}`),
  ];
}

/* ── shared renderers ───────────────────────────────────────────────────── */

/** Render content blocks. Lists use list/listitem roles; warnings are notes. */
function renderBlocks(scope: ContainerDSL, blocks: readonly Block[], idBase: string): void {
  blocks.forEach((b, i) => {
    const id = `${idBase}-${i}`;
    switch (b.kind) {
      case 'p':
        scope.text(b.text, { id, class: ds.bodyText });
        break;
      case 'h':
        scope.heading(b.text, { level: 2, id, class: ds.sectionHeading });
        break;
      case 'list':
        scope.container(id, (l) => {
          b.items.forEach((item, j) => l.text(item, { id: `${id}-${j}`, class: ds.bodyText, role: 'listitem' }));
        }, { id, class: ds.linkList, role: 'list' });
        break;
      case 'code':
        codeExample(scope, b.sample, id);
        break;
      case 'warn':
        scope.container(id, (w) => { w.text(b.text, { id: `${id}-text` }); }, { id, class: ds.alert, role: 'note' });
        break;
    }
  });
}

/** A card: linked title + summary. */
function linkCard(scope: ContainerDSL, idBase: string, title: string, href: string, summary: string, badge?: string): void {
  scope.container(idBase, (c) => {
    c.link(title, { href, id: `${idBase}-link`, class: ds.inlineLink });
    if (badge !== undefined) c.text(badge, { id: `${idBase}-badge`, class: ds.badge });
    c.text(summary, { id: `${idBase}-summary`, class: ds.metaText });
  }, { id: idBase, class: ds.card });
}

function notFoundBody(c: ContainerDSL, what: string): void {
  c.text(`${what} Use search (Ctrl+K), or start from one of these pages.`, { id: 'nf-text', class: ds.bodyText });
  c.container('nf-links', (l) => {
    l.link('Home', { href: '/', id: 'nf-home', class: ds.inlineLink });
    l.link('Documentation', { href: '/docs', id: 'nf-docs', class: ds.inlineLink });
    l.link('API reference', { href: '/api', id: 'nf-api', class: ds.inlineLink });
  }, { id: 'nf-links', class: ds.linkList });
}

const FEATURES: readonly { title: string; href: string; text: string }[] = [
  { title: 'HTTP with decorators', href: '/docs/http', text: 'streetApp() plus @Controller, @Get, @Post and friends, with a StreetContext per request.' },
  { title: 'Native PostgreSQL', href: '/docs/database', text: 'A built-in wire-protocol driver (PgPool). No pg package. Every column arrives as a string.' },
  { title: 'Migrations and seeds', href: '/docs/migrations', text: 'StreetMigrationRunner tracks files by name; StreetSeeder tracks seeds by content hash.' },
  { title: 'JWT, sessions, RBAC', href: '/docs/jwt-sessions', text: 'JwtService, SessionManager and RbacService, with the traps documented.' },
  { title: 'Jobs and workflows', href: '/docs/jobs', text: 'JobQueue, CronScheduler, WorkflowEngine and SagaOrchestrator.' },
  { title: 'Health routes', href: '/docs/health', text: 'HealthCheckRegistry and registerHealthRoutes serve /health/live and /health/ready.' },
];

/* ── route table ────────────────────────────────────────────────────────── */

export function buildRoutes(deps: RoutesDeps): RouteDefinition[] {
  const { getRouter, playground, backend } = deps;

  return [
    {
      path: '/',
      builder: (page: PageDSL) => {
        pageLayout(page, {
          id: 'home',
          title: 'StreetJS',
          lead: 'Production-grade TypeScript backend framework. Native PostgreSQL wire driver, JWT, WebSockets, clustering, runtime input validation, field-level encryption. No Express. No pg. No Prisma.',
          path: '/',
        }, (c) => {
          c.container('home-cta', (r) => {
            r.link('Get started', { href: '/getting-started', id: 'cta-start', class: ds.buttonPrimary });
            r.link('Read the docs', { href: '/docs', id: 'cta-docs', class: ds.buttonSecondary });
            r.link('Try the playground', { href: '/playground', id: 'cta-playground', class: ds.buttonSecondary });
          }, { id: 'home-cta', class: ds.ctaRow });
          provenanceNotice(c, 'home-provenance');
          c.heading('What is documented here', { level: 2, id: 'home-features-title', class: ds.sectionHeading });
          c.container('home-features', (g) => {
            FEATURES.forEach((f, i) => linkCard(g, `feature-${i}`, f.title, f.href, f.text));
          }, { id: 'home-features', class: ds.cardGrid });
          c.heading('Read the sharp edges first', { level: 2, id: 'home-traps-title', class: ds.sectionHeading });
          c.text('StreetJS has behaviours that surprise people: global rbacGuard authorises everything, no password hashing ships, and framework 5xx errors can expose database settings. They are written up plainly.', { id: 'home-traps-text', class: ds.bodyText });
          c.container('home-trap-links', (l) => {
            l.link('Known traps', { href: '/docs/known-traps', id: 'home-trap-doc', class: ds.inlineLink });
            l.link('Blog', { href: '/blog', id: 'home-trap-blog', class: ds.inlineLink });
          }, { id: 'home-trap-links', class: ds.linkList });
        });
      },
    },

    {
      path: '/getting-started',
      builder: (page: PageDSL) => {
        pageLayout(page, {
          id: 'start',
          title: 'Getting started',
          lead: 'Install StreetJS and run a first server. There is no verified scaffolding command, so you start from a plain project.',
          path: '/getting-started',
        }, (c) => {
          provenanceNotice(c, 'start-provenance');
          const install = docBySlug('installation');
          if (install !== undefined) renderBlocks(c, install.blocks, 'start-install');
          const hello = EXAMPLES.find((e) => e.slug === 'hello-controller');
          if (hello !== undefined) {
            c.heading('A first controller', { level: 2, id: 'start-hello-title', class: ds.sectionHeading });
            c.text(hello.summary, { id: 'start-hello-summary', class: ds.bodyText });
            codeExample(c, hello.sample, 'start-hello');
          }
          c.heading('Next', { level: 2, id: 'start-next-title', class: ds.sectionHeading });
          c.container('start-next', (l) => {
            l.link('HTTP app and controllers', { href: '/docs/http', id: 'start-next-http', class: ds.inlineLink });
            l.link('Connect to PostgreSQL', { href: '/docs/database', id: 'start-next-db', class: ds.inlineLink });
            l.link('Known traps', { href: '/docs/known-traps', id: 'start-next-traps', class: ds.inlineLink });
          }, { id: 'start-next', class: ds.linkList });
        });
      },
    },

    {
      path: '/docs',
      builder: (page: PageDSL) => {
        pageLayout(page, {
          id: 'docs',
          title: 'Documentation',
          lead: `${DOCS.length} pages across ${DOC_GROUPS.length} groups, recorded from the StreetJS v1.2.8 type declarations.`,
          path: '/docs',
        }, (c) => {
          provenanceNotice(c, 'docs-provenance');
          DOC_GROUPS.forEach((group, gi) => {
            c.heading(group, { level: 2, id: `docs-group-${gi}`, class: ds.sectionHeading });
            c.container(`docs-cards-${gi}`, (g) => {
              DOCS.filter((d) => d.group === group).forEach((d) => {
                linkCard(g, `doc-card-${d.slug}`, d.title, `/docs/${d.slug}`, d.summary);
              });
            }, { id: `docs-cards-${gi}`, class: ds.cardGrid });
          });
          c.text(`Official documentation: ${DOCS_SITE_URL}`, { id: 'docs-official', class: ds.metaText });
        });
      },
    },

    {
      path: '/docs/:section',
      builder: (page: PageDSL, ctx: RouteContext) => {
        const slug = ctx.params.section ?? '';
        const doc = docBySlug(slug);
        if (doc === undefined) {
          pageLayout(page, { id: 'notfound', title: 'Documentation page not found', lead: 'There is no documentation page at this address.', path: ctx.path, robots: 'noindex' },
            (c) => notFoundBody(c, `No page called "${slug}" exists.`));
          return;
        }
        const { prev, next } = docNeighbours(doc.slug);
        pageLayout(page, { id: 'doc', title: doc.title, lead: doc.summary, path: `/docs/${doc.slug}` }, (c) => {
          breadcrumb(c, [{ label: 'Docs', href: '/docs' }, { label: doc.group }, { label: doc.title }], 'doc-crumbs');
          c.container('doc-layout', (layout) => {
            layout.container('doc-sidebar', (s) => {
              DOC_GROUPS.forEach((group, gi) => {
                s.text(group, { id: `side-group-${gi}`, class: ds.docsSidebarGroup });
                DOCS.filter((d) => d.group === group).forEach((d) => {
                  navLink(s, getRouter(), { label: d.title, href: `/docs/${d.slug}`, id: `side-doc-${d.slug}`, exact: true }, ds.docsSidebarLink);
                });
              });
            }, { id: 'doc-sidebar', class: ds.docsSidebar, role: 'navigation', ariaLabel: 'Documentation sections' });
            layout.container('doc-content', (body) => {
              provenanceNotice(body, 'doc-provenance');
              renderBlocks(body, doc.blocks, 'doc-block');
              body.container('doc-pager', (p) => {
                if (prev !== undefined) p.link(`Previous: ${prev.title}`, { href: `/docs/${prev.slug}`, id: 'doc-prev', class: ds.inlineLink });
                if (next !== undefined) p.link(`Next: ${next.title}`, { href: `/docs/${next.slug}`, id: 'doc-next', class: ds.inlineLink });
              }, { id: 'doc-pager', class: ds.pagerRow });
            }, { id: 'doc-content', class: ds.docsContent });
          }, { id: 'doc-layout', class: ds.docsLayout });
        });
      },
    },

    {
      path: '/guides',
      builder: (page: PageDSL) => {
        pageLayout(page, {
          id: 'guides',
          title: 'Guides',
          lead: `${GUIDES.length} task-focused walkthroughs. Each links back to the reference pages it depends on.`,
          path: '/guides',
        }, (c) => {
          provenanceNotice(c, 'guides-provenance');
          c.container('guides-cards', (g) => {
            GUIDES.forEach((x) => linkCard(g, `guide-card-${x.slug}`, x.title, `/guides/${x.slug}`, x.summary, x.level));
          }, { id: 'guides-cards', class: ds.cardGrid });
        });
      },
    },

    {
      path: '/guides/:slug',
      builder: (page: PageDSL, ctx: RouteContext) => {
        const slug = ctx.params.slug ?? '';
        const guide = guideBySlug(slug);
        if (guide === undefined) {
          pageLayout(page, { id: 'notfound', title: 'Guide not found', lead: 'There is no guide at this address.', path: ctx.path, robots: 'noindex' },
            (c) => notFoundBody(c, `No guide called "${slug}" exists.`));
          return;
        }
        pageLayout(page, { id: 'guide', title: guide.title, lead: guide.summary, path: `/guides/${guide.slug}` }, (c) => {
          breadcrumb(c, [{ label: 'Guides', href: '/guides' }, { label: guide.title }], 'guide-crumbs');
          tagRow(c, [guide.level], 'guide-tags');
          provenanceNotice(c, 'guide-provenance');
          renderBlocks(c, guide.blocks, 'guide-block');
        });
      },
    },

    {
      path: '/api',
      builder: (page: PageDSL) => {
        pageLayout(page, {
          id: 'api',
          title: 'API reference',
          lead: `${API_GROUPS.length} groups of the surface recorded from the v1.2.8 type declarations. Signatures are abbreviated; the .d.ts files are authoritative.`,
          path: '/api',
        }, (c) => {
          provenanceNotice(c, 'api-provenance');
          API_GROUPS.forEach((g) => {
            c.container(`api-${g.id}`, (grp) => {
              grp.heading(g.title, { level: 2, id: `api-${g.id}-title`, class: ds.sectionHeading });
              grp.text(g.importPath, { id: `api-${g.id}-import`, class: ds.inlineCode });
              grp.text(g.summary, { id: `api-${g.id}-summary`, class: ds.bodyText });
              g.entries.forEach((e, i) => {
                grp.container(`api-${g.id}-e${i}`, (en) => {
                  en.text(e.name, { id: `api-${g.id}-e${i}-name`, class: ds.subHeading });
                  en.code(e.signature, { id: `api-${g.id}-e${i}-sig`, language: 'ts', class: ds.codeSurface });
                  en.text(e.note, { id: `api-${g.id}-e${i}-note`, class: ds.metaText });
                }, { id: `api-${g.id}-e${i}`, class: ds.card });
              });
            }, { id: `api-${g.id}`, class: ds.pageBody });
          });
        });
      },
    },

    {
      path: '/examples',
      builder: (page: PageDSL) => {
        pageLayout(page, {
          id: 'examples',
          title: 'Examples',
          lead: `${EXAMPLES.length} examples using the StreetJS v1.2.8 API as recorded. They have not been executed against a live install by this site; run them against yours.`,
          path: '/examples',
        }, (c) => {
          provenanceNotice(c, 'examples-provenance');
          EXAMPLES.forEach((e) => {
            c.container(`example-${e.slug}`, (x) => {
              x.heading(e.title, { level: 2, id: `example-${e.slug}-title`, class: ds.sectionHeading });
              x.text(e.summary, { id: `example-${e.slug}-summary`, class: ds.bodyText });
              codeExample(x, e.sample, `example-${e.slug}-code`);
            }, { id: `example-${e.slug}`, class: ds.pageBody });
          });
          c.text('Want to try behaviour interactively? The playground decodes pg rows, checks migration order and validates secret formats in your browser.', { id: 'examples-playground', class: ds.bodyText });
          c.link('Open the playground', { href: '/playground', id: 'examples-playground-link', class: ds.inlineLink });
        });
      },
    },

    {
      path: '/playground',
      builder: (page: PageDSL) => {
        pageLayout(page, {
          id: 'playground',
          title: 'Playground',
          lead: 'Interactive tools built with StreetUI signals. They run in your browser and are teaching aids for documented StreetJS behaviour — they are not StreetJS APIs.',
          path: '/playground',
        }, (c) => {
          const pg = playground;

          /* 1 — row decoder */
          c.container('tool-decoder', (t) => {
            t.heading('Decode pg rows', { level: 2, id: 'tool-decoder-title', class: ds.sectionHeading });
            t.text('StreetJS’s PostgreSQL driver returns every column as a string: booleans are \'t\'/\'f\', bigints stay strings, timestamps are not ISO 8601. Enter entries as "column | type | value", separated by semicolons.', { id: 'tool-decoder-help', class: ds.bodyText });
            t.container('decoder-field', (f) => {
              f.text('Columns', { id: 'decoder-label', class: ds.fieldLabel });
              f.input({ id: 'decoder-input', type: 'text', ariaLabel: 'Columns to decode', bind: pg.decoderInput, class: ds.textInput });
            }, { id: 'decoder-field', class: ds.fieldGroup });
            t.container('decoder-presets', (r) => {
              r.button('Boolean', { id: 'decoder-preset-bool', onClick: () => pg.decoderInput.set('active | boolean | t'), class: ds.buttonSecondary });
              r.button('Bigint', { id: 'decoder-preset-bigint', onClick: () => pg.decoderInput.set('id | bigint | 9007199254740993'), class: ds.buttonSecondary });
              r.button('Timestamp', { id: 'decoder-preset-ts', onClick: () => pg.decoderInput.set('created_at | timestamp | 2026-01-02 03:04:05.123456+00'), class: ds.buttonSecondary });
              r.button('Sample row', { id: 'decoder-preset-sample', onClick: () => pg.decoderInput.set(DECODER_SAMPLE), class: ds.buttonSecondary });
            }, { id: 'decoder-presets', class: ds.ctaRow });
            t.text(pg.decoderSummary, { id: 'decoder-summary', class: ds.metaText, ariaLive: 'polite' });
            const rows: ReadonlySignal<{ id: string; line: string }[]> = derived(() =>
              pg.decoded.get().map((r, i) => ({
                id: `decoder-row-${i}`,
                line: `${r.ok ? 'ok' : 'problem'} — ${r.column} (${r.type}): ${r.result}`,
              })));
            t.listOf('decoder-rows', rows, (r, _i, row) => {
              row.text(r.line, { id: r.id, class: ds.outputRow });
            }, { id: 'decoder-rows', class: ds.outputBox });
          }, { id: 'tool-decoder', class: ds.toolPanel });

          /* 2 — migration order */
          c.container('tool-migrations', (t) => {
            t.heading('Check migration order', { level: 2, id: 'tool-migrations-title', class: ds.sectionHeading });
            t.text('StreetMigrationRunner tracks migrations by file name and runs them in lexicographic order, so numeric prefixes must be zero-padded to the same width. Enter file names separated by commas; .rollback.sql files are ignored.', { id: 'tool-migrations-help', class: ds.bodyText });
            t.container('migrations-field', (f) => {
              f.text('File names', { id: 'migrations-label', class: ds.fieldLabel });
              f.input({ id: 'migrations-input', type: 'text', ariaLabel: 'Migration file names', bind: pg.migrationInput, class: ds.textInput });
            }, { id: 'migrations-field', class: ds.fieldGroup });
            t.text(pg.migrationSummary, { id: 'migrations-summary', class: ds.metaText, ariaLive: 'polite' });
            const order = derived(() => pg.migrations.get().order.map((name, i) => ({ id: `migration-order-${i}`, line: `${i + 1}. ${name}` })));
            const problems = derived(() => pg.migrations.get().problems.map((p, i) => ({ id: `migration-problem-${i}`, line: `problem — ${p}` })));
            t.listOf('migrations-order', order, (r, _i, row) => { row.text(r.line, { id: r.id, class: ds.outputRow }); }, { id: 'migrations-order', class: ds.outputBox });
            t.listOf('migrations-problems', problems, (r, _i, row) => { row.text(r.line, { id: r.id, class: ds.outputRow }); }, { id: 'migrations-problems', class: ds.outputBox });
          }, { id: 'tool-migrations', class: ds.toolPanel });

          /* 3 — secret formats */
          c.container('tool-secrets', (t) => {
            t.heading('Check secret formats', { level: 2, id: 'tool-secrets-title', class: ds.sectionHeading });
            t.text('JwtService needs a secret of at least 32 characters; SessionManager needs exactly 64 hex characters. This checks format only. Nothing leaves your browser, but do not paste a real production secret into any web page.', { id: 'tool-secrets-help', class: ds.bodyText });
            t.container('secrets-field', (f) => {
              f.text('Candidate secret', { id: 'secrets-label', class: ds.fieldLabel });
              f.input({ id: 'secrets-input', type: 'password', ariaLabel: 'Candidate secret', bind: pg.secretInput, class: ds.textInput });
            }, { id: 'secrets-field', class: ds.fieldGroup });
            const checks = derived(() => pg.secrets.get().map((s, i) => ({ id: `secret-check-${i}`, line: `${s.ok ? 'ok' : 'problem'} — ${s.label}: ${s.detail}` })));
            t.listOf('secrets-results', checks, (r, _i, row) => { row.text(r.line, { id: r.id, class: ds.outputRow }); }, { id: 'secrets-results', class: ds.outputBox });
          }, { id: 'tool-secrets', class: ds.toolPanel });

          /* 4 — backend status */
          c.container('tool-backend', (t) => {
            t.heading('Probe a running StreetJS app', { level: 2, id: 'tool-backend-title', class: ds.sectionHeading });
            t.text('This site has no backend of its own. Point it at a running StreetJS app and it requests the three routes the framework provides when registered: /health/live, /health/ready (registerHealthRoutes) and /api/jobs/metrics (registerJobMetricsRoute). Your app must allow this site’s origin through CORS.', { id: 'tool-backend-help', class: ds.bodyText });
            t.container('backend-field', (f) => {
              f.text('Base URL', { id: 'backend-label', class: ds.fieldLabel });
              f.input({ id: 'backend-input', type: 'text', placeholder: 'http://localhost:3000', ariaLabel: 'StreetJS app base URL', bind: backend.baseUrl, class: ds.textInput });
            }, { id: 'backend-field', class: ds.fieldGroup });
            t.when(derived(() => backend.urlError.get() !== ''), (e) => {
              e.text(backend.urlError, { id: 'backend-url-error', class: ds.errorBox, role: 'alert' });
            });
            t.button('Probe', { id: 'backend-run', onClick: () => { void backend.run(); }, class: ds.buttonPrimary });
            t.text(backend.summary, { id: 'backend-summary', class: ds.metaText, ariaLive: 'polite' });
            const probes: ReadonlySignal<{ id: string; line: string }[]> = derived(() =>
              backend.results.get().map((r: ProbeResult, i) => ({ id: `probe-${i}`, line: `${r.state} — ${r.path}: ${r.detail}` })));
            t.listOf('backend-results', probes, (r, _i, row) => { row.text(r.line, { id: r.id, class: ds.outputRow }); }, { id: 'backend-results', class: ds.outputBox });
          }, { id: 'tool-backend', class: ds.toolPanel });
        });
      },
    },

    {
      path: '/plugins',
      builder: (page: PageDSL) => {
        pageLayout(page, {
          id: 'plugins',
          title: 'Plugins',
          lead: 'What the v1.2.8 package actually provides for extension — and what it does not.',
          path: '/plugins',
        }, (c) => {
          c.container('plugins-note', (n) => { n.text(PLUGINS_NOTE, { id: 'plugins-note-text' }); }, { id: 'plugins-note', class: ds.notice, role: 'note' });
          c.container('plugins-cards', (g) => {
            PLUGINS.forEach((p) => {
              g.container(`plugin-${p.id}`, (x) => {
                x.heading(p.title, { level: 3, id: `plugin-${p.id}-title`, class: ds.subHeading });
                x.text(p.status, { id: `plugin-${p.id}-status`, class: ds.badge });
                x.text(p.summary, { id: `plugin-${p.id}-summary`, class: ds.bodyText });
              }, { id: `plugin-${p.id}`, class: ds.card });
            });
          }, { id: 'plugins-cards', class: ds.cardGrid });
          c.link('API reference for loadPlugin', { href: '/api', id: 'plugins-api', class: ds.inlineLink });
        });
      },
    },

    {
      path: '/changelog',
      builder: (page: PageDSL) => {
        pageLayout(page, {
          id: 'changelog',
          title: 'Changelog',
          lead: 'Only what is known. No release notes were available to this site, so there is no invented history.',
          path: '/changelog',
        }, (c) => {
          CHANGELOG.forEach((entry) => {
            c.container(`release-${entry.version}`, (r) => {
              r.heading(`Version ${entry.version}`, { level: 2, id: `release-${entry.version}-title`, class: ds.sectionHeading });
              r.text(entry.summary, { id: `release-${entry.version}-summary`, class: ds.bodyText });
              r.container(`release-${entry.version}-items`, (l) => {
                entry.items.forEach((item, i) => l.text(item, { id: `release-${entry.version}-item-${i}`, class: ds.bodyText, role: 'listitem' }));
              }, { id: `release-${entry.version}-items`, class: ds.linkList, role: 'list' });
            }, { id: `release-${entry.version}`, class: ds.card });
          });
          c.link('Official documentation', { href: DOCS_SITE_URL, external: true, id: 'changelog-official', class: ds.inlineLink });
        });
      },
    },

    {
      path: '/blog',
      builder: (page: PageDSL) => {
        pageLayout(page, {
          id: 'blog',
          title: 'Blog',
          lead: 'Short notes on StreetJS behaviours that are easy to get wrong. Each one is something the v1.2.8 type declarations or measurements back up.',
          path: '/blog',
        }, (c) => {
          c.container('blog-cards', (g) => {
            BLOG_POSTS.forEach((b) => linkCard(g, `post-card-${b.slug}`, b.title, `/blog/${b.slug}`, b.summary, b.tag));
          }, { id: 'blog-cards', class: ds.cardGrid });
        });
      },
    },

    {
      path: '/blog/:slug',
      builder: (page: PageDSL, ctx: RouteContext) => {
        const slug = ctx.params.slug ?? '';
        const post = postBySlug(slug);
        if (post === undefined) {
          pageLayout(page, { id: 'notfound', title: 'Post not found', lead: 'There is no post at this address.', path: ctx.path, robots: 'noindex' },
            (c) => notFoundBody(c, `No post called "${slug}" exists.`));
          return;
        }
        pageLayout(page, { id: 'post', title: post.title, lead: post.summary, path: `/blog/${post.slug}` }, (c) => {
          breadcrumb(c, [{ label: 'Blog', href: '/blog' }, { label: post.title }], 'post-crumbs');
          tagRow(c, [post.tag], 'post-tags');
          provenanceNotice(c, 'post-provenance');
          renderBlocks(c, post.blocks, 'post-block');
        });
      },
    },

    {
      path: '/about',
      builder: (page: PageDSL) => {
        pageLayout(page, {
          id: 'about',
          title: 'About',
          lead: 'What StreetJS is, what this site records about it, and what it cannot tell you.',
          path: '/about',
        }, (c) => {
          c.heading('Verified facts', { level: 2, id: 'about-facts-title', class: ds.sectionHeading });
          c.container('about-facts', (f) => {
            ABOUT_FACTS.forEach((fact, i) => {
              f.container(`about-fact-${i}`, (r) => {
                r.text(fact.label, { id: `about-fact-${i}-label`, class: ds.fieldLabel });
                r.text(fact.value, { id: `about-fact-${i}-value`, class: ds.inlineCode });
              }, { id: `about-fact-${i}`, class: ds.card });
            });
          }, { id: 'about-facts', class: ds.cardGrid });
          provenanceNotice(c, 'about-provenance');
          c.heading('Not verified, so not claimed', { level: 2, id: 'about-unverified-title', class: ds.sectionHeading });
          c.container('about-unverified', (l) => {
            ABOUT_UNVERIFIED.forEach((u, i) => l.text(u, { id: `about-unverified-${i}`, class: ds.bodyText, role: 'listitem' }));
          }, { id: 'about-unverified', class: ds.linkList, role: 'list' });
          c.heading('About this site', { level: 2, id: 'about-site-title', class: ds.sectionHeading });
          c.text('This is one site: documentation, guides, API reference, examples, playground, plugins, changelog and blog share one shell, router, theme, design system and search. It is written entirely with StreetUI.', { id: 'about-site-text', class: ds.bodyText });
          c.link('Official StreetJS documentation', { href: DOCS_SITE_URL, external: true, id: 'about-official', class: ds.inlineLink });
        });
      },
    },

    {
      path: '*',
      builder: (page: PageDSL, ctx: RouteContext) => {
        pageLayout(page, { id: 'notfound', title: 'Page not found', lead: 'That page does not exist.', path: ctx.path, robots: 'noindex' },
          (c) => notFoundBody(c, 'Nothing lives at this address.'));
      },
    },
  ];
}
