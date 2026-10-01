/**
 * StreetUI Website — SEO / document metadata (Phase 6, v2.6).
 *
 * The website declares its metadata with StreetUI's own first-class `head()`
 * primitive — the same graph/handler model as the rest of the app, NOT a
 * bolt-on. There are two layers, merged by `head()`'s document-order rule
 * (last-in-document-order wins per dedup key):
 *
 *   • {@link siteHead} — an app-level default declared once in the shell
 *     (charset, viewport, robots, theme-color, favicon, a default title /
 *     description, and the site-wide Open Graph / Twitter card fields).
 *   • {@link pageHead} — a per-route override declared by each page via
 *     `pageLayout`, carrying that page's own title, description, canonical URL
 *     and per-page Open Graph / Twitter values.
 *
 * Because the shell is emitted before the route outlet in document order, the
 * route's `pageHead()` deterministically overrides the shell default for the
 * keys it sets, while inheriting the rest. On the server `renderHead(compiled)`
 * serialises the merged result into `<head>`; on the client the same metadata
 * is applied to `document.head` and server tags are adopted on hydration.
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
 * App-level default metadata. Declared once by the shell so every route starts
 * from a complete, valid head and route pages only override what differs.
 */
export function siteHead(): HeadMetadata {
  return {
    charset: 'utf-8',
    viewport: 'width=device-width, initial-scale=1',
    title: SITE.defaultTitle,
    description: SITE.defaultDescription,
    robots: 'index,follow',
    themeColor: SITE.themeColor,
    favicon: '/favicon.svg',
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
 * Per-route metadata that overrides the site defaults. Title is suffixed with
 * the site name; canonical / og:url are the absolute URL for this path.
 */
export function pageHead(opts: PageMetaOptions): HeadMetadata {
  const url = SITE.baseUrl + opts.path;
  const title = `${opts.title} · ${SITE.name}`;
  const description = opts.description ?? SITE.defaultDescription;
  const meta: HeadMetadata = {
    title,
    description,
    canonical: url,
    openGraph: { type: 'website', title, description, url, image: SITE.ogImage },
    twitter: { card: SITE.twitterCard, title, description, image: SITE.ogImage },
  };
  return opts.robots !== undefined ? { ...meta, robots: opts.robots } : meta;
}
