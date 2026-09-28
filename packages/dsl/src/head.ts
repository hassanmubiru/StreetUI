/**
 * Document head / metadata model (2.0 §1–§3).
 *
 * `head({...})` is a first-class StreetUI primitive for declaring document
 * metadata — title, meta, link, canonical, Open Graph, Twitter/X, robots,
 * theme-color and favicon. It is NOT a copy of another framework's API: it is
 * expressed on StreetUI's own component/graph model. A `head()` call creates a
 * `'head'` graph node (rendered as a neutral inline anchor, like a portal) and
 * registers a `__head__<nodeId>` descriptor — exactly the handler-registry
 * convention used by `__overlay__`/`__transition__`/`__component__`. The
 * renderer reads that descriptor to:
 *
 *   • apply the contribution to `document.head` on the browser
 *     (`wireHeadBehavior`), adopting server-emitted tags on hydration so there
 *     are no duplicates, and cleaning up its own tags on unmount / route change;
 *   • emit only the active graph's merged metadata as an HTML string on the
 *     server (`renderHead`).
 *
 * This module is pure and DOM-free (like `transition.ts`): it defines the config
 * shape and normalises it into an ordered list of {@link HeadEntry} with stable
 * *dedup keys*. All merge/precedence/DOM work happens in the renderer, keyed by
 * these entries.
 *
 * ── Deduplication & precedence (§3) ──────────────────────────────────────────
 * Every entry carries a `dedupKey`. When several `head()` nodes are live at once
 * (e.g. an app-level default, a route-level `head()`, and a component-level
 * `head()`), the renderer merges all of their entries and, for each `dedupKey`,
 * the LAST contribution in document order wins. Document order is pre-order DFS
 * = mount order, so a `head()` declared deeper/later (a route or a component
 * nested inside the app shell) deterministically overrides an app-level default
 * for the same key. Removing that node (navigating away, unmounting the
 * component) re-exposes the previously-shadowed default. `<title>` and each
 * single-instance meta/link (description, robots, theme-color, viewport,
 * charset, canonical, favicon, and each og: or twitter: property) collapse to one
 * effective tag; generic `meta[]`/`link[]` array entries are keyed by their
 * identifying attributes so independent tags coexist.
 */

import type { ReadonlySignal, Signal } from '@streetui/state';

/** A head value that may be a literal string or a reactive signal of a string. */
export type BindableString = string | ReadonlySignal<string> | Signal<string>;

/** A single `<meta>` descriptor. Provide exactly one identifying key. */
export interface MetaDescriptor {
  /** `name="…"` (e.g. "description", "robots", "theme-color", "twitter:card"). */
  readonly name?: string;
  /** `property="…"` (e.g. "og:title", "og:image") — the Open Graph convention. */
  readonly property?: string;
  /** `http-equiv="…"` (e.g. "content-security-policy"). */
  readonly httpEquiv?: string;
  /** `charset="…"` (e.g. "utf-8"). Standalone; no `content`. */
  readonly charset?: string;
  /** The tag's `content`. May be reactive. */
  readonly content?: BindableString;
}

/** A single `<link>` descriptor. `rel`+`href` identify it. */
export interface LinkDescriptor {
  readonly rel: string;
  readonly href: string;
  readonly sizes?: string;
  readonly type?: string;
  readonly media?: string;
  readonly as?: string;
  readonly crossorigin?: string;
  readonly hreflang?: string;
}

/**
 * Declarative document metadata. Every field is optional; convenience fields
 * (title/description/canonical/robots/themeColor/viewport/charset/favicon/
 * openGraph/twitter) expand into the same normalized entries as the raw
 * `meta`/`link` arrays, with single-instance dedup keys so a later `head()`
 * cleanly overrides an earlier one.
 */
export interface HeadMetadata {
  /** `<title>` text. May be reactive. Single-instance (dedup key `title`). */
  readonly title?: BindableString;
  /** `<meta name="description">`. May be reactive. */
  readonly description?: BindableString;
  /** `<link rel="canonical">` href. */
  readonly canonical?: string;
  /** `<meta name="robots">` (e.g. "index,follow" / "noindex"). */
  readonly robots?: string;
  /** `<meta name="theme-color">`. */
  readonly themeColor?: string;
  /** `<meta name="viewport">`. */
  readonly viewport?: string;
  /** `<meta charset>`. */
  readonly charset?: string;
  /** Favicon: a shorthand for `<link rel="icon">`. String = href, or a full descriptor. */
  readonly favicon?: string | LinkDescriptor;
  /** Open Graph properties — each key `k` becomes `<meta property="og:k">`. Values may be reactive. */
  readonly openGraph?: Readonly<Record<string, BindableString>>;
  /** Twitter/X card properties — each key `k` becomes `<meta name="twitter:k">`. Values may be reactive. */
  readonly twitter?: Readonly<Record<string, BindableString>>;
  /** Raw `<meta>` tags (for anything the convenience fields don't cover). */
  readonly meta?: readonly MetaDescriptor[];
  /** Raw `<link>` tags (stylesheets, preload, alternate, etc.). */
  readonly link?: readonly LinkDescriptor[];
  /** `<base href>` — single-instance. */
  readonly base?: string;
}

/**
 * A normalized head tag: one `<title>`, `<meta>`, `<link>` or `<base>`. Attr
 * values and the title's text may still be reactive (`BindableString`); the
 * renderer peeks them for SSR and subscribes to them on the browser. `dedupKey`
 * is what the merge collapses on.
 */
export interface HeadEntry {
  readonly tag: 'title' | 'meta' | 'link' | 'base';
  readonly dedupKey: string;
  /** Static + reactive attributes (no `undefined` values). */
  readonly attrs: Readonly<Record<string, BindableString>>;
  /** Text content — only meaningful for `tag === 'title'`. */
  readonly text?: BindableString;
}

/** The value a `__head__<id>` handler returns: this node's ordered contribution. */
export interface HeadContribution {
  readonly entries: readonly HeadEntry[];
}

function metaDedupKey(m: MetaDescriptor): string | undefined {
  if (m.charset !== undefined) return 'meta:charset';
  if (m.name !== undefined) return `meta:name=${m.name}`;
  if (m.property !== undefined) return `meta:property=${m.property}`;
  if (m.httpEquiv !== undefined) return `meta:http-equiv=${m.httpEquiv}`;
  return undefined;
}

function metaAttrs(m: MetaDescriptor): Record<string, BindableString> {
  const attrs: Record<string, BindableString> = {};
  if (m.charset !== undefined) attrs['charset'] = m.charset;
  if (m.name !== undefined) attrs['name'] = m.name;
  if (m.property !== undefined) attrs['property'] = m.property;
  if (m.httpEquiv !== undefined) attrs['http-equiv'] = m.httpEquiv;
  if (m.content !== undefined) attrs['content'] = m.content;
  return attrs;
}

function linkAttrs(l: LinkDescriptor): Record<string, BindableString> {
  const attrs: Record<string, BindableString> = { rel: l.rel, href: l.href };
  if (l.sizes !== undefined) attrs['sizes'] = l.sizes;
  if (l.type !== undefined) attrs['type'] = l.type;
  if (l.media !== undefined) attrs['media'] = l.media;
  if (l.as !== undefined) attrs['as'] = l.as;
  if (l.crossorigin !== undefined) attrs['crossorigin'] = l.crossorigin;
  if (l.hreflang !== undefined) attrs['hreflang'] = l.hreflang;
  return attrs;
}

/**
 * Normalise a {@link HeadMetadata} into an ordered list of {@link HeadEntry}.
 * Emission order within one `head()` is: charset → base → title → description →
 * canonical → robots → theme-color → viewport → favicon → openGraph → twitter →
 * explicit meta[] → explicit link[]. (Merge across nodes is document order; this
 * per-node order only affects the sequence of same-priority tags.)
 */
export function resolveHead(config: HeadMetadata): HeadContribution {
  const entries: HeadEntry[] = [];

  if (config.charset !== undefined) {
    entries.push({ tag: 'meta', dedupKey: 'meta:charset', attrs: { charset: config.charset } });
  }
  if (config.base !== undefined) {
    entries.push({ tag: 'base', dedupKey: 'base', attrs: { href: config.base } });
  }
  if (config.title !== undefined) {
    entries.push({ tag: 'title', dedupKey: 'title', attrs: {}, text: config.title });
  }
  if (config.description !== undefined) {
    entries.push({
      tag: 'meta',
      dedupKey: 'meta:name=description',
      attrs: { name: 'description', content: config.description },
    });
  }
  if (config.canonical !== undefined) {
    entries.push({
      tag: 'link',
      dedupKey: 'link:rel=canonical',
      attrs: { rel: 'canonical', href: config.canonical },
    });
  }
  if (config.robots !== undefined) {
    entries.push({
      tag: 'meta',
      dedupKey: 'meta:name=robots',
      attrs: { name: 'robots', content: config.robots },
    });
  }
  if (config.themeColor !== undefined) {
    entries.push({
      tag: 'meta',
      dedupKey: 'meta:name=theme-color',
      attrs: { name: 'theme-color', content: config.themeColor },
    });
  }
  if (config.viewport !== undefined) {
    entries.push({
      tag: 'meta',
      dedupKey: 'meta:name=viewport',
      attrs: { name: 'viewport', content: config.viewport },
    });
  }
  if (config.favicon !== undefined) {
    const l: LinkDescriptor =
      typeof config.favicon === 'string' ? { rel: 'icon', href: config.favicon } : config.favicon;
    // Favicons are single-instance by rel (rel=icon), so a later head() replaces
    // an earlier icon rather than stacking a second one.
    entries.push({ tag: 'link', dedupKey: `link:rel=${l.rel}`, attrs: linkAttrs(l) });
  }
  if (config.openGraph !== undefined) {
    for (const key of Object.keys(config.openGraph)) {
      const property = `og:${key}`;
      entries.push({
        tag: 'meta',
        dedupKey: `meta:property=${property}`,
        attrs: { property, content: config.openGraph[key]! },
      });
    }
  }
  if (config.twitter !== undefined) {
    for (const key of Object.keys(config.twitter)) {
      const name = `twitter:${key}`;
      entries.push({
        tag: 'meta',
        dedupKey: `meta:name=${name}`,
        attrs: { name, content: config.twitter[key]! },
      });
    }
  }
  if (config.meta !== undefined) {
    for (const m of config.meta) {
      const key = metaDedupKey(m);
      if (key === undefined) continue; // a meta with no identifying attribute is dropped
      entries.push({ tag: 'meta', dedupKey: key, attrs: metaAttrs(m) });
    }
  }
  if (config.link !== undefined) {
    for (const l of config.link) {
      // Generic links are keyed by rel+href so multiple independent links coexist
      // (unlike canonical/icon which are single-instance by rel).
      entries.push({ tag: 'link', dedupKey: `link:rel=${l.rel}:href=${l.href}`, attrs: linkAttrs(l) });
    }
  }

  return { entries };
}

/** Runtime brand check for a head-contribution descriptor value. */
export function isHeadContribution(value: unknown): value is HeadContribution {
  return (
    value !== null &&
    typeof value === 'object' &&
    Array.isArray((value as Record<string, unknown>)['entries'])
  );
}
