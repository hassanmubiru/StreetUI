/**
 * Portal primitive (v1.9 §19/§20).
 *
 * A portal renders its children into `document.body` (escaping overflow/stacking
 * contexts) while leaving a neutral inline anchor at the declaration site. On the
 * server there is no body, so children render inline in the anchor; hydration
 * then relocates them to a body container so the live tree matches the browser
 * mount path exactly. These are structural assertions (engine-independent), not
 * timings, so they are deterministic in CI.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { resetIdCounter } from '@streetui/core';
import { streetui } from '@streetui/dsl';
import { signal } from '@streetui/state';
import { compile } from '@streetui/compiler';
import { BrowserDOMAdapter } from '@streetui/dom';
import { createRenderer } from './renderer.js';
import { renderToString } from './ssr.js';

beforeEach(() => {
  resetIdCounter();
  document.body.innerHTML = '';
});

function buildPortalApp() {
  const app = streetui.app({ name: 'portal' });
  app.page('home', (page) => {
    page.text('inline-before');
    page.portal('pt', (pt) => {
      pt.text('portaled');
    });
    page.text('inline-after');
  });
  return compile(app);
}

describe('portal — browser mount', () => {
  it('relocates children to a document.body container, leaving an inline anchor', () => {
    const compiled = buildPortalApp();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const renderer = createRenderer({ domAdapter: new BrowserDOMAdapter() });
    renderer.mount(compiled, container);

    // The anchor stays inline at the declaration site …
    const anchor = container.querySelector('[data-streetui-portal]');
    expect(anchor).not.toBeNull();
    // … but the portaled content is NOT inside it.
    expect(anchor!.textContent).toBe('');
    expect(container.textContent).toContain('inline-before');
    expect(container.textContent).toContain('inline-after');
    expect(container.textContent).not.toContain('portaled');

    // The content lives in a body-level container instead.
    const bodyContainer = document.body.querySelector('[data-streetui-portal-container]');
    expect(bodyContainer).not.toBeNull();
    expect(bodyContainer!.textContent).toContain('portaled');
    // The body container is a sibling of `container`, not nested inside it.
    expect(container.contains(bodyContainer)).toBe(false);
  });

  it('removes the body container on unmount (no orphaned DOM)', () => {
    const compiled = buildPortalApp();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const renderer = createRenderer({ domAdapter: new BrowserDOMAdapter() });
    const handle = renderer.mount(compiled, container);

    expect(document.body.querySelector('[data-streetui-portal-container]')).not.toBeNull();
    handle.unmount();
    expect(document.body.querySelector('[data-streetui-portal-container]')).toBeNull();
  });

  it('a plain portal wires no overlay/focus behavior', () => {
    // Mounting a plain portal must not move focus anywhere.
    const compiled = buildPortalApp();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const sentinel = document.createElement('button');
    sentinel.id = 'sentinel';
    document.body.appendChild(sentinel);
    sentinel.focus();

    const renderer = createRenderer({ domAdapter: new BrowserDOMAdapter() });
    renderer.mount(compiled, container);
    expect(document.activeElement).toBe(sentinel);
  });
});

describe('portal — SSR renders inline (no body on the server)', () => {
  it('emits the anchor with children inline and no body-container marker', () => {
    const compiled = buildPortalApp();
    const html = renderToString(compiled);
    expect(html).toContain('data-streetui-portal');
    expect(html).toContain('portaled');
    // The body-relocation is a browser-only concern.
    expect(html).not.toContain('data-streetui-portal-container');
  });
});

describe('portal — hydration relocates server-inline children', () => {
  it('moves inline children into a body container and empties the anchor', () => {
    const compiled = buildPortalApp();
    const html = renderToString(compiled);

    // Reset ids so hydration walks the same graph the server did.
    resetIdCounter();
    const compiled2 = buildPortalApp();
    const container = document.createElement('div');
    container.innerHTML = html;
    document.body.appendChild(container);

    const renderer = createRenderer({ domAdapter: new BrowserDOMAdapter() });
    const handle = renderer.hydrate(compiled2, container);

    const anchor = container.querySelector('[data-streetui-portal]');
    expect(anchor).not.toBeNull();
    expect(anchor!.textContent).toBe(''); // children moved out

    const bodyContainer = document.body.querySelector('[data-streetui-portal-container]');
    expect(bodyContainer).not.toBeNull();
    expect(bodyContainer!.textContent).toContain('portaled');

    handle.unmount();
    expect(document.body.querySelector('[data-streetui-portal-container]')).toBeNull();
  });
});

describe('portal — reactive children still work through the body container', () => {
  it('updates portaled text when its bound signal changes', () => {
    resetIdCounter();
    const label = signal('one');
    const app = streetui.app({ name: 'portal-reactive' });
    app.page('home', (page) => {
      page.portal('pt', (pt) => {
        pt.text(label);
      });
    });
    const compiled = compile(app);
    const container = document.createElement('div');
    document.body.appendChild(container);
    const renderer = createRenderer({ domAdapter: new BrowserDOMAdapter() });
    renderer.mount(compiled, container);

    const bodyContainer = document.body.querySelector('[data-streetui-portal-container]')!;
    expect(bodyContainer.textContent).toContain('one');
    label.set('two');
    expect(bodyContainer.textContent).toContain('two');
    expect(bodyContainer.textContent).not.toContain('one');
  });
});
