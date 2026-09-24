/**
 * DOMAdapter — framework-owned abstraction over DOM operations.
 *
 * The renderer depends on this interface, never on raw browser globals,
 * which makes the renderer testable and portable.
 */
interface DOMAdapter {
    createElement(tag: string, ns?: string): Element;
    createTextNode(data: string): Text;
    createComment(data: string): Comment;
    createFragment(): DocumentFragment;
    appendChild(parent: Node, child: Node): void;
    insertBefore(parent: Node, child: Node, reference: Node | null): void;
    removeChild(parent: Node, child: Node): void;
    replaceChild(parent: Node, newChild: Node, oldChild: Node): void;
    setAttribute(element: Element, name: string, value: string): void;
    removeAttribute(element: Element, name: string): void;
    getAttribute(element: Element, name: string): string | null;
    setProperty(element: Element, name: string, value: unknown): void;
    setTextContent(node: Node, text: string): void;
    getTextContent(node: Node): string | null;
    addEventListener(target: EventTarget, type: string, handler: EventListener, options?: AddEventListenerOptions): void;
    removeEventListener(target: EventTarget, type: string, handler: EventListener, options?: EventListenerOptions): void;
    querySelector(root: Element | Document, selector: string): Element | null;
    querySelectorAll(root: Element | Document, selector: string): NodeListOf<Element>;
    getElementById(id: string): Element | null;
    /**
     * Move focus to an element. On the server (or when the element cannot receive
     * focus) this is a safe no-op, keeping focus management SSR-compatible.
     */
    focus(element: Element): void;
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

/**
 * Browser implementation of DOMAdapter — delegates directly to browser APIs.
 */

declare class BrowserDOMAdapter implements DOMAdapter {
    createElement(tag: string, ns?: string): Element;
    createTextNode(data: string): Text;
    createComment(data: string): Comment;
    createFragment(): DocumentFragment;
    appendChild(parent: Node, child: Node): void;
    insertBefore(parent: Node, child: Node, reference: Node | null): void;
    removeChild(parent: Node, child: Node): void;
    replaceChild(parent: Node, newChild: Node, oldChild: Node): void;
    setAttribute(element: Element, name: string, value: string): void;
    removeAttribute(element: Element, name: string): void;
    getAttribute(element: Element, name: string): string | null;
    setProperty(element: Element, name: string, value: unknown): void;
    setTextContent(node: Node, text: string): void;
    getTextContent(node: Node): string | null;
    addEventListener(target: EventTarget, type: string, handler: EventListener, options?: AddEventListenerOptions): void;
    removeEventListener(target: EventTarget, type: string, handler: EventListener, options?: EventListenerOptions): void;
    querySelector(root: Element | Document, selector: string): Element | null;
    querySelectorAll(root: Element | Document, selector: string): NodeListOf<Element>;
    getElementById(id: string): Element | null;
    focus(element: Element): void;
    isElement(node: Node): node is Element;
    isTextNode(node: Node): node is Text;
    tagName(element: Element): string;
    parentNode(node: Node): Node | null;
    nextSibling(node: Node): Node | null;
    firstChild(node: Node): Node | null;
    childNodes(node: Node): Node[];
}
declare const browserDOMAdapter: BrowserDOMAdapter;

/**
 * Server-side DOM node model.
 *
 * A tiny, dependency-free tree of plain objects that mirrors just enough of the
 * browser DOM for StreetUI's renderer to build a tree on the server and
 * serialize it to an HTML string. There is NO browser global here — these are
 * ordinary classes usable in any JavaScript environment (Node, workers, tests).
 *
 * The renderer never touches these types directly; it goes through the
 * `DOMAdapter` interface, and `ServerDOMAdapter` translates adapter calls into
 * operations on this model.
 */
type ServerNodeKind = 'element' | 'text' | 'comment' | 'fragment';
interface ServerNode {
    readonly kind: ServerNodeKind;
    parent: ServerParent | null;
}
type ServerParent = ServerElement | ServerFragment;
/** A minimal inline-style holder mirroring `element.style.setProperty`. */
declare class ServerStyle {
    readonly declarations: Map<string, string>;
    setProperty(name: string, value: string): void;
    get isEmpty(): boolean;
    toCss(): string;
}
declare class ServerText implements ServerNode {
    readonly kind: "text";
    parent: ServerParent | null;
    data: string;
    constructor(data: string);
}
declare class ServerComment implements ServerNode {
    readonly kind: "comment";
    parent: ServerParent | null;
    data: string;
    constructor(data: string);
}
declare class ServerFragment implements ServerNode {
    readonly kind: "fragment";
    parent: ServerParent | null;
    readonly children: ServerNode[];
}
declare class ServerElement implements ServerNode {
    readonly kind: "element";
    parent: ServerParent | null;
    readonly tagName: string;
    readonly attributes: Map<string, string>;
    /** JS properties set via `setProperty` (e.g. input `value`, `checked`). */
    readonly properties: Map<string, unknown>;
    readonly children: ServerNode[];
    readonly style: ServerStyle;
    constructor(tagName: string);
}
/** Escape text node content. */
declare function escapeHtmlText(value: string): string;
/** Escape a double-quoted attribute value. */
declare function escapeHtmlAttr(value: string): string;
/** Serialize a single server node (element/text/comment/fragment) to HTML. */
declare function serializeServerNode(node: ServerNode): string;
/** Serialize the children of an element or fragment (its "inner HTML"). */
declare function serializeChildren(node: ServerElement | ServerFragment): string;

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

declare class ServerDOMAdapter implements DOMAdapter {
    createElement(tag: string, _ns?: string): Element;
    createTextNode(data: string): Text;
    createComment(data: string): Comment;
    createFragment(): DocumentFragment;
    appendChild(parent: Node, child: Node): void;
    insertBefore(parent: Node, child: Node, reference: Node | null): void;
    removeChild(parent: Node, child: Node): void;
    replaceChild(parent: Node, newChild: Node, oldChild: Node): void;
    private _detach;
    setAttribute(element: Element, name: string, value: string): void;
    removeAttribute(element: Element, name: string): void;
    getAttribute(element: Element, name: string): string | null;
    setProperty(element: Element, name: string, value: unknown): void;
    setTextContent(node: Node, text: string): void;
    getTextContent(node: Node): string | null;
    addEventListener(): void;
    removeEventListener(): void;
    querySelector(): Element | null;
    querySelectorAll(): NodeListOf<Element>;
    getElementById(): Element | null;
    focus(): void;
    isElement(node: Node): node is Element;
    isTextNode(node: Node): node is Text;
    tagName(element: Element): string;
    parentNode(node: Node): Node | null;
    nextSibling(node: Node): Node | null;
    firstChild(node: Node): Node | null;
    childNodes(node: Node): Node[];
    /** Serialize a node's children ("inner HTML") to an HTML string. */
    serializeInner(node: Node): string;
    /** Serialize a node (including itself) to an HTML string. */
    serializeOuter(node: Node): string;
}
declare const serverDOMAdapter: ServerDOMAdapter;

/**
 * Focus helpers built on the {@link DOMAdapter} abstraction.
 *
 * These are the minimal, genuinely-useful focus operations an app needs:
 * focus a specific element (e.g. the first field when a route or modal opens)
 * or focus the first focusable element inside a container (e.g. move focus
 * into a dialog). Both go through the adapter, so they are no-ops on the server
 * (`ServerDOMAdapter.querySelector` returns null / `focus` does nothing) and
 * therefore safe to call from universal code.
 */

/** Default selector for natively focusable / tabbable elements. */
declare const FOCUSABLE_SELECTOR = "a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex=\"-1\"])";
/**
 * Focus the element with the given id, scoped to `root`.
 * Returns true if an element was found and focused.
 */
declare function focusById(dom: DOMAdapter, root: Element | Document, id: string): boolean;
/**
 * Focus the first focusable element inside `container`.
 * Returns true if a focusable element was found and focused.
 */
declare function focusFirst(dom: DOMAdapter, container: Element | Document, selector?: string): boolean;

export { BrowserDOMAdapter, type DOMAdapter, FOCUSABLE_SELECTOR, ServerComment, ServerDOMAdapter, ServerElement, ServerFragment, type ServerNode, type ServerNodeKind, type ServerParent, ServerStyle, ServerText, browserDOMAdapter, escapeHtmlAttr, escapeHtmlText, focusById, focusFirst, serializeChildren, serializeServerNode, serverDOMAdapter };
