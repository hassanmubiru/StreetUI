/**
 * DOMAdapter — framework-owned abstraction over DOM operations.
 *
 * The renderer depends on this interface, never on raw browser globals,
 * which makes the renderer testable and portable.
 */

export interface DOMAdapter {
  // ── Creation ───────────────────────────────────────────────────────────────
  createElement(tag: string, ns?: string): Element;
  createTextNode(data: string): Text;
  createComment(data: string): Comment;
  createFragment(): DocumentFragment;

  // ── Tree mutations ─────────────────────────────────────────────────────────
  appendChild(parent: Node, child: Node): void;
  insertBefore(parent: Node, child: Node, reference: Node | null): void;
  removeChild(parent: Node, child: Node): void;
  replaceChild(parent: Node, newChild: Node, oldChild: Node): void;

  // ── Attribute / property ───────────────────────────────────────────────────
  setAttribute(element: Element, name: string, value: string): void;
  removeAttribute(element: Element, name: string): void;
  getAttribute(element: Element, name: string): string | null;
  setProperty(element: Element, name: string, value: unknown): void;

  // ── Text content ───────────────────────────────────────────────────────────
  setTextContent(node: Node, text: string): void;
  getTextContent(node: Node): string | null;

  // ── Events ─────────────────────────────────────────────────────────────────
  addEventListener(
    target: EventTarget,
    type: string,
    handler: EventListener,
    options?: AddEventListenerOptions,
  ): void;
  removeEventListener(
    target: EventTarget,
    type: string,
    handler: EventListener,
    options?: EventListenerOptions,
  ): void;

  // ── Query ──────────────────────────────────────────────────────────────────
  querySelector(root: Element | Document, selector: string): Element | null;
  querySelectorAll(root: Element | Document, selector: string): NodeListOf<Element>;
  getElementById(id: string): Element | null;

  // ── Focus ────────────────────────────────────────────────────────────────────
  /**
   * Move focus to an element. On the server (or when the element cannot receive
   * focus) this is a safe no-op, keeping focus management SSR-compatible.
   */
  focus(element: Element): void;

  // ── Helpers ────────────────────────────────────────────────────────────────
  isElement(node: Node): node is Element;
  isTextNode(node: Node): node is Text;
  /** Lower-cased tag name of an element (e.g. "div", "h1"). */
  tagName(element: Element): string;
  parentNode(node: Node): Node | null;
  nextSibling(node: Node): Node | null;
  /** First child node (element, text, or otherwise), or null. */
  firstChild(node: Node): Node | null;
  /** All child nodes of an element in order (empty for leaf/text nodes). */
  childNodes(node: Node): Node[];
}
