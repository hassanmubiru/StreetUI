/**
 * StreetJS website — design system.
 *
 * Single source of every visual class. Built ONLY on StreetUI's public styling
 * API (`style`, `layout`, `text`, `form`, `a11y`, `cx`, design `tokens`) — no
 * CSS file, no utility framework, no second styling system.
 *
 * SSR DETERMINISM: every token is computed at module load, so importing this
 * module registers the complete rule set into the shared `styleRegistry` up
 * front. Routes only *reference* these pre-registered tokens (they never call
 * `style()` with a fresh definition at render time), therefore the serialized
 * stylesheet is byte-identical for every route.
 *
 * THEMING: all colour / space / type values are design tokens
 * (`tokens.ref.*` → `var(--…)`); dark mode re-points the variables through one
 * `data-theme` flip.
 */

import { style, cx, layout, text, form, a11y, tokens } from 'streetui';

const t = tokens.ref;

// ── Document & page scaffolding ────────────────────────────────────────────

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

export const pageContainer = layout.container({ max: 1120, padX: '5' });

export const pageSection = cx(
  pageContainer,
  layout.stack({ gap: '5' }),
  style({ paddingTop: t.space['8'], paddingBottom: t.space['8'] }),
);

export const pageBody = layout.stack({ gap: '5' });
export const pageTitle = text.heading({ level: 1 });
export const pageLead = cx(text.body({ muted: true, measure: '65ch' }), style({ fontSize: t.size.lg }));
export const sectionHeading = text.heading({ level: 2 });
export const subHeading = text.heading({ level: 3 });
export const bodyText = text.body({ measure: '70ch' });
export const metaText = text.caption();
export const inlineLink = text.link();

/** Large hero headline (home page only). */
export const heroTitle = style({
  fontFamily: t.font.sans,
  fontSize: t.size['3xl'],
  fontWeight: t.weight.bold,
  lineHeight: t.leading.tight,
  letterSpacing: '-0.02em',
  color: t.content.primary,
  maxWidth: '22ch',
});

// ── Top navigation bar ──────────────────────────────────────────────────────

export const navBar = style({
  position: 'sticky',
  top: 0,
  zIndex: t.z.dropdown,
  background: t.surface.raised,
  boxShadow: t.shadow.sm,
});

export const navInner = cx(
  pageContainer,
  layout.row({ gap: '4', align: 'center', justify: 'between', wrap: true }),
  style({ paddingTop: t.space['3'], paddingBottom: t.space['3'] }),
);

export const brand = style({
  fontFamily: t.font.sans,
  fontSize: t.size.lg,
  fontWeight: t.weight.bold,
  letterSpacing: '-0.01em',
  color: t.content.primary,
  textDecoration: 'none',
});

/** The brand is a link to home: same look, plus focus ring. */
export const brandLink = style({
  fontFamily: t.font.sans,
  fontSize: t.size.lg,
  fontWeight: t.weight.bold,
  letterSpacing: '-0.01em',
  color: t.content.primary,
  textDecoration: 'none',
  borderRadius: t.radius.sm,
  on: { focusVisible: { outline: `2px solid ${t.focus.ring}`, outlineOffset: 2 } },
});

/** Desktop primary links — hidden below `md` (the mobile menu replaces them). */
export const navLinks = style({
  display: { base: 'none', md: 'flex' },
  flexDirection: 'row',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: t.space['4'],
});

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

export const navActiveMark = a11y.visuallyHidden();

export const navControls = layout.row({ gap: '3', align: 'center', wrap: true });

const compactButton = {
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
} as const;

export const themeToggle = style({
  ...compactButton,
  on: {
    hover: { background: t.surface.sunken },
    focusVisible: { outline: 'none', boxShadow: `0 0 0 3px ${t.focus.ring}` },
  },
});

/** Menu toggle — visible only below `md`. */
export const menuToggle = style({
  ...compactButton,
  display: { base: 'inline-flex', md: 'none' },
  alignItems: 'center',
  on: {
    hover: { background: t.surface.sunken },
    focusVisible: { outline: 'none', boxShadow: `0 0 0 3px ${t.focus.ring}` },
  },
});

/** The mobile menu panel — a stacked column, hidden from `md` up. */
export const mobileMenu = style({
  display: { base: 'flex', md: 'none' },
  flexDirection: 'column',
  gap: t.space['1'],
  background: t.surface.raised,
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: t.border.default,
  paddingTop: t.space['3'],
  paddingBottom: t.space['3'],
  paddingLeft: t.space['5'],
  paddingRight: t.space['5'],
});

export const mobileMenuLink = style({
  fontSize: t.size.md,
  fontWeight: t.weight.medium,
  color: t.content.primary,
  textDecoration: 'none',
  borderRadius: t.radius.sm,
  paddingTop: t.space['2'],
  paddingBottom: t.space['2'],
  on: {
    hover: { color: t.accent.primary },
    focusVisible: { outline: `2px solid ${t.focus.ring}`, outlineOffset: 2 },
  },
});

// ── Global search (dialog) ──────────────────────────────────────────────────

/** The always-visible search opener in the nav bar. */
export const searchTrigger = style({
  ...compactButton,
  display: 'inline-flex',
  alignItems: 'center',
  gap: t.space['2'],
  color: t.content.secondary,
  minWidth: 120,
  on: {
    hover: { background: t.surface.sunken },
    focusVisible: { outline: 'none', boxShadow: `0 0 0 3px ${t.focus.ring}` },
  },
});

/** Keyboard-hint chip. */
export const kbd = style({
  fontFamily: t.font.mono,
  fontSize: t.size.xs,
  color: t.content.secondary,
  background: t.surface.sunken,
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: t.border.default,
  borderRadius: t.radius.sm,
  paddingLeft: t.space['1'],
  paddingRight: t.space['1'],
});

/**
 * The search dialog panel. Fixed + centred; the oversized spread shadow dims
 * the page behind it (the framework dialog has no separate backdrop node).
 */
export const searchPanel = style({
  position: 'fixed',
  top: '10vh',
  left: '50%',
  transform: 'translateX(-50%)',
  width: 'min(640px, 92vw)',
  maxHeight: '78vh',
  overflowY: 'auto',
  zIndex: t.z.overlay,
  display: 'flex',
  flexDirection: 'column',
  gap: t.space['3'],
  background: t.surface.raised,
  color: t.content.primary,
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: t.border.strong,
  borderRadius: t.radius.lg,
  padding: t.space['4'],
  boxShadow: `${t.shadow.lg}, 0 0 0 100vmax ${t.surface.overlay}`,
});

export const searchPanelHeader = layout.row({ gap: '3', align: 'center', justify: 'between' });
export const searchPanelTitle = style({ fontSize: t.size.md, fontWeight: t.weight.semibold });

export const searchDialogInput = cx(
  form.input(),
  style({ fontSize: t.size.md, width: '100%' }),
);

export const searchHint = text.caption();

export const searchResultsList = layout.stack({ gap: '1' });

export const searchResultLink = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  color: t.content.primary,
  textDecoration: 'none',
  borderRadius: t.radius.md,
  padding: t.space['2'],
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: 'transparent',
  on: {
    hover: { background: t.surface.sunken },
    focus: { background: t.surface.sunken, borderColor: t.accent.primary },
    focusVisible: { outline: `2px solid ${t.focus.ring}`, outlineOffset: -2 },
  },
});

export const searchResultTitle = style({ fontSize: t.size.sm, fontWeight: t.weight.semibold });
export const searchResultMeta = text.caption();
export const searchEmpty = cx(text.body({ muted: true }), style({ padding: t.space['2'] }));

// ── Footer ──────────────────────────────────────────────────────────────────

export const footer = style({
  borderStyle: 'solid',
  borderColor: t.border.default,
  borderWidth: 1,
  background: t.surface.raised,
  marginTop: t.space['10'],
});

export const footerInner = cx(
  pageContainer,
  layout.stack({ gap: '3' }),
  style({ paddingTop: t.space['5'], paddingBottom: t.space['5'] }),
);

export const footerLinks = layout.row({ gap: '4', align: 'center', wrap: true });
export const footerText = text.caption();

// ── Skip link (a11y) ────────────────────────────────────────────────────────

export const skipLink = a11y.skipLink();

// ── Cards & grids ───────────────────────────────────────────────────────────

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

export const cardGrid = layout.grid({ columns: 'auto', min: 260, gap: '5' });

export const featureGrid = style({
  display: 'grid',
  gap: t.space['5'],
  gridTemplateColumns: { base: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
});

// ── Code blocks ─────────────────────────────────────────────────────────────

export const codeBlock = layout.stack({ gap: '2' });
export const codeLabel = cx(text.label(), style({ color: t.content.secondary }));
export const codeSurface = text.pre();
export const inlineCode = text.code();

// ── Breadcrumbs ─────────────────────────────────────────────────────────────

export const breadcrumbTrail = cx(layout.row({ gap: '2', align: 'center', wrap: true }), text.caption());
export const breadcrumbLink = cx(text.link(), style({ fontSize: t.size.xs, textDecoration: 'none' }));
export const breadcrumbCurrent = cx(text.caption(), style({ color: t.content.secondary }));

// ── Buttons ─────────────────────────────────────────────────────────────────

export const buttonPrimary = form.button();

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

export const ctaRow = layout.row({ gap: '3', align: 'center', wrap: true });

// ── Badges, status, alerts ──────────────────────────────────────────────────

const pill = {
  display: 'inline-flex',
  alignItems: 'center',
  fontSize: t.size.xs,
  fontWeight: t.weight.medium,
  borderRadius: t.radius.full,
  paddingLeft: t.space['2'],
  paddingRight: t.space['2'],
  paddingTop: 2,
  paddingBottom: 2,
  borderWidth: 1,
  borderStyle: 'solid',
} as const;

export const badge = style({
  ...pill,
  color: t.accent.primary,
  background: t.surface.sunken,
  borderColor: t.border.subtle,
});

export const statusOk = style({
  ...pill,
  color: t.success.content,
  background: t.surface.sunken,
  borderColor: t.success.solid,
});

export const statusError = style({
  ...pill,
  color: t.danger.content,
  background: t.danger.surface,
  borderColor: t.danger.border,
});

export const statusNeutral = style({
  ...pill,
  color: t.content.secondary,
  background: t.surface.sunken,
  borderColor: t.border.default,
});

export const badgeRow = layout.row({ gap: '2', align: 'center', wrap: true });

export const alert = cx(
  layout.stack({ gap: '2' }),
  style({
    background: t.surface.sunken,
    borderStyle: 'solid',
    borderColor: t.border.default,
    borderWidth: 1,
    borderRadius: t.radius.md,
    padding: t.space['4'],
  }),
);

/** Provenance / "verify against your installed version" notice. */
export const notice = cx(
  layout.stack({ gap: '1' }),
  style({
    background: t.surface.sunken,
    borderStyle: 'solid',
    borderColor: t.accent.primary,
    borderWidth: 1,
    borderRadius: t.radius.md,
    padding: t.space['3'],
    fontSize: t.size.sm,
    color: t.content.secondary,
  }),
);

/** Error callout (backend failures, invalid tool input). */
export const errorBox = cx(
  layout.stack({ gap: '2' }),
  style({
    background: t.danger.surface,
    borderStyle: 'solid',
    borderColor: t.danger.border,
    borderWidth: 1,
    borderRadius: t.radius.md,
    padding: t.space['3'],
    color: t.danger.content,
    fontSize: t.size.sm,
  }),
);

export const table = style({ width: '100%', fontSize: t.size.sm, color: t.content.primary });

// ── Docs layout (sidebar + content) ─────────────────────────────────────────

export const docsLayout = style({
  display: 'grid',
  gap: t.space['6'],
  gridTemplateColumns: { base: '1fr', md: '230px minmax(0, 1fr)' },
  alignItems: 'start',
});

export const docsSidebar = cx(
  layout.stack({ gap: '2' }),
  style({ position: { base: 'static', md: 'sticky' }, top: t.space['10'] }),
);

export const docsSidebarGroup = text.label();

export const docsSidebarLink = style({
  fontSize: t.size.sm,
  color: t.content.secondary,
  textDecoration: 'none',
  borderRadius: t.radius.sm,
  paddingTop: t.space['1'],
  paddingBottom: t.space['1'],
  paddingLeft: t.space['2'],
  paddingRight: t.space['2'],
  on: {
    hover: { color: t.accent.primary, background: t.surface.sunken },
    focusVisible: { outline: `2px solid ${t.focus.ring}`, outlineOffset: 2 },
  },
});

export const docsContent = cx(layout.stack({ gap: '5' }), style({ minWidth: 0 }));
export const linkList = layout.stack({ gap: '2' });
export const pagerRow = layout.row({ gap: '4', align: 'center', justify: 'between', wrap: true });

// ── Playground / backend tools ──────────────────────────────────────────────

export const fieldGroup = layout.stack({ gap: '2' });
export const fieldLabel = text.label();

export const textarea = cx(
  form.input(),
  style({ fontFamily: t.font.mono, fontSize: t.size.sm, minHeight: 120, width: '100%' }),
);

export const textInput = cx(form.input(), style({ width: '100%' }));

/** Monospace read-out box for tool results. */
export const outputBox = cx(
  layout.stack({ gap: '1' }),
  style({
    fontFamily: t.font.mono,
    fontSize: t.size.sm,
    background: t.surface.sunken,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: t.border.default,
    borderRadius: t.radius.md,
    padding: t.space['3'],
    overflowX: 'auto',
  }),
);

export const outputRow = style({
  display: 'grid',
  gridTemplateColumns: { base: '1fr', md: '160px 1fr 1fr' },
  gap: t.space['2'],
  alignItems: 'start',
});

export const toolPanel = cx(
  layout.stack({ gap: '4' }),
  style({
    background: t.surface.raised,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: t.border.default,
    borderRadius: t.radius.lg,
    padding: t.space['5'],
  }),
);

/** The namespace object — one import for the whole design system. */
export const ds = {
  appRoot, pageContainer, pageSection, pageBody, pageTitle, pageLead,
  sectionHeading, subHeading, bodyText, metaText, inlineLink, heroTitle,
  navBar, navInner, brand, brandLink, navLinks, navLinkItem, navActiveMark, navControls,
  themeToggle, menuToggle, mobileMenu, mobileMenuLink,
  searchTrigger, kbd, searchPanel, searchPanelHeader, searchPanelTitle, searchDialogInput,
  searchHint, searchResultsList, searchResultLink, searchResultTitle, searchResultMeta, searchEmpty,
  footer, footerInner, footerLinks, footerText, skipLink,
  card, cardGrid, featureGrid,
  codeBlock, codeLabel, codeSurface, inlineCode,
  breadcrumbTrail, breadcrumbLink, breadcrumbCurrent,
  buttonPrimary, buttonSecondary, ctaRow,
  badge, statusOk, statusError, statusNeutral, badgeRow, alert, notice, errorBox, table,
  docsLayout, docsSidebar, docsSidebarGroup, docsSidebarLink, docsContent, linkList, pagerRow,
  fieldGroup, fieldLabel, textarea, textInput, outputBox, outputRow, toolPanel,
} as const;
