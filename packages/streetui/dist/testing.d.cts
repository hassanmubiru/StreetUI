import { S as StreetApp, H as HydrationDiagnostic, a as ComponentDefinition, b as ContainerBuilder } from './hydration-diagnostics-j2ged4cF.cjs';
export { V as VERSION } from './hydration-diagnostics-j2ged4cF.cjs';
import { R as RenderHandle } from './renderer-interface-hcqzG-N6.cjs';
export * from 'streetui/diagnostics';

/**
 * StreetUI Test Renderer.
 *
 * Renders a StreetApp into a real (happy-dom / jsdom) DOM container
 * and exposes query helpers so tests can assert on structure/content
 * without importing the browser renderer directly.
 */

interface RenderResult {
    /** The root container element that was rendered into. */
    readonly container: HTMLElement;
    /** Unmount and clean up the render. */
    unmount(): void;
    /** Query a single element (throws if missing). */
    getByTag<K extends keyof HTMLElementTagNameMap>(tag: K): HTMLElementTagNameMap[K];
    /** Query all elements by tag. */
    getAllByTag<K extends keyof HTMLElementTagNameMap>(tag: K): Array<HTMLElementTagNameMap[K]>;
    /** Query by text content (partial match). */
    getByText(text: string): Element;
    /** Query all elements whose text content includes the given string. */
    getAllByText(text: string): Element[];
    /** Raw querySelector. */
    query(selector: string): Element | null;
    /** Raw querySelectorAll. */
    queryAll(selector: string): Element[];
    /** Assert element exists; return it. */
    find(selector: string): Element;
    /** Force a flush of any pending scheduler work. */
    flush(): void;
    /** The underlying render handle. */
    readonly handle: RenderHandle;
}
/**
 * Render a StreetApp into a detached DOM container.
 * Uses the real StreetUI renderer backed by happy-dom/jsdom.
 */
declare function render(app: StreetApp): RenderResult;
/** Render and automatically clean up after the test. */
declare function renderOnce(app: StreetApp, testFn: (result: RenderResult) => void | Promise<void>): Promise<void>;

/**
 * Higher-level testing helpers: role/text queries, update flushing, async
 * waiting, and a first-class SSR → hydrate → assert workflow.
 *
 * These build on the same real renderer the app uses — no private-graph access,
 * no second assertion framework. They exist so a test does not have to
 * reimplement server-render/hydrate plumbing or poll for async resource state
 * by hand.
 */

/**
 * Flush all pending scheduler work, then yield once to the microtask queue so
 * promise-driven updates (e.g. a resolved `resource` loader) are applied. Await
 * this after triggering a change that schedules a DOM patch.
 */
declare function flushUpdates(): Promise<void>;
interface WaitForOptions {
    /** Give up after this many milliseconds (default 1000). */
    readonly timeout?: number;
    /** Delay between attempts in milliseconds (default 10). */
    readonly interval?: number;
}
/**
 * Poll `check` until it returns a truthy value (or stops throwing), flushing
 * updates between attempts. Rejects with the last error/tiemout after the
 * deadline. Use for assertions that become true only after async work settles.
 */
declare function waitFor<T>(check: () => T, options?: WaitForOptions): Promise<T>;
/** A minimal writable-boolean seam (an overlay `open` signal, typically). */
interface BooleanControl {
    set(value: boolean): void;
}
/** Focus `el` (no-op if it exposes no `focus`). Intentful wrapper for tests. */
declare function focus(el: Element): void;
/** Blur `el` (no-op if it exposes no `blur`). */
declare function blur(el: Element): void;
/**
 * Dispatch a bubbling, cancelable `keydown` for `key` on `el` (defaulting to the
 * currently-focused element). Extra `init` fields (e.g. `{ shiftKey: true }`)
 * are forwarded. Use for keyboard-interaction assertions (Escape, Tab, arrows).
 */
declare function pressKey(key: string, el?: Element | null, init?: KeyboardEventInit): void;
/**
 * Simulate a pointer interaction OUTSIDE `container` — a `mousedown` + `click`
 * on `document.body` (or `target` if given). Drives "click-away to dismiss"
 * behaviour without the test constructing events by hand. If `target` is inside
 * `container` this throws, so a mistake is loud rather than a silent no-op.
 */
declare function clickOutside(container: Element, target?: Element): void;
/**
 * Open an overlay by flipping its `open` control to `true`, then flush so the
 * panel mounts and its enter/focus wiring runs. Overlay visibility is app-owned
 * state (§18) — a plain signal — so this is a thin, intentful wrapper over
 * `set(true)` + {@link flushUpdates}.
 */
declare function openOverlay(open: BooleanControl): Promise<void>;
/** Close an overlay by flipping its `open` control to `false`, then flush. */
declare function closeOverlay(open: BooleanControl): Promise<void>;
/**
 * Settle a CSS transition on `el` deterministically: dispatch the
 * `transitionend` the controller listens for (happy-dom fires none of its own),
 * then flush pending work so any deferred leave-teardown (DOM removal, dispose,
 * detach) completes. Await this after toggling a transitioned element to assert
 * its post-animation state without depending on the fallback timeout.
 */
declare function waitForTransition(el: Element): Promise<void>;
/** Find the first leaf element whose text content includes `text`. */
declare function findByText(container: Element, text: string): Element;
interface ByRoleOptions {
    /** Restrict to elements whose accessible name includes this string. */
    readonly name?: string;
}
/**
 * Find all elements matching an ARIA `role` — explicit `role="…"` first, then
 * the element's implicit role. Optionally filter by accessible name.
 */
declare function findAllByRole(container: Element, role: string, options?: ByRoleOptions): Element[];
/** Find the single element matching a role (throws if none/ambiguous). */
declare function findByRole(container: Element, role: string, options?: ByRoleOptions): Element;
interface HydrateTestOptions {
    /** Collect hydration mismatch diagnostics (dev-style) during hydration. */
    readonly collectDiagnostics?: boolean;
}
interface HydrateTestResult {
    /** The container holding the server HTML, now hydrated live. */
    readonly container: HTMLElement;
    /** The server-produced HTML string (before hydration). */
    readonly serverHtml: string;
    /** The live render handle from hydration. */
    readonly handle: RenderHandle;
    /** Hydration mismatch diagnostics (empty unless collectDiagnostics + a real mismatch). */
    readonly diagnostics: readonly HydrationDiagnostic[];
    /** Flush pending scheduler work. */
    flush(): void;
    /** Unmount and detach the container. */
    unmount(): void;
}
/**
 * Render `build` on the "server" to HTML, mount that HTML into a container,
 * then hydrate the SAME app against it — exactly the production SSR path. The
 * builder is invoked twice (server then client) with `resetIdCounter` between,
 * so deterministic ids line up. Assert node identity, behavior, and (optionally)
 * that hydration reported no mismatches.
 */
declare function renderServerThenHydrate(build: () => StreetApp, options?: HydrateTestOptions): HydrateTestResult;

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

interface RenderComponentResult extends RenderResult {
    /** The component's root `<div>` wrapper element. */
    readonly component: HTMLElement;
}
/**
 * Build a throwaway single-page host app whose only content is `def` rendered
 * with `props` (and optional `children`), mount it, and return the usual
 * `RenderResult` plus the component's root element. Use for unit-testing one
 * component without hand-writing an app+page wrapper each time.
 */
declare function renderComponent<P>(def: ComponentDefinition<P>, props: P, children?: ContainerBuilder): RenderComponentResult;
/**
 * SSR-render then hydrate a single component in a host app — the production
 * server→client seam (§11/§12). `build` must return `{ def, props, children? }`;
 * it is invoked twice (server then client) with id-counter reset between, so a
 * component that owns per-instance signals lines up positionally on hydration.
 */
declare function hydrateComponent<P>(build: () => {
    def: ComponentDefinition<P>;
    props: P;
    children?: ContainerBuilder;
}, options?: HydrateTestOptions): HydrateTestResult;
/** All component instances under `container`, optionally filtered by name. */
declare function findAllComponents(container: Element, name?: string): HTMLElement[];
/** The single component instance under `container` (throws if none/ambiguous). */
declare function findComponent(container: Element, name?: string): HTMLElement;
/** Read a component element's definition name, or `null` if `el` is not one. */
declare function getComponentName(el: Element): string | null;
/**
 * Dispatch a bubbling, cancelable DOM event of `type` on `el`. Thin wrapper over
 * `dispatchEvent` so tests read intentfully (`trigger(btn, 'click')`) without
 * constructing `Event`/`KeyboardEvent` objects by hand. Extra `init` fields
 * (e.g. `{ key: 'Escape' }`) are forwarded to the appropriate event ctor.
 */
declare function trigger(el: Element, type: string, init?: Record<string, unknown>): void;

export { type BooleanControl, type ByRoleOptions, type HydrateTestOptions, type HydrateTestResult, type RenderComponentResult, type RenderResult, type WaitForOptions, blur, clickOutside, closeOverlay, findAllByRole, findAllComponents, findByRole, findByText, findComponent, flushUpdates, focus, getComponentName, hydrateComponent, openOverlay, pressKey, render, renderComponent, renderOnce, renderServerThenHydrate, trigger, waitFor, waitForTransition };
