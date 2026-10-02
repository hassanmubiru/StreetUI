/**
 * StreetUI styling — semantic typography + code/pre primitives (§13/§14).
 *
 * Token-driven `style()` presets for text roles. Each returns a deduplicated class
 * string and reads the `--font-*`, `--size-*`, `--weight-*`, `--leading-*` and
 * `--content-*` tokens, so typography stays on the design system and re-themes with
 * no duplicated definitions. `code` and `blockquote` cover the §14 code/pre case:
 * monospace, token surface, and sensible wrapping without an external prose sheet.
 */

import { type StyleDef } from './canonical.js';
import { style } from './style.js';
import { tokens } from './tokens.js';

const t = tokens.ref;

export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

const HEADING_SIZE: Record<HeadingLevel, string> = {
  1: t.size['3xl'], 2: t.size['2xl'], 3: t.size.xl,
  4: t.size.lg, 5: t.size.md, 6: t.size.sm,
};

export interface HeadingStyleOptions {
  /** Semantic heading level 1–6 (drives size + weight). Default `2`. */
  readonly level?: HeadingLevel;
}

/** A display heading sized from the type scale by level. */
export function heading(opts: HeadingOptions = {}): string {
  const level = opts.level ?? 2;
  return style({
    fontFamily: t.font.sans,
    fontSize: HEADING_SIZE[level],
    fontWeight: level <= 2 ? t.weight.bold : t.weight.semibold,
    lineHeight: t.leading.tight,
    color: t.content.primary,
    letterSpacing: level <= 2 ? '-0.02em' : '-0.01em',
  });
}

export interface BodyOptions {
  /** Secondary (muted) body colour instead of primary. Default `false`. */
  readonly muted?: boolean;
  /** Line length cap for comfortable reading (e.g. `'65ch'`). */
  readonly measure?: string;
}

/** Default running-text body copy. */
export function body(opts: BodyOptions = {}): string {
  const def: StyleDef = {
    fontFamily: t.font.sans,
    fontSize: t.size.md,
    fontWeight: t.weight.normal,
    lineHeight: t.leading.normal,
    color: opts.muted ? t.content.secondary : t.content.primary,
  };
  return style(opts.measure !== undefined ? { ...def, maxWidth: opts.measure } : def);
}

/** A small, medium-weight form/field label. */
export function label(): string {
  return style({
    fontFamily: t.font.sans,
    fontSize: t.size.sm,
    fontWeight: t.weight.medium,
    lineHeight: t.leading.normal,
    color: t.content.primary,
  });
}

/** The smallest supporting text (captions, help, metadata). */
export function caption(): string {
  return style({
    fontFamily: t.font.sans,
    fontSize: t.size.xs,
    fontWeight: t.weight.normal,
    lineHeight: t.leading.normal,
    color: t.content.muted,
  });
}

/** An inline text link with a token accent colour and accessible focus/hover. */
export function link(): string {
  return style({
    color: t.accent.primary,
    textDecoration: 'underline',
    cursor: 'pointer',
    borderRadius: t.radius.sm,
    on: {
      hover: { color: t.accent.hover },
      focusVisible: { outline: `2px solid ${t.focus.ring}` },
    },
  });
}

/** Inline monospace code (§14). */
export function code(): string {
  return style({
    fontFamily: t.font.mono,
    fontSize: '0.9em',
    background: t.surface.sunken,
    color: t.content.primary,
    borderRadius: t.radius.sm,
    paddingLeft: t.space['1'],
    paddingRight: t.space['1'],
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: t.border.subtle,
  });
}

/** A fenced code block / `<pre>` surface: monospace, scrollable, token surface (§14). */
export function pre(): string {
  return style({
    fontFamily: t.font.mono,
    fontSize: t.size.sm,
    lineHeight: t.leading.relaxed,
    background: t.surface.sunken,
    color: t.content.primary,
    borderRadius: t.radius.md,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: t.border.subtle,
    padding: t.space['4'],
    overflowX: 'auto',
    whiteSpace: 'pre',
  });
}

/** A left-ruled quotation block. */
export function blockquote(): string {
  return style({
    fontFamily: t.font.sans,
    fontSize: t.size.lg,
    lineHeight: t.leading.relaxed,
    color: t.content.secondary,
    borderStyle: 'solid',
    borderColor: t.accent.primary,
    paddingLeft: t.space['4'],
    marginLeft: 0,
  });
}

/** A vertically-spaced list body. */
export function list(): string {
  return style({
    fontFamily: t.font.sans,
    fontSize: t.size.md,
    lineHeight: t.leading.normal,
    color: t.content.primary,
    display: 'flex',
    flexDirection: 'column',
    gap: t.space['2'],
  });
}

/** The semantic typography family (§13/§14), exported as one namespace object. */
export const text = { heading, body, label, caption, link, code, pre, blockquote, list } as const;
