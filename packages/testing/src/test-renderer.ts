/**
 * StreetUI Test Renderer.
 *
 * Renders a StreetApp into a real (happy-dom / jsdom) DOM container
 * and exposes query helpers so tests can assert on structure/content
 * without importing the browser renderer directly.
 */

import { resetIdCounter } from '@streetui/core';
import { compile } from '@streetui/compiler';
import type { StreetApp } from '@streetui/dsl';
import { BrowserDOMAdapter } from '@streetui/dom';
import { createRenderer } from '@streetui/renderer';
import type { RenderHandle } from '@streetui/runtime';

export interface RenderResult {
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
export function render(app: StreetApp): RenderResult {
  const compiled = compile(app);
  const container = document.createElement('div');
  document.body.appendChild(container);

  const renderer = createRenderer({ domAdapter: new BrowserDOMAdapter() });
  const handle = renderer.mount(compiled, container);

  return {
    container,
    handle,
    unmount() {
      handle.unmount();
      if (container.parentNode !== null) {
        container.parentNode.removeChild(container);
      }
    },
    flush() {
      handle.flush();
    },
    getByTag<K extends keyof HTMLElementTagNameMap>(tag: K): HTMLElementTagNameMap[K] {
      const el = container.querySelector(tag);
      if (el === null) {
        throw new Error(`[StreetUI Testing] Element <${tag}> not found in render output`);
      }
      return el as HTMLElementTagNameMap[K];
    },
    getAllByTag<K extends keyof HTMLElementTagNameMap>(tag: K): Array<HTMLElementTagNameMap[K]> {
      return Array.from(container.querySelectorAll(tag)) as Array<HTMLElementTagNameMap[K]>;
    },
    getByText(text: string): Element {
      const all = Array.from(container.querySelectorAll('*'));
      const match = all.find(el =>
        el.children.length === 0 && el.textContent?.includes(text),
      );
      if (match === undefined) {
        throw new Error(`[StreetUI Testing] No element with text "${text}" found`);
      }
      return match;
    },
    getAllByText(text: string): Element[] {
      return Array.from(container.querySelectorAll('*')).filter(el =>
        el.textContent?.includes(text),
      );
    },
    query(selector: string): Element | null {
      return container.querySelector(selector);
    },
    queryAll(selector: string): Element[] {
      return Array.from(container.querySelectorAll(selector));
    },
    find(selector: string): Element {
      const el = container.querySelector(selector);
      if (el === null) {
        throw new Error(`[StreetUI Testing] Selector "${selector}" matched nothing`);
      }
      return el;
    },
  };
}

/** Render and automatically clean up after the test. */
export function renderOnce(
  app: StreetApp,
  testFn: (result: RenderResult) => void | Promise<void>,
): Promise<void> {
  const result = render(app);
  return Promise.resolve(testFn(result)).finally(() => {
    result.unmount();
    resetIdCounter();
  });
}
