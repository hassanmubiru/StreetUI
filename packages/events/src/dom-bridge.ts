/**
 * DOM ↔ StreetUI event bridge.
 *
 * Attaches native DOM event listeners and translates them into
 * StreetUI events dispatched to registered handlers.
 * The renderer uses this to wire events without coupling
 * DOM event mechanics into the render pipeline directly.
 */

import { createStreetEvent, type EventHandler, type StreetEventType } from './event-types.js';

export interface DomBinding {
  remove(): void;
}

/**
 * Attach a DOM event listener that fires the given StreetUI handler.
 * Returns a binding whose `remove()` detaches the listener.
 */
export function bindDomEvent<T extends Event = Event>(
  element: EventTarget,
  domEventType: StreetEventType | string,
  handler: EventHandler,
  options?: AddEventListenerOptions,
): DomBinding {
  const listener = (e: T) => {
    const streetEvent = createStreetEvent(domEventType, element, undefined, e as unknown as Event);
    handler(streetEvent);
  };

  element.addEventListener(domEventType, listener as EventListener, options);

  return {
    remove() {
      element.removeEventListener(domEventType, listener as EventListener, options);
    },
  };
}

/**
 * A registry that tracks all DOM bindings for a single node,
 * making bulk teardown easy.
 */
export class DomEventRegistry {
  private readonly _bindings: DomBinding[] = [];

  bind(
    element: EventTarget,
    type: StreetEventType | string,
    handler: EventHandler,
    options?: AddEventListenerOptions,
  ): void {
    this._bindings.push(bindDomEvent(element, type, handler, options));
  }

  removeAll(): void {
    for (const b of this._bindings) {
      b.remove();
    }
    this._bindings.length = 0;
  }

  get count(): number {
    return this._bindings.length;
  }
}
