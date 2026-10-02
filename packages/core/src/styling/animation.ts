/**
 * StreetUI styling — animation tokens & declarative keyframes (§22).
 *
 * Animation is **pure CSS**: duration and easing come from the `--duration-*` /
 * `--easing-*` design tokens, and named `@keyframes` are registered once in the
 * shared registry (lazily, only when referenced, so unused animations add zero
 * bytes and unstyled routes stay byte-identical). There is **no animation
 * runtime** — StreetUI runs no timers, RAF loops, or JS tweening for these; the
 * browser owns playback. Enter/leave *lifecycle* animation remains the transition
 * engine's job (§18); these helpers supply the appearance it toggles.
 */

import { type CSSValue } from './canonical.js';
import { style } from './style.js';
import { styleRegistry } from './registry.js';
import { tokens } from './tokens.js';

const t = tokens.ref;

/** Duration token keys (`--duration-*`). */
export type DurationKey = keyof typeof tokens.ref.duration;
/** Easing token keys (`--easing-*`). */
export type EasingKey = keyof typeof tokens.ref.easing;

/** The built-in keyframe animations and their raw `@keyframes` bodies. */
const KEYFRAMES: Readonly<Record<string, string>> = {
  'streetui-fade-in': 'from{opacity:0}to{opacity:1}',
  'streetui-fade-out': 'from{opacity:1}to{opacity:0}',
  'streetui-scale-in': 'from{opacity:0;transform:scale(.96)}to{opacity:1;transform:scale(1)}',
  'streetui-scale-out': 'from{opacity:1;transform:scale(1)}to{opacity:0;transform:scale(.96)}',
  'streetui-slide-in-up': 'from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}',
  'streetui-slide-out-down': 'from{opacity:1;transform:translateY(0)}to{opacity:0;transform:translateY(8px)}',
  'streetui-spin': 'to{transform:rotate(360deg)}',
};

/** The animation names available to {@link animate}. */
export type AnimationName = keyof typeof KEYFRAMES;

/** Register a keyframe rule once (idempotent, keyed by its own name). */
function ensureKeyframes(name: AnimationName): void {
  const id = `kf-${name}`;
  if (!styleRegistry.has(id)) {
    styleRegistry.register(id, 'base', `@keyframes ${name}{${KEYFRAMES[name]}}`);
  }
}

export interface AnimateOptions {
  /** Duration token key (default `'base'`). */
  readonly duration?: DurationKey;
  /** Easing token key (default `'standard'`). */
  readonly easing?: EasingKey;
  /** Delay before the animation starts (e.g. `'100ms'`). */
  readonly delay?: CSSValue;
  /** Iteration count — a number or `'infinite'` (default `1`). */
  readonly iterations?: number | 'infinite';
  /** Fill mode (default `'both'` so the end state persists). */
  readonly fill?: 'none' | 'forwards' | 'backwards' | 'both';
}

/**
 * A class that plays a named keyframe animation using token duration/easing. The
 * keyframe rule is registered on first use. One class → one CSS `animation`; no JS
 * drives the frames.
 */
export function animate(name: AnimationName, opts: AnimateOptions = {}): string {
  ensureKeyframes(name);
  const duration = t.duration[opts.duration ?? 'base'];
  const easing = t.easing[opts.easing ?? 'standard'];
  const iterations = opts.iterations ?? 1;
  const fill = opts.fill ?? 'both';
  return style({
    animationName: name,
    animationDuration: duration,
    animationTimingFunction: easing,
    animationFillMode: fill,
    animationIterationCount: String(iterations),
    ...(opts.delay !== undefined ? { animationDelay: opts.delay } : {}),
  });
}

export interface TransitionOptions {
  /** Duration token key (default `'base'`). */
  readonly duration?: DurationKey;
  /** Easing token key (default `'standard'`). */
  readonly easing?: EasingKey;
  /** Delay before the transition starts (e.g. `'50ms'`). */
  readonly delay?: CSSValue;
}

/**
 * Build a CSS `transition` value for one or more properties using token
 * duration/easing — e.g. `transition(['opacity','transform'])`. Assign the result
 * to a `transition` style property; the browser performs the interpolation.
 */
export function transition(
  properties: string | readonly string[],
  opts: TransitionOptions = {},
): string {
  const props = typeof properties === 'string' ? [properties] : properties;
  const duration = t.duration[opts.duration ?? 'base'];
  const easing = t.easing[opts.easing ?? 'standard'];
  const delay = opts.delay !== undefined
    ? ` ${typeof opts.delay === 'number' ? `${opts.delay}ms` : opts.delay}`
    : '';
  return props.map((p) => `${p} ${duration} ${easing}${delay}`).join(', ');
}

/** The animation family (§22) — tokens + declarative keyframes, no runtime. */
export const animation = { animate, transition, keyframes: KEYFRAMES } as const;
