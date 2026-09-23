/**
 * Focus helpers built on the {@link DOMAdapter} abstraction.
 *
 * These are the minimal, genuinely-useful focus operations an app needs:
 * focus a specific element (e.g. the first field when a route or modal opens)
 * or focus the first focusable element inside a container (e.g. move focus
 * into a dialog). Both go through the adapter, so they are no-ops on the server
 * (`ServerDOMAdapter.querySelector` returns null / `focus` does nothing) and
 * therefore safe to call from universal code.
 */

import type { DOMAdapter } from './adapter.js';

/** Default selector for natively focusable / tabbable elements. */
export const FOCUSABLE_SELECTOR =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Focus the element with the given id, scoped to `root`.
 * Returns true if an element was found and focused.
 */
export function focusById(dom: DOMAdapter, root: Element | Document, id: string): boolean {
  const el = dom.querySelector(root, `[id="${id}"]`);
  if (el === null) return false;
  dom.focus(el);
  return true;
}

/**
 * Focus the first focusable element inside `container`.
 * Returns true if a focusable element was found and focused.
 */
export function focusFirst(
  dom: DOMAdapter,
  container: Element | Document,
  selector: string = FOCUSABLE_SELECTOR,
): boolean {
  const el = dom.querySelector(container, selector);
  if (el === null) return false;
  dom.focus(el);
  return true;
}
