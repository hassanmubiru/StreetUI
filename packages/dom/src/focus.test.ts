import { describe, it, expect, beforeEach } from 'vitest';
import { BrowserDOMAdapter } from './browser-adapter.js';
import { ServerDOMAdapter } from './server-adapter.js';
import type { DOMAdapter } from './adapter.js';
import {
  focusById, focusFirst, FOCUSABLE_SELECTOR,
  getFocusable, saveFocus, restoreFocus, focusInitial, trapFocus, containFocus, onEscape,
} from './focus.js';

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
    const dom: DOMAdapter = new ServerDOMAdapter();
    const el = dom.createElement('div');
    expect(() => dom.focus(el)).not.toThrow();
    expect(focusById(dom, el, 'anything')).toBe(false);
    expect(focusFirst(dom, el)).toBe(false);
  });

  it('v1.9 focus platform is a safe no-op on the server', () => {
    const dom: DOMAdapter = new ServerDOMAdapter();
    const el = dom.createElement('div');
    expect(saveFocus(dom)).toBe(null);
    expect(() => restoreFocus(dom, null)).not.toThrow();
    expect(getFocusable(dom, el)).toEqual([]);
    expect(() => focusInitial(dom, el, 'x')).not.toThrow();
    // trap/contain/escape return callable cleanups even with no DOM
    expect(() => trapFocus(dom, el)()).not.toThrow();
    expect(() => containFocus(dom, el)()).not.toThrow();
    expect(() => onEscape(dom, el, () => {})()).not.toThrow();
  });
});

function keydown(target: Element, key: string, opts: { shiftKey?: boolean } = {}): KeyboardEvent {
  const ev = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...opts });
  target.dispatchEvent(ev);
  return ev;
}

describe('v1.9 focus platform (browser)', () => {
  let dom: BrowserDOMAdapter;
  let container: HTMLElement;

  beforeEach(() => {
    dom = new BrowserDOMAdapter();
    document.body.innerHTML = '';
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('getFocusable returns focusable descendants in order, skipping disabled', () => {
    container.innerHTML = '<button id="a">a</button><button disabled>x</button><input id="c">';
    const ids = getFocusable(dom, container).map((el) => el.id);
    expect(ids).toEqual(['a', 'c']);
  });

  it('saveFocus/restoreFocus round-trips the active element', () => {
    container.innerHTML = '<button id="a">a</button><button id="b">b</button>';
    const a = container.querySelector<HTMLElement>('#a')!;
    const b = container.querySelector<HTMLElement>('#b')!;
    a.focus();
    const saved = saveFocus(dom);
    b.focus();
    expect(document.activeElement).toBe(b);
    restoreFocus(dom, saved);
    expect(document.activeElement).toBe(a);
    expect(() => restoreFocus(dom, null)).not.toThrow();
  });

  it('focusInitial prefers the given id, else the first focusable', () => {
    container.innerHTML = '<button id="a">a</button><input id="target">';
    focusInitial(dom, container, 'target');
    expect(document.activeElement).toBe(container.querySelector('#target'));
    focusInitial(dom, container);
    expect(document.activeElement).toBe(container.querySelector('#a'));
  });

  it('trapFocus wraps Tab from last to first and Shift+Tab from first to last', () => {
    container.innerHTML = '<button id="a">a</button><button id="b">b</button><button id="c">c</button>';
    const a = container.querySelector<HTMLElement>('#a')!;
    const c = container.querySelector<HTMLElement>('#c')!;
    const cleanup = trapFocus(dom, container);

    c.focus();
    const e1 = keydown(container, 'Tab');
    expect(e1.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(a);

    a.focus();
    const e2 = keydown(container, 'Tab', { shiftKey: true });
    expect(e2.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(c);

    cleanup();
    c.focus();
    const e3 = keydown(container, 'Tab');
    expect(e3.defaultPrevented).toBe(false); // listener detached
  });

  it('trapFocus with no focusable elements just prevents default', () => {
    container.innerHTML = '<div>no focusables</div>';
    trapFocus(dom, container);
    const e = keydown(container, 'Tab');
    expect(e.defaultPrevented).toBe(true);
  });

  it('containFocus redirects an outside focus back into the container', () => {
    container.innerHTML = '<button id="inside">in</button>';
    const outside = document.createElement('button');
    outside.id = 'outside';
    document.body.appendChild(outside);
    const cleanup = containFocus(dom, container);

    outside.focus(); // fires focusin, bubbles to body
    expect(document.activeElement).toBe(container.querySelector('#inside'));

    cleanup();
    outside.focus();
    expect(document.activeElement).toBe(outside); // no longer redirected
  });

  it('onEscape invokes the handler only on Escape and detaches on cleanup', () => {
    let count = 0;
    const cleanup = onEscape(dom, container, () => { count++; });
    keydown(container, 'Enter');
    expect(count).toBe(0);
    keydown(container, 'Escape');
    expect(count).toBe(1);
    cleanup();
    keydown(container, 'Escape');
    expect(count).toBe(1);
  });
});

describe('DOMAdapter environment methods', () => {
  it('browser adapter reports body/activeElement/contains/matches', () => {
    const dom = new BrowserDOMAdapter();
    document.body.innerHTML = '';
    const box = document.createElement('div');
    box.className = 'box';
    const btn = document.createElement('button');
    box.appendChild(btn);
    document.body.appendChild(box);
    expect(dom.body()).toBe(document.body);
    btn.focus();
    expect(dom.activeElement()).toBe(btn);
    expect(dom.contains(box, btn)).toBe(true);
    expect(dom.contains(btn, box)).toBe(false);
    expect(dom.matches(box, '.box')).toBe(true);
    expect(dom.matches(box, '.nope')).toBe(false);
  });

  it('server adapter degrades environment methods to null/false', () => {
    const dom = new ServerDOMAdapter();
    const el = dom.createElement('div');
    const child = dom.createElement('span');
    expect(dom.body()).toBe(null);
    expect(dom.activeElement()).toBe(null);
    expect(dom.contains(el, child)).toBe(false);
    expect(dom.matches(el, 'div')).toBe(false);
  });
});
