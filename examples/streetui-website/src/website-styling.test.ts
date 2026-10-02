/**
 * StreetUI Website — styling-system wiring tests (2.7.0, §15–§17, §25).
 *
 * These exercise the migration to the unified styling system through the public
 * API only: the server emits ONE deduplicated `<style data-streetui-css>` block,
 * that block is deterministic across routes, a fresh client mount injects it
 * into the document head, hydration adopts the server sheet without duplicating
 * it, and the migrated builders actually carry their design-system classes.
 *
 * No private registry access and no second renderer: everything goes through
 * `renderWebsite` (server) and `mountWebsite` (client), the same seams a real
 * host uses.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createMemoryHistory, resetIdCounter } from 'streetui';
import { mountWebsite, type MountedWebsite } from './website.js';
import { renderWebsite } from './server-entry.js';

const CSS_MARKER = 'data-streetui-css';

function makeContainer(): HTMLElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

function clearInjectedSheets(): void {
  for (const el of Array.from(document.head.querySelectorAll(`[${CSS_MARKER}]`))) {
    el.parentNode?.removeChild(el);
  }
}

let site: MountedWebsite | null = null;
let container: HTMLElement;

beforeEach(() => {
  resetIdCounter();
  clearInjectedSheets();
  container = makeContainer();
});

afterEach(() => {
  site?.unmount();
  site = null;
  if (container.parentNode !== null) container.parentNode.removeChild(container);
  clearInjectedSheets();
});

describe('server stylesheet (§15/§16)', () => {
  it('emits exactly one deduplicated <style data-streetui-css> block', () => {
    const { styles } = renderWebsite('/');
    expect(styles.length).toBeGreaterThan(0);
    expect(styles.startsWith('<style ')).toBe(true);
    expect(styles).toContain(CSS_MARKER);
    expect(styles).toContain('data-streetui-css-keys="');
    // One block only.
    expect(styles.match(/<style /g)?.length ?? 0).toBe(1);
    // Carries real token custom properties and generated class rules.
    expect(styles).toContain('--');
    expect(styles).toContain('.s-');
  });

  it('is byte-identical across different routes (deterministic dedup)', () => {
    const a = renderWebsite('/');
    const b = renderWebsite('/docs/reactivity');
    const c = renderWebsite('/benchmarks');
    expect(a.styles).toBe(b.styles);
    expect(b.styles).toBe(c.styles);
  });

  it('keeps the stylesheet OUT of the head-metadata field', () => {
    const { head, styles } = renderWebsite('/');
    expect(head).not.toContain(CSS_MARKER);
    expect(styles).toContain(CSS_MARKER);
  });
});

describe('client stylesheet install / adopt (§17)', () => {
  it('injects the sheet into the document head on a fresh mount', () => {
    expect(document.head.querySelector(`[${CSS_MARKER}]`)).toBeNull();
    site = mountWebsite(container, { history: createMemoryHistory('/') });
    const sheets = document.head.querySelectorAll(`[${CSS_MARKER}]`);
    expect(sheets.length).toBe(1);
    expect((sheets[0]?.textContent ?? '').length).toBeGreaterThan(0);
  });

  it('does not inject a second sheet when one is already present', () => {
    site = mountWebsite(container, { history: createMemoryHistory('/') });
    expect(document.head.querySelectorAll(`[${CSS_MARKER}]`).length).toBe(1);
    // Mount a second instance into a new container in the same document.
    const second = makeContainer();
    const s2 = mountWebsite(second, { history: createMemoryHistory('/about') });
    expect(document.head.querySelectorAll(`[${CSS_MARKER}]`).length).toBe(1);
    s2.unmount();
    if (second.parentNode !== null) second.parentNode.removeChild(second);
  });

  it('adopts a server-planted sheet on hydrate without duplicating it', () => {
    const { styles } = renderWebsite('/');
    // Plant the server sheet exactly as a host would place it in <head>.
    document.head.insertAdjacentHTML('beforeend', styles);
    expect(document.head.querySelectorAll(`[${CSS_MARKER}]`).length).toBe(1);

    // Plant server body markup, then hydrate.
    resetIdCounter();
    const serverContainer = makeContainer();
    const server = mountWebsite(serverContainer, { history: createMemoryHistory('/') });
    const html = serverContainer.innerHTML;
    server.unmount();
    if (serverContainer.parentNode !== null) {
      serverContainer.parentNode.removeChild(serverContainer);
    }

    container.innerHTML = html;
    resetIdCounter();
    site = mountWebsite(container, { history: createMemoryHistory('/'), hydrate: true });
    // Hydration adopted the existing sheet — still exactly one block.
    expect(document.head.querySelectorAll(`[${CSS_MARKER}]`).length).toBe(1);
  });
});

describe('migration seam — builders carry design-system classes (§25)', () => {
  it('shell and route nodes expose their class attribute', () => {
    site = mountWebsite(container, { history: createMemoryHistory('/') });
    const brand = container.querySelector('#brand');
    const title = container.querySelector('#home-title');
    const cta = container.querySelector('#home-cta');
    expect((brand?.getAttribute('class') ?? '').length).toBeGreaterThan(0);
    expect((title?.getAttribute('class') ?? '').length).toBeGreaterThan(0);
    expect((cta?.getAttribute('class') ?? '').length).toBeGreaterThan(0);
  });

  it('server HTML carries the same classes (SSR path, not client-only)', () => {
    const { html } = renderWebsite('/');
    // Generated style-identity classes are baked onto props.class server-side.
    expect(html).toContain('id="home-start"');
    expect(html).toContain('class="s-');
  });
});
