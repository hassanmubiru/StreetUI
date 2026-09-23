import { describe, it, expect, beforeEach } from 'vitest';
import { BrowserDOMAdapter } from './browser-adapter.js';
import { ServerDOMAdapter } from './server-adapter.js';
import { focusById, focusFirst, FOCUSABLE_SELECTOR } from './focus.js';

describe('focus helpers (browser)', () => {
  let dom: BrowserDOMAdapter;
  let root: HTMLElement;

  beforeEach(() => {
    dom = new BrowserDOMAdapter();
    document.body.innerHTML = '';
    root = document.createElement('div');
    document.body.appendChild(root);
  });

  it('focusById focuses the matching element and returns true', () => {
    root.innerHTML = '<input id="email-input"><input id="pw-input">';
    const ok = focusById(dom, root, 'email-input');
    expect(ok).toBe(true);
    expect(document.activeElement).toBe(root.querySelector('#email-input'));
  });

  it('focusById returns false when nothing matches', () => {
    root.innerHTML = '<input id="email-input">';
    expect(focusById(dom, root, 'missing')).toBe(false);
  });

  it('focusFirst focuses the first focusable element', () => {
    root.innerHTML = '<div>text</div><button id="b">go</button><input id="i">';
    const ok = focusFirst(dom, root);
    expect(ok).toBe(true);
    expect(document.activeElement).toBe(root.querySelector('#b'));
  });

  it('focusFirst skips disabled controls via the default selector', () => {
    root.innerHTML = '<button disabled>x</button><input id="i">';
    focusFirst(dom, root);
    expect(document.activeElement).toBe(root.querySelector('#i'));
    expect(FOCUSABLE_SELECTOR).toContain(':not([disabled])');
  });
});

describe('focus helpers (server) — SSR-safe no-ops', () => {
  it('return false and never throw on the server adapter', () => {
    const dom = new ServerDOMAdapter();
    const el = dom.createElement('div');
    expect(() => dom.focus(el)).not.toThrow();
    expect(focusById(dom, el, 'anything')).toBe(false);
    expect(focusFirst(dom, el)).toBe(false);
  });
});
