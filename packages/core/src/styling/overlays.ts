/**
 * StreetUI styling — overlay surface styling (§21).
 *
 * Token-driven presets for the overlay surfaces produced by the overlay runtime
 * (dialog, popover, tooltip, dropdown, toast + backdrop). Styling here is **only**
 * appearance (surface colour, elevation, radius, z-index from the `--z-*` tokens);
 * positioning, focus trapping and open/close lifecycle remain owned by the overlay
 * runtime and the transition engine (§18/§21). Elevation and z-index come from
 * tokens so overlays stack predictably and re-theme with the rest of the system.
 */

import { type StyleDef } from './canonical.js';
import { style } from './style.js';
import { tokens } from './tokens.js';

const t = tokens.ref;

/** The dimmed, full-viewport backdrop behind a modal surface. */
export function backdrop(): string {
  return style({
    position: 'fixed',
    inset: 0,
    background: t.surface.overlay,
    zIndex: t.z.overlay,
  });
}

/** A centered modal dialog surface (elevation + radius from tokens). */
export function dialog(): string {
  return style({
    position: 'relative',
    background: t.surface.background,
    color: t.content.primary,
    borderRadius: t.radius.lg,
    boxShadow: t.shadow.lg,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: t.border.default,
    padding: t.space['5'],
    maxWidth: 'min(560px, calc(100vw - 32px))',
    width: '100%',
    zIndex: t.z.overlay,
  });
}

/** A small anchored popover panel. */
export function popover(): string {
  return style({
    position: 'absolute',
    background: t.surface.raised,
    color: t.content.primary,
    borderRadius: t.radius.md,
    boxShadow: t.shadow.md,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: t.border.default,
    padding: t.space['3'],
    zIndex: t.z.dropdown,
  });
}

/** A compact, high-contrast tooltip bubble. */
export function tooltip(): string {
  return style({
    position: 'absolute',
    background: t.content.primary,
    color: t.surface.background,
    fontFamily: t.font.sans,
    fontSize: t.size.xs,
    lineHeight: t.leading.tight,
    borderRadius: t.radius.sm,
    paddingTop: t.space['1'],
    paddingBottom: t.space['1'],
    paddingLeft: t.space['2'],
    paddingRight: t.space['2'],
    maxWidth: 240,
    zIndex: t.z.overlay,
    pointerEvents: 'none',
  });
}

const MENU_BASE: StyleDef = {
  position: 'absolute',
  background: t.surface.background,
  color: t.content.primary,
  borderRadius: t.radius.md,
  boxShadow: t.shadow.md,
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: t.border.default,
  paddingTop: t.space['1'],
  paddingBottom: t.space['1'],
  minWidth: 180,
  zIndex: t.z.dropdown,
};

/** A dropdown menu surface. */
export function dropdown(): string {
  return style(MENU_BASE);
}

/** A single dropdown menu item (hover/selected via tokens + attribute state). */
export function dropdownItem(): string {
  return style({
    display: 'flex',
    alignItems: 'center',
    gap: t.space['2'],
    fontFamily: t.font.sans,
    fontSize: t.size.sm,
    color: t.content.primary,
    paddingTop: t.space['2'],
    paddingBottom: t.space['2'],
    paddingLeft: t.space['3'],
    paddingRight: t.space['3'],
    cursor: 'pointer',
    on: {
      hover: { background: t.surface.raised },
      disabled: { opacity: 0.5, cursor: 'not-allowed' },
    },
    when: { selected: { background: t.surface.sunken, fontWeight: t.weight.medium } },
  });
}

/** A toast notification surface, elevated above overlays on the toast z-band. */
export function toast(): string {
  return style({
    background: t.surface.raised,
    color: t.content.primary,
    borderRadius: t.radius.md,
    boxShadow: t.shadow.lg,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: t.border.default,
    padding: t.space['3'],
    minWidth: 240,
    maxWidth: 420,
    zIndex: t.z.toast,
  });
}

/** The overlay styling family (§21). */
export const overlay = {
  backdrop, dialog, popover, tooltip, dropdown, dropdownItem, toast,
} as const;
