/**
 * StreetUI styling — transition-engine interop tests (§18).
 *
 * Proves the styling layer produces a descriptor the *existing* transition engine
 * can consume verbatim: enter/leave class lists are plain deduped `style()` tokens,
 * the active class carries a token-driven CSS `transition`, and the numeric
 * `duration` mirrors the chosen `--duration-*` token so the engine's single timeout
 * stays in sync. No new timer or animation system is introduced here.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { styleRegistry } from '@streetui/core';
import { fadeTransition, scaleTransition, slideTransition, transitions } from './styling-transitions.js';
import type { ResolvedTransitionLike } from './transition.js';

beforeEach(() => styleRegistry.reset());

function assertShape(rt: ResolvedTransitionLike): void {
  for (const phase of ['enterActive', 'enterFrom', 'enterTo', 'leaveActive', 'leaveFrom', 'leaveTo'] as const) {
    expect(Array.isArray(rt[phase])).toBe(true);
    expect(rt[phase].length).toBeGreaterThan(0);
    for (const cls of rt[phase]) expect(typeof cls).toBe('string');
  }
  expect(typeof rt.appear).toBe('boolean');
  expect(typeof rt.duration).toBe('number');
}

describe('fadeTransition (§18)', () => {
  it('produces an engine-consumable descriptor with a token-driven active class', () => {
    const rt = fadeTransition();
    assertShape(rt);
    expect(rt.duration).toBe(200); // mirrors --duration-base
    expect(rt.appear).toBe(false);
    const css = styleRegistry.serializeCSS();
    expect(css).toContain('opacity var(--duration-base) var(--easing-standard)');
  });

  it('enter runs opacity 0 → 1 and leave runs 1 → 0 (shared active rule)', () => {
    const rt = fadeTransition();
    expect(rt.enterActive).toEqual(rt.leaveActive);
    expect(rt.enterFrom).toEqual(rt.leaveTo);
    expect(rt.enterTo).toEqual(rt.leaveFrom);
    const css = styleRegistry.serializeCSS();
    expect(css).toContain('opacity:0');
    expect(css).toContain('opacity:1');
  });

  it('honours a duration token for both the CSS and the engine timeout', () => {
    const rt = fadeTransition({ duration: 'slow' });
    expect(rt.duration).toBe(320);
    expect(styleRegistry.serializeCSS()).toContain('opacity var(--duration-slow)');
  });
});

describe('scale/slide transitions (§18)', () => {
  it('scaleTransition animates opacity + transform (emphasized easing by default)', () => {
    const rt = scaleTransition();
    assertShape(rt);
    const css = styleRegistry.serializeCSS();
    expect(css).toContain('transform:scale(.96)');
    expect(css).toContain('var(--easing-emphasized)');
  });

  it('slideTransition enters from a vertical offset', () => {
    const rt = slideTransition();
    assertShape(rt);
    const css = styleRegistry.serializeCSS();
    expect(css).toContain('transform:translateY(8px)');
  });
});

describe('transition preset namespace', () => {
  it('exposes the three presets', () => {
    expect(transitions.fadeTransition).toBe(fadeTransition);
    expect(transitions.scaleTransition).toBe(scaleTransition);
    expect(transitions.slideTransition).toBe(slideTransition);
  });
});
