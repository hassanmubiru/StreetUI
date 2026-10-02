/**
 * StreetUI styling — reactive scalar style tests (§4).
 *
 * Proves the reactive-scalar compile contract: the rule reads a CSS custom
 * property (so it is static + deduped), the class is a plain string that opens no
 * subscription, and the binding keys map one signal to one `style.<custom-prop>`
 * update. No DOM and no reactive system are involved at this layer.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  styleWithVars, reactiveVarName, reactiveVarValue, style, styleRegistry,
} from './index.js';

beforeEach(() => styleRegistry.reset());

describe('styleWithVars (§4 reactive scalar)', () => {
  it('rewrites reactive props to var(--s-<prop>) and exposes names + binding keys', () => {
    const r = styleWithVars({ padding: 8, width: 100 }, ['width']);
    expect(reactiveVarName('width')).toBe('--s-width');
    expect(r.vars.width).toBe('--s-width');
    expect(r.bind.width).toBe('style.--s-width');
    const css = styleRegistry.serializeCSS();
    expect(css).toContain('width:var(--s-width)');
    // The static (non-reactive) property is still baked literally.
    expect(css).toContain('padding:8px');
  });

  it('is a plain string identical to the equivalent static var() style (deduped)', () => {
    const r = styleWithVars({ width: 0 }, ['width']);
    const equivalent = style({ width: 'var(--s-width)' });
    expect(typeof r.class).toBe('string');
    expect(r.class).toBe(equivalent);
    // Same identity → a single registered rule.
    expect(styleRegistry.size).toBe(1);
  });

  it('camelCases custom-property names (minWidth → --s-min-width)', () => {
    const r = styleWithVars({ display: 'block' }, ['minWidth']);
    expect(r.vars.minWidth).toBe('--s-min-width');
    expect(r.bind.minWidth).toBe('style.--s-min-width');
    expect(styleRegistry.serializeCSS()).toContain('min-width:var(--s-min-width)');
  });

  it('formats reactive values with the same unit rule as static values', () => {
    expect(reactiveVarValue('width', 240)).toBe('240px');   // length prop → px
    expect(reactiveVarValue('opacity', 0.5)).toBe('0.5');   // unitless passthrough
    expect(reactiveVarValue('width', 0)).toBe('0');         // zero stays bare
    expect(reactiveVarValue('color', 'red')).toBe('red');   // strings untouched
  });
});
