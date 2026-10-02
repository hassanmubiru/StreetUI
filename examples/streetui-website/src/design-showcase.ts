/**
 * StreetUI Website — §33 design test: fifteen distinct UIs built using ONLY the
 * public StreetUI styling system (no CSS files, no utility-class framework, no
 * second styling API). Each `Showcase` is a self-contained builder over the
 * public `ContainerDSL`, styling its nodes with `style` / `cx` / `styleVariants`
 * / `layout` / `text` / `form` / `a11y` and the design `tokens`.
 *
 * This is the acceptance surface for 2.7.0: if a polished, responsive, themeable
 * interface can be assembled here without reaching for anything outside the
 * framework, the styling system has met its objective. The companion test
 * compiles every showcase, mounts/SSRs it, and asserts the deduplicated sheet
 * serializes and that the migrated builders carry their generated classes.
 */

import { signal, derived } from 'streetui';
import { style, cx, styleVariants, layout, text, form, a11y, tokens } from 'streetui';
import type { ContainerDSL } from 'streetui';

const t = tokens.ref;

export interface Showcase {
  readonly id: string;
  readonly title: string;
  readonly build: (c: ContainerDSL) => void;
}

// ── Shared variant family (§11 type-safe variants) ──────────────────────────

const button = styleVariants({
  base: {
    fontFamily: t.font.sans,
    fontWeight: t.weight.semibold,
    borderRadius: t.radius.md,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'transparent',
    cursor: 'pointer',
    appearance: 'none',
    on: { focusVisible: { outline: 'none', boxShadow: `0 0 0 3px ${t.focus.ring}` } },
  },
  variants: {
    intent: {
      primary: { color: t.accent.contrast, background: t.accent.primary, on: { hover: { background: t.accent.hover } } },
      secondary: { color: t.content.primary, background: t.surface.background, borderColor: t.border.strong, on: { hover: { background: t.surface.sunken } } },
      danger: { color: t.danger.content, background: t.danger.surface, borderColor: t.danger.border },
    },
    size: {
      sm: { fontSize: t.size.sm, paddingTop: t.space['1'], paddingBottom: t.space['1'], paddingLeft: t.space['3'], paddingRight: t.space['3'] },
      md: { fontSize: t.size.md, paddingTop: t.space['2'], paddingBottom: t.space['2'], paddingLeft: t.space['4'], paddingRight: t.space['4'] },
    },
  },
  defaultVariants: { intent: 'primary', size: 'md' },
});

const panel = cx(
  layout.stack({ gap: '3' }),
  style({
    background: t.surface.raised,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: t.border.default,
    borderRadius: t.radius.lg,
    padding: t.space['5'],
  }),
);

// ── 1. Button bar (variant matrix) ──────────────────────────────────────────

const buttonBar: Showcase = {
  id: 'buttons',
  title: 'Buttons',
  build: (c) => {
    c.container('sc-buttons-row', (r) => {
      r.button('Primary', { id: 'sc-btn-primary', class: button({ intent: 'primary' }) });
      r.button('Secondary', { id: 'sc-btn-secondary', class: button({ intent: 'secondary' }) });
      r.button('Danger', { id: 'sc-btn-danger', class: button({ intent: 'danger' }) });
      r.button('Small', { id: 'sc-btn-small', class: button({ intent: 'secondary', size: 'sm' }) });
    }, { id: 'sc-buttons-row', class: layout.row({ gap: '3', align: 'center', wrap: true }) });
  },
};

// ── 2. Card grid ─────────────────────────────────────────────────────────────

const cardGrid: Showcase = {
  id: 'cards',
  title: 'Card grid',
  build: (c) => {
    c.container('sc-cards', (grid) => {
      for (let i = 1; i <= 3; i++) {
        grid.container(`sc-card-${i}`, (card) => {
          card.heading(`Card ${i}`, { level: 3, id: `sc-card-${i}-title`, class: text.heading({ level: 3 }) });
          card.text('A surface card with token padding, border and radius.', { id: `sc-card-${i}-body`, class: text.body({ measure: '40ch' }) });
        }, { id: `sc-card-${i}`, class: panel });
      }
    }, { id: 'sc-cards', class: layout.grid({ columns: 'auto', min: 220, gap: '5' }) });
  },
};

// ── 3. Form (field / input / label / help / error / button) ─────────────────

const formCard: Showcase = {
  id: 'form',
  title: 'Form',
  build: (c) => {
    c.container('sc-form', (f) => {
      f.container('sc-field-email', (field) => {
        field.text('Email', { id: 'sc-form-label', class: form.label() });
        field.input({ id: 'sc-form-input', type: 'email', placeholder: 'you@example.com', class: form.input() });
        field.text('We never share your address.', { id: 'sc-form-help', class: form.help() });
      }, { id: 'sc-field-email', class: form.field() });
      f.container('sc-field-pw', (field) => {
        field.text('Password', { id: 'sc-form-pw-label', class: form.label() });
        field.input({ id: 'sc-form-pw-input', type: 'password', placeholder: '••••••••', class: form.input() });
        field.text('Must be at least 8 characters.', { id: 'sc-form-error', class: form.error() });
      }, { id: 'sc-field-pw', class: form.field() });
      f.button('Create account', { id: 'sc-form-submit', class: button({ intent: 'primary' }) });
    }, { id: 'sc-form', class: cx(panel, style({ maxWidth: 420 })) });
  },
};

// ── 4. Responsive split (one column → two from md up) ───────────────────────

const responsiveSplit: Showcase = {
  id: 'responsive',
  title: 'Responsive split',
  build: (c) => {
    c.container('sc-split', (split) => {
      split.container('sc-split-main', (m) => {
        m.heading('Main', { level: 3, id: 'sc-split-main-title', class: text.heading({ level: 3 }) });
        m.text('Stacks under the aside on narrow screens, sits beside it from md up — all via a single responsive grid-template value, no JS.', { id: 'sc-split-main-body', class: text.body({ measure: '60ch' }) });
      }, { id: 'sc-split-main', class: panel });
      split.container('sc-split-aside', (a) => {
        a.heading('Aside', { level: 3, id: 'sc-split-aside-title', class: text.heading({ level: 3 }) });
        a.text('Secondary content.', { id: 'sc-split-aside-body', class: text.body() });
      }, { id: 'sc-split-aside', class: panel });
    }, {
      id: 'sc-split',
      class: style({
        display: 'grid',
        gap: t.space['5'],
        gridTemplateColumns: { base: '1fr', md: 'minmax(0, 2fr) minmax(0, 1fr)' },
        alignItems: 'start',
      }),
    });
  },
};

// ── 5. Typography scale ──────────────────────────────────────────────────────

const typographyScale: Showcase = {
  id: 'typography',
  title: 'Typography',
  build: (c) => {
    c.container('sc-type', (ty) => {
      ty.heading('Heading level 1', { level: 1, id: 'sc-type-h1', class: text.heading({ level: 1 }) });
      ty.heading('Heading level 2', { level: 2, id: 'sc-type-h2', class: text.heading({ level: 2 }) });
      ty.text('Body copy, measured for comfortable reading length.', { id: 'sc-type-body', class: text.body({ measure: '65ch' }) });
      ty.text('Muted caption / metadata.', { id: 'sc-type-caption', class: text.caption() });
      ty.text('inline code token', { id: 'sc-type-code', class: text.code() });
      ty.code("const x = 1;\nconsole.log(x);", { id: 'sc-type-pre', class: text.pre(), language: 'ts' });
    }, { id: 'sc-type', class: layout.stack({ gap: '3' }) });
  },
};

// ── 6. Stat tiles ────────────────────────────────────────────────────────────

const statTiles: Showcase = {
  id: 'stats',
  title: 'Stat tiles',
  build: (c) => {
    const stats: ReadonlyArray<{ k: string; v: string }> = [
      { k: 'Routes', v: '13' }, { k: 'Tests', v: 'green' }, { k: 'CSS files', v: '0' },
    ];
    c.container('sc-stats', (row) => {
      stats.forEach((s, i) => {
        row.container(`sc-stat-${i}`, (tile) => {
          tile.text(s.v, { id: `sc-stat-${i}-v`, class: cx(text.heading({ level: 2 }), style({ color: t.accent.primary })) });
          tile.text(s.k, { id: `sc-stat-${i}-k`, class: text.caption() });
        }, { id: `sc-stat-${i}`, class: panel });
      });
    }, { id: 'sc-stats', class: layout.grid({ columns: 'auto', min: 140, gap: '4' }) });
  },
};

// ── 7. Badges + alert ────────────────────────────────────────────────────────

const badge = style({
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

const badgesAndAlert: Showcase = {
  id: 'feedback',
  title: 'Badges & alert',
  build: (c) => {
    c.container('sc-badges', (row) => {
      for (const label of ['new', 'stable', 'a11y']) {
        row.text(label, { id: `sc-badge-${label}`, class: badge });
      }
    }, { id: 'sc-badges', class: layout.row({ gap: '2', align: 'center', wrap: true }) });
    c.container('sc-alert', (a) => {
      a.text('Heads up — this is an informational callout surface.', { id: 'sc-alert-text', class: text.body() });
    }, {
      id: 'sc-alert',
      class: cx(layout.stack({ gap: '2' }), style({
        background: t.surface.sunken,
        borderStyle: 'solid',
        borderColor: t.border.subtle,
        borderWidth: 1,
        borderRadius: t.radius.md,
        padding: t.space['4'],
      })),
    });
  },
};

// ── 8. Data table ────────────────────────────────────────────────────────────

const dataTable: Showcase = {
  id: 'table',
  title: 'Data table',
  build: (c) => {
    const rows: ReadonlyArray<{ name: string; role: string }> = [
      { name: 'Ada', role: 'Owner' }, { name: 'Linus', role: 'Admin' }, { name: 'Grace', role: 'Editor' },
    ];
    c.container('sc-table', (tbl) => {
      tbl.container('sc-table-head', (h) => {
        h.text('Name', { id: 'sc-table-h-name', class: form.label() });
        h.text('Role', { id: 'sc-table-h-role', class: form.label() });
      }, { id: 'sc-table-head', class: layout.row({ gap: '4', justify: 'between' }) });
      rows.forEach((r, i) => {
        tbl.container(`sc-table-row-${i}`, (tr) => {
          tr.text(r.name, { id: `sc-table-${i}-name`, class: text.body() });
          tr.text(r.role, { id: `sc-table-${i}-role`, class: text.caption() });
        }, { id: `sc-table-row-${i}`, class: cx(layout.row({ gap: '4', justify: 'between' }), style({ borderWidth: 1, borderStyle: 'solid', borderColor: t.border.subtle, borderRadius: t.radius.sm, padding: t.space['2'] })) });
      });
    }, { id: 'sc-table', class: cx(panel, style({ width: '100%' })) });
  },
};

// ── 9. Hero ──────────────────────────────────────────────────────────────────

const hero: Showcase = {
  id: 'hero',
  title: 'Hero',
  build: (c) => {
    c.container('sc-hero', (h) => {
      h.heading('Build it with StreetUI', { level: 1, id: 'sc-hero-title', class: text.heading({ level: 1 }) });
      h.text('A polished, responsive, themeable interface — styled entirely by the framework.', { id: 'sc-hero-lead', class: cx(text.body({ muted: true, measure: '55ch' }), style({ fontSize: t.size.lg })) });
      h.container('sc-hero-cta', (cta) => {
        cta.button('Get started', { id: 'sc-hero-start', class: button({ intent: 'primary' }) });
        cta.button('Docs', { id: 'sc-hero-docs', class: button({ intent: 'secondary' }) });
      }, { id: 'sc-hero-cta', class: layout.row({ gap: '3', align: 'center', wrap: true }) });
    }, { id: 'sc-hero', class: cx(layout.stack({ gap: '4' }), style({ paddingTop: t.space['8'], paddingBottom: t.space['8'] })) });
  },
};

// APPEND_MARKER
