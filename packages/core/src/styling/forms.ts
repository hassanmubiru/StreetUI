/**
 * StreetUI styling — form control styling (§20).
 *
 * Token-driven presets for the common form surfaces. Validation styling is read
 * from the ARIA attribute the renderer already sets (`[aria-invalid="true"]`) via
 * the `when: { invalid }` → `[data-invalid]` channel *and* a native attribute
 * selector, so there is no parallel form-state system — the control's accessible
 * state drives its appearance (§10/§15/§19). Focus uses native `:focus-visible`
 * with the strong focus-ring token (§19).
 */

import { type StyleDef } from './canonical.js';
import { style } from './style.js';
import { tokens } from './tokens.js';

const t = tokens.ref;

const CONTROL_BASE: StyleDef = {
  fontFamily: t.font.sans,
  fontSize: t.size.md,
  lineHeight: t.leading.normal,
  color: t.content.primary,
  background: t.surface.background,
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: t.border.strong,
  borderRadius: t.radius.md,
  paddingTop: t.space['2'],
  paddingBottom: t.space['2'],
  paddingLeft: t.space['3'],
  paddingRight: t.space['3'],
  width: '100%',
  appearance: 'none',
  transition: `border-color ${t.duration.fast} ${t.easing.standard}, box-shadow ${t.duration.fast} ${t.easing.standard}`,
  on: {
    focusVisible: { outline: 'none', borderColor: t.accent.primary, boxShadow: `0 0 0 3px ${t.focus.ring}` },
    disabled: { opacity: 0.55, cursor: 'not-allowed', background: t.surface.sunken },
  },
  when: {
    invalid: { borderColor: t.danger.border, boxShadow: `0 0 0 3px ${t.danger.surface}` },
  },
};

/** A single-line text input / select / textarea surface. */
export function input(): string {
  return style(CONTROL_BASE);
}

/** The vertical field wrapper: label, control and help/error stacked with gap. */
export function field(): string {
  return style({ display: 'flex', flexDirection: 'column', gap: t.space['2'] });
}

/** A field label (medium weight, primary content colour). */
export function fieldLabel(): string {
  return style({
    fontFamily: t.font.sans,
    fontSize: t.size.sm,
    fontWeight: t.weight.medium,
    color: t.content.primary,
  });
}

/** Supporting help text under a control. */
export function fieldHelp(): string {
  return style({ fontFamily: t.font.sans, fontSize: t.size.xs, color: t.content.muted });
}

/** An inline validation error message, coloured with the danger token. */
export function fieldError(): string {
  return style({
    fontFamily: t.font.sans,
    fontSize: t.size.xs,
    fontWeight: t.weight.medium,
    color: t.danger.content,
  });
}

/** A primary action button surface with hover/active/disabled and focus ring. */
export function button(): string {
  return style({
    fontFamily: t.font.sans,
    fontSize: t.size.md,
    fontWeight: t.weight.semibold,
    lineHeight: t.leading.normal,
    color: t.accent.contrast,
    background: t.accent.primary,
    borderWidth: 0,
    borderStyle: 'solid',
    borderRadius: t.radius.md,
    paddingTop: t.space['2'],
    paddingBottom: t.space['2'],
    paddingLeft: t.space['4'],
    paddingRight: t.space['4'],
    cursor: 'pointer',
    appearance: 'none',
    transition: `background ${t.duration.fast} ${t.easing.standard}`,
    on: {
      hover: { background: t.accent.hover },
      focusVisible: { outline: 'none', boxShadow: `0 0 0 3px ${t.focus.ring}` },
      disabled: { opacity: 0.55, cursor: 'not-allowed' },
    },
  });
}

/** The form styling family (§20). */
export const form = { field, input, label: fieldLabel, help: fieldHelp, error: fieldError, button } as const;
