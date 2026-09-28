/**
 * StreetUI event type catalogue.
 * Framework events are distinct from raw DOM events.
 */
type StreetEventType = 'click' | 'dblclick' | 'input' | 'change' | 'submit' | 'focus' | 'blur' | 'keydown' | 'keyup' | 'keypress' | 'mouseenter' | 'mouseleave' | 'mousemove' | 'mousedown' | 'mouseup' | 'pointerdown' | 'pointerup' | 'pointermove' | 'pointerenter' | 'pointerleave' | 'scroll' | 'resize' | 'mount' | 'unmount' | 'update';
interface StreetEvent<T = unknown> {
    readonly type: StreetEventType | string;
    readonly target: unknown;
    readonly data: T | undefined;
    readonly originalEvent: Event | undefined;
    readonly timestamp: number;
    defaultPrevented: boolean;
    stopPropagation(): void;
    preventDefault(): void;
}
declare function createStreetEvent<T = unknown>(type: StreetEventType | string, target: unknown, data?: T, originalEvent?: Event): StreetEvent<T>;
type EventHandler<T = unknown> = (event: StreetEvent<T>) => void;

/**
 * Framework-internal event bus.
 * Decouples emitters from handlers across subsystems.
 */

declare class EventBus {
    private readonly _handlers;
    on<T = unknown>(type: string, handler: EventHandler<T>): () => void;
    off<T = unknown>(type: string, handler: EventHandler<T>): void;
    once<T = unknown>(type: string, handler: EventHandler<T>): () => void;
    emit<T = unknown>(event: StreetEvent<T>): void;
    clear(type?: string): void;
    listenerCount(type: string): number;
}
declare const globalEventBus: EventBus;

/**
 * DOM ↔ StreetUI event bridge.
 *
 * Attaches native DOM event listeners and translates them into
 * StreetUI events dispatched to registered handlers.
 * The renderer uses this to wire events without coupling
 * DOM event mechanics into the render pipeline directly.
 */

interface DomBinding {
    remove(): void;
}
/**
 * Attach a DOM event listener that fires the given StreetUI handler.
 * Returns a binding whose `remove()` detaches the listener.
 */
declare function bindDomEvent<T extends Event = Event>(element: EventTarget, domEventType: StreetEventType | string, handler: EventHandler, options?: AddEventListenerOptions): DomBinding;
/**
 * A registry that tracks all DOM bindings for a single node,
 * making bulk teardown easy.
 */
declare class DomEventRegistry {
    private readonly _bindings;
    bind(element: EventTarget, type: StreetEventType | string, handler: EventHandler, options?: AddEventListenerOptions): void;
    removeAll(): void;
    get count(): number;
}

export { type DomBinding, DomEventRegistry, EventBus, type EventHandler, type StreetEvent, type StreetEventType, bindDomEvent, createStreetEvent, globalEventBus };
