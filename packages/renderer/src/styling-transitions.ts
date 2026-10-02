/**
 * StreetUI styling — transition engine interop presets (§18).
 *
 * These helpers return a {@link ResolvedTransitionLike} — the exact descriptor the
 * existing transition engine consumes — assembled entirely from token-driven
 * `style()` classes and the `--duration-*` / `--easing-*` tokens. Styling therefore
 * *integrates with* the transition engine rather than competing with it: it only
 * supplies the enter/leave appearance classes the engine toggles; the engine still
 * owns all lifecycle timing, leave-deferral and keyed-identity reclaim (§18).
 * StreetUI adds no new timer and no second animation system here — the browser
 * performs the interpolation via CSS, and the engine's single timeout coordinates
 * DOM removal.
 */

import { style, transition as transitionValue, type DurationKey, type EasingKey } from '@streetui/core';
import type { ResolvedTransitionLike } from './transition.js';

/** Default millisecond values mirroring the default `--duration-*` tokens. */
const DURATION_MS: Record<DurationKey, number> = { fast: 120, base: 200, slow: 320 };

export interface TransitionPresetOptions {
  /** Duration token key driving both the CSS transition and the engine timeout. */
  readonly duration?: DurationKey;
  /** Easing token key for the CSS transition. */
  readonly easing?: EasingKey;
  /** Play the enter animation on first mount too (default `false`). */
  readonly appear?: boolean;
}

function activeClass(props: readonly string[], duration: DurationKey, easing: EasingKey): string {
  return style({ transition: transitionValue(props, { duration, easing }) });
}

/** A cross-fade enter/leave transition descriptor for the transition engine. */
export function fadeTransition(opts: TransitionPresetOptions = {}): ResolvedTransitionLike {
  const duration = opts.duration ?? 'base';
  const easing = opts.easing ?? 'standard';
  const active = activeClass(['opacity'], duration, easing);
  const hidden = style({ opacity: 0 });
  const shown = style({ opacity: 1 });
  return {
    enterActive: [active], enterFrom: [hidden], enterTo: [shown],
    leaveActive: [active], leaveFrom: [shown], leaveTo: [hidden],
    appear: opts.appear ?? false,
    duration: DURATION_MS[duration],
  };
}

/** A fade + scale "pop" transition descriptor (opacity and transform). */
export function scaleTransition(opts: TransitionPresetOptions = {}): ResolvedTransitionLike {
  const duration = opts.duration ?? 'base';
  const easing = opts.easing ?? 'emphasized';
  const active = activeClass(['opacity', 'transform'], duration, easing);
  const hidden = style({ opacity: 0, transform: 'scale(.96)' });
  const shown = style({ opacity: 1, transform: 'scale(1)' });
  return {
    enterActive: [active], enterFrom: [hidden], enterTo: [shown],
    leaveActive: [active], leaveFrom: [shown], leaveTo: [hidden],
    appear: opts.appear ?? false,
    duration: DURATION_MS[duration],
  };
}

/** A fade + vertical-slide transition descriptor (enters from below). */
export function slideTransition(opts: TransitionPresetOptions = {}): ResolvedTransitionLike {
  const duration = opts.duration ?? 'base';
  const easing = opts.easing ?? 'standard';
  const active = activeClass(['opacity', 'transform'], duration, easing);
  const hidden = style({ opacity: 0, transform: 'translateY(8px)' });
  const shown = style({ opacity: 1, transform: 'translateY(0)' });
  return {
    enterActive: [active], enterFrom: [hidden], enterTo: [shown],
    leaveActive: [active], leaveFrom: [shown], leaveTo: [hidden],
    appear: opts.appear ?? false,
    duration: DURATION_MS[duration],
  };
}

/** The token-driven transition presets (§18), for use with the transition engine. */
export const transitions = { fadeTransition, scaleTransition, slideTransition } as const;
