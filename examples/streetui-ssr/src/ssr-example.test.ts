/**
 * End-to-end SSR + hydration for the example app, exercised under a DOM.
 *
 * The flow mirrors production: render on the "server" with `renderToString`,
 * embed the state with `serializeState`, plant that markup in the document, then
 * `hydrateApp` adopts it and brings it to life. We assert the server DOM is
 * reused (identity), the transferred state seeds the client (no flash, correct
 * values), and every interaction drives the adopted nodes in place.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { resetIdCounter } from 'streetui';
import { renderToString, serializeState } from 'streetui';
import {
  createState,
  compileApp,
  snapshot,
  STATE_KEY,
  type AppSnapshot,
} from './app.js';
import { renderDocument } from './document.js';
import { hydrateApp } from './browser-entry.js';

const SEED: AppSnapshot = {
  count: 5,
  name: 'Ada',
  showDetails: false,
  todos: [
    { id: 10, label: 'alpha' },
    { id: 20, label: 'beta' },
  ],
};

/** Server render → plant markup + island in the document → return the #app root. */
function planted(seed: AppSnapshot): Element {
  resetIdCounter();
  const state = createState(seed);
  const compiled = compileApp(state);
  const body = renderToString(compiled);
  const island = serializeState({ [STATE_KEY]: snapshot(state) });
  document.body.innerHTML = `<div id="app">${body}</div>${island}`;
  resetIdCounter();
  return document.getElementById('app')!;
}

beforeEach(() => {
  document.body.innerHTML = '';
  resetIdCounter();
});

describe('renderDocument — pure server render', () => {
  it('produces a full HTML document with markup and a state island', () => {
    const html = renderDocument(SEED);
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('id="app"');
    expect(html).toContain('Count: 5'); // seeded value rendered server-side
    expect(html).toContain('data-streetui-state'); // island present
    expect(html).toContain('Ada');
  });
});

describe('SSR → hydration (universal rendering)', () => {
  it('adopts the server DOM (same nodes) and seeds state from the island', () => {
    const app = planted(SEED);
    const titleBefore = app.querySelector('#title');
    const countBefore = app.querySelector('#count');
    expect(countBefore?.textContent).toContain('5');

    const { state, unmount } = hydrateApp(app, document);

    // Adoption — the very same element objects, not recreated.
    expect(app.querySelector('#title')).toBe(titleBefore);
    expect(app.querySelector('#count')).toBe(countBefore);
    // Client state was seeded from the island, not defaulted.
    expect(state.count.peek()).toBe(5);
    expect(state.name.peek()).toBe('Ada');

    unmount();
  });

  it('increment button updates the count text in place after hydration', () => {
    const app = planted(SEED);
    const countBefore = app.querySelector('#count');
    const { state, unmount } = hydrateApp(app, document);

    (app.querySelector('#inc') as HTMLButtonElement).dispatchEvent(new Event('click'));
    expect(state.count.peek()).toBe(6);
    expect(app.querySelector('#count')?.textContent).toContain('6');
    expect(app.querySelector('#count')).toBe(countBefore); // same node, patched

    unmount();
  });

  it('two-way input propagates typing into the signal and updates the greeting', () => {
    const app = planted(SEED);
    const { state, unmount } = hydrateApp(app, document);

    const input = app.querySelector('#name-input') as HTMLInputElement;
    expect(input.value).toBe('Ada');
    input.value = 'Grace';
    input.dispatchEvent(new Event('input'));
    expect(state.name.peek()).toBe('Grace');
    expect(app.querySelector('#greeting')?.textContent).toContain('Grace');

    unmount();
  });

  it('toggles a when() branch that was absent in the server HTML', () => {
    const app = planted(SEED); // showDetails: false → no #detail server-side
    expect(app.querySelector('#detail')).toBeNull();
    const { unmount } = hydrateApp(app, document);

    (app.querySelector('#toggle') as HTMLButtonElement).dispatchEvent(new Event('click'));
    expect(app.querySelector('#detail')).not.toBeNull();
    (app.querySelector('#toggle') as HTMLButtonElement).dispatchEvent(new Event('click'));
    expect(app.querySelector('#detail')).toBeNull();

    unmount();
  });

  it('reactive list is keyed after hydration — reorder reuses server nodes', () => {
    const app = planted(SEED);
    const { state, unmount } = hydrateApp(app, document);

    const before = Array.from(app.querySelectorAll('li'));
    expect(before.map((li) => li.textContent)).toEqual(['alpha', 'beta']);
    const alpha = before.find((li) => li.textContent === 'alpha')!;

    state.todos.set([
      { id: 20, label: 'beta' },
      { id: 10, label: 'alpha' },
    ]);

    const after = Array.from(app.querySelectorAll('li'));
    expect(after.map((li) => li.textContent)).toEqual(['beta', 'alpha']);
    expect(after.find((li) => li.textContent === 'alpha')).toBe(alpha); // reused

    unmount();
  });

  it('unmount tears the app down and stops reacting', () => {
    const app = planted(SEED);
    const { state, unmount } = hydrateApp(app, document);
    unmount();
    expect(app.children.length).toBe(0);
    // Post-unmount signal writes are safe no-ops.
    expect(() => state.count.set(99)).not.toThrow();
  });
});
