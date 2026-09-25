/**
 * Browser implementation of DOMAdapter — delegates directly to browser APIs.
 */

import type { DOMAdapter } from './adapter.js';

export class BrowserDOMAdapter implements DOMAdapter {
  createElement(tag: string, ns?: string): Element {
    if (ns !== undefined) {
      return document.createElementNS(ns, tag);
    }
    return document.createElement(tag);
  }

  createTextNode(data: string): Text {
    return document.createTextNode(data);
  }

  createComment(data: string): Comment {
    return document.createComment(data);
  }

  createFragment(): DocumentFragment {
    return document.createDocumentFragment();
  }

  appendChild(parent: Node, child: Node): void {
    parent.appendChild(child);
  }

  insertBefore(parent: Node, child: Node, reference: Node | null): void {
    parent.insertBefore(child, reference);
  }

  removeChild(parent: Node, child: Node): void {
    parent.removeChild(child);
  }

  replaceChild(parent: Node, newChild: Node, oldChild: Node): void {
    parent.replaceChild(newChild, oldChild);
  }

  setAttribute(element: Element, name: string, value: string): void {
    element.setAttribute(name, value);
  }

  removeAttribute(element: Element, name: string): void {
    element.removeAttribute(name);
  }

  getAttribute(element: Element, name: string): string | null {
    return element.getAttribute(name);
  }

  setProperty(element: Element, name: string, value: unknown): void {
    (element as unknown as Record<string, unknown>)[name] = value;
  }

  setTextContent(node: Node, text: string): void {
    node.textContent = text;
  }

  getTextContent(node: Node): string | null {
    return node.textContent;
  }

  addEventListener(
    target: EventTarget,
    type: string,
    handler: EventListener,
    options?: AddEventListenerOptions,
  ): void {
    target.addEventListener(type, handler, options);
  }

  removeEventListener(
    target: EventTarget,
    type: string,
    handler: EventListener,
    options?: EventListenerOptions,
  ): void {
    target.removeEventListener(type, handler, options);
  }

  querySelector(root: Element | Document, selector: string): Element | null {
    return root.querySelector(selector);
  }

  querySelectorAll(root: Element | Document, selector: string): NodeListOf<Element> {
    return root.querySelectorAll(selector);
  }

  getElementById(id: string): Element | null {
    return document.getElementById(id);
  }

  focus(element: Element): void {
    (element as unknown as { focus?: () => void }).focus?.();
  }

  isElement(node: Node): node is Element {
    return node.nodeType === Node.ELEMENT_NODE;
  }

  isTextNode(node: Node): node is Text {
    return node.nodeType === Node.TEXT_NODE;
  }

  tagName(element: Element): string {
    return element.tagName.toLowerCase();
  }

  parentNode(node: Node): Node | null {
    return node.parentNode;
  }

  nextSibling(node: Node): Node | null {
    return node.nextSibling;
  }

  firstChild(node: Node): Node | null {
    return node.firstChild;
  }

  childNodes(node: Node): Node[] {
    return Array.from(node.childNodes);
  }
}

// `/* @__PURE__ */`: convenience singleton, unreferenced by internal runtime
// paths. Marking construction pure lets bundlers drop it when unused instead of
// retaining it (and the BrowserDOMAdapter class) as an import-time side effect.
export const browserDOMAdapter = /* @__PURE__ */ new BrowserDOMAdapter();
