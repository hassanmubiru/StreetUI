import { describe, it, expect } from 'vitest';
import { resetIdCounter, a11yIds } from '@streetui/core';
import { streetui, type PageDSL } from '@streetui/dsl';
import { compile } from '@streetui/compiler';
import { BrowserDOMAdapter } from '@streetui/dom';
import { createRenderer } from './renderer.js';
import { renderToString } from './ssr.js';

function renderHtml(build: (page: PageDSL) => void): string {
  resetIdCounter();
  const app = streetui.app({ name: 'a11y' });
  app.page('home', (page) => build(page));
  return renderToString(compile(app));
}

function prepare(build: (page: PageDSL) => void) {
  resetIdCounter();
  const serverApp = streetui.app({ name: 'a11y' });
  serverApp.page('home', (page) => build(page));
  const html = renderToString(compile(serverApp));
  const container = document.createElement('div');
  container.innerHTML = html;
  return {
    container,
    hydrate() {
      resetIdCounter();
      const clientApp = streetui.app({ name: 'a11y' });
      clientApp.page('home', (page) => build(page));
      const renderer = createRenderer({ domAdapter: new BrowserDOMAdapter() });
      return renderer.hydrate(compile(clientApp), container);
    },
  };
}

describe('a11y attributes — server rendering', () => {
  it('renders role, tabindex, aria-label and aria-controls through the DSL', () => {
    const html = renderHtml((page) => {
      page.button('Menu', {
        role: 'button',
        tabIndex: 0,
        ariaLabel: 'Open menu',
        ariaControls: 'menu-panel',
      });
    });
    expect(html).toContain('role="button"');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('aria-label="Open menu"');
    expect(html).toContain('aria-controls="menu-panel"');
  });

  it('serializes ARIA boolean state as the strings "true"/"false" (never dropped)', () => {
    const collapsed = renderHtml((page) =>
      page.button('Toggle', { ariaExpanded: false, ariaHidden: false }),
    );
    // false must survive as the attribute string, not be removed like a DOM boolean attr.
    expect(collapsed).toContain('aria-expanded="false"');
    expect(collapsed).toContain('aria-hidden="false"');

    const expanded = renderHtml((page) => page.button('Toggle', { ariaExpanded: true }));
    expect(expanded).toContain('aria-expanded="true"');
  });

  it('renders an aria-live region value', () => {
    const html = renderHtml((page) =>
      page.container('status', () => {}, { ariaLive: 'polite', role: 'status' }),
    );
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('role="status"');
  });

  it('wires deterministic a11yIds between an input and its description', () => {
    const ids = a11yIds('email');
    const html = renderHtml((page) => {
      page.input({ id: ids.input, ariaDescribedBy: ids.description, ariaInvalid: true });
      page.text('Enter a valid email', { id: ids.description });
    });
    expect(ids.input).toBe('email-input');
    expect(ids.description).toBe('email-description');
    expect(html).toContain('id="email-input"');
    expect(html).toContain('aria-describedby="email-description"');
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('id="email-description"');
  });
});

describe('a11y attributes — hydration adoption', () => {
  it('adopts server a11y markup without recreating or rewriting it', () => {
    const { container, hydrate } = prepare((page) =>
      page.button('Menu', { role: 'button', ariaExpanded: false, ariaLabel: 'Open menu' }),
    );
    const before = container.querySelector('button');
    expect(before).not.toBeNull();
    expect(before?.getAttribute('aria-expanded')).toBe('false');

    hydrate();

    const after = container.querySelector('button');
    // Same node identity — hydration adopted, did not rebuild.
    expect(after).toBe(before);
    expect(after?.getAttribute('role')).toBe('button');
    expect(after?.getAttribute('aria-label')).toBe('Open menu');
    expect(after?.getAttribute('aria-expanded')).toBe('false');
    expect(container.querySelectorAll('button').length).toBe(1);
  });

  it('server and client produce identical a11y ids (deterministic, no counters)', () => {
    const build = (page: PageDSL): void => {
      const ids = a11yIds('password');
      page.input({ id: ids.input, ariaDescribedBy: ids.error, ariaInvalid: true });
      page.text('Too short', { id: ids.error, role: 'alert' });
    };
    resetIdCounter();
    const serverApp = streetui.app({ name: 'a11y' });
    serverApp.page('home', (page) => build(page));
    const serverHtml = renderToString(compile(serverApp));

    resetIdCounter();
    const clientApp = streetui.app({ name: 'a11y' });
    clientApp.page('home', (page) => build(page));
    const clientHtml = renderToString(compile(clientApp));

    expect(serverHtml).toBe(clientHtml);
    expect(serverHtml).toContain('aria-describedby="password-error"');
  });
});
