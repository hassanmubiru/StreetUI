import { C as CompiledApplication } from './compile-CEom4hkp.js';

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
 * SSR state transfer (dehydration) — move server-resolved data to the client.
 *
 * When the server resolves resources before rendering, their data must reach
 * the client so hydration can seed them (via `resource({ initialData })`)
 * instead of refetching. StreetUI does this with a single, framework-scoped
 * `<script>` payload rather than blindly interpolating `JSON.stringify` into
 * markup.
 *
 * Safety (v0.4 rule #16): the JSON is emitted into a
 * `<script type="application/json">` block — an inert data island the browser
 * never executes — and every character that could terminate that block or be
 * reinterpreted by the HTML/JS parser is escaped to its `\uXXXX` form. Because
 * `<` inside JSON parses back to `<`, the payload round-trips exactly
 * while being impossible to break out of. This is deterministic (stable key
 * order is the caller's responsibility) and typed at the boundary as
 * `Record<string, unknown>` — never `any`.
 */

/** Attribute marking StreetUI's state island so the client can find it. */
declare const STATE_MARKER_ATTR = "data-streetui-state";
/**
 * Serialize a state map to an HTML `<script>` island for inclusion in the
 * server-rendered document (typically just before the closing tag of the
 * mount container). Returns an empty string for an empty map.
 */
declare function serializeState(state: Record<string, unknown>): string;
/**
 * Read the state island back on the client. Searches `root` for StreetUI's
 * state `<script>` and parses it. Returns an empty object when absent or
 * unparseable (hydration then proceeds as a cold client render). Routed through
 * the DOM adapter so it is testable and never assumes a global `document`.
 */
declare function readState(dom: DOMAdapter, root: Element | Document): Record<string, unknown>;

/**
 * Server-side rendering — `renderToString`.
 *
 * Runs the *exact same* mount pipeline used in the browser (`mountGraph`), but
 * against a `ServerDOMAdapter` that builds a lightweight in-memory node tree
 * instead of a real browser DOM. The tree is then serialized to a normal HTML
 * string. Because both browser and server share the DSL → Compiler → Graph →
 * Runtime → Renderer pipeline, there is no second, SSR-specific renderer and no
 * virtual DOM.
 *
 * Lifecycle (v0.4 rule #20): the initial synchronous mount may open signal
 * subscriptions (via `wireSignalBindings`/`wireReactiveList`). On the server
 * those would be live forever, so once the HTML is serialized we dispose the
 * root instance — tearing down every subscription and listener. SSR therefore
 * has a *render* lifecycle only; the live *runtime* lifecycle is established
 * later on the client by `hydrate`.
 */

interface RenderToStringOptions {
    /**
     * Override the server DOM adapter (rarely needed). Defaults to a fresh
     * `ServerDOMAdapter` per call so concurrent renders never share state.
     */
    readonly domAdapter?: ServerDOMAdapter;
}
/**
 * Render a compiled StreetUI application to an HTML string.
 *
 * The returned markup contains only the application's own elements (the
 * synthetic container is not emitted), so callers embed it wherever they mount
 * on the client — e.g. inside `<div id="app">…</div>`.
 */
declare function renderToString(compiled: CompiledApplication, options?: RenderToStringOptions): string;

export { type DOMAdapter as D, type RenderToStringOptions as R, STATE_MARKER_ATTR as S, ServerDOMAdapter as a, renderToString as b, serverDOMAdapter as c, readState as r, serializeState as s };
