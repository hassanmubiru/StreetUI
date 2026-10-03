/**
 * StreetUI Stress App — design system ("Ledger", Theme B).
 *
 * This module is the single source of every visual class the stress app uses and
 * is the SECOND, materially different consumer of the StreetUI 2.7 styling model
 * (§V2.8). It exists to prove the unified styling surface stays coherent,
 * expressive and themeable outside the documentation website — so it deliberately
 * adopts a visual language the website does NOT share:
 *
 *   • A dense, operational ledger/commerce dashboard instead of a doc site.
 *   • A distinct palette — a deep-teal brand accent on a slate-neutral surface
 *     family, NOT the website's indigo accent / cool-grey surfaces.
 *   • Tighter, more compact spacing & control density (a 4px rhythm at half the
 *     website's generous gaps) and noticeably squarer radii.
 *   • A different type emphasis — heavier tabular/mono data numerals and a
 *     restrained sans hierarchy instead of the website's large editorial scale.
 *
 * Everything here is built ENTIRELY on StreetUI's public styling API — `style`,
 * `cx`, `styleVariants`, `styleWithVars`, `createThemeTokens`, `tokens`, plus the
 * `layout`/`text`/`form`/`a11y`/`overlay`/`animation` presets — with no CSS file,
 * no utility-class framework and no second styling system. Each export is a
 * deduplicated class token (a plain string) suitable to pass as the `class`
 * option to any DSL builder.
 *
 * INDEPENDENT TOKEN SET (§V2.8): the app registers its OWN token band via
 * `createThemeTokens({ light, dark })` under a `ledger-*` variable namespace. It
 * still composes the generic layout/text/form presets (which read the default
 * `--*` semantic tokens that always ship), but every bespoke surface below is
 * authored against the app's own `ledger.ref` variables — so the palette, density
 * and radii are provably not a restyle of the website's `tokens.ref` defaults.
 *
 * SSR DETERMINISM: every token below is computed at *module load*, so importing
 * this module registers the complete rule set into the shared `styleRegistry` up
 * front. Routes only *reference* these pre-registered tokens (they never call
 * `style()` with a fresh definition at render time), so the serialized stylesheet
 * is identical for every route regardless of which renders first.
 */

import {
  style,
  cx,
  styleVariants,
  createThemeTokens,
  layout,
  text,
  form,
  a11y,
  overlay,
  animation,
} from 'streetui';

// ── Independent theme tokens (Theme B) ────────────────────────────────────────

/**
 * The app's own token band. The `ledger` namespace keeps these variables distinct
 * from StreetUI's default `--*` semantic tokens so the two coexist in one sheet:
 * generic presets still read `--space-4` etc., while every bespoke surface here
 * reads `--ledger-*`. Dark mode re-points only the `ledger` colour/elevation
 * semantics; spacing, radii and type structure are theme-invariant.
 */
export const ledger = createThemeTokens({
  light: {
    // Surfaces — a slate-neutral operational chrome family (not the website's
    // near-white + raised cards). Dark header rail, light data canvas.
    surface: {
      app: '#f4f5f7',        // canvas
      rail: '#1d2733',       // persistent nav rail (dark even in light theme)
      card: '#ffffff',       // data surfaces
      sunken: '#eceef1',     // recessed / zebra
      line: '#e2e5e9',       // hairlines
      overlay: 'rgba(13,18,25,0.55)',
    },
    content: {
      primary: '#1a2430',
      secondary: '#4a5563',
      muted: '#6b7684',
      faint: '#93a0ae',
      onRail: '#eef2f6',     // text on the dark rail
      onRailDim: '#8b98a8',  // secondary text on the dark rail
      inverse: '#ffffff',
    },
    border: {
      default: '#dbe0e6',
      strong: '#bcc5cf',
      faint: '#eef1f4',
      onRail: '#2e3a49',
    },
    // A deep-teal brand accent — deliberately NOT the website's indigo.
    accent: {
      primary: '#0d7a6f',
      hover: '#0a655c',
      active: '#084f49',
      soft: '#e0f1ef',       // tint surface for selected/active fills
      contrast: '#ffffff',
    },
    focus: { ring: '#14a394' },
    danger: {
      surface: '#fdeceb', border: '#f5c6c2', content: '#b3271e', solid: '#d23a2f', onSoft: '#8f1d15',
    },
    warning: {
      surface: '#fdf3e2', border: '#f3dcae', content: '#8a5a13', solid: '#d99a26', onSoft: '#6d470e',
    },
    success: {
      surface: '#e6f4ea', border: '#bfe3c9', content: '#1c7a3d', solid: '#2a9d54', onSoft: '#155d2e',
    },
    info: {
      surface: '#e8f0fb', border: '#c3d7f2', content: '#1f5cb0', solid: '#2f6fd0', onSoft: '#174a8c',
    },
    // Tighter operational rhythm: a finer 4px scale with less whitespace than
    // the website's generous gaps.
    space: {
      '0': '0', '05': '2px', '1': '4px', '2': '8px', '3': '12px',
      '4': '16px', '5': '20px', '6': '24px', '8': '32px', '10': '40px', '12': '48px',
    },
    // Squarer radii — an operational/tool feel rather than the website's soft
    // rounding.
    radius: { xs: '2px', sm: '3px', md: '5px', lg: '8px', pill: '9999px' },
    font: {
      sans: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
    },
    size: { xs: '11px', sm: '12px', md: '13px', lg: '15px', xl: '18px', '2xl': '22px', '3xl': '28px' },
    weight: { normal: '400', medium: '500', semibold: '600', bold: '700' },
    leading: { tight: '1.25', normal: '1.45', relaxed: '1.6' },
    shadow: {
      sm: '0 1px 2px rgba(16,24,32,0.06)',
      md: '0 2px 8px rgba(16,24,32,0.10)',
      lg: '0 12px 32px rgba(16,24,32,0.18)',
      pop: '0 4px 16px rgba(16,24,32,0.14)',
    },
    z: { base: '0', rail: '20', sticky: '30', dropdown: '1000', overlay: '1100', toast: '1200' },
    duration: { fast: '100ms', base: '160ms', slow: '260ms' },
    easing: { standard: 'cubic-bezier(0.2,0,0,1)', out: 'cubic-bezier(0.16,1,0.3,1)' },
  },
  dark: {
    surface: {
      app: '#0d1218',
      rail: '#0a0e13',
      card: '#161d26',
      sunken: '#0a0e13',
      line: '#232c37',
      overlay: 'rgba(0,0,0,0.62)',
    },
    content: {
      primary: '#e7edf3',
      secondary: '#a7b3c0',
      muted: '#7d8a99',
      faint: '#5b6875',
      onRail: '#e7edf3',
      onRailDim: '#6d7a89',
      inverse: '#10161d',
    },
    border: {
      default: '#28323e',
      strong: '#3a4756',
      faint: '#1c242e',
      onRail: '#1d2733',
    },
    accent: {
      primary: '#2bbbad',
      hover: '#45d2c4',
      active: '#5ee0d3',
      soft: '#0e2f2c',
      contrast: '#08110f',
    },
    focus: { ring: '#35c9bc' },
    danger: {
      surface: '#34110f', border: '#5d201c', content: '#f49d95', solid: '#e55a4d', onSoft: '#ffb3ad',
    },
    warning: {
      surface: '#33260f', border: '#59421a', content: '#eec27a', solid: '#e0a63a', onSoft: '#ffd68f',
    },
    success: {
      surface: '#0f2c1a', border: '#1d4a2c', content: '#7fd6a0', solid: '#3ab968', onSoft: '#98e2b6',
    },
    info: {
      surface: '#0f2540', border: '#1f4268', content: '#8fbcf2', solid: '#4a8ae0', onSoft: '#a9ccf6',
    },
    shadow: {
      sm: '0 1px 2px rgba(0,0,0,0.5)',
      md: '0 2px 10px rgba(0,0,0,0.55)',
      lg: '0 14px 40px rgba(0,0,0,0.6)',
      pop: '0 6px 20px rgba(0,0,0,0.55)',
    },
  },
});

// Shorthand for the app's token references.
const L = ledger.ref;

// ── App scaffold / chrome ─────────────────────────────────────────────────────

/**
 * The whole-app grid: a fixed-width nav rail on the left and a scrollable content
 * column on the right. Collapses to a single stacked column under `md` (the rail
 * then becomes a top bar) — responsive, no JS.
 */
export const appShell = style({
  display: 'grid',
  gridTemplateColumns: { base: '1fr', md: '248px minmax(0, 1fr)' },
  minHeight: '100vh',
  background: L.surface.app,
  color: L.content.primary,
  fontFamily: L.font.sans,
  fontSize: L.size.md,
  lineHeight: L.leading.normal,
});

/** The persistent left navigation rail (dark even in light theme — signature). */
export const rail = cx(
  layout.stack({ gap: '0' }),
  style({
    background: L.surface.rail,
    color: L.content.onRail,
    boxShadow: { base: `inset 0 -1px 0 ${L.border.onRail}`, md: `inset -1px 0 0 ${L.border.onRail}` },
    paddingTop: L.space['4'],
    paddingBottom: L.space['4'],
    position: { base: 'relative', md: 'sticky' },
    top: { base: 0, md: 0 },
    height: { base: 'auto', md: '100vh' },
    alignSelf: { base: 'auto', md: 'start' },
    overflowY: { base: 'visible', md: 'auto' },
  }),
);

/** The brand block at the top of the rail. */
export const railBrand = style({
  fontFamily: L.font.sans,
  fontSize: L.size.xl,
  fontWeight: L.weight.bold,
  letterSpacing: '-0.02em',
  color: L.content.onRail,
  paddingLeft: L.space['4'],
  paddingRight: L.space['4'],
  paddingBottom: L.space['4'],
});

/** The small caption under the brand wordmark. */
export const railTagline = style({
  fontFamily: L.font.sans,
  fontSize: L.size.xs,
  fontWeight: L.weight.medium,
  color: L.content.onRailDim,
  paddingLeft: L.space['4'],
  paddingRight: L.space['4'],
  paddingBottom: L.space['4'],
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
});

/** A group of nav links inside the rail. */
export const railNav = cx(
  layout.stack({ gap: '05' }),
  style({ paddingLeft: L.space['2'], paddingRight: L.space['2'] }),
);

/** A single nav link in the rail. Active state rides `[data-current]`. */
export const railLink = style({
  display: 'flex',
  alignItems: 'center',
  gap: L.space['2'],
  fontFamily: L.font.sans,
  fontSize: L.size.md,
  fontWeight: L.weight.medium,
  color: L.content.onRailDim,
  textDecoration: 'none',
  borderRadius: L.radius.md,
  paddingTop: L.space['2'],
  paddingBottom: L.space['2'],
  paddingLeft: L.space['3'],
  paddingRight: L.space['3'],
  transition: `background ${L.duration.fast} ${L.easing.standard}, color ${L.duration.fast} ${L.easing.standard}`,
  on: {
    hover: { color: L.content.onRail, background: 'rgba(255,255,255,0.06)' },
    focusVisible: { outline: `2px solid ${L.focus.ring}`, outlineOffset: -2 },
  },
  when: {
    current: {
      color: L.content.onRail,
      background: L.accent.primary,
      fontWeight: L.weight.semibold,
    },
  },
});

/** A short divider between rail link groups. */
export const railDivider = style({
  height: 1,
  background: L.border.onRail,
  marginTop: L.space['3'],
  marginBottom: L.space['3'],
  marginLeft: L.space['4'],
  marginRight: L.space['4'],
});

/** The scrollable content column (everything right of the rail). */
export const contentCol = cx(
  layout.stack({ gap: '0' }),
  style({ minWidth: 0 }),
);

/** The top application bar inside the content column (sticky, translucent). */
export const topbar = cx(
  layout.row({ gap: '3', align: 'center', justify: 'between', wrap: true }),
  style({
    position: 'sticky',
    top: 0,
    zIndex: L.z.sticky,
    background: L.surface.app,
    borderBottom: `1px solid ${L.surface.line}`,
    paddingLeft: { base: L.space['4'], lg: L.space['6'] },
    paddingRight: { base: L.space['4'], lg: L.space['6'] },
    paddingTop: L.space['3'],
    paddingBottom: L.space['3'],
  }),
);

/** The breadcrumb / page-context title inside the topbar. */
export const topbarTitle = style({
  fontFamily: L.font.sans,
  fontSize: L.size.md,
  fontWeight: L.weight.semibold,
  color: L.content.primary,
});

/** The right-aligned action cluster in the topbar. */
export const topbarActions = layout.row({ gap: '2', align: 'center', wrap: true });

/** A page region: vertical rhythm + side padding inside the content column. */
export const page = cx(
  layout.stack({ gap: '5' }),
  style({
    paddingLeft: { base: L.space['4'], lg: L.space['6'] },
    paddingRight: { base: L.space['4'], lg: L.space['6'] },
    paddingTop: L.space['5'],
    paddingBottom: L.space['8'],
  }),
);

/** The page header row (title + description + primary action). */
export const pageHeader = cx(
  layout.row({ gap: '4', align: 'start', justify: 'between', wrap: true }),
);

export const pageTitleBlock = layout.stack({ gap: '1' });

/** The page h1 — compact and operational rather than editorial. */
export const pageTitle = style({
  fontFamily: L.font.sans,
  fontSize: L.size['2xl'],
  fontWeight: L.weight.bold,
  lineHeight: L.leading.tight,
  color: L.content.primary,
  letterSpacing: '-0.015em',
});

/** A one-line description under the page title. */
export const pageSubtitle = style({
  fontFamily: L.font.sans,
  fontSize: L.size.md,
  color: L.content.secondary,
});

// ── Cards, panels & metric tiles ─────────────────────────────────────────────

/** A generic surface card — the dashboard's atomic container. */
export const card = cx(
  layout.stack({ gap: '4' }),
  style({
    background: L.surface.card,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: L.border.default,
    borderRadius: L.radius.lg,
    padding: L.space['5'],
  }),
);

/** A card whose header carries a title and an optional trailing control. */
export const cardHeader = layout.row({ gap: '3', align: 'center', justify: 'between', wrap: true });

/** The small heading inside a card. */
export const cardTitle = style({
  fontFamily: L.font.sans,
  fontSize: L.size.lg,
  fontWeight: L.weight.semibold,
  color: L.content.primary,
});

/** Muted helper text inside a card. */
export const cardHint = style({
  fontFamily: L.font.sans,
  fontSize: L.size.sm,
  color: L.content.muted,
});

/** A responsive auto-fill grid of metric tiles (KPI cards). */
export const metricGrid = style({
  display: 'grid',
  gap: L.space['4'],
  gridTemplateColumns: { base: '1fr', sm: 'repeat(2, minmax(0,1fr))', xl: 'repeat(4, minmax(0,1fr))' },
});

/** One KPI tile: a compact card with a label, big value and a delta. */
export const metricTile = cx(
  layout.stack({ gap: '2' }),
  style({
    background: L.surface.card,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: L.border.default,
    borderRadius: L.radius.lg,
    padding: L.space['4'],
    transition: `box-shadow ${L.duration.base} ${L.easing.standard}, border-color ${L.duration.base} ${L.easing.standard}`,
    on: { hover: { boxShadow: L.shadow.sm, borderColor: L.border.strong } },
  }),
);

export const metricLabel = style({
  fontFamily: L.font.sans,
  fontSize: L.size.sm,
  fontWeight: L.weight.medium,
  color: L.content.muted,
  letterSpacing: '0.02em',
  textTransform: 'uppercase',
});

/** The big metric number — mono tabular for easy scanning of data. */
export const metricValue = style({
  fontFamily: L.font.mono,
  fontSize: L.size['3xl'],
  fontWeight: L.weight.semibold,
  lineHeight: L.leading.tight,
  color: L.content.primary,
  letterSpacing: '-0.02em',
});

/** The delta line under a metric value; up/down variants are applied via `when`. */
export const metricDelta = styleVariants({
  base: {
    fontFamily: L.font.sans,
    fontSize: L.size.sm,
    fontWeight: L.weight.medium,
  },
  variants: {
    trend: {
      up: { color: L.success.content },
      down: { color: L.danger.content },
      flat: { color: L.content.muted },
    },
  },
  defaultVariants: { trend: 'flat' },
});

/** A two-column content split that collapses to one column under `lg`. */
export const splitGrid = style({
  display: 'grid',
  gap: L.space['4'],
  gridTemplateColumns: { base: '1fr', lg: 'repeat(2, minmax(0, 1fr))' },
  alignItems: 'start',
});

/** A primary content column next to a narrower aside (2fr / 1fr). */
export const mainAside = style({
  display: 'grid',
  gap: L.space['4'],
  gridTemplateColumns: { base: '1fr', xl: 'minmax(0, 2fr) minmax(0, 1fr)' },
  alignItems: 'start',
});

// ── Badges, chips & status pills ─────────────────────────────────────────────

/**
 * A status badge — the recurring semantic pill across the app (order status,
 * stock state, health). All four intents share one base; the variant selects the
 * colourway. The `when:` component-state channel is NOT needed here because the
 * variant is chosen at build time from data.
 */
export const badge = styleVariants({
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: L.space['1'],
    fontFamily: L.font.sans,
    fontSize: L.size.xs,
    fontWeight: L.weight.semibold,
    borderRadius: L.radius.pill,
    paddingTop: L.space['05'],
    paddingBottom: L.space['05'],
    paddingLeft: L.space['2'],
    paddingRight: L.space['2'],
    letterSpacing: '0.02em',
    borderWidth: 1,
    borderStyle: 'solid',
    whiteSpace: 'nowrap',
  },
  variants: {
    intent: {
      neutral: { color: L.content.secondary, background: L.surface.sunken, borderColor: L.border.default },
      success: { color: L.success.onSoft, background: L.success.surface, borderColor: L.success.border },
      warning: { color: L.warning.onSoft, background: L.warning.surface, borderColor: L.warning.border },
      danger: { color: L.danger.onSoft, background: L.danger.surface, borderColor: L.danger.border },
      info: { color: L.info.onSoft, background: L.info.surface, borderColor: L.info.border },
      accent: { color: L.accent.contrast, background: L.accent.primary, borderColor: L.accent.primary },
    },
  },
  defaultVariants: { intent: 'neutral' },
});

/** A tiny count chip (e.g. "3" unread) — square-ish, high contrast. */
export const countChip = style({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 18,
  height: 18,
  fontFamily: L.font.sans,
  fontSize: L.size.xs,
  fontWeight: L.weight.bold,
  color: L.accent.contrast,
  background: L.accent.primary,
  borderRadius: L.radius.pill,
  paddingLeft: L.space['1'],
  paddingRight: L.space['1'],
});

// ── Buttons ──────────────────────────────────────────────────────────────────

/**
 * A real button family via `styleVariants`. `intent` picks the colourway,
 * `size` the density, `ghost` flips to an outline/quiet treatment. Selection is
 * purely build-time → no runtime style work.
 */
export const button = styleVariants({
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: L.space['2'],
    fontFamily: L.font.sans,
    fontWeight: L.weight.semibold,
    borderWidth: 1,
    borderStyle: 'solid',
    borderRadius: L.radius.md,
    cursor: 'pointer',
    appearance: 'none',
    textDecoration: 'none',
    whiteSpace: 'nowrap',
    userSelect: 'none',
    transition: `background ${L.duration.fast} ${L.easing.standard}, border-color ${L.duration.fast} ${L.easing.standard}, box-shadow ${L.duration.fast} ${L.easing.standard}`,
    on: {
      focusVisible: { outline: 'none', boxShadow: `0 0 0 3px ${L.focus.ring}` },
      disabled: { opacity: 0.5, cursor: 'not-allowed', pointerEvents: 'none' },
    },
  },
  variants: {
    intent: {
      primary: {
        background: L.accent.primary,
        borderColor: L.accent.primary,
        color: L.accent.contrast,
        on: { hover: { background: L.accent.hover, borderColor: L.accent.hover } },
      },
      danger: {
        background: L.danger.solid,
        borderColor: L.danger.solid,
        color: L.content.inverse,
        on: { hover: { background: L.danger.content, borderColor: L.danger.content } },
      },
      quiet: {
        background: 'transparent',
        borderColor: L.border.strong,
        color: L.content.primary,
        on: { hover: { background: L.surface.sunken, borderColor: L.border.strong } },
      },
      subtle: {
        background: L.surface.sunken,
        borderColor: 'transparent',
        color: L.content.primary,
        on: { hover: { background: L.border.faint } },
      },
    },
    size: {
      sm: { fontSize: L.size.sm, paddingTop: L.space['1'], paddingBottom: L.space['1'], paddingLeft: L.space['2'], paddingRight: L.space['2'] },
      md: { fontSize: L.size.md, paddingTop: L.space['2'], paddingBottom: L.space['2'], paddingLeft: L.space['4'], paddingRight: L.space['4'] },
      lg: { fontSize: L.size.lg, paddingTop: L.space['3'], paddingBottom: L.space['3'], paddingLeft: L.space['5'], paddingRight: L.space['5'] },
    },
    busy: {
      idle: {},
      loading: { opacity: 0.7, cursor: 'progress', pointerEvents: 'none' },
    },
  },
  defaultVariants: { intent: 'primary', size: 'md', busy: 'idle' },
});

/** A compact icon-adjacent action used inside table rows and card headers. */
export const iconButton = style({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 28,
  height: 28,
  fontFamily: L.font.sans,
  fontSize: L.size.sm,
  color: L.content.secondary,
  background: 'transparent',
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: 'transparent',
  borderRadius: L.radius.md,
  cursor: 'pointer',
  transition: `background ${L.duration.fast} ${L.easing.standard}, color ${L.duration.fast} ${L.easing.standard}`,
  on: {
    hover: { background: L.surface.sunken, color: L.content.primary },
    focusVisible: { outline: `2px solid ${L.focus.ring}`, outlineOffset: -2 },
    disabled: { opacity: 0.4, cursor: 'not-allowed', pointerEvents: 'none' },
  },
});

// ── Data tables ──────────────────────────────────────────────────────────────

/** The wrapping region that gives a table a card-like frame + horizontal scroll. */
export const tableWrap = style({
  background: L.surface.card,
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: L.border.default,
  borderRadius: L.radius.lg,
  overflow: 'hidden',
  overflowX: 'auto',
});

/**
 * A data table surface. StreetUI's DSL has no `table()` node, so tables are
 * composed from container + list rows styled as a grid — but each ROW can also
 * carry a real header/zebra/hover treatment. `when:` drives selected/expanded
 * row states through `[data-*]` attributes.
 */
export const tableHeadRow = style({
  display: 'grid',
  gap: L.space['3'],
  alignItems: 'center',
  fontFamily: L.font.sans,
  fontSize: L.size.xs,
  fontWeight: L.weight.semibold,
  color: L.content.muted,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  paddingTop: L.space['2'],
  paddingBottom: L.space['2'],
  paddingLeft: L.space['4'],
  paddingRight: L.space['4'],
  borderBottom: `1px solid ${L.border.default}`,
  background: L.surface.sunken,
});

/** A body row: a grid row that highlights on hover and marks selected/expanded. */
export const tableRow = style({
  display: 'grid',
  gap: L.space['3'],
  alignItems: 'center',
  fontFamily: L.font.sans,
  fontSize: L.size.md,
  color: L.content.primary,
  paddingTop: L.space['3'],
  paddingBottom: L.space['3'],
  paddingLeft: L.space['4'],
  paddingRight: L.space['4'],
  borderBottom: `1px solid ${L.border.faint}`,
  transition: `background ${L.duration.fast} ${L.easing.standard}`,
  on: {
    hover: { background: L.surface.sunken },
    lastChild: { borderBottom: 'none' },
  },
  when: {
    selected: { background: L.accent.soft, boxShadow: `inset 3px 0 0 ${L.accent.primary}` },
    expanded: { background: L.surface.sunken },
    current: { background: L.accent.soft },
  },
});

/** A numeric/table cell that right-aligns and uses mono tabular figures. */
export const cellNum = style({
  fontFamily: L.font.mono,
  fontSize: L.size.md,
  color: L.content.primary,
  textAlign: 'right',
});

/** A muted secondary cell (id, date, category). */
export const cellMeta = style({
  fontFamily: L.font.sans,
  fontSize: L.size.sm,
  color: L.content.muted,
});

/** A primary text cell. */
export const cellText = style({
  fontFamily: L.font.sans,
  fontSize: L.size.md,
  color: L.content.primary,
  overflow: 'hidden',
  whiteSpace: 'nowrap',
});

// ── Tabs ─────────────────────────────────────────────────────────────────────

/** The tab strip container — an underlined row of tab buttons. */
export const tabList = style({
  display: 'flex',
  gap: L.space['1'],
  borderBottom: `1px solid ${L.border.default}`,
  overflowX: 'auto',
});

/** A single tab. Active state rides `[data-current]`/`[data-active]`. */
export const tab = style({
  fontFamily: L.font.sans,
  fontSize: L.size.md,
  fontWeight: L.weight.medium,
  color: L.content.secondary,
  background: 'transparent',
  border: 0,
  borderBottom: `2px solid transparent`,
  paddingTop: L.space['2'],
  paddingBottom: L.space['2'],
  paddingLeft: L.space['3'],
  paddingRight: L.space['3'],
  cursor: 'pointer',
  marginBottom: -1,
  whiteSpace: 'nowrap',
  transition: `color ${L.duration.fast} ${L.easing.standard}, border-color ${L.duration.fast} ${L.easing.standard}`,
  on: {
    hover: { color: L.content.primary },
    focusVisible: { outline: `2px solid ${L.focus.ring}`, outlineOffset: -2 },
  },
  when: {
    current: { color: L.accent.primary, borderBottom: `2px solid ${L.accent.primary}`, fontWeight: L.weight.semibold },
    active: { color: L.accent.primary, borderBottom: `2px solid ${L.accent.primary}`, fontWeight: L.weight.semibold },
  },
});

// ── Pagination ───────────────────────────────────────────────────────────────

/** The pagination control row (prev / pages / next + count). */
export const pagination = layout.row({ gap: '2', align: 'center', justify: 'between', wrap: true });

/** The cluster of numbered page buttons. */
export const pageButtons = layout.row({ gap: '1', align: 'center' });

/** A numbered/arrow page control; current page marked via `[data-current]`. */
export const pageButton = style({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 30,
  height: 30,
  fontFamily: L.font.sans,
  fontSize: L.size.sm,
  fontWeight: L.weight.medium,
  color: L.content.secondary,
  background: L.surface.card,
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: L.border.default,
  borderRadius: L.radius.md,
  cursor: 'pointer',
  paddingLeft: L.space['2'],
  paddingRight: L.space['2'],
  transition: `background ${L.duration.fast} ${L.easing.standard}, color ${L.duration.fast} ${L.easing.standard}, border-color ${L.duration.fast} ${L.easing.standard}`,
  on: {
    hover: { borderColor: L.border.strong, color: L.content.primary },
    focusVisible: { outline: `2px solid ${L.focus.ring}`, outlineOffset: -2 },
    disabled: { opacity: 0.4, cursor: 'not-allowed', pointerEvents: 'none' },
  },
  when: {
    current: { background: L.accent.primary, borderColor: L.accent.primary, color: L.accent.contrast, fontWeight: L.weight.semibold },
  },
});

// ── Filters & toolbar ────────────────────────────────────────────────────────

/** The filter/toolbar strip above a list — search + segmented controls + actions. */
export const toolbar = cx(
  layout.row({ gap: '3', align: 'center', justify: 'between', wrap: true }),
  style({
    background: L.surface.card,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: L.border.default,
    borderRadius: L.radius.lg,
    padding: L.space['3'],
  }),
);

/** The group of filter controls inside the toolbar. */
export const toolbarGroup = layout.row({ gap: '2', align: 'center', wrap: true });

/** A segmented control row (a group of mutually-exclusive filter toggles). */
export const segmentGroup = style({
  display: 'inline-flex',
  gap: 0,
  background: L.surface.sunken,
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: L.border.default,
  borderRadius: L.radius.md,
  padding: 2,
});

/** One segment inside a segmented control; active rides `[data-current]`. */
export const segment = style({
  fontFamily: L.font.sans,
  fontSize: L.size.sm,
  fontWeight: L.weight.medium,
  color: L.content.secondary,
  background: 'transparent',
  border: 0,
  borderRadius: L.radius.sm,
  paddingTop: L.space['1'],
  paddingBottom: L.space['1'],
  paddingLeft: L.space['3'],
  paddingRight: L.space['3'],
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  transition: `background ${L.duration.fast} ${L.easing.standard}, color ${L.duration.fast} ${L.easing.standard}`,
  on: {
    hover: { color: L.content.primary },
    focusVisible: { outline: `2px solid ${L.focus.ring}`, outlineOffset: -2 },
  },
  when: {
    current: { background: L.surface.card, color: L.content.primary, fontWeight: L.weight.semibold, boxShadow: L.shadow.sm },
  },
});

// ── Forms ────────────────────────────────────────────────────────────────────

/** A field wrapper (label + control + help/error). Reuses the form preset shape. */
export const field = form.field();

/** A field label. */
export const fieldLabel = style({
  fontFamily: L.font.sans,
  fontSize: L.size.sm,
  fontWeight: L.weight.medium,
  color: L.content.primary,
});

/** A single-line input/select surface, themed to the app's tokens. */
export const input = style({
  fontFamily: L.font.sans,
  fontSize: L.size.md,
  lineHeight: L.leading.normal,
  color: L.content.primary,
  background: L.surface.card,
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: L.border.strong,
  borderRadius: L.radius.md,
  paddingTop: L.space['2'],
  paddingBottom: L.space['2'],
  paddingLeft: L.space['3'],
  paddingRight: L.space['3'],
  width: '100%',
  appearance: 'none',
  transition: `border-color ${L.duration.fast} ${L.easing.standard}, box-shadow ${L.duration.fast} ${L.easing.standard}`,
  on: {
    focusVisible: { outline: 'none', borderColor: L.accent.primary, boxShadow: `0 0 0 3px ${L.focus.ring}` },
    disabled: { opacity: 0.55, cursor: 'not-allowed', background: L.surface.sunken },
  },
  when: {
    invalid: { borderColor: L.danger.solid, boxShadow: `0 0 0 3px ${L.danger.surface}` },
  },
});

/** Compact input used in toolbars/search (smaller padding). */
export const inputCompact = cx(
  input,
  style({ fontSize: L.size.sm, paddingTop: L.space['1'], paddingBottom: L.space['1'], paddingLeft: L.space['2'], paddingRight: L.space['2'] }),
);

/** Helper text under a control. */
export const fieldHelp = style({
  fontFamily: L.font.sans,
  fontSize: L.size.xs,
  color: L.content.muted,
});

/** A validation error line under a control. */
export const fieldError = style({
  fontFamily: L.font.sans,
  fontSize: L.size.xs,
  fontWeight: L.weight.medium,
  color: L.danger.content,
});

/** A two-column form grid that collapses to one column under `md`. */
export const formGrid = style({
  display: 'grid',
  gap: L.space['4'],
  gridTemplateColumns: { base: '1fr', md: 'repeat(2, minmax(0,1fr))' },
});

// ── Alerts & callouts ────────────────────────────────────────────────────────

/** An inline alert/callout surface; intent selects the colourway. */
export const alert = styleVariants({
  base: {
    display: 'flex',
    gap: L.space['3'],
    alignItems: 'flex-start',
    fontFamily: L.font.sans,
    fontSize: L.size.md,
    borderRadius: L.radius.md,
    borderWidth: 1,
    borderStyle: 'solid',
    padding: L.space['4'],
  },
  variants: {
    intent: {
      info: { background: L.info.surface, borderColor: L.info.border, color: L.info.content },
      success: { background: L.success.surface, borderColor: L.success.border, color: L.success.content },
      warning: { background: L.warning.surface, borderColor: L.warning.border, color: L.warning.content },
      danger: { background: L.danger.surface, borderColor: L.danger.border, color: L.danger.content },
      neutral: { background: L.surface.sunken, borderColor: L.border.default, color: L.content.secondary },
    },
  },
  defaultVariants: { intent: 'info' },
});

// ── States: loading, empty, error, skeleton ─────────────────────────────────

/** A centered region for loading/empty/error states inside a panel. */
export const stateRegion = cx(
  layout.center(),
  layout.stack({ gap: '3', align: 'center' }),
  style({ paddingTop: L.space['8'], paddingBottom: L.space['8'], paddingLeft: L.space['4'], paddingRight: L.space['4'], color: L.content.muted }),
);

/** A spinning loader indicator (pure CSS via the keyframes helper). */
export const spinner = cx(
  animation.animate('streetui-spin', { duration: 'slow', iterations: 'infinite' }),
  style({
    width: 22,
    height: 22,
    borderRadius: L.radius.pill,
    borderWidth: 2,
    borderStyle: 'solid',
    borderColor: L.border.strong,
    // Use a transparent top border to read as a spinner arc.
  }),
);

/** A skeleton placeholder bar (loading shimmer, deterministic — no JS). */
export const skeleton = style({
  background: `linear-gradient(90deg, ${L.surface.sunken} 0%, ${L.surface.card} 50%, ${L.surface.sunken} 100%)`,
  borderRadius: L.radius.sm,
  minHeight: 12,
});

/** The title of an empty/error state. */
export const stateTitle = style({
  fontFamily: L.font.sans,
  fontSize: L.size.lg,
  fontWeight: L.weight.semibold,
  color: L.content.primary,
});

/** Supporting copy for an empty/error state. */
export const stateHint = style({
  fontFamily: L.font.sans,
  fontSize: L.size.md,
  color: L.content.muted,
  textAlign: 'center',
  maxWidth: 420,
});

// ── Overlays (re-themed surfaces) ───────────────────────────────────────────

/** A dialog panel themed to the app (squarer radius, app tokens). */
export const dialogPanel = style({
  position: 'relative',
  background: L.surface.card,
  color: L.content.primary,
  borderRadius: L.radius.lg,
  boxShadow: L.shadow.lg,
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: L.border.default,
  padding: L.space['6'],
  maxWidth: 'min(520px, calc(100vw - 32px))',
  width: '100%',
  zIndex: L.z.overlay,
});

/** The dimmed backdrop behind a modal. */
export const backdrop = style({
  position: 'fixed',
  inset: 0,
  background: L.surface.overlay,
  zIndex: L.z.overlay,
});

/** A dropdown menu surface themed to the app. */
export const dropdownMenu = style({
  position: 'absolute',
  background: L.surface.card,
  color: L.content.primary,
  borderRadius: L.radius.md,
  boxShadow: L.shadow.pop,
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: L.border.default,
  paddingTop: L.space['1'],
  paddingBottom: L.space['1'],
  minWidth: 180,
  zIndex: L.z.dropdown,
});

/** A single dropdown menu item. */
export const dropdownItem = style({
  display: 'flex',
  alignItems: 'center',
  gap: L.space['2'],
  fontFamily: L.font.sans,
  fontSize: L.size.md,
  color: L.content.primary,
  paddingTop: L.space['2'],
  paddingBottom: L.space['2'],
  paddingLeft: L.space['3'],
  paddingRight: L.space['3'],
  cursor: 'pointer',
  on: {
    hover: { background: L.surface.sunken },
    disabled: { opacity: 0.5, cursor: 'not-allowed' },
    focusVisible: { outline: `2px solid ${L.focus.ring}`, outlineOffset: -2 },
  },
  when: { selected: { background: L.accent.soft, fontWeight: L.weight.medium } },
});

/** A compact tooltip bubble. */
export const tooltipBubble = style({
  position: 'absolute',
  background: L.content.primary,
  color: L.surface.card,
  fontFamily: L.font.sans,
  fontSize: L.size.xs,
  lineHeight: L.leading.tight,
  borderRadius: L.radius.sm,
  paddingTop: L.space['1'],
  paddingBottom: L.space['1'],
  paddingLeft: L.space['2'],
  paddingRight: L.space['2'],
  maxWidth: 240,
  zIndex: L.z.overlay,
  pointerEvents: 'none',
});

/** A toast notification surface. */
export const toastSurface = style({
  background: L.surface.card,
  color: L.content.primary,
  borderRadius: L.radius.md,
  boxShadow: L.shadow.lg,
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: L.border.default,
  padding: L.space['4'],
  minWidth: 260,
  maxWidth: 420,
  zIndex: L.z.toast,
});

// ── Accessibility ────────────────────────────────────────────────────────────

/** A keyboard focus ring composed onto any interactive element. */
export const focusRing = a11y.focusRing({ color: L.focus.ring });

/** Visually-hidden-but-AT-available content (sr-only). */
export const visuallyHidden = a11y.visuallyHidden();

/** A skip-to-content link revealed on keyboard focus. */
export const skipLink = a11y.skipLink();

// ── Convenience text roles (themed) ─────────────────────────────────────────

/** The app's muted caption/metadata text. */
export const metaText = style({
  fontFamily: L.font.sans,
  fontSize: L.size.xs,
  color: L.content.muted,
  lineHeight: L.leading.normal,
});

/** A numeric/data emphasis (mono). */
export const dataText = style({
  fontFamily: L.font.mono,
  fontSize: L.size.md,
  color: L.content.primary,
});

/** An inline link themed to the app's accent. */
export const inlineLink = style({
  color: L.accent.primary,
  textDecoration: 'underline',
  cursor: 'pointer',
  borderRadius: L.radius.xs,
  on: {
    hover: { color: L.accent.hover },
    focusVisible: { outline: `2px solid ${L.focus.ring}`, outlineOffset: 2 },
  },
});

/** Section heading inside a card or panel (h2/h3 scale). */
export const sectionHeading = style({
  fontFamily: L.font.sans,
  fontSize: L.size.lg,
  fontWeight: L.weight.semibold,
  color: L.content.primary,
});

// ── Namespace object ─────────────────────────────────────────────────────────

/** One import for the whole design system. */
export const ds = {
  ledger,
  appShell, rail, railBrand, railTagline, railNav, railLink, railDivider,
  contentCol, topbar, topbarTitle, topbarActions,
  page, pageHeader, pageTitleBlock, pageTitle, pageSubtitle,
  card, cardHeader, cardTitle, cardHint,
  metricGrid, metricTile, metricLabel, metricValue, metricDelta,
  splitGrid, mainAside,
  badge, countChip,
  button, iconButton,
  tableWrap, tableHeadRow, tableRow, cellNum, cellMeta, cellText,
  tabList, tab,
  pagination, pageButtons, pageButton,
  toolbar, toolbarGroup, segmentGroup, segment,
  field, fieldLabel, input, inputCompact, fieldHelp, fieldError, formGrid,
  alert,
  stateRegion, spinner, skeleton, stateTitle, stateHint,
  dialogPanel, backdrop, dropdownMenu, dropdownItem, tooltipBubble, toastSurface,
  focusRing, visuallyHidden, skipLink,
  metaText, dataText, inlineLink, sectionHeading,
} as const;
