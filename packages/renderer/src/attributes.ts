/**
 * Attribute and property application helpers.
 *
 * Decides whether a prop should be set as a DOM attribute or a JS property,
 * handling special cases (boolean attrs, event-like props, style, class).
 */

import type { DOMAdapter } from '@streetui/dom';

// Properties that must be set as JS object properties, not HTML attributes
const DOM_PROPERTIES = new Set([
  'value', 'checked', 'selected', 'indeterminate',
  'innerHTML', 'textContent', 'innerText',
  'scrollTop', 'scrollLeft',
]);

// Boolean attributes — present means true, absent means false
const BOOLEAN_ATTRS = new Set([
  'disabled', 'readonly', 'required', 'checked', 'selected',
  'multiple', 'autofocus', 'autoplay', 'controls', 'default',
  'defer', 'formnovalidate', 'hidden', 'ismap', 'loop',
  'novalidate', 'open', 'reversed', 'scoped', 'seamless',
]);

export function applyProp(
  dom: DOMAdapter,
  element: Element,
  name: string,
  value: unknown,
): void {
  // Skip internal renderer metadata
  if (name.startsWith('_')) return;
  // Skip event handlers (handled separately)
  if (name.startsWith('on')) return;

  if (DOM_PROPERTIES.has(name)) {
    dom.setProperty(element, name, value);
    return;
  }

  if (BOOLEAN_ATTRS.has(name)) {
    if (value === true || value === '' || value === name) {
      dom.setAttribute(element, name, '');
    } else {
      dom.removeAttribute(element, name);
    }
    return;
  }

  if (name === 'class' || name === 'className') {
    dom.setAttribute(element, 'class', String(value ?? ''));
    return;
  }

  if (name === 'style' && typeof value === 'object' && value !== null) {
    const el = element as HTMLElement;
    const styles = value as Record<string, string>;
    for (const [k, v] of Object.entries(styles)) {
      el.style.setProperty(k, v);
    }
    return;
  }

  if (value === null || value === undefined || value === false) {
    dom.removeAttribute(element, name);
    return;
  }

  dom.setAttribute(element, name, String(value));
}

export function patchProp(
  dom: DOMAdapter,
  element: Element,
  name: string,
  oldValue: unknown,
  newValue: unknown,
): void {
  if (Object.is(oldValue, newValue)) return;
  applyProp(dom, element, name, newValue);
}
