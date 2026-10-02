/**
 * StreetUI styling — reactive scalar binding at the renderer seam (§4).
 *
 * Verifies that a `style.<custom-prop>` prop updates exactly one CSS custom
 * property via `el.style.setProperty`, leaving the element's `class` and all
 * other inline properties untouched (no class churn, no reconstruction), and that
 * a null/undefined value removes the property. This is the exact path a reactive
 * scalar signal drives through `wireSignalBindings → onUpdate → applyProp`.
 */

import { describe, it, expect } from 'vitest';
import { BrowserDOMAdapter } from '@streetui/dom';
import { applyProp, patchProp } from './attributes.js';

describe('applyProp style.<prop> (§4 reactive scalar)', () => {
  const dom = new BrowserDOMAdapter();

  it('sets a single custom property without touching class or other inline styles', () => {
    const el = document.createElement('div');
    el.setAttribute('class', 's-abc');
    el.style.setProperty('--s-height', '10px');

    applyProp(dom, el, 'style.--s-width', '240px');

    expect(el.style.getPropertyValue('--s-width')).toBe('240px');
    expect(el.style.getPropertyValue('--s-height')).toBe('10px'); // untouched
    expect(el.getAttribute('class')).toBe('s-abc');                // untouched
  });

  it('patchProp skips a no-op write but applies a real change', () => {
    const el = document.createElement('div');
    patchProp(dom, el, 'style.--s-width', '100px', '100px');
    expect(el.style.getPropertyValue('--s-width')).toBe('');       // Object.is skip → never set
    patchProp(dom, el, 'style.--s-width', '100px', '140px');
    expect(el.style.getPropertyValue('--s-width')).toBe('140px');
  });

  it('removes the property when the value is null or undefined', () => {
    const el = document.createElement('div');
    applyProp(dom, el, 'style.--s-width', '50px');
    expect(el.style.getPropertyValue('--s-width')).toBe('50px');
    applyProp(dom, el, 'style.--s-width', null);
    expect(el.style.getPropertyValue('--s-width')).toBe('');
  });
});
