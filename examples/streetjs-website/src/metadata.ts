/**
 * StreetJS website — document metadata.
 *
 * One COMPLETE head per route, declared with StreetUI's first-class `head()`
 * (via `pageLayout` in components.ts). Do not add a second head layer in the
 * shell: mountRouter renders the shell and each route in separate render
 * contexts, and the browser HeadManager is scoped per context, so two layers do
 * not merge (StreetUI finding F-7).
 *
 * CANONICAL ORIGIN: there is no verified production domain for this site. The
 * base URL is therefore a *configurable placeholder* on a reserved `.example`
 * host. Call `configureSite({ baseUrl })` (the SSR server does this from the
 * `SITE_URL` environment variable) before rendering; canonical and Open Graph
 * URLs follow. No og:image is declared because no verified image asset exists.
 */

import type { HeadMetadata } from 'streetui';

/** Placeholder origin — replace via SITE_URL / configureSite() on deploy. */
export const PLACEHOLDER_BASE_URL = 'https://streetjs.example';

export const SITE = {
  name: 'StreetJS',
  defaultTitle: 'StreetJS — production-grade TypeScript backend framework',
  defaultDescription:
    'StreetJS is a TypeScript backend framework with a native PostgreSQL wire driver, JWT, WebSockets, clustering, runtime input validation and field-level encryption. No Express. No pg. No Prisma.',
  themeColor: '#0f1419',
  twitterCard: 'summary',
  /** The only upstream documentation URL recorded for StreetJS. */
  docsUrl: 'https://hassanmubiru.github.io/StreetJS/',
  /** The only StreetJS version these pages were verified against. */
  version: '1.2.8',
} as const;

let baseUrl: string = PLACEHOLDER_BASE_URL;

/** Set the canonical origin (no trailing slash). Idempotent. */
export function configureSite(options: { baseUrl: string }): void {
  baseUrl = options.baseUrl.replace(/\/+$/, '');
}

/** The current canonical origin. */
export function siteBaseUrl(): string {
  return baseUrl;
}

function siteDefaults(): HeadMetadata {
  return {
    charset: 'utf-8',
    viewport: 'width=device-width, initial-scale=1',
    robots: 'index,follow',
    themeColor: SITE.themeColor,
    favicon: '/favicon.svg',
  };
}

export interface PageMetaOptions {
  /** The page's own title (without the site suffix). */
  readonly title: string;
  /** The page's description (<= ~160 chars). Falls back to the site default. */
  readonly description?: string | undefined;
  /** The route path for the canonical URL (e.g. '/docs/http'). */
  readonly path: string;
  /** Override the default 'index,follow' (e.g. 'noindex' for 404). */
  readonly robots?: string | undefined;
}

/** Truncate a description to a meta-friendly length without cutting words. */
export function metaDescription(text: string, max = 160): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return (space > 80 ? cut.slice(0, space) : cut).replace(/[.,;:\s]+$/, '') + '…';
}

/** The complete head for a route. */
export function pageHead(opts: PageMetaOptions): HeadMetadata {
  const url = baseUrl + (opts.path === '/' ? '/' : opts.path);
  const isHome = opts.path === '/';
  const title = isHome ? SITE.defaultTitle : `${opts.title} · ${SITE.name}`;
  const description = metaDescription(opts.description ?? SITE.defaultDescription);
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
    },
    twitter: {
      card: SITE.twitterCard,
      title,
      description,
    },
  };
}
