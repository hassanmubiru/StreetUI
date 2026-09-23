import { describe, it, expect, beforeEach } from 'vitest';
import { BrowserDOMAdapter } from './browser-adapter.js';

describe('BrowserDOMAdapter', () => {
  let adapter: BrowserDOMAdapter;

  beforeEach(() => {
    adapter = new BrowserDOMAdapter();
  });

  it('createElement creates a DOM element', () => {
    const el = adapter.createElement('div');
    expect(el.tagName.toLowerCase()).toBe('div');
  });

  it('createTextNode creates a text node', () => {
    const t = adapter.createTextNode('hello');
    expect(adapter.isTextNode(t)).toBe(true);
    expect(t.textContent).toBe('hello');
  });

  it('createComment creates a comment node', () => {
    const c = adapter.createComment('marker');
    expect(c.nodeType).toBe(8); // COMMENT_NODE
    expect(c.textContent).toBe('marker');
  });

  it('createFragment creates a DocumentFragment', () => {
    const frag = adapter.createFragment();
    expect(frag.nodeType).toBe(11); // DOCUMENT_FRAGMENT_NODE
  });

  it('appendChild / removeChild', () => {
    const parent = adapter.createElement('div');
    const child = adapter.createElement('span');
    adapter.appendChild(parent, child);
    expect(parent.childNodes.length).toBe(1);
    adapter.removeChild(parent, child);
    expect(parent.childNodes.length).toBe(0);
  });

  it('insertBefore positions correctly', () => {
    const parent = adapter.createElement('div');
    const a = adapter.createElement('span');
    const b = adapter.createElement('span');
    adapter.appendChild(parent, b);
    adapter.insertBefore(parent, a, b);
    expect(parent.childNodes[0]).toBe(a);
    expect(parent.childNodes[1]).toBe(b);
  });

  it('replaceChild swaps nodes', () => {
    const parent = adapter.createElement('div');
    const old = adapter.createElement('span');
    const replacement = adapter.createElement('p');
    adapter.appendChild(parent, old);
    adapter.replaceChild(parent, replacement, old);
    expect(parent.childNodes[0]).toBe(replacement);
  });

  it('setAttribute / getAttribute / removeAttribute', () => {
    const el = adapter.createElement('button') as HTMLElement;
    adapter.setAttribute(el, 'aria-label', 'close');
    expect(adapter.getAttribute(el, 'aria-label')).toBe('close');
    adapter.removeAttribute(el, 'aria-label');
    expect(adapter.getAttribute(el, 'aria-label')).toBeNull();
  });

  it('setProperty sets a DOM property', () => {
    const input = adapter.createElement('input') as HTMLInputElement;
    adapter.setProperty(input, 'value', 'test-val');
    expect(input.value).toBe('test-val');
  });

  it('setTextContent / getTextContent', () => {
    const el = adapter.createElement('p');
    adapter.setTextContent(el, 'Hello');
    expect(adapter.getTextContent(el)).toBe('Hello');
  });

  it('addEventListener fires the handler', () => {
    const el = adapter.createElement('button');
    let fired = false;
    const handler: EventListener = () => { fired = true; };
    adapter.addEventListener(el, 'click', handler);
    el.dispatchEvent(new Event('click'));
    expect(fired).toBe(true);
    adapter.removeEventListener(el, 'click', handler);
  });

  it('removeEventListener prevents further calls', () => {
    const el = adapter.createElement('button');
    let count = 0;
    const handler: EventListener = () => { count++; };
    adapter.addEventListener(el, 'click', handler);
    adapter.removeEventListener(el, 'click', handler);
    el.dispatchEvent(new Event('click'));
    expect(count).toBe(0);
  });

  it('isElement / isTextNode', () => {
    const el = adapter.createElement('div');
    const t = adapter.createTextNode('x');
    expect(adapter.isElement(el)).toBe(true);
    expect(adapter.isElement(t)).toBe(false);
    expect(adapter.isTextNode(t)).toBe(true);
    expect(adapter.isTextNode(el)).toBe(false);
  });

  it('parentNode returns parent', () => {
    const parent = adapter.createElement('div');
    const child = adapter.createElement('span');
    adapter.appendChild(parent, child);
    expect(adapter.parentNode(child)).toBe(parent);
  });

  it('nextSibling returns correct node', () => {
    const parent = adapter.createElement('div');
    const a = adapter.createElement('span');
    const b = adapter.createElement('span');
    adapter.appendChild(parent, a);
    adapter.appendChild(parent, b);
    expect(adapter.nextSibling(a)).toBe(b);
  });
});
