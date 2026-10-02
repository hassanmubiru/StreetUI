/**
 * StreetUI styling — preset family tests (§12–§14, §19–§22).
 *
 * Each family (layout, typography, a11y, forms, overlays, animation) is a set of
 * pure `style()` presets that compile to token-referencing CSS through the shared
 * registry. These tests prove three contracts at once: the presets reference design
 * tokens (not hard-coded values), identical calls dedupe to one rule, and the
 * animation family registers each `@keyframes` lazily and only once.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  layout, text, a11y, form, overlay, animation, animate, transition,
  styleRegistry,
} from './index.js';

beforeEach(() => styleRegistry.reset());

describe('layout primitives (§12)', () => {
  it('resolve spacing through the --space-* tokens', () => {
    layout.stack({ gap: '4' });
    const css = styleRegistry.serializeCSS();
    expect(css).toContain('display:flex');
    expect(css).toContain('flex-direction:column');
    expect(css).toContain('gap:var(--space-4)');
  });

  it('grid auto mode emits an auto-fill track; fixed mode a repeat count', () => {
    const auto = layout.grid({ columns: 'auto', min: 200 });
    const fixed = layout.grid({ columns: 3 });
    expect(auto).not.toBe(fixed);
    const css = styleRegistry.serializeCSS();
    expect(css).toContain('repeat(auto-fill, minmax(200px, 1fr))');
    expect(css).toContain('repeat(3, minmax(0, 1fr))');
  });

  it('dedupe identical option bags to a single rule', () => {
    const a = layout.container({ padX: '4' });
    const b = layout.container({ padX: '4' });
    expect(a).toBe(b);
    expect(styleRegistry.size).toBe(1);
  });
});

describe('typography (§13/§14)', () => {
  it('heading sizes come from the type-scale tokens', () => {
    text.heading({ level: 1 });
    const css = styleRegistry.serializeCSS();
    expect(css).toContain('font-size:var(--size-3xl)');
    expect(css).toContain('font-family:var(--font-sans)');
  });

  it('code/pre use the mono font token (§14)', () => {
    text.code();
    text.pre();
    const css = styleRegistry.serializeCSS();
    expect(css).toContain('font-family:var(--font-mono)');
  });

  it('link exposes hover + focus-visible through CSS, not JS', () => {
    const cls = text.link();
    const css = styleRegistry.serializeCSS();
    expect(css).toContain(`.${cls}:hover`);
    expect(css).toContain(`.${cls}:focus-visible`);
  });
});

describe('accessibility styling (§19)', () => {
  it('focusRing shows the ring only on :focus-visible', () => {
    const cls = a11y.focusRing();
    const css = styleRegistry.serializeCSS();
    expect(css).toContain(`.${cls}:focus-visible`);
    expect(css).toContain('var(--focus-ring)');
  });

  it('visuallyHidden clips to a zero-area box (correct sr-only)', () => {
    a11y.visuallyHidden();
    const css = styleRegistry.serializeCSS();
    expect(css).toContain('clip-path:inset(50%)');
    expect(css).not.toContain('display:none');
  });
});

describe('form controls (§20)', () => {
  it('input focus ring + invalid state ride native + attribute selectors', () => {
    const cls = form.input();
    const css = styleRegistry.serializeCSS();
    expect(css).toContain(`.${cls}:focus-visible`);
    expect(css).toContain(`.${cls}[data-invalid]`);
    expect(css).toContain('var(--focus-ring)');
  });

  it('button uses the accent token for its surface', () => {
    form.button();
    const css = styleRegistry.serializeCSS();
    expect(css).toContain('background:var(--accent-primary)');
  });
});

describe('overlay surfaces (§21)', () => {
  it('stack on the z-index tokens', () => {
    overlay.dialog();
    overlay.dropdown();
    overlay.toast();
    const css = styleRegistry.serializeCSS();
    expect(css).toContain('z-index:var(--z-overlay)');
    expect(css).toContain('z-index:var(--z-dropdown)');
    expect(css).toContain('z-index:var(--z-toast)');
  });
});

describe('animation family (§22)', () => {
  it('animate registers its @keyframes once (lazy) with token duration/easing', () => {
    const a = animate('streetui-fade-in');
    const b = animate('streetui-fade-in');
    expect(a).toBe(b);
    const css = styleRegistry.serializeCSS();
    // keyframes present exactly once
    expect(css.match(/@keyframes streetui-fade-in/g)).toHaveLength(1);
    expect(css).toContain('animation-duration:var(--duration-base)');
    expect(css).toContain('animation-timing-function:var(--easing-standard)');
  });

  it('unreferenced keyframes add zero bytes', () => {
    const css = styleRegistry.serializeCSS();
    expect(css).not.toContain('@keyframes streetui-spin');
    expect(animation.keyframes['streetui-spin']).toBe('to{transform:rotate(360deg)}');
  });

  it('transition builds a token-driven CSS transition value (no registration)', () => {
    const value = transition(['opacity', 'transform'], { duration: 'fast', easing: 'emphasized' });
    expect(value).toBe(
      'opacity var(--duration-fast) var(--easing-emphasized), transform var(--duration-fast) var(--easing-emphasized)',
    );
  });
});
