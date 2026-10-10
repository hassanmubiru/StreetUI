/**
 * StreetJS website — reusable DSL building blocks.
 *
 * Plain functions over the builder scopes (PageDSL / ContainerDSL). They are
 * composition, not a second render path: each one calls the same public
 * builder methods the rest of the app uses.
 */

import { derived, signal, type Signal, type ReadonlySignal } from 'streetui';
import type { ContainerDSL, PageDSL, Router } from 'streetui';
import type { CodeSample } from './content-types.js';
// (content.ts is the public facade; components only need the type.)
import { pageHead } from './metadata.js';
import { codeTokens, ds } from './design-system.js';
import { highlightTs } from './highlight.js';

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
    s.container(`${opts.id}-header`, (h) => {
      h.heading(opts.title, { level: 1, id: `${opts.id}-title`, class: ds.pageTitle });
      if (opts.lead !== undefined) {
        h.text(opts.lead, { id: `${opts.id}-lead`, class: ds.pageLead });
      }
    }, { id: `${opts.id}-header`, class: ds.pageHeader });
    s.container(`${opts.id}-body`, (content) => body(content), { id: `${opts.id}-body`, class: ds.pageBody });
  }, { id: `page-${opts.id}`, class: ds.pageSection });
}

/**
 * A navigation link that reflects the active route. Because the DSL `class` is
 * static (not reactive), the active and inactive forms are two mutually
 * exclusive `when()` branches sharing one id, so exactly one is ever mounted.
 * The active branch also carries a visually hidden "(active)" marker for AT.
 */
export function navLink(
  scope: ContainerDSL,
  router: Router,
  item: { label: string; href: string; id: string; exact?: boolean },
  cls: string = ds.navLinkItem,
  activeCls: string = ds.navLinkActive,
): void {
  const active = router.isActive(item.href, { exact: item.exact ?? false });
  scope.when(derived(() => !active.get()), (c) => {
    c.link(item.label, { href: item.href, id: item.id, class: cls });
  });
  scope.when(active, (c) => {
    c.link(item.label, { href: item.href, id: item.id, class: activeCls });
    c.text(' (active)', { id: `${item.id}-active`, class: ds.navActiveMark });
  });
}

/**
 * A code window: filename chrome, a copy-to-clipboard button, and the source
 * rendered as highlighted spans on the first-class builder (text is escaped at
 * the renderer boundary). Deterministic for SSR; the copy button is the only
 * browser-only behaviour and degrades to a no-op where clipboard is absent.
 */
export function codeWindow(
  scope: ContainerDSL,
  opts: { code: string; filename?: string; idBase: string },
): void {
  const { code, idBase } = opts;
  const label = signal('Copy');
  scope.container(idBase, (w) => {
    w.container(`${idBase}-bar`, (bar) => {
      bar.container(`${idBase}-dots`, (d) => {
        d.container(`${idBase}-dot0`, () => {}, { id: `${idBase}-dot0`, class: ds.codeDot });
        d.container(`${idBase}-dot1`, () => {}, { id: `${idBase}-dot1`, class: ds.codeDot });
        d.container(`${idBase}-dot2`, () => {}, { id: `${idBase}-dot2`, class: ds.codeDot });
      }, { id: `${idBase}-dots`, class: ds.codeDots });
      bar.text(opts.filename ?? 'example.ts', { id: `${idBase}-name`, class: ds.codeName });
      bar.button(label, {
        id: `${idBase}-copy`,
        class: ds.codeCopy,
        ariaLabel: 'Copy code to clipboard',
        onClick: () => {
          try {
            const nav = (globalThis as { navigator?: { clipboard?: { writeText(s: string): Promise<void> } } }).navigator;
            void nav?.clipboard?.writeText(code);
            label.set('Copied');
            setTimeout(() => label.set('Copy'), 1600);
          } catch { /* clipboard unavailable */ }
        },
      });
    }, { id: `${idBase}-bar`, class: ds.codeBar });
    w.container(`${idBase}-scroll`, (sc) => {
      sc.container(`${idBase}-src`, (pre) => {
        highlightTs(code).forEach((tok, i) => {
          pre.text(tok.text, { id: `${idBase}-t${i}`, class: codeTokens[tok.kind] });
        });
      }, { id: `${idBase}-src`, class: ds.codePre });
    }, { id: `${idBase}-scroll`, class: ds.codeScroll, tabIndex: 0, ariaLabel: 'Code sample (scrollable)' });
  }, { id: idBase, class: ds.codeWindow });
}

/**
 * A labelled code block — now a titled code window. Kept name/signature so
 * routes are unchanged.
 */
export function codeExample(scope: ContainerDSL, sample: CodeSample, idBase: string): void {
  const filename = sample.label.length > 0 ? sample.label : undefined;
  const windowOpts: { code: string; filename?: string; idBase: string } = { code: sample.code, idBase };
  if (filename !== undefined) windowOpts.filename = filename;
  codeWindow(scope, windowOpts);
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
