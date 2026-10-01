/**
 * StreetUI Website — metadata pure-function unit suite (Phase 6, v2.6).
 *
 * Unit-level coverage for the SEO metadata helpers in `./metadata.ts`, exercised
 * in isolation from the renderer: given options in, a well-formed `HeadMetadata`
 * out. The SSR serialisation and client application of this metadata are covered
 * by `website-seo.test.ts`; this file pins the pure composition rules the site
 * depends on (title suffixing, canonical URL construction, description fallback,
 * Open Graph / Twitter mirroring, and conditional robots).
 */
import { describe, it, expect } from 'vitest';
import { SITE, siteHead, pageHead } from './metadata.js';

describe('metadata — siteHead() app-level defaults', () => {
  it('declares a complete, valid default head', () => {
    const head = siteHead();
    expect(head.charset).toBe('utf-8');
    expect(head.viewport).toContain('width=device-width');
    expect(head.title).toBe(SITE.defaultTitle);
    expect(head.description).toBe(SITE.defaultDescription);
    expect(head.robots).toBe('index,follow');
    expect(head.themeColor).toBe(SITE.themeColor);
    expect(head.favicon).toBe('/favicon.svg');
    expect(head.canonical).toBe(SITE.baseUrl + '/');
  });

  it('carries site-wide Open Graph and Twitter card fields', () => {
    const head = siteHead();
    expect(head.openGraph?.site_name).toBe(SITE.name);
    expect(head.openGraph?.type).toBe('website');
    expect(head.openGraph?.url).toBe(SITE.baseUrl + '/');
    expect(head.openGraph?.image).toBe(SITE.ogImage);
    expect(head.twitter?.card).toBe(SITE.twitterCard);
    expect(head.twitter?.image).toBe(SITE.ogImage);
  });
});

describe('metadata — pageHead() per-route complete head', () => {
  it('suffixes the title with the site name', () => {
    expect(pageHead({ title: 'Docs', path: '/docs' }).title).toBe(`Docs · ${SITE.name}`);
  });

  it('includes the shared site defaults (single head layer)', () => {
    const head = pageHead({ title: 'Docs', path: '/docs' });
    expect(head.charset).toBe('utf-8');
    expect(head.viewport).toContain('width=device-width');
    expect(head.themeColor).toBe(SITE.themeColor);
    expect(head.favicon).toBe('/favicon.svg');
    expect(head.openGraph?.site_name).toBe(SITE.name);
    expect(head.twitter?.card).toBe(SITE.twitterCard);
  });

  it('builds the canonical and og:url from baseUrl + path', () => {
    const head = pageHead({ title: 'Core Concepts', path: '/docs/core-concepts' });
    const url = SITE.baseUrl + '/docs/core-concepts';
    expect(head.canonical).toBe(url);
    expect(head.openGraph?.url).toBe(url);
  });

  it('falls back to the site default description when none is given', () => {
    expect(pageHead({ title: 'Blog', path: '/blog' }).description).toBe(
      SITE.defaultDescription,
    );
  });

  it('uses the supplied description for title/description across OG and Twitter', () => {
    const head = pageHead({ title: 'About', description: 'About the project', path: '/about' });
    expect(head.description).toBe('About the project');
    expect(head.openGraph?.description).toBe('About the project');
    expect(head.openGraph?.title).toBe(`About · ${SITE.name}`);
    expect(head.twitter?.description).toBe('About the project');
    expect(head.twitter?.title).toBe(`About · ${SITE.name}`);
  });

  it('defaults robots to index,follow and honours a noindex override', () => {
    expect(pageHead({ title: 'Home', path: '/' }).robots).toBe('index,follow');
    expect(pageHead({ title: 'Not found', path: '/x', robots: 'noindex' }).robots).toBe(
      'noindex',
    );
  });
});
