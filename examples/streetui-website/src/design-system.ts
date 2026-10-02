/**
 * StreetUI Website — design system (v2.7 styling migration, §25–§27).
 *
 * This module is the single source of every visual class the website uses. It
 * is built ENTIRELY on StreetUI's public styling API — `style`, `layout`,
 * `text`, `form`, `a11y`, `overlay`, `cx` and the design `tokens` — with no CSS
 * file, no utility-class framework and no second styling system. Each export is
 * a deduplicated class token (a plain string) suitable to pass as the `class`
 * option to any DSL builder; the builder forwards it onto the node's
 * `props.class` (the migration seam).
 *
 * SSR DETERMINISM (§15/§16): every token below is computed at *module load*, so
 * importing this module registers the complete rule set into the shared
 * `styleRegistry` up front. Because routes only *reference* these pre-registered
 * tokens (they never call `style()` with a fresh definition at render time), the
 * serialized stylesheet is identical for every route regardless of which one is
 * rendered first — a stable, byte-reproducible sheet.
 *
 * THEMING (§6/§7): all colour/space/type values are design tokens
 * (`tokens.ref.*` → `var(--…)`). Dark mode re-points the variables via a single
 * `data-theme` flip; nothing here is duplicated per theme.
 */

import { style, cx, layout, text, form, a11y, tokens } from 'streetui';

const t = tokens.ref;

// ── Document & page scaffolding ────────────────────────────────────────────

/** The app root: full-height column, token background + base body type. */
export const appRoot = cx(
  layout.stack({ gap: '0' }),
  style({
    minHeight: '100vh',
    background: t.surface.background,
    color: t.content.primary,
    fontFamily: t.font.sans,
    fontSize: t.size.md,
    lineHeight: t.leading.normal,
  }),
);

/** Width-capped, centered content column reused by every landmark. */
export const pageContainer = layout.container({ max: 1120, padX: '5' });

/** A route <section> landmark: vertical rhythm + top/bottom breathing room. */
export const pageSection = cx(
  pageContainer,
  layout.stack({ gap: '5' }),
  style({ paddingTop: t.space['8'], paddingBottom: t.space['8'] }),
);

/** The body container inside a section — a comfortable reading stack. */
export const pageBody = layout.stack({ gap: '5' });

/** The page h1. */
export const pageTitle = text.heading({ level: 1 });

/** The lead paragraph under the page title (muted, measured for reading). */
export const pageLead = cx(
  text.body({ muted: true, measure: '65ch' }),
  style({ fontSize: t.size.lg }),
);

/** A section sub-heading (h2) used throughout routes. */
export const sectionHeading = text.heading({ level: 2 });

/** Default running-text body copy, measured. */
export const bodyText = text.body({ measure: '70ch' });

/** The smallest supporting/metadata text. */
export const metaText = text.caption();

/** An inline, token-accented hyperlink with accessible focus/hover. */
export const inlineLink = text.link();

// ── Top navigation bar ──────────────────────────────────────────────────────

/** The sticky top navigation landmark: raised surface, bottom border, blur. */
export const navBar = cx(
  style({
    position: 'sticky',
    top: 0,
    zIndex: t.z.dropdown,
    background: t.surface.raised,
    boxShadow: t.shadow.sm,
  }),
);

/**
 * The inner nav row: brand on the left, links + controls on the right. Wraps on
 * narrow viewports (responsive, no JS) and keeps the same container width as the
 * page body so content lines up with the bar.
 */
export const navInner = cx(
  pageContainer,
  layout.row({ gap: '4', align: 'center', justify: 'between', wrap: true }),
  style({ paddingTop: t.space['3'], paddingBottom: t.space['3'] }),
);

/** The site wordmark — overrides the h1 scale down to a compact brand size. */
export const brand = style({
  fontFamily: t.font.sans,
  fontSize: t.size.lg,
  fontWeight: t.weight.bold,
  letterSpacing: '-0.01em',
  color: t.content.primary,
  textDecoration: 'none',
});

/** The horizontal group of primary nav links (wraps on small screens). */
export const navLinks = layout.row({ gap: '4', align: 'center', wrap: true });

/** A single primary nav link: quiet by default, accent on hover/focus. */
export const navLinkItem = style({
  fontSize: t.size.sm,
  fontWeight: t.weight.medium,
  color: t.content.secondary,
  textDecoration: 'none',
  borderRadius: t.radius.sm,
  paddingTop: t.space['1'],
  paddingBottom: t.space['1'],
  paddingLeft: t.space['2'],
  paddingRight: t.space['2'],
  transition: `color ${t.duration.fast} ${t.easing.standard}, background ${t.duration.fast} ${t.easing.standard}`,
  on: {
    hover: { color: t.accent.primary, background: t.surface.sunken },
    focusVisible: { outline: `2px solid ${t.focus.ring}`, outlineOffset: 2 },
  },
});

/** The "(active)" marker appended to the active nav link. */
export const navActiveMark = cx(
  a11y.visuallyHidden(),
);

/** The region holding the theme toggle + search, right-aligned. */
export const navControls = layout.row({ gap: '3', align: 'center', wrap: true });

/** The theme toggle — a compact secondary (outline) button. */
export const themeToggle = style({
  fontFamily: t.font.sans,
  fontSize: t.size.sm,
  fontWeight: t.weight.medium,
  color: t.content.primary,
  background: t.surface.background,
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: t.border.strong,
  borderRadius: t.radius.md,
  paddingTop: t.space['1'],
  paddingBottom: t.space['1'],
  paddingLeft: t.space['3'],
  paddingRight: t.space['3'],
  cursor: 'pointer',
  appearance: 'none',
  transition: `background ${t.duration.fast} ${t.easing.standard}`,
  on: {
    hover: { background: t.surface.sunken },
    focusVisible: { outline: 'none', boxShadow: `0 0 0 3px ${t.focus.ring}` },
  },
});

// ── Search box + results ────────────────────────────────────────────────────

/** The docs-search region: a small vertical stack (input over results). */
export const searchRegion = cx(
  layout.stack({ gap: '2' }),
  style({ position: 'relative', minWidth: 200 }),
);

/** The search text input — the shared form control surface, sized down. */
export const searchInput = cx(
  form.input(),
  style({ fontSize: t.size.sm, paddingTop: t.space['1'], paddingBottom: t.space['1'] }),
);

/** The live results list: a floating, elevated popover-like card. */
export const searchResults = cx(
  layout.stack({ gap: '1' }),
  style({
    background: t.surface.raised,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: t.border.default,
    borderRadius: t.radius.md,
    boxShadow: t.shadow.md,
    padding: t.space['2'],
  }),
);

/** A single search result link. */
export const searchResultItem = cx(
  text.link(),
  style({ fontSize: t.size.sm, textDecoration: 'none', padding: t.space['1'], borderRadius: t.radius.sm }),
);

/** The "No matches." empty-state line. */
export const searchEmpty = cx(text.caption(), style({ padding: t.space['1'] }));

// ── Footer ──────────────────────────────────────────────────────────────────

/** The site footer landmark: top border, muted, centered content width. */
export const footer = cx(
  style({
    borderStyle: 'solid',
    borderColor: t.border.default,
    borderWidth: 1,
    background: t.surface.raised,
    marginTop: t.space['10'],
  }),
);

/** The inner footer row (same container width as the page). */
export const footerInner = cx(
  pageContainer,
  layout.row({ gap: '4', align: 'center', justify: 'between', wrap: true }),
  style({ paddingTop: t.space['5'], paddingBottom: t.space['5'] }),
);

/** Footer supporting text. */
export const footerText = text.caption();

// ── Skip link (a11y) ────────────────────────────────────────────────────────

/** The "skip to content" link: hidden until keyboard focus (§19). */
export const skipLink = a11y.skipLink();

// ── Cards & grids ───────────────────────────────────────────────────────────

/** A surface card: raised background, subtle border, padding, rounded. */
export const card = cx(
  layout.stack({ gap: '3' }),
  style({
    background: t.surface.raised,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: t.border.default,
    borderRadius: t.radius.lg,
    padding: t.space['5'],
    transition: `box-shadow ${t.duration.fast} ${t.easing.standard}, border-color ${t.duration.fast} ${t.easing.standard}`,
    on: { hover: { boxShadow: t.shadow.md, borderColor: t.border.strong } },
  }),
);

/** A responsive auto-fill grid of cards. */
export const cardGrid = layout.grid({ columns: 'auto', min: 240, gap: '5' });

/** A two-column feature grid that collapses to one column on small screens. */
export const featureGrid = style({
  display: 'grid',
  gap: t.space['5'],
  gridTemplateColumns: { base: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
});

// ── Code blocks ─────────────────────────────────────────────────────────────

/** A labelled code-example wrapper: the label sits above a `<pre>` surface. */
export const codeBlock = layout.stack({ gap: '2' });

/** The small caption above a code sample. */
export const codeLabel = cx(text.label(), style({ color: t.content.secondary }));

/** The `<pre>` surface itself (monospace, scrollable, token surface, §14). */
export const codeSurface = text.pre();

/** Inline monospace code inside prose (§14). */
export const inlineCode = text.code();

// ── Breadcrumbs ─────────────────────────────────────────────────────────────

/** The breadcrumb trail row. */
export const breadcrumbTrail = cx(
  layout.row({ gap: '2', align: 'center', wrap: true }),
  text.caption(),
);

/** A breadcrumb link (quiet, accent on hover). */
export const breadcrumbLink = cx(
  text.link(),
  style({ fontSize: t.size.xs, textDecoration: 'none' }),
);

/** The final (current-page) breadcrumb crumb — plain, de-emphasised. */
export const breadcrumbCurrent = cx(text.caption(), style({ color: t.content.secondary }));

// ── Buttons ─────────────────────────────────────────────────────────────────

/** The primary call-to-action button surface (§20). */
export const buttonPrimary = form.button();

/** A secondary (outline) button: token border, transparent surface. */
export const buttonSecondary = style({
  fontFamily: t.font.sans,
  fontSize: t.size.md,
  fontWeight: t.weight.semibold,
  color: t.content.primary,
  background: t.surface.background,
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: t.border.strong,
  borderRadius: t.radius.md,
  paddingTop: t.space['2'],
  paddingBottom: t.space['2'],
  paddingLeft: t.space['4'],
  paddingRight: t.space['4'],
  cursor: 'pointer',
  appearance: 'none',
  textDecoration: 'none',
  transition: `background ${t.duration.fast} ${t.easing.standard}`,
  on: {
    hover: { background: t.surface.sunken },
    focusVisible: { outline: 'none', boxShadow: `0 0 0 3px ${t.focus.ring}` },
  },
});

/** A row of hero CTA links/buttons. */
export const ctaRow = layout.row({ gap: '3', align: 'center', wrap: true });

// ── Badges, alerts, tables ──────────────────────────────────────────────────

/** A small pill badge (used for tags / "active" markers). */
export const badge = style({
  display: 'inline-flex',
  alignItems: 'center',
  fontSize: t.size.xs,
  fontWeight: t.weight.medium,
  color: t.accent.primary,
  background: t.surface.sunken,
  borderRadius: t.radius.full,
  paddingLeft: t.space['2'],
  paddingRight: t.space['2'],
  paddingTop: 2,
  paddingBottom: 2,
});

/** An informational callout surface. */
export const alert = cx(
  layout.stack({ gap: '2' }),
  style({
    background: t.surface.sunken,
    borderStyle: 'solid',
    borderColor: t.border.subtle,
    borderWidth: 1,
    borderRadius: t.radius.md,
    padding: t.space['4'],
  }),
);

/** A simple API/data table surface. */
export const table = style({
  width: '100%',
  fontSize: t.size.sm,
  color: t.content.primary,
});

// ── Docs layout (sidebar + content) ─────────────────────────────────────────

/**
 * A docs two-pane layout: a sidebar nav column and the content column. Single
 * column on small screens, two columns from `md` up (responsive, no JS).
 */
export const docsLayout = style({
  display: 'grid',
  gap: t.space['6'],
  gridTemplateColumns: { base: '1fr', md: '220px minmax(0, 1fr)' },
  alignItems: 'start',
});

/** The sticky docs sidebar column. */
export const docsSidebar = cx(
  layout.stack({ gap: '2' }),
  style({ position: 'sticky', top: t.space['10'] }),
);

/** A grouped list of links in the sidebar or an index page. */
export const linkList = layout.stack({ gap: '2' });

/** The namespace object — one import for the whole design system. */
export const ds = {
  appRoot, pageContainer, pageSection, pageBody, pageTitle, pageLead,
  sectionHeading, bodyText, metaText, inlineLink,
  navBar, navInner, brand, navLinks, navLinkItem, navActiveMark, navControls, themeToggle,
  searchRegion, searchInput, searchResults, searchResultItem, searchEmpty,
  footer, footerInner, footerText, skipLink,
  card, cardGrid, featureGrid,
  codeBlock, codeLabel, codeSurface, inlineCode,
  breadcrumbTrail, breadcrumbLink, breadcrumbCurrent,
  buttonPrimary, buttonSecondary, ctaRow,
  badge, alert, table,
  docsLayout, docsSidebar, linkList,
} as const;
