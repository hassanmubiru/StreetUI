/**
 * StreetJS website design system.
 * Built entirely on the StreetUI 3.0.0 public styling API.
 */
import {
  style, cx, styleVariants, createThemeTokens, layout, text, a11y, tokens,
} from 'streetui';

// ── Theme tokens ───────────────────────────────────────────────────────────

export const brand = createThemeTokens({
  light: {
    surface: { app: '#f8fafc', card: '#ffffff', rail: '#0f172a', sunken: '#f1f5f9', line: '#e2e8f0', overlay: 'rgba(0,0,0,0.4)' },
    content: { primary: '#0f172a', secondary: '#475569', muted: '#64748b', inverse: '#ffffff' },
    border: { default: '#e2e8f0', strong: '#cbd5e1', faint: '#f1f5f9' },
    accent: { primary: '#3b82f6', hover: '#2563eb', soft: '#eff6ff', contrast: '#ffffff' },
    focus: { ring: '#3b82f6' },
    space: { '1': '4px', '2': '8px', '3': '12px', '4': '16px', '5': '24px', '6': '32px', '8': '48px', '10': '64px', '12': '80px' },
    radius: { sm: '4px', md: '8px', lg: '12px', xl: '16px', pill: '9999px' },
    font: { sans: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' },
    size: { xs: '12px', sm: '14px', md: '16px', lg: '18px', xl: '20px', '2xl': '24px', '3xl': '30px', '4xl': '36px', '5xl': '48px' },
    weight: { normal: '400', medium: '500', semibold: '600', bold: '700' },
    leading: { tight: '1.25', normal: '1.5', relaxed: '1.75' },
    shadow: { sm: '0 1px 2px rgba(0,0,0,0.05)', md: '0 4px 6px rgba(0,0,0,0.07)', lg: '0 10px 25px rgba(0,0,0,0.1)' },
    z: { sticky: '40', overlay: '100' },
    duration: { fast: '150ms', base: '200ms' },
    easing: { standard: 'cubic-bezier(0.4,0,0.2,1)' },
  },
  dark: {
    surface: { app: '#0f172a', card: '#1e293b', rail: '#020617', sunken: '#0f172a', line: '#334155', overlay: 'rgba(0,0,0,0.6)' },
    content: { primary: '#f1f5f9', secondary: '#94a3b8', muted: '#64748b', inverse: '#0f172a' },
    border: { default: '#334155', strong: '#475569', faint: '#1e293b' },
    accent: { primary: '#60a5fa', hover: '#93c5fd', soft: '#1e3a5f', contrast: '#0f172a' },
    focus: { ring: '#60a5fa' },
    shadow: { sm: '0 1px 3px rgba(0,0,0,0.3)', md: '0 4px 8px rgba(0,0,0,0.4)', lg: '0 10px 30px rgba(0,0,0,0.5)' },
  },
});

const B = brand.ref;

// ── Layout ─────────────────────────────────────────────────────────────────

export const siteLayout = style({
  minHeight: '100vh',
  background: B.surface.app,
  color: B.content.primary,
  fontFamily: B.font.sans,
  fontSize: B.size.md,
  lineHeight: B.leading.normal,
});

export const siteHeader = style({
  position: 'sticky', top: 0, zIndex: B.z.sticky,
  background: B.surface.app,
  boxShadow: `inset 0 -1px 0 ${B.surface.line}`,
  paddingLeft: { base: B.space['4'], lg: B.space['8'] },
  paddingRight: { base: B.space['4'], lg: B.space['8'] },
  paddingTop: B.space['3'], paddingBottom: B.space['3'],
});

export const headerInner = cx(
  layout.row({ gap: '4', align: 'center', justify: 'between' }),
  style({ maxWidth: '1200px', marginLeft: 'auto', marginRight: 'auto', width: '100%' }),
);

export const siteLogo = style({
  fontFamily: B.font.sans, fontSize: B.size.xl, fontWeight: B.weight.bold,
  color: B.content.primary, textDecoration: 'none', letterSpacing: '-0.02em',
});

export const logoAccent = style({ color: B.accent.primary });

export const headerNav = cx(layout.row({ gap: '1', align: 'center' }));

export const navLink = style({
  fontFamily: B.font.sans, fontSize: B.size.sm, fontWeight: B.weight.medium,
  color: B.content.secondary, textDecoration: 'none',
  paddingTop: B.space['2'], paddingBottom: B.space['2'],
  paddingLeft: B.space['3'], paddingRight: B.space['3'],
  borderRadius: B.radius.md,
  transition: `color ${B.duration.fast} ${B.easing.standard}, background ${B.duration.fast} ${B.easing.standard}`,
  on: { hover: { color: B.content.primary, background: B.surface.sunken } },
  when: { current: { color: B.accent.primary, fontWeight: B.weight.semibold } },
});

export const themeToggle = style({
  fontFamily: B.font.sans, fontSize: B.size.sm, fontWeight: B.weight.medium,
  color: B.content.secondary, background: 'transparent',
  borderWidth: 1, borderStyle: 'solid', borderColor: B.border.default,
  borderRadius: B.radius.md, paddingTop: B.space['1'], paddingBottom: B.space['1'],
  paddingLeft: B.space['3'], paddingRight: B.space['3'],
  cursor: 'pointer',
  on: { hover: { color: B.content.primary, borderColor: B.border.strong, background: B.surface.sunken } },
  on_focusVisible: { outline: `2px solid ${B.focus.ring}`, outlineOffset: '2px' },
});

export const mainContent = style({ maxWidth: '1200px', marginLeft: 'auto', marginRight: 'auto', padding: `${B.space['8']} ${B.space['4']}` });

export const siteFooter = style({
  borderTop: `1px solid ${B.surface.line}`,
  paddingTop: B.space['6'], paddingBottom: B.space['6'],
  paddingLeft: B.space['4'], paddingRight: B.space['4'],
  marginTop: B.space['10'],
});

export const footerInner = cx(
  layout.row({ gap: '4', align: 'center', justify: 'between', wrap: true }),
  style({ maxWidth: '1200px', marginLeft: 'auto', marginRight: 'auto' }),
);

export const footerText = style({ fontFamily: B.font.sans, fontSize: B.size.sm, color: B.content.muted });

export const skipLink = a11y.skipLink();

// ── Hero ───────────────────────────────────────────────────────────────────

export const heroSection = style({
  textAlign: 'center',
  paddingTop: B.space['12'], paddingBottom: B.space['10'],
});

export const heroBadge = style({
  display: 'inline-flex', alignItems: 'center', gap: B.space['2'],
  fontFamily: B.font.sans, fontSize: B.size.sm, fontWeight: B.weight.medium,
  color: B.accent.primary, background: B.accent.soft,
  borderWidth: 1, borderStyle: 'solid', borderColor: B.accent.primary,
  borderRadius: B.radius.pill,
  paddingTop: B.space['1'], paddingBottom: B.space['1'],
  paddingLeft: B.space['3'], paddingRight: B.space['3'],
  marginBottom: B.space['5'],
});

export const heroTitle = style({
  fontFamily: B.font.sans, fontSize: { base: B.size['3xl'], md: B.size['5xl'] },
  fontWeight: B.weight.bold, lineHeight: B.leading.tight,
  letterSpacing: '-0.03em', color: B.content.primary,
  marginBottom: B.space['5'],
});

export const heroSubtitle = style({
  fontFamily: B.font.sans, fontSize: { base: B.size.lg, md: B.size.xl },
  color: B.content.secondary, lineHeight: B.leading.relaxed,
  maxWidth: '600px', marginLeft: 'auto', marginRight: 'auto',
  marginBottom: B.space['8'],
});

export const heroActions = cx(layout.row({ gap: '3', align: 'center', justify: 'center', wrap: true }));

export const btnPrimary = style({
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  fontFamily: B.font.sans, fontSize: B.size.md, fontWeight: B.weight.semibold,
  color: B.accent.contrast, background: B.accent.primary,
  borderWidth: 1, borderStyle: 'solid', borderColor: B.accent.primary,
  borderRadius: B.radius.md,
  paddingTop: B.space['3'], paddingBottom: B.space['3'],
  paddingLeft: B.space['6'], paddingRight: B.space['6'],
  textDecoration: 'none', cursor: 'pointer',
  transition: `background ${B.duration.fast} ${B.easing.standard}`,
  on: { hover: { background: B.accent.hover, borderColor: B.accent.hover } },
});

export const btnSecondary = style({
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  fontFamily: B.font.sans, fontSize: B.size.md, fontWeight: B.weight.semibold,
  color: B.content.primary, background: 'transparent',
  borderWidth: 1, borderStyle: 'solid', borderColor: B.border.strong,
  borderRadius: B.radius.md,
  paddingTop: B.space['3'], paddingBottom: B.space['3'],
  paddingLeft: B.space['6'], paddingRight: B.space['6'],
  textDecoration: 'none', cursor: 'pointer',
  on: { hover: { background: B.surface.sunken } },
});

// ── Code block ─────────────────────────────────────────────────────────────

export const codeBlock = style({
  fontFamily: B.font.mono, fontSize: B.size.sm, lineHeight: B.leading.relaxed,
  color: '#e2e8f0', background: '#0f172a',
  borderRadius: B.radius.lg, padding: B.space['5'],
  overflowX: 'auto', marginTop: B.space['3'], marginBottom: B.space['3'],
  boxShadow: B.shadow.lg,
});

// ── Features grid ──────────────────────────────────────────────────────────

export const featuresGrid = style({
  display: 'grid', gap: B.space['5'],
  gridTemplateColumns: { base: '1fr', sm: 'repeat(2,1fr)', lg: 'repeat(3,1fr)' },
  marginTop: B.space['8'],
});

export const featureCard = cx(
  layout.stack({ gap: '3' }),
  style({
    background: B.surface.card,
    borderWidth: 1, borderStyle: 'solid', borderColor: B.border.default,
    borderRadius: B.radius.lg, padding: B.space['5'],
    on: { hover: { boxShadow: B.shadow.md, borderColor: B.border.strong } },
    transition: `box-shadow ${B.duration.base} ${B.easing.standard}, border-color ${B.duration.base} ${B.easing.standard}`,
  }),
);

export const featureIcon = style({
  fontSize: B.size['2xl'], marginBottom: B.space['2'],
});

export const featureTitle = style({
  fontFamily: B.font.sans, fontSize: B.size.lg, fontWeight: B.weight.semibold,
  color: B.content.primary,
});

export const featureDesc = style({
  fontFamily: B.font.sans, fontSize: B.size.sm, color: B.content.secondary,
  lineHeight: B.leading.relaxed,
});

// ── Section headings ───────────────────────────────────────────────────────

export const sectionHeading = style({
  fontFamily: B.font.sans, fontSize: B.size['3xl'], fontWeight: B.weight.bold,
  color: B.content.primary, letterSpacing: '-0.02em',
  marginBottom: B.space['3'],
});

export const sectionSubheading = style({
  fontFamily: B.font.sans, fontSize: B.size.lg, color: B.content.secondary,
  marginBottom: B.space['8'],
});

export const pageTitle = style({
  fontFamily: B.font.sans, fontSize: B.size['4xl'], fontWeight: B.weight.bold,
  color: B.content.primary, letterSpacing: '-0.025em', lineHeight: B.leading.tight,
  marginBottom: B.space['4'],
});

export const bodyText = style({
  fontFamily: B.font.sans, fontSize: B.size.md, color: B.content.secondary,
  lineHeight: B.leading.relaxed, marginBottom: B.space['4'],
});

export const inlineCode = style({
  fontFamily: B.font.mono, fontSize: '0.875em',
  color: B.accent.primary, background: B.accent.soft,
  borderRadius: B.radius.sm, paddingLeft: B.space['1'], paddingRight: B.space['1'],
});

// ── Cards ──────────────────────────────────────────────────────────────────

export const card = cx(
  layout.stack({ gap: '3' }),
  style({
    background: B.surface.card,
    borderWidth: 1, borderStyle: 'solid', borderColor: B.border.default,
    borderRadius: B.radius.lg, padding: B.space['5'],
  }),
);

export const cardGrid = style({
  display: 'grid', gap: B.space['4'],
  gridTemplateColumns: { base: '1fr', md: 'repeat(2,1fr)', xl: 'repeat(3,1fr)' },
});
