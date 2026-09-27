/**
 * Component-focused testing helpers (§22).
 *
 * These extend `streetui/testing` for the component model. Following the spec's
 * "add only the ones that are actually useful" directive, this module ships the
 * helpers that remove real boilerplate and OMITS the ones that would be
 * misleading in this architecture:
 *
 *   • renderComponent   — mount a single component in a throwaway host app.
 *   • hydrateComponent  — SSR-then-hydrate that same host (the §11/§12 seam).
 *   • findComponent / findAllComponents / getComponentName — locate component
 *     instances by their inspectable `data-streetui-component` name.
 *   • trigger           — dispatch a bubbling DOM event (click/input/keydown…).
 *
 * Deliberately NOT provided:
 *   • getComponentProps — props are passed to `setup` and captured by closure;
 *     they are not reified on the node (only the definition *name* is), so a
 *     prop-reading helper would either lie or require a private-graph backdoor.
 *     Assert on rendered output (or a signal you own) instead.
 *   • awaitResource     — `waitFor(...)` and `flushUpdates()` already settle
 *     async resource state; a resource-specific alias would be redundant.
 */

import { streetui, type ComponentDefinition, type ContainerBuilder } from '@streetui/dsl';
import { render, type RenderResult } from './test-renderer.js';
import { renderServerThenHydrate, type HydrateTestResult, type HydrateTestOptions } from './helpers.js';

/** The attribute the DSL writes for a component's inspectable name. */
const COMPONENT_ATTR = 'data-streetui-component';

export interface RenderComponentResult extends RenderResult {
  /** The component's root `<div>` wrapper element. */
  readonly component: HTMLElement;
}

/**
 * Build a throwaway single-page host app whose only content is `def` rendered
 * with `props` (and optional `children`), mount it, and return the usual
 * `RenderResult` plus the component's root element. Use for unit-testing one
 * component without hand-writing an app+page wrapper each time.
 */
export function renderComponent<P>(
  def: ComponentDefinition<P>,
  props: P,
  children?: ContainerBuilder,
): RenderComponentResult {
  const app = streetui.app({ name: `test:${def.name}` });
  app.page('host', (page) => {
    page.component('root', def, props, children);
  });
  const result = render(app);
  const component = result.container.querySelector<HTMLElement>(`[${COMPONENT_ATTR}]`);
  if (component === null) {
    throw new Error(`[StreetUI Testing] renderComponent: no component element rendered for "${def.name}"`);
  }
  return { ...result, component };
}

/**
 * SSR-render then hydrate a single component in a host app — the production
 * server→client seam (§11/§12). `build` must return `{ def, props, children? }`;
 * it is invoked twice (server then client) with id-counter reset between, so a
 * component that owns per-instance signals lines up positionally on hydration.
 */
export function hydrateComponent<P>(
  build: () => { def: ComponentDefinition<P>; props: P; children?: ContainerBuilder },
  options: HydrateTestOptions = {},
): HydrateTestResult {
  return renderServerThenHydrate(() => {
    const { def, props, children } = build();
    const app = streetui.app({ name: `test:${def.name}` });
    app.page('host', (page) => page.component('root', def, props, children));
    return app;
  }, options);
}

/** All component instances under `container`, optionally filtered by name. */
export function findAllComponents(container: Element, name?: string): HTMLElement[] {
  const selector = name === undefined
    ? `[${COMPONENT_ATTR}]`
    : `[${COMPONENT_ATTR}="${name}"]`;
  return Array.from(container.querySelectorAll<HTMLElement>(selector));
}

/** The single component instance under `container` (throws if none/ambiguous). */
export function findComponent(container: Element, name?: string): HTMLElement {
  const matches = findAllComponents(container, name);
  const named = name !== undefined ? ` named "${name}"` : '';
  if (matches.length === 0) {
    throw new Error(`[StreetUI Testing] No component${named} found`);
  }
  if (matches.length > 1) {
    throw new Error(
      `[StreetUI Testing] Found ${matches.length} components${named} — pass a name to disambiguate`,
    );
  }
  return matches[0]!;
}

/** Read a component element's definition name, or `null` if `el` is not one. */
export function getComponentName(el: Element): string | null {
  return el.getAttribute(COMPONENT_ATTR);
}

/**
 * Dispatch a bubbling, cancelable DOM event of `type` on `el`. Thin wrapper over
 * `dispatchEvent` so tests read intentfully (`trigger(btn, 'click')`) without
 * constructing `Event`/`KeyboardEvent` objects by hand. Extra `init` fields
 * (e.g. `{ key: 'Escape' }`) are forwarded to the appropriate event ctor.
 */
export function trigger(el: Element, type: string, init: Record<string, unknown> = {}): void {
  const base = { bubbles: true, cancelable: true, ...init };
  let event: Event;
  if (type.startsWith('key')) {
    event = new KeyboardEvent(type, base as KeyboardEventInit);
  } else if (type.startsWith('mouse') || type === 'click' || type === 'dblclick') {
    event = new MouseEvent(type, base as MouseEventInit);
  } else if (type === 'input' || type === 'change') {
    event = new Event(type, base);
  } else {
    event = new Event(type, base);
  }
  el.dispatchEvent(event);
}
