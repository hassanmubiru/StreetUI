/**
 * StreetUI Website — SEO / document metadata (Phase 6, v2.6).
 *
 * The website declares its metadata with StreetUI's own first-class `head()`
 * primitive — the same graph/handler model as the rest of the app, NOT a
 * bolt-on.
 *
 * SINGLE-LAYER DECISION (dogfooding finding, see V2.6.0-FRAMEWORK-FINDINGS.md):
 * the complete document head is declared in ONE place — the route layer, via
 * `pageHead` + `pageLayout`. We deliberately do NOT also declare a second
 * app-level `head()` in the router shell. `mountRouter` renders the shell and
 * each route in SEPARATE render contexts, and the browser `HeadManager` is
 * scoped per render context; two live head layers writing to the same
 * `document.head` therefore do not merge on the client (the route context
 * adopts the shell's tags and then prunes every key it does not itself declare,
 * dropping the site-wide defaults, and duplicates tags on hydration). Declaring
 * the whole head once, at the route level, keeps a single manager in charge of
 * the whole `document.head` — so every route emits a complete, correct head on
 * the server, on the client, and across hydration.
 *
 * `pageHead(opts)` therefore returns the FULL head for a route: the shared site
 * defaults (charset, viewport, robots, theme-color, favicon, Open Graph site
 * fields, Twitter card) merged with that page's own title, description,
 * canonical URL and per-page Open Graph / Twitter values. `siteHead()` is the
 * same shared default set as a standalone head (used for non-router / full-page
 * renders and unit-tested in isolation).
 */

import type { HeadMetadata } from 'streetui';

/** Site-wide constants. The base URL is the canonical origin for this site. */
export const SITE = {
  name: 'StreetUI',
  baseUrl: 'https://streetui.dev',
  defaultTitle: 'StreetUI — a semantic-graph UI framework',
  defaultDescription:
    'StreetUI is a TypeScript-first UI framework with its own reactivity and a keyed real-DOM reconciler — no virtual DOM.',
  themeColor: '#0b0d10',
  twitterCard: 'summary_large_image',
  ogImage: 'https://streetui.dev/og-card.png',
} as const;

/**
 * The shared, page-independent head fields every route inherits: document-level
 * tags (charset, viewport, robots, theme-color, favicon) and the site-wide
 * Open Graph / Twitter card fields. Page-specific values (title, description,
 * canonical, og:title/url, …) are layered on top by {@link pageHead}.
 */
function siteDefaults(): HeadMetadata {
  return {
    charset: 'utf-8',
    viewport: 'width=device-width, initial-scale=1',
    robots: 'index,follow',
    themeColor: SITE.themeColor,
    favicon: '/favicon.svg',
  };
}

/**
 * The shared default head as a standalone document head (defaults + the site's
 * own default title / description / canonical and site-wide OG/Twitter). Used
 * for a full-page render that is not driven by the route layer.
 */
export function siteHead(): HeadMetadata {
  return {
    ...siteDefaults(),
    title: SITE.defaultTitle,
    description: SITE.defaultDescription,
    canonical: SITE.baseUrl + '/',
    openGraph: {
      site_name: SITE.name,
      type: 'website',
      title: SITE.defaultTitle,
      description: SITE.defaultDescription,
      url: SITE.baseUrl + '/',
      image: SITE.ogImage,
    },
    twitter: {
      card: SITE.twitterCard,
      title: SITE.defaultTitle,
      description: SITE.defaultDescription,
      image: SITE.ogImage,
    },
  };
}

export interface PageMetaOptions {
  /** The page's own title (without the site suffix). */
  readonly title: string;
  /** The page's description (<=~160 chars). Falls back to the site default. */
  readonly description?: string | undefined;
  /** The route path for the canonical URL (e.g. '/docs/core-concepts'). */
  readonly path: string;
  /** Override the default 'index,follow' (e.g. 'noindex' for 404). */
  readonly robots?: string | undefined;
}

/**
 * The COMPLETE head for a route: the shared site defaults merged with this
 * page's own title / description / canonical and per-page Open Graph + Twitter
 * values. Declared once per route (the single head layer — see the file
 * header), so one browser HeadManager owns the whole document head.
 */
export function pageHead(opts: PageMetaOptions): HeadMetadata {
  const url = SITE.baseUrl + opts.path;
  const title = `${opts.title} · ${SITE.name}`;
  const description = opts.description ?? SITE.defaultDescription;
  return {
    ...siteDefaults(),
    ...(opts.robots !== undefined ? { robots: opts.robots } : {}),
    title,
    description,
    canonical: url,
    openGraph: {
      site_name: SITE.name,
      type: 'website',
      title,
      description,
      url,
      image: SITE.ogImage,
    },
    twitter: {
      card: SITE.twitterCard,
      title,
      description,
      image: SITE.ogImage,
    },
  };
}

