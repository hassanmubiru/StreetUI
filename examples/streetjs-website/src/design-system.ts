/**
 * StreetJS website — design system.
 *
 * Single source of every visual class, built ONLY on StreetUI's public styling
 * API (`style`, `layout`, `text`, `form`, `a11y`, `animation`, `cx`, design
 * `tokens`). No CSS file, no utility framework, no second styling system.
 *
 * VISUAL IDENTITY (premium developer-tool): charcoal surfaces with a refined
 * blue accent, generous type, restrained depth. The palette is installed with
 * `createThemeTokens`, which re-points the default semantic token variables for
 * BOTH light and dark — so every framework helper (text/form/a11y) and every
 * class below adopts the StreetJS palette with no change to StreetUI itself.
 *
 * SSR DETERMINISM: every token/style is computed at module load, so importing
 * this module registers the complete rule set up front. Routes only *reference*
 * these pre-registered identities, so the serialized stylesheet is byte-
 * identical for every route.
 */

import { a11y, animation, cx, createThemeTokens, form, layout, style, text, tokens } from 'streetui';

/**
 * Install the StreetJS palette. Same key shape as the default tokens, so the
 * generated CSS variables share names (`--surface-background`, `--accent-primary`
 * …) and, registering AFTER the framework defaults, win the cascade for both
 * `:root` and `[data-theme="dark"]`. Every color is set in BOTH themes so dark
 * mode never falls back to a framework default. Structural tokens (space, radii,
 * type scale) are left to the framework; only shadows are re-pointed for depth
 * on charcoal.
 */
export const brandTokens = createThemeTokens({
  light: {
    surface: { background: '#ffffff', raised: '#f7f9fc', sunken: '#eef2f7', overlay: 'rgba(13,22,38,0.5)' },
    content: { primary: '#0b1a2b', secondary: '#44536a', muted: '#6a7788', inverse: '#ffffff' },
    border: { default: '#e3e9f0', strong: '#cbd5e2', subtle: '#eef2f7' },
    accent: { primary: '#1766d6', hover: '#114fab', contrast: '#ffffff' },
    focus: { ring: '#1766d6' },
    danger: { surface: '#fef2f2', border: '#f4c9c9', content: '#b42318', solid: '#e5484d' },
    success: { content: '#0f7a45', solid: '#16a34a' },
    shadow: {
      sm: '0 1px 2px rgba(13,22,38,0.06)',
      md: '0 6px 20px -8px rgba(13,22,38,0.14)',
      lg: '0 24px 50px -16px rgba(13,22,38,0.20)',
    },
  },
  dark: {
    surface: { background: '#0a0e15', raised: '#121926', sunken: '#0d131d', overlay: 'rgba(2,5,10,0.66)' },
    content: { primary: '#e8eef7', secondary: '#aab6c7', muted: '#7d8aa0', inverse: '#0a0e15' },
    border: { default: '#1f2a3a', strong: '#30415c', subtle: '#18212e' },
    accent: { primary: '#4c8dff', hover: '#6ba3ff', contrast: '#06142b' },
    focus: { ring: '#4c8dff' },
    danger: { surface: '#2a1316', border: '#5c2328', content: '#ff8d8d', solid: '#e5484d' },
    success: { content: '#58d68a', solid: '#22c55e' },
    shadow: {
      sm: '0 1px 2px rgba(0,0,0,0.5)',
      md: '0 10px 28px -10px rgba(0,0,0,0.6)',
      lg: '0 30px 64px -20px rgba(0,0,0,0.72)',
    },
  },
});

const t = tokens.ref;

/** Code surfaces stay a deep slate in BOTH themes — code reads best on dark. */
const codeBg = '#0b1120';
const codeBgBar = '#0e1424';
const codeFg = '#dbe4f0';
const codeBorder = '#1c2740';

/** Content column widths. */
const CONTENT_MAX = 1160;
const PROSE_MAX = '72ch';

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

export const pageContainer = layout.container({ max: CONTENT_MAX, padX: '5' });

export const pageSection = cx(
  pageContainer,
  layout.stack({ gap: '6' }),
  style({ paddingTop: t.space['10'], paddingBottom: t.space['10'] }),
);

export const pageBody = layout.stack({ gap: '5' });

/** Page header block: a hairline-separated title + lead that opens a route. */
export const pageHeader = cx(
  layout.stack({ gap: '3' }),
  style({ paddingBottom: t.space['5'], boxShadow: `inset 0 -1px 0 ${t.border.subtle}` }),
);

export const pageTitle = style({
  fontFamily: t.font.sans,
  fontSize: t.size['3xl'],
  fontWeight: t.weight.bold,
  lineHeight: t.leading.tight,
  letterSpacing: '-0.025em',
  color: t.content.primary,
  maxWidth: '20ch',
});

export const pageLead = style({
  fontSize: t.size.lg,
  lineHeight: t.leading.relaxed,
  color: t.content.secondary,
  maxWidth: '62ch',
});

export const sectionHeading = style({
  fontFamily: t.font.sans,
  fontSize: t.size.xl,
  fontWeight: t.weight.semibold,
  lineHeight: t.leading.tight,
  letterSpacing: '-0.015em',
  color: t.content.primary,
});

export const subHeading = style({
  fontFamily: t.font.sans,
  fontSize: t.size.lg,
  fontWeight: t.weight.semibold,
  color: t.content.primary,
});

export const bodyText = style({
  fontSize: t.size.md,
  lineHeight: t.leading.relaxed,
  color: t.content.secondary,
  maxWidth: PROSE_MAX,
});

/**
 * Metadata / caption text: uses secondary content colour to meet WCAG AA
 * contrast (≥4.5:1) on the raised surface (#f7f9fc light / #121926 dark).
 */
export const metaText = cx(text.caption(), style({ color: t.content.secondary }));
export const inlineLink = text.link();

// ── Kicker (restrained, sentence-case — not an ALL-CAPS eyebrow) ────────────

export const kicker = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: t.space['2'],
  fontSize: t.size.sm,
  fontWeight: t.weight.medium,
  color: t.accent.primary,
  letterSpacing: '0',
});

// ── Top navigation bar ──────────────────────────────────────────────────────

export const navBar = style({
  position: 'sticky',
  top: 0,
  zIndex: t.z.dropdown,
  background: t.surface.background,
  boxShadow: `inset 0 -1px 0 ${t.border.default}`,
});

export const navInner = cx(
  layout.container({ max: CONTENT_MAX, padX: '5' }),
  layout.row({ gap: '3', align: 'center', justify: 'between', wrap: false }),
  style({ paddingTop: t.space['3'], paddingBottom: t.space['3'], minHeight: 60 }),
);

export const brand = style({
  fontFamily: t.font.sans, fontSize: t.size.lg, fontWeight: t.weight.bold,
  letterSpacing: '-0.02em', color: t.content.primary, textDecoration: 'none',
  borderRadius: t.radius.sm,
  on: { focusVisible: { outline: `2px solid ${t.focus.ring}`, outlineOffset: 3 } },
});

export const brandLink = style({
  display: 'inline-flex', alignItems: 'center', gap: t.space['2'],
  fontFamily: t.font.sans, fontSize: t.size.lg, fontWeight: t.weight.bold,
  letterSpacing: '-0.02em', color: t.content.primary, textDecoration: 'none',
  borderRadius: t.radius.sm, flexShrink: 0,
  on: { focusVisible: { outline: `2px solid ${t.focus.ring}`, outlineOffset: 3 } },
});

export const brandMark = style({
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: 26, height: 26, borderRadius: t.radius.md,
  background: t.accent.primary, color: t.accent.contrast,
  fontSize: t.size.sm, fontWeight: t.weight.bold, letterSpacing: '-0.03em', flexShrink: 0,
});

export const navLinks = style({
  display: { base: 'none', lg: 'flex' },
  flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'center',
  gap: t.space['1'], marginLeft: t.space['4'], marginRight: 'auto',
});

const navLinkBase = {
  fontSize: t.size.sm, fontWeight: t.weight.medium, textDecoration: 'none',
  borderRadius: t.radius.md,
  paddingTop: t.space['2'], paddingBottom: t.space['2'],
  paddingLeft: t.space['3'], paddingRight: t.space['3'],
  whiteSpace: 'nowrap',
} as const;

export const navLinkItem = style({
  ...navLinkBase,
  color: t.content.secondary,
  transition: animation.transition(['color', 'background'], { duration: 'fast' }),
  on: {
    hover: { color: t.content.primary, background: t.surface.sunken },
    focusVisible: { outline: `2px solid ${t.focus.ring}`, outlineOffset: 2 },
  },
});

export const navLinkActive = style({
  ...navLinkBase,
  fontWeight: t.weight.semibold,
  color: t.accent.primary,
  background: t.surface.sunken,
  on: { focusVisible: { outline: `2px solid ${t.focus.ring}`, outlineOffset: 2 } },
});

export const navActiveMark = a11y.visuallyHidden();
export const navControls = layout.row({ gap: '2', align: 'center', wrap: false });

// ── Nav controls (search / theme / menu) ────────────────────────────────────

const controlButton = {
  display: 'inline-flex', alignItems: 'center', gap: t.space['2'],
  fontFamily: t.font.sans, fontSize: t.size.sm, fontWeight: t.weight.medium,
  color: t.content.secondary, background: t.surface.raised,
  borderWidth: 1, borderStyle: 'solid', borderColor: t.border.default,
  borderRadius: t.radius.md,
  paddingTop: t.space['2'], paddingBottom: t.space['2'],
  paddingLeft: t.space['3'], paddingRight: t.space['3'],
  cursor: 'pointer', appearance: 'none', whiteSpace: 'nowrap',
  transition: animation.transition(['background', 'border-color', 'color'], { duration: 'fast' }),
} as const;

export const themeToggle = style({
  ...controlButton,
  on: {
    hover: { background: t.surface.sunken, borderColor: t.border.strong, color: t.content.primary },
    focusVisible: { outline: 'none', boxShadow: `0 0 0 3px ${t.focus.ring}` },
  },
});

export const menuToggle = style({
  ...controlButton,
  display: { base: 'inline-flex', lg: 'none' },
  on: {
    hover: { background: t.surface.sunken, borderColor: t.border.strong, color: t.content.primary },
    focusVisible: { outline: 'none', boxShadow: `0 0 0 3px ${t.focus.ring}` },
  },
});

export const searchTrigger = style({
  ...controlButton,
  justifyContent: 'space-between',
  minWidth: { base: 0, md: 200 },
  on: {
    hover: { background: t.surface.sunken, borderColor: t.border.strong },
    focusVisible: { outline: 'none', boxShadow: `0 0 0 3px ${t.focus.ring}` },
  },
});

export const kbd = style({
  fontFamily: t.font.mono, fontSize: t.size.xs, color: t.content.muted,
  background: t.surface.background, borderWidth: 1, borderStyle: 'solid',
  borderColor: t.border.default, borderRadius: t.radius.sm,
  paddingLeft: t.space['1'], paddingRight: t.space['1'],
  display: { base: 'none', md: 'inline-flex' },
});

// ── Mobile menu ──────────────────────────────────────────────────────────────

export const mobileMenu = style({
  display: { base: 'flex', lg: 'none' },
  flexDirection: 'column', gap: t.space['1'],
  background: t.surface.raised,
  boxShadow: `inset 0 1px 0 ${t.border.default}`,
  paddingTop: t.space['3'], paddingBottom: t.space['4'],
  paddingLeft: t.space['5'], paddingRight: t.space['5'],
});

export const mobileMenuLink = style({
  fontSize: t.size.md, fontWeight: t.weight.medium, color: t.content.secondary,
  textDecoration: 'none', borderRadius: t.radius.md,
  paddingTop: t.space['2'], paddingBottom: t.space['2'],
  paddingLeft: t.space['2'], paddingRight: t.space['2'],
  on: {
    hover: { color: t.content.primary, background: t.surface.sunken },
    focusVisible: { outline: `2px solid ${t.focus.ring}`, outlineOffset: 2 },
  },
});

export const mobileMenuLinkActive = style({
  fontSize: t.size.md, fontWeight: t.weight.semibold, color: t.accent.primary,
  textDecoration: 'none', borderRadius: t.radius.md, background: t.surface.sunken,
  paddingTop: t.space['2'], paddingBottom: t.space['2'],
  paddingLeft: t.space['2'], paddingRight: t.space['2'],
});

// ── Global search (dialog) ──────────────────────────────────────────────────

export const searchPanel = style({
  position: 'fixed', top: '12vh', left: '50%', transform: 'translateX(-50%)',
  width: 'min(620px, 92vw)', maxHeight: '72vh', overflowY: 'auto',
  zIndex: t.z.overlay, display: 'flex', flexDirection: 'column', gap: t.space['3'],
  background: t.surface.raised, color: t.content.primary,
  borderWidth: 1, borderStyle: 'solid', borderColor: t.border.strong,
  borderRadius: t.radius.lg, padding: t.space['4'],
  boxShadow: `${t.shadow.lg}, 0 0 0 100vmax ${t.surface.overlay}`,
});

export const searchPanelHeader = layout.row({ gap: '3', align: 'center', justify: 'between' });
export const searchPanelTitle = style({ fontSize: t.size.md, fontWeight: t.weight.semibold, color: t.content.primary });

export const searchDialogInput = cx(
  form.input(),
  style({ fontSize: t.size.md, width: '100%' }),
);

export const searchHint = cx(text.caption(), style({ color: t.content.muted }));
export const searchResultsList = layout.stack({ gap: '1' });

export const searchResultLink = style({
  display: 'flex', flexDirection: 'column', gap: 2,
  color: t.content.primary, textDecoration: 'none',
  borderRadius: t.radius.md, padding: t.space['3'],
  borderWidth: 1, borderStyle: 'solid', borderColor: 'transparent',
  transition: animation.transition(['background', 'border-color'], { duration: 'fast' }),
  on: {
    hover: { background: t.surface.sunken },
    focus: { background: t.surface.sunken, borderColor: t.accent.primary },
    focusVisible: { outline: `2px solid ${t.focus.ring}`, outlineOffset: -2 },
  },
});

export const searchResultTitle = style({ fontSize: t.size.sm, fontWeight: t.weight.semibold, color: t.content.primary });
export const searchResultMeta = cx(text.caption(), style({ color: t.content.muted }));
export const searchEmpty = cx(style({ color: t.content.secondary, padding: t.space['2'] }));

// ── Footer ──────────────────────────────────────────────────────────────────

export const footer = style({
  background: t.surface.raised,
  boxShadow: `inset 0 1px 0 ${t.border.default}`,
  marginTop: t.space['10'],
});

export const footerInner = cx(
  layout.container({ max: CONTENT_MAX, padX: '5' }),
  style({
    display: 'grid', gap: t.space['5'],
    gridTemplateColumns: { base: '1fr', md: 'minmax(0, 1fr) auto' },
    alignItems: 'center',
    paddingTop: t.space['6'], paddingBottom: t.space['6'],
  }),
);

export const footerLinks = layout.row({ gap: '5', align: 'center', wrap: true });
/**
 * Footer body copy: uses secondary content colour (not muted) so that the text
 * reliably passes WCAG 2.1 AA contrast (≥4.5:1) against the raised surface
 * background (#f7f9fc light / #121926 dark).
 * Light: #44536a on #f7f9fc → 7.4:1 ✓
 * Dark:  #aab6c7 on #121926 → 7.9:1 ✓
 */
export const footerText = cx(text.caption(), style({ color: t.content.secondary, maxWidth: '60ch' }));
export const footerLink = style({
  fontSize: t.size.sm, color: t.content.secondary, textDecoration: 'none',
  on: { hover: { color: t.accent.primary }, focusVisible: { outline: `2px solid ${t.focus.ring}`, outlineOffset: 2 } },
});

export const skipLink = a11y.skipLink();

// ── Cards & grids ───────────────────────────────────────────────────────────

export const card = cx(
  layout.stack({ gap: '3' }),
  style({
    background: t.surface.raised,
    borderWidth: 1, borderStyle: 'solid', borderColor: t.border.default,
    borderRadius: t.radius.lg, padding: t.space['5'],
  }),
);

/** A whole-card link: title + summary, lifts slightly on hover. */
export const linkCardShell = cx(
  layout.stack({ gap: '2' }),
  style({
    background: t.surface.raised,
    borderWidth: 1, borderStyle: 'solid', borderColor: t.border.default,
    borderRadius: t.radius.lg, padding: t.space['5'], height: '100%',
    transition: animation.transition(['border-color', 'box-shadow', 'transform'], { duration: 'fast' }),
    on: {
      hover: { borderColor: t.border.strong, boxShadow: t.shadow.md },
      focusWithin: { borderColor: t.accent.primary, boxShadow: t.shadow.md },
    },
  }),
);

export const cardTitleLink = style({
  fontSize: t.size.md, fontWeight: t.weight.semibold, color: t.content.primary,
  textDecoration: 'none', letterSpacing: '-0.01em',
  on: {
    hover: { color: t.accent.primary },
    focusVisible: { outline: `2px solid ${t.focus.ring}`, outlineOffset: 2 },
  },
});

export const cardSummary = style({ fontSize: t.size.sm, lineHeight: t.leading.normal, color: t.content.secondary });

export const cardGrid = style({
  display: 'grid', gap: t.space['4'],
  gridTemplateColumns: { base: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))' },
});

export const cardGrid2 = style({
  display: 'grid', gap: t.space['4'],
  gridTemplateColumns: { base: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
});

export const featureGrid = cardGrid2;

// ── Home hero + section rhythm ───────────────────────────────────────────────

export const heroOuter = style({
  background: `radial-gradient(1200px 480px at 78% -10%, ${t.surface.sunken}, transparent 60%)`,
  boxShadow: `inset 0 -1px 0 ${t.border.subtle}`,
});

export const heroWrap = cx(
  layout.container({ max: CONTENT_MAX, padX: '5' }),
  style({
    display: 'grid', gap: t.space['8'], alignItems: 'center',
    gridTemplateColumns: { base: '1fr', lg: 'minmax(0, 1fr) minmax(0, 1fr)' },
    paddingTop: { base: t.space['8'], md: t.space['10'] },
    paddingBottom: { base: t.space['8'], md: t.space['10'] },
  }),
);

export const heroCol = layout.stack({ gap: '5' });

export const heroTitle = style({
  fontFamily: t.font.sans,
  fontSize: 'clamp(34px, 5.4vw, 54px)',
  fontWeight: t.weight.bold,
  lineHeight: '1.05',
  letterSpacing: '-0.035em',
  color: t.content.primary,
  maxWidth: '15ch',
});

export const heroLead = style({
  fontSize: t.size.lg, lineHeight: t.leading.relaxed, color: t.content.secondary, maxWidth: '54ch',
});

export const heroMetaRow = cx(layout.row({ gap: '4', align: 'center', wrap: true }), style({ color: t.content.muted }));
export const heroMetaItem = style({ fontSize: t.size.sm, color: t.content.muted });

/** A tinted full-bleed band to separate alternating sections. */
export const bandAlt = style({ background: t.surface.raised, boxShadow: `inset 0 1px 0 ${t.border.subtle}, inset 0 -1px 0 ${t.border.subtle}` });
export const bandInner = cx(
  layout.container({ max: CONTENT_MAX, padX: '5' }),
  layout.stack({ gap: '6' }),
  style({ paddingTop: t.space['10'], paddingBottom: t.space['10'] }),
);

export const sectionIntro = layout.stack({ gap: '2' });

// ── Code window (the signature code presentation) ────────────────────────────

export const codeWindow = style({
  background: codeBg,
  borderWidth: 1, borderStyle: 'solid', borderColor: codeBorder,
  borderRadius: t.radius.lg, overflow: 'hidden',
  boxShadow: t.shadow.md,
});

export const codeBar = style({
  display: 'flex', alignItems: 'center', gap: t.space['3'],
  background: codeBgBar,
  boxShadow: `inset 0 -1px 0 ${codeBorder}`,
  paddingTop: t.space['2'], paddingBottom: t.space['2'],
  paddingLeft: t.space['4'], paddingRight: t.space['3'],
});

export const codeDots = cx(layout.row({ gap: '2', align: 'center' }), style({ flexShrink: 0 }));
export const codeDot = style({ width: 11, height: 11, borderRadius: t.radius.full, background: '#2a3344' });
export const codeName = style({ fontFamily: t.font.mono, fontSize: t.size.xs, color: '#8595ad', marginRight: 'auto', whiteSpace: 'nowrap', overflow: 'hidden' });

export const codeCopy = style({
  fontFamily: t.font.sans, fontSize: t.size.xs, fontWeight: t.weight.medium,
  color: '#aeb9cc', background: 'transparent',
  borderWidth: 1, borderStyle: 'solid', borderColor: codeBorder, borderRadius: t.radius.sm,
  paddingTop: 3, paddingBottom: 3, paddingLeft: t.space['2'], paddingRight: t.space['2'],
  cursor: 'pointer', appearance: 'none', flexShrink: 0,
  transition: animation.transition(['background', 'color', 'border-color'], { duration: 'fast' }),
  on: {
    hover: { background: '#182134', color: '#e6edf6', borderColor: '#334259' },
    focusVisible: { outline: 'none', boxShadow: `0 0 0 2px ${t.focus.ring}` },
  },
});

export const codeScroll = style({ overflowX: 'auto', padding: t.space['4'] });
export const codePre = style({
  margin: 0, fontFamily: t.font.mono, fontSize: t.size.sm, lineHeight: '1.7',
  color: codeFg, whiteSpace: 'pre',
});

// Syntax token colors (tuned for the deep-slate code surface).
export const tokPlain = style({ color: codeFg });
export const tokComment = style({ color: '#6b7a90' });
export const tokKeyword = style({ color: '#79b8ff' });
export const tokString = style({ color: '#8ddb8c' });
export const tokNumber = style({ color: '#f0b072' });
export const tokType = style({ color: '#6cc0ff' });
export const tokDecorator = style({ color: '#d2a8ff' });
export const tokFn = style({ color: '#c3a7ff' });
export const tokPunct = style({ color: '#8b98ac' });

// Legacy / inline code surfaces (kept for API signatures etc.) — dark slate.
export const codeBlock = layout.stack({ gap: '2' });
export const codeLabel = cx(text.label(), style({ color: t.content.secondary }));
export const codeSurface = style({
  display: 'block', fontFamily: t.font.mono, fontSize: t.size.sm, lineHeight: '1.6',
  color: codeFg, background: codeBg,
  borderWidth: 1, borderStyle: 'solid', borderColor: codeBorder, borderRadius: t.radius.md,
  padding: t.space['3'], overflowX: 'auto', whiteSpace: 'pre',
});

export const inlineCode = style({
  fontFamily: t.font.mono, fontSize: '0.9em', color: t.accent.primary,
  background: t.surface.sunken,
  borderWidth: 1, borderStyle: 'solid', borderColor: t.border.subtle, borderRadius: t.radius.sm,
  paddingLeft: 5, paddingRight: 5, paddingTop: 1, paddingBottom: 1,
});

// ── Buttons ─────────────────────────────────────────────────────────────────

const buttonBase = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: t.space['2'],
  fontFamily: t.font.sans, fontSize: t.size.md, fontWeight: t.weight.semibold,
  borderRadius: t.radius.md, cursor: 'pointer', appearance: 'none', textDecoration: 'none',
  paddingTop: t.space['3'], paddingBottom: t.space['3'],
  paddingLeft: t.space['5'], paddingRight: t.space['5'],
  borderWidth: 1, borderStyle: 'solid',
  transition: animation.transition(['background', 'border-color', 'color', 'box-shadow'], { duration: 'fast' }),
} as const;

export const buttonPrimary = style({
  ...buttonBase,
  color: t.accent.contrast, background: t.accent.primary, borderColor: t.accent.primary,
  boxShadow: t.shadow.sm,
  on: {
    hover: { background: t.accent.hover, borderColor: t.accent.hover },
    active: { boxShadow: 'none' },
    focusVisible: { outline: 'none', boxShadow: `0 0 0 3px ${t.focus.ring}` },
  },
});

export const buttonSecondary = style({
  ...buttonBase,
  color: t.content.primary, background: t.surface.raised, borderColor: t.border.strong,
  on: {
    hover: { background: t.surface.sunken, borderColor: t.content.muted },
    focusVisible: { outline: 'none', boxShadow: `0 0 0 3px ${t.focus.ring}` },
  },
});

/** Ghost text button used for tertiary actions. */
export const buttonGhost = style({
  ...buttonBase,
  color: t.accent.primary, background: 'transparent', borderColor: 'transparent',
  paddingLeft: t.space['3'], paddingRight: t.space['3'],
  on: {
    hover: { background: t.surface.sunken },
    focusVisible: { outline: 'none', boxShadow: `0 0 0 3px ${t.focus.ring}` },
  },
});

export const ctaRow = layout.row({ gap: '3', align: 'center', wrap: true });

// ── Breadcrumbs ─────────────────────────────────────────────────────────────

export const breadcrumbTrail = cx(layout.row({ gap: '2', align: 'center', wrap: true }), style({ color: t.content.muted }));
export const breadcrumbLink = style({
  fontSize: t.size.xs, color: t.content.secondary, textDecoration: 'none',
  on: { hover: { color: t.accent.primary }, focusVisible: { outline: `2px solid ${t.focus.ring}`, outlineOffset: 2 } },
});
export const breadcrumbCurrent = style({ fontSize: t.size.xs, color: t.content.muted });

// ── Badges, status, alerts ──────────────────────────────────────────────────

const pill = {
  display: 'inline-flex', alignItems: 'center', gap: t.space['1'],
  fontSize: t.size.xs, fontWeight: t.weight.medium,
  borderRadius: t.radius.full,
  paddingLeft: t.space['3'], paddingRight: t.space['3'], paddingTop: 3, paddingBottom: 3,
  borderWidth: 1, borderStyle: 'solid',
} as const;

export const badge = style({ ...pill, color: t.accent.primary, background: t.surface.sunken, borderColor: t.border.subtle });
export const statusOk = style({ ...pill, color: t.success.content, background: t.surface.sunken, borderColor: t.success.solid });
export const statusError = style({ ...pill, color: t.danger.content, background: t.danger.surface, borderColor: t.danger.border });
export const statusNeutral = style({ ...pill, color: t.content.secondary, background: t.surface.sunken, borderColor: t.border.default });
export const badgeRow = layout.row({ gap: '2', align: 'center', wrap: true });

export const alert = cx(
  layout.stack({ gap: '2' }),
  style({
    background: t.surface.sunken, borderWidth: 1, borderStyle: 'solid', borderColor: t.border.default,
    borderRadius: t.radius.md, padding: t.space['4'],
    fontSize: t.size.sm, color: t.content.secondary,
  }),
);

/** Provenance notice — a left accent rule, blue, restrained. */
export const notice = style({
  background: t.surface.sunken,
  boxShadow: `inset 3px 0 0 ${t.accent.primary}`,
  borderWidth: 1, borderStyle: 'solid', borderColor: t.border.default,
  borderRadius: t.radius.md,
  paddingTop: t.space['3'], paddingBottom: t.space['3'],
  paddingLeft: t.space['4'], paddingRight: t.space['4'],
  fontSize: t.size.sm, color: t.content.secondary, maxWidth: PROSE_MAX,
});

export const errorBox = cx(
  layout.stack({ gap: '2' }),
  style({
    background: t.danger.surface, borderWidth: 1, borderStyle: 'solid', borderColor: t.danger.border,
    borderRadius: t.radius.md, padding: t.space['3'], color: t.danger.content, fontSize: t.size.sm,
  }),
);

export const table = style({ width: '100%', fontSize: t.size.sm, color: t.content.primary });

// ── Docs layout (sidebar + article + TOC) ────────────────────────────────────

export const docsLayout = style({
  display: 'grid', gap: t.space['8'], alignItems: 'start',
  gridTemplateColumns: { base: '1fr', md: '232px minmax(0, 1fr)', xl: '232px minmax(0, 1fr) 200px' },
});

export const docsSidebar = cx(
  layout.stack({ gap: '4' }),
  style({
    position: { base: 'static', md: 'sticky' }, top: 76,
    maxHeight: { md: 'calc(100vh - 92px)' }, overflowY: { md: 'auto' },
    paddingRight: t.space['2'],
  }),
);

export const docsSidebarGroupBlock = layout.stack({ gap: '1' });
export const docsSidebarGroup = style({
  fontSize: t.size.xs, fontWeight: t.weight.semibold, color: t.content.muted,
  textTransform: 'uppercase', letterSpacing: '0.06em',
  paddingLeft: t.space['2'], marginBottom: t.space['1'], marginTop: t.space['3'],
});

export const docsSidebarLink = style({
  display: 'block', fontSize: t.size.sm, color: t.content.secondary, textDecoration: 'none',
  borderRadius: t.radius.sm, paddingTop: 5, paddingBottom: 5,
  paddingLeft: t.space['2'], paddingRight: t.space['2'],
  boxShadow: `inset 2px 0 0 transparent`,
  on: {
    hover: { color: t.content.primary, background: t.surface.sunken },
    focusVisible: { outline: `2px solid ${t.focus.ring}`, outlineOffset: 2 },
  },
});

export const docsSidebarLinkActive = style({
  display: 'block', fontSize: t.size.sm, fontWeight: t.weight.semibold, color: t.accent.primary,
  textDecoration: 'none', borderRadius: t.radius.sm, paddingTop: 5, paddingBottom: 5,
  paddingLeft: t.space['2'], paddingRight: t.space['2'],
  background: t.surface.sunken, boxShadow: `inset 2px 0 0 ${t.accent.primary}`,
});

export const docsContent = cx(layout.stack({ gap: '5' }), style({ minWidth: 0, maxWidth: '78ch' }));
export const linkList = layout.stack({ gap: '2' });
export const pagerRow = style({
  display: 'grid', gap: t.space['3'],
  gridTemplateColumns: { base: '1fr', sm: '1fr 1fr' },
  marginTop: t.space['6'],
});

// Prev/next pager cards.
export const pagerLink = style({
  display: 'flex', flexDirection: 'column', gap: 2,
  textDecoration: 'none', color: t.content.primary,
  borderWidth: 1, borderStyle: 'solid', borderColor: t.border.default, borderRadius: t.radius.md,
  padding: t.space['4'],
  transition: animation.transition(['border-color', 'background'], { duration: 'fast' }),
  on: {
    hover: { borderColor: t.border.strong, background: t.surface.raised },
    focusVisible: { outline: `2px solid ${t.focus.ring}`, outlineOffset: 2 },
  },
});
export const pagerDir = style({ fontSize: t.size.xs, color: t.content.muted });
export const pagerTitle = style({ fontSize: t.size.sm, fontWeight: t.weight.semibold, color: t.accent.primary });
export const pagerNext = cx(pagerLink, style({ textAlign: 'right' }));

// In-page table of contents (right column, large screens).
export const docsToc = cx(
  layout.stack({ gap: '2' }),
  style({
    display: { base: 'none', xl: 'flex' },
    position: 'sticky', top: 76,
    boxShadow: `inset 2px 0 0 ${t.border.default}`,
    paddingLeft: t.space['4'],
  }),
);
export const docsTocTitle = style({
  fontSize: t.size.xs, fontWeight: t.weight.semibold, color: t.content.muted,
  textTransform: 'uppercase', letterSpacing: '0.06em',
});
export const docsTocLink = style({
  fontSize: t.size.sm, color: t.content.secondary, textDecoration: 'none', lineHeight: t.leading.normal,
  on: { hover: { color: t.accent.primary }, focusVisible: { outline: `2px solid ${t.focus.ring}`, outlineOffset: 2 } },
});

// A doc section heading that also serves as an anchor target under the sticky nav.
export const docHeading = style({
  fontFamily: t.font.sans, fontSize: t.size.xl, fontWeight: t.weight.semibold,
  lineHeight: t.leading.tight, letterSpacing: '-0.015em', color: t.content.primary,
  paddingTop: 72, marginTop: -48,
});

// ── Prose primitives (docs/guide/blog article bodies) ────────────────────────

export const prose = style({ fontSize: t.size.md, lineHeight: t.leading.relaxed, color: t.content.secondary, maxWidth: '78ch' });
export const proseList = cx(layout.stack({ gap: '2' }), style({ paddingLeft: t.space['4'] }));
export const proseListItem = style({
  position: 'relative', fontSize: t.size.md, lineHeight: t.leading.relaxed, color: t.content.secondary,
  boxShadow: `inset 6px 0 0 -4px ${t.border.strong}`, paddingLeft: t.space['3'],
});

// ── Playground / backend tools ────────────────────────────────────────────

export const fieldGroup = layout.stack({ gap: '2' });
export const fieldLabel = cx(text.label(), style({ color: t.content.primary }));

export const textInput = cx(form.input(), style({ width: '100%' }));
export const textarea = cx(
  form.input(),
  style({ fontFamily: t.font.mono, fontSize: t.size.sm, minHeight: 120, width: '100%' }),
);

export const outputBox = cx(
  layout.stack({ gap: '1' }),
  style({
    fontFamily: t.font.mono, fontSize: t.size.sm, color: codeFg,
    background: codeBg, borderWidth: 1, borderStyle: 'solid', borderColor: codeBorder,
    borderRadius: t.radius.md, padding: t.space['3'], overflowX: 'auto',
  }),
);

export const outputRow = style({ fontFamily: t.font.mono, fontSize: t.size.sm, color: codeFg, whiteSpace: 'pre-wrap' });

export const toolPanel = cx(
  layout.stack({ gap: '4' }),
  style({
    background: t.surface.raised, borderWidth: 1, borderStyle: 'solid', borderColor: t.border.default,
    borderRadius: t.radius.lg, padding: { base: t.space['4'], md: t.space['5'] },
  }),
);

export const toolGrid = style({
  display: 'grid', gap: t.space['5'],
  gridTemplateColumns: { base: '1fr', lg: 'repeat(2, minmax(0, 1fr))' },
  alignItems: 'start',
});

/** The namespace object — one import for the whole design system. */
export const ds = {
  appRoot, pageContainer, pageSection, pageBody, pageHeader, pageTitle, pageLead,
  sectionHeading, subHeading, bodyText, metaText, inlineLink, kicker,
  navBar, navInner, brand, brandLink, brandMark, navLinks, navLinkItem, navLinkActive, navActiveMark, navControls,
  themeToggle, menuToggle, searchTrigger, kbd,
  mobileMenu, mobileMenuLink, mobileMenuLinkActive,
  searchPanel, searchPanelHeader, searchPanelTitle, searchDialogInput, searchHint,
  searchResultsList, searchResultLink, searchResultTitle, searchResultMeta, searchEmpty,
  footer, footerInner, footerLinks, footerText, footerLink, skipLink,
  card, linkCardShell, cardTitleLink, cardSummary, cardGrid, cardGrid2, featureGrid,
  heroOuter, heroWrap, heroCol, heroTitle, heroLead, heroMetaRow, heroMetaItem,
  bandAlt, bandInner, sectionIntro,
  codeWindow, codeBar, codeDots, codeDot, codeName, codeCopy, codeScroll, codePre,
  tokPlain, tokComment, tokKeyword, tokString, tokNumber, tokType, tokDecorator, tokFn, tokPunct,
  codeBlock, codeLabel, codeSurface, inlineCode,
  buttonPrimary, buttonSecondary, buttonGhost, ctaRow,
  breadcrumbTrail, breadcrumbLink, breadcrumbCurrent,
  badge, statusOk, statusError, statusNeutral, badgeRow, alert, notice, errorBox, table,
  docsLayout, docsSidebar, docsSidebarGroupBlock, docsSidebarGroup, docsSidebarLink, docsSidebarLinkActive,
  docsContent, linkList, pagerRow, pagerLink, pagerDir, pagerTitle, pagerNext,
  docsToc, docsTocTitle, docsTocLink, docHeading,
  prose, proseList, proseListItem,
  fieldGroup, fieldLabel, textInput, textarea, outputBox, outputRow, toolPanel, toolGrid,
} as const;

/** Syntax-highlight token classes, keyed for the highlighter. */
export const codeTokens = {
  plain: tokPlain, comment: tokComment, keyword: tokKeyword, string: tokString,
  number: tokNumber, type: tokType, decorator: tokDecorator, fn: tokFn, punct: tokPunct,
} as const;
export type CodeTokenKind = keyof typeof codeTokens;

















