import { S as StreetApp } from './compile-DGHUC0T6.cjs';
export { V as VERSION } from './compile-DGHUC0T6.cjs';
import { R as RenderHandle, H as HydrationDiagnostic } from './hydration-diagnostics-D9odszLZ.cjs';
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

export { type ByRoleOptions, type HydrateTestOptions, type HydrateTestResult, type RenderResult, type WaitForOptions, findAllByRole, findByRole, findByText, flushUpdates, render, renderOnce, renderServerThenHydrate, waitFor };
