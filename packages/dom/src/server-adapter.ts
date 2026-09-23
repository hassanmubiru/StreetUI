/**
 * Server implementation of `DOMAdapter`.
 *
 * Builds a lightweight in-memory tree (see `server-node.ts`) instead of touching
 * a real browser DOM, then lets the caller serialize it to an HTML string. It is
 * completely free of browser globals, so the exact same renderer that runs in
 * the browser can produce HTML on the server.
 *
 * The `DOMAdapter` interface is typed against the lib DOM types (`Element`,
 * `Node`, `Text`, …). Our server nodes structurally stand in for those at
 * runtime, so the boundary uses `as unknown as` casts in one place. Everything
 * inside operates on the real server-node model.
 */

import type { DOMAdapter } from './adapter.js';
import {
  ServerElement,
  ServerText,
  ServerComment,
  ServerFragment,
  serializeChildren,
  serializeServerNode,
  type ServerNode,
  type ServerParent,
} from './server-node.js';

function asServer(node: unknown): ServerNode {
  return node as unknown as ServerNode;
}
function asParent(node: unknown): ServerParent {
  return node as unknown as ServerParent;
}

export class ServerDOMAdapter implements DOMAdapter {
  createElement(tag: string, _ns?: string): Element {
    return new ServerElement(tag) as unknown as Element;
  }

  createTextNode(data: string): Text {
    return new ServerText(data) as unknown as Text;
  }

  createComment(data: string): Comment {
    return new ServerComment(data) as unknown as Comment;
  }

  createFragment(): DocumentFragment {
    return new ServerFragment() as unknown as DocumentFragment;
  }

  appendChild(parent: Node, child: Node): void {
    const p = asParent(parent);
    const c = asServer(child);
    this._detach(c);
    c.parent = p;
    p.children.push(c);
  }

  insertBefore(parent: Node, child: Node, reference: Node | null): void {
    const p = asParent(parent);
    const c = asServer(child);
    this._detach(c);
    c.parent = p;
    if (reference === null) {
      p.children.push(c);
      return;
    }
    const ref = asServer(reference);
    const idx = p.children.indexOf(ref);
    if (idx === -1) p.children.push(c);
    else p.children.splice(idx, 0, c);
  }

  removeChild(parent: Node, child: Node): void {
    const p = asParent(parent);
    const c = asServer(child);
    const idx = p.children.indexOf(c);
    if (idx !== -1) {
      p.children.splice(idx, 1);
      c.parent = null;
    }
  }

  replaceChild(parent: Node, newChild: Node, oldChild: Node): void {
    const p = asParent(parent);
    const nc = asServer(newChild);
    const oc = asServer(oldChild);
    const idx = p.children.indexOf(oc);
    if (idx === -1) return;
    this._detach(nc);
    nc.parent = p;
    p.children.splice(idx, 1, nc);
    oc.parent = null;
  }

  private _detach(node: ServerNode): void {
    if (node.parent !== null) {
      const siblings = node.parent.children;
      const idx = siblings.indexOf(node);
      if (idx !== -1) siblings.splice(idx, 1);
      node.parent = null;
    }
  }

  setAttribute(element: Element, name: string, value: string): void {
    (element as unknown as ServerElement).attributes.set(name, value);
  }

  removeAttribute(element: Element, name: string): void {
    (element as unknown as ServerElement).attributes.delete(name);
  }

  getAttribute(element: Element, name: string): string | null {
    return (element as unknown as ServerElement).attributes.get(name) ?? null;
  }

  setProperty(element: Element, name: string, value: unknown): void {
    (element as unknown as ServerElement).properties.set(name, value);
  }

  setTextContent(node: Node, text: string): void {
    const n = asServer(node);
    if (n.kind === 'element' || n.kind === 'fragment') {
      const el = n as ServerElement | ServerFragment;
      el.children.length = 0;
      const t = new ServerText(text);
      t.parent = el;
      el.children.push(t);
    } else if (n.kind === 'text') {
      (n as ServerText).data = text;
    }
  }

  getTextContent(node: Node): string | null {
    const n = asServer(node);
    if (n.kind === 'text') return (n as ServerText).data;
    if (n.kind === 'element' || n.kind === 'fragment') {
      let out = '';
      for (const c of (n as ServerElement | ServerFragment).children) {
        out += this.getTextContent(c as unknown as Node) ?? '';
      }
      return out;
    }
    return null;
  }

  // Server nodes never dispatch events — listeners are a no-op on the server.
  addEventListener(): void {
    /* no-op on the server */
  }
  removeEventListener(): void {
    /* no-op on the server */
  }

  querySelector(): Element | null {
    return null;
  }
  querySelectorAll(): NodeListOf<Element> {
    return [] as unknown as NodeListOf<Element>;
  }
  getElementById(): Element | null {
    return null;
  }

  isElement(node: Node): node is Element {
    return asServer(node).kind === 'element';
  }

  isTextNode(node: Node): node is Text {
    return asServer(node).kind === 'text';
  }

  tagName(element: Element): string {
    return (element as unknown as ServerElement).tagName;
  }

  parentNode(node: Node): Node | null {
    return (asServer(node).parent as unknown as Node | null) ?? null;
  }

  nextSibling(node: Node): Node | null {
    const n = asServer(node);
    const parent = n.parent;
    if (parent === null) return null;
    const idx = parent.children.indexOf(n);
    if (idx === -1 || idx + 1 >= parent.children.length) return null;
    return parent.children[idx + 1] as unknown as Node;
  }

  firstChild(node: Node): Node | null {
    const n = asServer(node);
    if (n.kind === 'element' || n.kind === 'fragment') {
      const el = n as ServerElement | ServerFragment;
      return (el.children[0] as unknown as Node) ?? null;
    }
    return null;
  }

  childNodes(node: Node): Node[] {
    const n = asServer(node);
    if (n.kind === 'element' || n.kind === 'fragment') {
      return (n as ServerElement | ServerFragment).children as unknown as Node[];
    }
    return [];
  }

  // ── Server-only ────────────────────────────────────────────────────────────

  /** Serialize a node's children ("inner HTML") to an HTML string. */
  serializeInner(node: Node): string {
    const n = asServer(node);
    if (n.kind === 'element' || n.kind === 'fragment') {
      return serializeChildren(n as ServerElement | ServerFragment);
    }
    return '';
  }

  /** Serialize a node (including itself) to an HTML string. */
  serializeOuter(node: Node): string {
    return serializeServerNode(asServer(node));
  }
}

export const serverDOMAdapter = new ServerDOMAdapter();
