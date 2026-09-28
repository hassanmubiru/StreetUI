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
    /**
     * Optional, server-only: create a verbatim pre-serialized HTML node used by
     * the v1.7 static SSR plan. The browser adapter does not implement it; the
     * renderer only calls it when a static SSR plan is active (i.e. during SSR),
     * so client builds never reach this path and it stays tree-shakeable.
     */
    createRawHTML?(html: string): Node;
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
    /**
     * The document body — the default mount target for portals/overlays. Returns
     * null on the server (no document), which is what makes portal SSR degrade to
     * inline rendering and focus management degrade to a no-op.
     */
    body(): Element | null;
    /**
     * The document head — the mount target for `head()` metadata (title/meta/
     * link/etc.). Returns null on the server (no document), which is what makes
     * the head platform degrade to server-side string emission (`renderHead`) and
     * the browser `wireHeadBehavior` a no-op on the server render pass.
     */
    head(): Element | null;
    /** The currently focused element, or null on the server / when none is focused. */
    activeElement(): Element | null;
    /** True if `ancestor` contains `node` (inclusive). Always false on the server. */
    contains(ancestor: Element, node: Node): boolean;
    /** True if `element` matches the given CSS selector. Always false on the server. */
    matches(element: Element, selector: string): boolean;
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
    body(): Element | null;
    head(): Element | null;
    activeElement(): Element | null;
    contains(ancestor: Element, node: Node): boolean;
    matches(element: Element, selector: string): boolean;
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
type ServerNodeKind = 'element' | 'text' | 'comment' | 'fragment' | 'raw';
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
/**
 * A pre-serialized, verbatim HTML fragment (v1.7 static SSR plan).
 *
 * Emitted for provably-static subtrees whose HTML the compiler-derived static
 * SSR plan already computed once. Serializing this node copies its stored
 * string directly — it allocates no ServerElement/ServerText, no attribute Map
 * and no children array for the collapsed subtree. The stored `html` is
 * produced by the exact same mount + serialize pipeline as the runtime path, so
 * the output is byte-identical (the v1.7 byte-identity gate proves this).
 *
 * This node is SSR-only: it is created solely via `ServerDOMAdapter.createRawHTML`
 * on the server render path and never appears in a browser build.
 */
declare class ServerRawHTML implements ServerNode {
    readonly kind: "raw";
    parent: ServerParent | null;
    readonly html: string;
    constructor(html: string);
}
declare class ServerElement implements ServerNode {
    readonly kind: "element";
    parent: ServerParent | null;
    readonly tagName: string;
    readonly attributes: Map<string, string>;
    readonly children: ServerNode[];
    _properties: Map<string, unknown> | null;
    _style: ServerStyle | null;
    constructor(tagName: string);
    /** JS properties set via `setProperty` (e.g. input `value`, `checked`). Allocated on first access. */
    get properties(): Map<string, unknown>;
    /** Inline-style holder mirroring `element.style`. Allocated on first access. */
    get style(): ServerStyle;
}
/** Escape text node content. */
declare function escapeHtmlText(value: string): string;
/** Escape a double-quoted attribute value. */
declare function escapeHtmlAttr(value: string): string;
/** Serialize a single server node (element/text/comment/fragment/raw) to HTML. */
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
    /**
     * Create a verbatim pre-serialized HTML node (v1.7 static SSR plan, §6).
     * Server-only: the browser adapter does not implement this, and the renderer
     * fast path only invokes it when a static SSR plan is present (SSR). The
     * stored HTML was produced by this same serializer, so it is emitted as-is.
     */
    createRawHTML(html: string): Node;
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
    body(): Element | null;
    head(): Element | null;
    activeElement(): Element | null;
    contains(_ancestor: Element, _node: Node): boolean;
    matches(_element: Element, _selector: string): boolean;
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
/**
 * Ordered list of focusable/tabbable descendants of `container`.
 * Re-checks each candidate against the selector so elements disabled after the
 * initial query (e.g. a button toggled to `disabled`) are excluded.
 */
declare function getFocusable(dom: DOMAdapter, container: Element, selector?: string): Element[];
/**
 * Capture the currently-focused element so it can be restored later (e.g. when
 * a dialog closes). Returns null on the server or when nothing is focused.
 */
declare function saveFocus(dom: DOMAdapter): Element | null;
/** Restore focus to a previously {@link saveFocus}-d element. No-op if null. */
declare function restoreFocus(dom: DOMAdapter, saved: Element | null): void;
/**
 * Move focus into `container` on open: the element with id `initialFocusId` if
 * given and present, otherwise the first focusable element. Server-safe no-op.
 */
declare function focusInitial(dom: DOMAdapter, container: Element, initialFocusId?: string): void;
/**
 * Trap Tab / Shift+Tab focus within `container` (wrap-around at both ends).
 * Attaches a keydown listener to the container and returns a cleanup function
 * that detaches it. Server-safe: `addEventListener` is a no-op, and the returned
 * cleanup is still callable.
 */
declare function trapFocus(dom: DOMAdapter, container: Element): () => void;
declare function containFocus(dom: DOMAdapter, container: Element): () => void;
/**
 * Invoke `handler` when Escape is pressed while focus is within `target`.
 * Returns a cleanup function. Server-safe no-op.
 */
declare function onEscape(dom: DOMAdapter, target: Element, handler: () => void): () => void;
/**
 * Roving-focus keyboard navigation for a menu (role="menu") container: the
 * arrow keys move focus between the container's focusable items (wrap-around at
 * both ends), Home/End jump to the first/last item, and Enter/Space activate
 * the currently-focused item (a native `click`, so an item's `onClick` fires).
 * `Tab` and `Escape` are deliberately left alone — the overlay layer wires
 * Escape-to-close separately and a menu does not trap Tab.
 *
 * Items are re-queried on every key (via {@link getFocusable}) so a menu whose
 * items change reactively is always navigated against the live set, and items
 * disabled after mount are skipped. Attaches a keydown listener to the
 * container and returns a cleanup function. Server-safe: `addEventListener` is
 * a no-op and the returned cleanup is still callable.
 */
declare function rovingMenu(dom: DOMAdapter, container: Element, selector?: string): () => void;

/**
 * ARIA live-region announcer (§15).
 *
 * Screen readers announce text that appears inside an `aria-live` region. The
 * naive approach — append a fresh `<div aria-live>` per message — leaks a
 * growing pile of stale nodes and (because a node inserted *already carrying*
 * its text is often not re-announced) is unreliable. This announcer instead
 * keeps exactly TWO persistent regions on `<body>` — one `polite`, one
 * `assertive` — and mutates their text to speak. Announcing clears the region
 * first and writes on a microtask so that repeating the same string still
 * triggers a DOM mutation the AT will pick up.
 *
 * Built entirely on the {@link DOMAdapter}, so it is server-safe: when
 * `dom.body()` is null (SSR / headless) construction returns an inert announcer
 * whose `announce`/`clear`/`destroy` are no-ops. There is never any SSR markup
 * for a live region — announcements are a runtime-only concept.
 */

interface Announcer {
    /**
     * Announce `message`. `assertive` (default false) routes to the assertive
     * region (interrupts the user) instead of the polite one (waits for a pause).
     */
    announce(message: string, options?: {
        assertive?: boolean;
    }): void;
    /** Clear both regions without announcing anything. */
    clear(): void;
    /** Remove both regions from the DOM. Idempotent. */
    destroy(): void;
}
/**
 * Create a live-region announcer bound to `dom`. Idempotent per call — each
 * call owns its own pair of regions, so an app that wants a single shared
 * announcer should create one and reuse it (and `destroy()` it on teardown).
 */
declare function createAnnouncer(dom: DOMAdapter): Announcer;

export { type Announcer, BrowserDOMAdapter, type DOMAdapter, FOCUSABLE_SELECTOR, ServerComment, ServerDOMAdapter, ServerElement, ServerFragment, type ServerNode, type ServerNodeKind, type ServerParent, ServerRawHTML, ServerStyle, ServerText, browserDOMAdapter, containFocus, createAnnouncer, escapeHtmlAttr, escapeHtmlText, focusById, focusFirst, focusInitial, getFocusable, onEscape, restoreFocus, rovingMenu, saveFocus, serializeChildren, serializeServerNode, serverDOMAdapter, trapFocus };
