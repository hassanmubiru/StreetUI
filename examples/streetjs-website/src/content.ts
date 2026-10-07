/**
 * StreetJS website — content facade: navigation, lookups and the global
 * search index. Everything searchable is derived from the typed content
 * modules, so the index cannot drift from the pages.
 */

import type { NavItem, SearchDoc } from './content-types.js';
import { DOCS, GUIDES } from './content-docs.js';
import { API_GROUPS, BLOG_POSTS, CHANGELOG, EXAMPLES, PLUGINS } from './content-reference.js';

export type {
  ApiEntry, ApiGroup, BlogPost, Block, ChangelogEntry, CodeSample, DocPage,
  ExampleItem, GuidePage, NavItem, PluginItem, SearchDoc, SearchKind,
} from './content-types.js';
export { DOCS, GUIDES, DOC_GROUPS } from './content-docs.js';
export {
  ABOUT_FACTS, ABOUT_UNVERIFIED, API_GROUPS, BLOG_POSTS, CHANGELOG, EXAMPLES, PLUGINS, PLUGINS_NOTE,
} from './content-reference.js';

export const PRIMARY_NAV: readonly NavItem[] = [
  { label: 'Getting started', href: '/getting-started', id: 'nav-getting-started' },
  { label: 'Docs', href: '/docs', id: 'nav-docs' },
  { label: 'Guides', href: '/guides', id: 'nav-guides' },
  { label: 'API', href: '/api', id: 'nav-api' },
  { label: 'Examples', href: '/examples', id: 'nav-examples' },
  { label: 'Playground', href: '/playground', id: 'nav-playground' },
  { label: 'Plugins', href: '/plugins', id: 'nav-plugins' },
  { label: 'Changelog', href: '/changelog', id: 'nav-changelog' },
  { label: 'Blog', href: '/blog', id: 'nav-blog' },
  { label: 'About', href: '/about', id: 'nav-about' },
];

export const docBySlug = (slug: string) => DOCS.find((d) => d.slug === slug);
export const guideBySlug = (slug: string) => GUIDES.find((g) => g.slug === slug);
export const postBySlug = (slug: string) => BLOG_POSTS.find((b) => b.slug === slug);

/** The previous / next doc in reading order. */
export function docNeighbours(slug: string): { prev?: (typeof DOCS)[number]; next?: (typeof DOCS)[number] } {
  const i = DOCS.findIndex((d) => d.slug === slug);
  const out: { prev?: (typeof DOCS)[number]; next?: (typeof DOCS)[number] } = {};
  const prev = DOCS[i - 1];
  const next = DOCS[i + 1];
  if (i > 0 && prev !== undefined) out.prev = prev;
  if (i >= 0 && next !== undefined) out.next = next;
  return out;
}

const PAGES: readonly SearchDoc[] = [
  { title: 'Getting started', kind: 'Page', href: '/getting-started', summary: 'Install StreetJS and run a first server.', keywords: 'install npm begin tutorial quickstart' },
  { title: 'Playground', kind: 'Page', href: '/playground', summary: 'Interactive tools built on StreetUI.', keywords: 'try decoder migration secret health probe' },
  { title: 'About', kind: 'Page', href: '/about', summary: 'What StreetJS is and what this site can and cannot claim.', keywords: 'about project facts' },
];

export const SEARCH_INDEX: readonly SearchDoc[] = [
  ...PAGES,
  ...DOCS.map((d): SearchDoc => ({
    title: d.title, kind: 'Docs', href: `/docs/${d.slug}`, summary: d.summary,
    keywords: `${d.group} ${d.blocks.map((b) => ('text' in b ? b.text : 'items' in b ? b.items.join(' ') : b.sample.code)).join(' ')}`,
  })),
  ...GUIDES.map((g): SearchDoc => ({
    title: g.title, kind: 'Guide', href: `/guides/${g.slug}`, summary: g.summary,
    keywords: `${g.level} ${g.blocks.map((b) => ('text' in b ? b.text : 'items' in b ? b.items.join(' ') : b.sample.code)).join(' ')}`,
  })),
  ...API_GROUPS.map((a): SearchDoc => ({
    title: a.title, kind: 'API', href: '/api', summary: `${a.importPath} — ${a.summary}`,
    keywords: a.entries.map((e) => `${e.name} ${e.signature} ${e.note}`).join(' '),
  })),
  ...EXAMPLES.map((e): SearchDoc => ({
    title: e.title, kind: 'Example', href: '/examples', summary: e.summary, keywords: e.sample.code,
  })),
  ...PLUGINS.map((x): SearchDoc => ({
    title: x.title, kind: 'Plugin', href: '/plugins', summary: x.summary, keywords: x.status,
  })),
  ...CHANGELOG.map((c): SearchDoc => ({
    title: `Version ${c.version}`, kind: 'Changelog', href: '/changelog', summary: c.summary, keywords: c.items.join(' '),
  })),
  ...BLOG_POSTS.map((b): SearchDoc => ({
    title: b.title, kind: 'Blog', href: `/blog/${b.slug}`, summary: b.summary,
    keywords: `${b.tag} ${b.blocks.map((x) => ('text' in x ? x.text : 'items' in x ? x.items.join(' ') : x.sample.code)).join(' ')}`,
  })),
];

/**
 * Case-insensitive AND search. Every whitespace-separated term must appear in
 * the title, summary or keywords. Ranking: title hits (3) > summary (2) >
 * keywords (1), ties keep index order. An empty query yields no results.
 */
export function searchContent(query: string, index: readonly SearchDoc[] = SEARCH_INDEX, limit = 12): SearchDoc[] {
  const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 0);
  if (terms.length === 0) return [];
  const scored: { doc: SearchDoc; score: number; order: number }[] = [];
  index.forEach((doc, order) => {
    const title = doc.title.toLowerCase();
    const summary = doc.summary.toLowerCase();
    const keywords = doc.keywords.toLowerCase();
    let score = 0;
    for (const term of terms) {
      if (title.includes(term)) score += 3;
      else if (summary.includes(term)) score += 2;
      else if (keywords.includes(term)) score += 1;
      else return; // AND semantics
    }
    scored.push({ doc, score, order });
  });
  scored.sort((a, b) => b.score - a.score || a.order - b.order);
  return scored.slice(0, limit).map((s) => s.doc);
}
