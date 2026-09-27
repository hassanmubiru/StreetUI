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

/**
 * Ordered list of focusable/tabbable descendants of `container`.
 * Re-checks each candidate against the selector so elements disabled after the
 * initial query (e.g. a button toggled to `disabled`) are excluded.
 */
export function getFocusable(
  dom: DOMAdapter,
  container: Element,
  selector: string = FOCUSABLE_SELECTOR,
): Element[] {
  return Array.from(dom.querySelectorAll(container, selector)).filter((el) =>
    dom.matches(el, selector),
  );
}

/**
 * Capture the currently-focused element so it can be restored later (e.g. when
 * a dialog closes). Returns null on the server or when nothing is focused.
 */
export function saveFocus(dom: DOMAdapter): Element | null {
  return dom.activeElement();
}

/** Restore focus to a previously {@link saveFocus}-d element. No-op if null. */
export function restoreFocus(dom: DOMAdapter, saved: Element | null): void {
  if (saved !== null) dom.focus(saved);
}

/**
 * Move focus into `container` on open: the element with id `initialFocusId` if
 * given and present, otherwise the first focusable element. Server-safe no-op.
 */
export function focusInitial(
  dom: DOMAdapter,
  container: Element,
  initialFocusId?: string,
): void {
  if (initialFocusId !== undefined && focusById(dom, container, initialFocusId)) return;
  focusFirst(dom, container);
}

/**
 * Trap Tab / Shift+Tab focus within `container` (wrap-around at both ends).
 * Attaches a keydown listener to the container and returns a cleanup function
 * that detaches it. Server-safe: `addEventListener` is a no-op, and the returned
 * cleanup is still callable.
 */
export function trapFocus(dom: DOMAdapter, container: Element): () => void {
  const onKeydown = ((event: KeyboardEvent): void => {
    if (event.key !== 'Tab') return;
    const items = getFocusable(dom, container);
    if (items.length === 0) {
      event.preventDefault();
      return;
    }
    const first = items[0]!;
    const last = items[items.length - 1]!;
    const active = dom.activeElement();
    if (active === null || !dom.contains(container, active)) {
      event.preventDefault();
      dom.focus(first);
    } else if (event.shiftKey && active === first) {
      event.preventDefault();
      dom.focus(last);
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      dom.focus(first);
    }
  }) as EventListener;
  dom.addEventListener(container, 'keydown', onKeydown);
  return () => dom.removeEventListener(container, 'keydown', onKeydown);
}

/**
 * Modal containment: if focus moves to an element outside `container`, redirect
 * it back inside. Listens on the document body (focusin bubbles there) and
 * returns a cleanup function. Server-safe no-op (body() is null).
 */
export function containFocus(dom: DOMAdapter, container: Element): () => void {
  const body = dom.body();
  if (body === null) return () => {};
  const onFocusIn = ((event: FocusEvent): void => {
    const target = event.target as Node | null;
    if (target !== null && !dom.contains(container, target)) {
      focusFirst(dom, container);
    }
  }) as EventListener;
  dom.addEventListener(body, 'focusin', onFocusIn);
  return () => dom.removeEventListener(body, 'focusin', onFocusIn);
}

/**
 * Invoke `handler` when Escape is pressed while focus is within `target`.
 * Returns a cleanup function. Server-safe no-op.
 */
export function onEscape(dom: DOMAdapter, target: Element, handler: () => void): () => void {
  const onKeydown = ((event: KeyboardEvent): void => {
    if (event.key === 'Escape') handler();
  }) as EventListener;
  dom.addEventListener(target, 'keydown', onKeydown);
  return () => dom.removeEventListener(target, 'keydown', onKeydown);
}

