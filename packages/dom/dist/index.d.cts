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
    isElement(node: Node): node is Element;
    isTextNode(node: Node): node is Text;
    parentNode(node: Node): Node | null;
    nextSibling(node: Node): Node | null;
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
    isElement(node: Node): node is Element;
    isTextNode(node: Node): node is Text;
    parentNode(node: Node): Node | null;
    nextSibling(node: Node): Node | null;
}
declare const browserDOMAdapter: BrowserDOMAdapter;

export { BrowserDOMAdapter, type DOMAdapter, browserDOMAdapter };
