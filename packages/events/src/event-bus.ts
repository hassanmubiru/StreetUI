/**
 * Framework-internal event bus.
 * Decouples emitters from handlers across subsystems.
 */

import type { StreetEvent, EventHandler } from './event-types.js';

export class EventBus {
  private readonly _handlers: Map<string, Set<EventHandler>> = new Map();

  on<T = unknown>(type: string, handler: EventHandler<T>): () => void {
    let set = this._handlers.get(type);
    if (set === undefined) {
      set = new Set();
      this._handlers.set(type, set);
    }
    set.add(handler as EventHandler);
    return () => this.off(type, handler as EventHandler);
  }

  off<T = unknown>(type: string, handler: EventHandler<T>): void {
    this._handlers.get(type)?.delete(handler as EventHandler);
  }

  once<T = unknown>(type: string, handler: EventHandler<T>): () => void {
    const wrapped: EventHandler<T> = (event) => {
      handler(event);
      this.off(type, wrapped);
    };
    return this.on(type, wrapped);
  }

  emit<T = unknown>(event: StreetEvent<T>): void {
    const handlers = this._handlers.get(event.type);
    if (handlers === undefined) return;
    for (const h of handlers) {
      h(event as StreetEvent);
    }
  }

  clear(type?: string): void {
    if (type !== undefined) {
      this._handlers.delete(type);
    } else {
      this._handlers.clear();
    }
  }

  listenerCount(type: string): number {
    return this._handlers.get(type)?.size ?? 0;
  }
}

export const globalEventBus = new EventBus();
