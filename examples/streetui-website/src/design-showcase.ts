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
