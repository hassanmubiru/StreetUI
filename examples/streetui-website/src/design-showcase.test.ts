/**
 * StreetUI Website — §33 design-test acceptance.
 *
 * Compiles the fifteen showcases built with ONLY the public styling system,
 * renders them on the server and in the browser, and asserts: every showcase
 * mounts, generated style-identity classes are baked onto the nodes, the shared
 * registry serializes a single non-empty deduplicated stylesheet, and a reactive
 * showcase (tabs) actually responds to a real click. Public API only.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  streetui, compile, renderToString, renderStyles, styleRegistry,
  createRenderer, createRuntime, BrowserDOMAdapter, resetIdCounter,
} from 'streetui';
import type { PageDSL } from 'streetui';
import { flushUpdates, trigger } from 'streetui/testing';
import { SHOWCASES, buildShowcases } from './design-showcase.js';

function makeApp() {
  const app = streetui.app({ name: 'design-showcase', version: '2.7.0' });
  app.page('showcase', (page: PageDSL) => {
    page.section('showcases', (s) => buildShowcases(s), { id: 'showcases-root' });
  });
  return compile(app);
}

let container: HTMLElement;
let runtime: ReturnType<typeof createRuntime> | null = null;

beforeEach(() => {
  resetIdCounter();
  container = document.createElement('div');
  document.body.appendChild(container);
});

afterEach(() => {
  runtime?.unmount();
  runtime = null;
  if (container.parentNode !== null) container.parentNode.removeChild(container);
});

describe('§33 — fifteen UIs on the public styling system', () => {
  it('ships exactly fifteen distinct showcases', () => {
    expect(SHOWCASES.length).toBe(15);
    const ids = new Set(SHOWCASES.map((s) => s.id));
    expect(ids.size).toBe(15);
  });

  it('server-renders every showcase with generated classes', () => {
    const html = renderToString(makeApp());
    for (const sc of SHOWCASES) {
      expect(html).toContain(`id="showcase-${sc.id}"`);
    }
    expect(html).toContain('class="s-');
  });

  it('serializes one non-empty deduplicated stylesheet for the whole set', () => {
    makeApp(); // registration happens at module load, but render exercises it too
    const sheet = renderStyles({ registry: styleRegistry });
    expect(sheet.length).toBeGreaterThan(0);
    expect(sheet).toContain('data-streetui-css');
    expect(sheet).toContain('--');       // token custom properties
    expect(sheet).toContain('.s-');      // generated identity rules
    expect(sheet.match(/<style /g)?.length ?? 0).toBe(1);
  });

  it('mounts in the browser and bakes classes onto nodes', () => {
    const renderer = createRenderer({ domAdapter: new BrowserDOMAdapter() });
    runtime = createRuntime({ renderer });
    runtime.mount(makeApp(), container);
    const primary = container.querySelector('#sc-btn-primary');
    const card = container.querySelector('#sc-card-1');
    expect((primary?.getAttribute('class') ?? '').length).toBeGreaterThan(0);
    expect((card?.getAttribute('class') ?? '').length).toBeGreaterThan(0);
  });

  it('drives a reactive showcase (tabs) via a real click', async () => {
    const renderer = createRenderer({ domAdapter: new BrowserDOMAdapter() });
    runtime = createRuntime({ renderer });
    runtime.mount(makeApp(), container);
    expect(container.querySelector('#sc-tab-panel-overview')).not.toBeNull();
    expect(container.querySelector('#sc-tab-panel-details')).toBeNull();

    const detailsTab = container.querySelector('#sc-tab-details');
    expect(detailsTab).not.toBeNull();
    trigger(detailsTab as Element, 'click');
    await flushUpdates();

    expect(container.querySelector('#sc-tab-panel-details')).not.toBeNull();
    expect(container.querySelector('#sc-tab-panel-overview')).toBeNull();
  });
});
