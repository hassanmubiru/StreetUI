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

/**
 * A consistent page shell: a titled landmark `<section>` wrapping a content
 * container the caller fills. Used by every route for a predictable heading
 * structure (one h1 per page) and a stable `#page-*` / `#*-body` id scheme.
 */
export function pageLayout(
  page: PageDSL,
  opts: { id: string; title: string; lead?: string | undefined },
  body: (content: ContainerDSL) => void,
): void {
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
 * A labeled code block. StreetUI has no first-class preformatted/code node, so
 * this composes a container + a label + the source as text; styling (monospace,
 * wrapping) is CSS on the `code-sample`/`code-sample-src` ids. The source is
 * passed through text() which escapes at the renderer boundary.
 */
export function codeExample(scope: ContainerDSL, sample: CodeSample, idBase: string): void {
  scope.container(idBase, (c) => {
    c.text(sample.label, { id: `${idBase}-label` });
    c.text(sample.code, { id: `${idBase}-src` });
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
export function countLabel(source: Signal<{ length: number }>, noun: string): Signal<string> {
  return derived(() => {
    const n = source.get().length;
    return `${n} ${noun}${n === 1 ? '' : 's'}`;
  });
}
