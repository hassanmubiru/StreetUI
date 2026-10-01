/**
 * StreetUI Website — reusable DSL building blocks.
 *
 * These are plain functions over the builder scopes (PageDSL / ContainerDSL).
 * They are composition, not a second render path: each one just calls the same
 * public builder methods the rest of the app uses. Keeping them here avoids
 * repeating the shell/layout/code-block structure in every route.
 */

import { derived, type Signal, type ReadonlySignal } from 'streetui';
import type { ContainerDSL, PageDSL, Router } from 'streetui';
import type { CodeSample } from './content.js';
import { pageHead } from './metadata.js';

/**
 * A consistent page shell: a titled landmark `<section>` wrapping a content
 * container the caller fills. Used by every route for a predictable heading
 * structure (one h1 per page) and a stable `#page-*` / `#*-body` id scheme.
 *
 * When `path` is supplied the layout also declares the page's SEO metadata via
 * `page.head(...)` (title/description/canonical/Open Graph/Twitter), which
 * overrides the shell's site-wide defaults for this route (Phase 6). `description`
 * defaults to `lead` when omitted so the human-visible lead and the meta
 * description stay in agreement.
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
    s.heading(opts.title, { level: 1, id: `${opts.id}-title` });
    if (opts.lead !== undefined) {
      s.text(opts.lead, { id: `${opts.id}-lead` });
    }
    s.container(`${opts.id}-body`, (content) => body(content), { id: `${opts.id}-body` });
  }, { id: `page-${opts.id}` });
}

/**
 * A navigation link that renders an "(active)" marker when its route is active.
 * The marker is driven by router.isActive(...) — a real StreetUI signal — and
 * mounted/removed by when(), so no manual class toggling is needed.
 */
export function navLink(
  scope: ContainerDSL,
  router: Router,
  item: { label: string; href: string; id: string; exact?: boolean },
): void {
  scope.link(item.label, { href: item.href, id: item.id });
  scope.when(router.isActive(item.href, { exact: item.exact ?? false }), (c) => {
    c.text(' (active)', { id: `${item.id}-active` });
  });
}

/**
 * A labeled code block built on StreetUI's first-class `code()` primitive. The
 * label is a `text` node; the source renders as a semantic `<pre><code>` via
 * `code(...)`, which preserves whitespace and escapes the source at the
 * renderer boundary (no raw-HTML injection). An optional `language` hint is
 * forwarded as `data-language` on the `<pre>` for styling / highlighting hooks.
 */
export function codeExample(scope: ContainerDSL, sample: CodeSample, idBase: string): void {
  scope.container(idBase, (c) => {
    c.text(sample.label, { id: `${idBase}-label` });
    const codeOpts: { id: string; language?: string } = { id: `${idBase}-src` };
    if (sample.language !== undefined) codeOpts.language = sample.language;
    c.code(sample.code, codeOpts);
  }, { id: `${idBase}` });
}

/**
 * A breadcrumb trail (Home / Docs / <section>). Pure links; the final crumb is
 * plain text (the current page).
 */
export function breadcrumb(
  scope: ContainerDSL,
  trail: readonly { label: string; href?: string }[],
  idBase: string,
): void {
  scope.container(idBase, (c) => {
    trail.forEach((crumb, i) => {
      if (crumb.href !== undefined) {
        c.link(crumb.label, { href: crumb.href, id: `${idBase}-${i}` });
      } else {
        c.text(crumb.label, { id: `${idBase}-${i}` });
      }
    });
  }, { id: idBase });
}

/** Render a value or signal of text, choosing a stable id. */
export function note(scope: ContainerDSL, value: string | Signal<string>, id: string): void {
  scope.text(value, { id });
}

/** A derived "N results" style count label. */
export function countLabel(source: Signal<{ length: number }>, noun: string): ReadonlySignal<string> {
  return derived(() => {
    const n = source.get().length;
    return `${n} ${noun}${n === 1 ? '' : 's'}`;
  });
}
