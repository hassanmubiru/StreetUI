import { StreetApp } from '@streetui/dsl';
import { RenderHandle } from '@streetui/runtime';

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

export { type RenderResult, render, renderOnce };
