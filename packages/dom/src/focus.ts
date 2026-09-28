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
 *
 * Nested modals (§16): every active containment pushes its container onto a
 * module-level stack, and a handler only redirects while ITS container is the
 * top of the stack — i.e. the most recently opened modal. This is the framework's
 * minimal "focus owner" concept: because overlay panels are relocated to
 * body-level portals (siblings, not descendants), two overlapping `containFocus`
 * handlers would otherwise fight over every `focusin`. The stack makes exactly
 * one owner authoritative at a time; cleanup pops it so the previous modal
 * resumes ownership. State is internal and torn down on cleanup — nothing is
 * retained on the graph (§18).
 */
const containmentStack: Element[] = [];

export function containFocus(dom: DOMAdapter, container: Element): () => void {
  const body = dom.body();
  if (body === null) return () => {};
  containmentStack.push(container);
  const onFocusIn = ((event: FocusEvent): void => {
    // Only the topmost owner enforces containment (nested-modal correctness).
    if (containmentStack[containmentStack.length - 1] !== container) return;
    const target = event.target as Node | null;
    if (target !== null && !dom.contains(container, target)) {
      focusFirst(dom, container);
    }
  }) as EventListener;
  dom.addEventListener(body, 'focusin', onFocusIn);
  return () => {
    dom.removeEventListener(body, 'focusin', onFocusIn);
    const index = containmentStack.lastIndexOf(container);
    if (index !== -1) containmentStack.splice(index, 1);
  };
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

/**
 * Roving-focus keyboard navigation for a menu (role="menu") container: the
 * arrow keys move focus between the container's focusable items (wrap-around at
 * both ends), Home/End jump to the first/last item, and Enter/Space activate
 * the currently-focused item (a native `click`, so an item's `onClick` fires).
 * `Tab` and `Escape` are deliberately left alone — the overlay layer wires
 * Escape-to-close separately and a menu does not trap Tab.
 *
 * Items are re-queried on every key (via {@link getFocusable}) so a menu whose
 * items change reactively is always navigated against the live set, and items
 * disabled after mount are skipped. Attaches a keydown listener to the
 * container and returns a cleanup function. Server-safe: `addEventListener` is
 * a no-op and the returned cleanup is still callable.
 */
export function rovingMenu(
  dom: DOMAdapter,
  container: Element,
  selector: string = FOCUSABLE_SELECTOR,
): () => void {
  const onKeydown = ((event: KeyboardEvent): void => {
    const key = event.key;
    const isActivate = key === 'Enter' || key === ' ' || key === 'Spacebar';
    const isMove =
      key === 'ArrowDown' || key === 'ArrowUp' || key === 'Home' || key === 'End';
    if (!isActivate && !isMove) return;

    const items = getFocusable(dom, container, selector);
    if (items.length === 0) return;
    const active = dom.activeElement();
    const index = active === null ? -1 : items.indexOf(active);

    if (isActivate) {
      // Activating a menu item only makes sense when one is focused; otherwise
      // let the event fall through unchanged.
      if (index < 0) return;
      event.preventDefault();
      (items[index] as unknown as { click?: () => void }).click?.();
      return;
    }

    event.preventDefault();
    let next: number;
    if (key === 'Home') next = 0;
    else if (key === 'End') next = items.length - 1;
    else if (key === 'ArrowDown') next = index < 0 ? 0 : (index + 1) % items.length;
    else next = index <= 0 ? items.length - 1 : index - 1; // ArrowUp
    dom.focus(items[next]!);
  }) as EventListener;
  dom.addEventListener(container, 'keydown', onKeydown);
  return () => dom.removeEventListener(container, 'keydown', onKeydown);
}

