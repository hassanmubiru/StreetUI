/**
 * StreetJS website — reusable DSL building blocks.
 *
 * Plain functions over the builder scopes (PageDSL / ContainerDSL). They are
 * composition, not a second render path: each one calls the same public
 * builder methods the rest of the app uses.
 */

import { derived, type Signal, type ReadonlySignal } from 'streetui';
import type { ContainerDSL, PageDSL, Router } from 'streetui';
import type { CodeSample } from './content-types.js';
// (content.ts is the public facade; components only need the type.)
import { pageHead } from './metadata.js';
import { ds } from './design-system.js';

/**
 * A consistent page shell: a titled landmark `<section>` wrapping a content
 * container the caller fills. One h1 per page, stable `#page-*` / `#*-body`
 * ids. When `path` is supplied the layout declares the page's COMPLETE head
 * (title / description / canonical / robots / Open Graph / Twitter) once, at
 * the route layer (StreetUI finding F-7: never a second head layer).
 */
export function pageLayout(
  page: PageDSL,
  opts: {
    id: string;
    title: string;
    lead?: string | undefined;
    path?: string | undefined;
    description?: string | undefined;
    robots?: string | undefined;
  },
  body: (content: ContainerDSL) => void,
): void {
  if (opts.path !== undefined) {
    page.head(
      pageHead({
        title: opts.title,
        description: opts.description ?? opts.lead,
        path: opts.path,
        robots: opts.robots,
      }),
    );
  }
  page.section(opts.id, (s) => {
    s.heading(opts.title, { level: 1, id: `${opts.id}-title`, class: ds.pageTitle });
    if (opts.lead !== undefined) {
      s.text(opts.lead, { id: `${opts.id}-lead`, class: ds.pageLead });
    }
    s.container(`${opts.id}-body`, (content) => body(content), { id: `${opts.id}-body`, class: ds.pageBody });
  }, { id: `page-${opts.id}`, class: ds.pageSection });
}

/**
 * A navigation link that carries a visually hidden "(active)" marker while its
 * route is active. Driven by `router.isActive(...)` (a real signal) and
 * mounted/removed by `when()`.
 */
export function navLink(
  scope: ContainerDSL,
  router: Router,
  item: { label: string; href: string; id: string; exact?: boolean },
  cls: string = ds.navLinkItem,
): void {
  scope.link(item.label, { href: item.href, id: item.id, class: cls });
  scope.when(router.isActive(item.href, { exact: item.exact ?? false }), (c) => {
    c.text(' (active)', { id: `${item.id}-active`, class: ds.navActiveMark });
  });
}

/**
 * A labelled code block on the first-class `code()` primitive: semantic
 * `<pre><code>`, whitespace preserved, source escaped at the renderer boundary.
 */
export function codeExample(scope: ContainerDSL, sample: CodeSample, idBase: string): void {
  scope.container(idBase, (c) => {
    c.text(sample.label, { id: `${idBase}-label`, class: ds.codeLabel });
    const codeOpts: { id: string; language?: string; class: string } = { id: `${idBase}-src`, class: ds.codeSurface };
    if (sample.language !== undefined) codeOpts.language = sample.language;
    c.code(sample.code, codeOpts);
  }, { id: idBase, class: ds.codeBlock });
}

/** Breadcrumb trail; the final crumb (no href) is plain text. */
export function breadcrumb(
  scope: ContainerDSL,
  trail: readonly { label: string; href?: string }[],
  idBase: string,
): void {
  scope.container(idBase, (c) => {
    trail.forEach((crumb, i) => {
      if (crumb.href !== undefined) {
        c.link(crumb.label, { href: crumb.href, id: `${idBase}-${i}`, class: ds.breadcrumbLink });
      } else {
        c.text(crumb.label, { id: `${idBase}-${i}`, class: ds.breadcrumbCurrent });
      }
    });
  }, { id: idBase, class: ds.breadcrumbTrail });
}

/**
 * The provenance notice shown on every content page. StreetJS source was not
 * available to this site's authors, so facts are recorded from the v1.2.8
 * type declarations and must be re-verified against the installed version.
 */
export const PROVENANCE_TEXT =
  'Recorded from the StreetJS v1.2.8 type declarations. Verify against your installed version before relying on it.';

export function provenanceNotice(scope: ContainerDSL, idBase: string): void {
  scope.container(idBase, (c) => {
    c.text(PROVENANCE_TEXT, { id: `${idBase}-text` });
  }, { id: idBase, class: ds.notice, role: 'note' });
}

/** A small badge row of tags. */
export function tagRow(scope: ContainerDSL, tags: readonly string[], idBase: string): void {
  scope.container(idBase, (c) => {
    tags.forEach((tag, i) => c.text(tag, { id: `${idBase}-${i}`, class: ds.badge }));
  }, { id: idBase, class: ds.badgeRow });
}

/** A derived "N results" style count label. */
export function countLabel(source: Signal<{ length: number }>, noun: string): ReadonlySignal<string> {
  return derived(() => {
    const n = source.get().length;
    return `${n} ${noun}${n === 1 ? '' : 's'}`;
  });
}
