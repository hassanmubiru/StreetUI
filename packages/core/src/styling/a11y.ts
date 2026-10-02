/**
 * StreetUI styling — accessibility styling helpers (§19).
 *
 * These presets make the *default* accessible: a strong, token-driven focus ring
 * that is visible against any surface, and a correct visually-hidden pattern that
 * still exposes content to assistive technology. They introduce **no** parallel
 * a11y-state system — focus styling rides the browser's native `:focus-visible`,
 * and component a11y states remain the ARIA attributes the renderer already sets,
 * read from CSS via the `when`/attribute selectors (§10/§15).
 */

import { style } from './style.js';
import { tokens } from './tokens.js';

const t = tokens.ref;

export interface FocusRingOptions {
  /** Ring colour (default `--focus-ring` token). */
  readonly color?: string;
  /** Ring thickness in px (default `2`). */
  readonly width?: number;
  /** Gap between the element and the ring in px (default `2`). */
  readonly offset?: number;
}

/**
 * A strong keyboard focus indicator applied via native `:focus-visible` only, so
 * pointer focus stays quiet while keyboard focus is always clearly visible (§19).
 * Compose onto any interactive element's class list.
 */
export function focusRing(opts: FocusRingOptions = {}): string {
  const color = opts.color ?? t.focus.ring;
  const width = opts.width ?? 2;
  const offset = opts.offset ?? 2;
  return style({
    outline: '2px solid transparent', // reserve space; real ring shown on focus
    on: {
      focusVisible: {
        outline: `${width}px solid ${color}`,
        outlineOffset: offset,
      },
    },
  });
}

/**
 * Visually-hidden content that remains available to screen readers (the correct
 * `sr-only` pattern — not `display:none`, which also hides from AT).
 */
export function visuallyHidden(): string {
  return style({
    position: 'absolute',
    width: 1,
    height: 1,
    padding: 0,
    margin: -1,
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    border: 0,
    // clip to a zero-area rect so the node occupies no visual space
    clipPath: 'inset(50%)',
  });
}

/**
 * A skip-link style: visually hidden until focused, then revealed as a prominent
 * on-surface control. Pairs with `visuallyHidden` semantics but becomes visible on
 * keyboard focus so "skip to content" links work.
 */
export function skipLink(): string {
  return style({
    position: 'absolute',
    left: t.space['2'],
    top: -40,
    background: t.surface.raised,
    color: t.content.primary,
    padding: t.space['2'],
    borderRadius: t.radius.md,
    boxShadow: t.shadow.md,
    transition: `top ${t.duration.fast} ${t.easing.standard}`,
    on: {
      focusVisible: { top: t.space['2'], outline: `2px solid ${t.focus.ring}`, outlineOffset: 2 },
    },
  });
}

/** The accessibility styling family (§19). */
export const a11y = { focusRing, visuallyHidden, skipLink } as const;
