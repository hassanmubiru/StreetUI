/**
 * StreetUI event type catalogue.
 * Framework events are distinct from raw DOM events.
 */

export type StreetEventType =
  | 'click'
  | 'dblclick'
  | 'input'
  | 'change'
  | 'submit'
  | 'focus'
  | 'blur'
  | 'keydown'
  | 'keyup'
  | 'keypress'
  | 'mouseenter'
  | 'mouseleave'
  | 'mousemove'
  | 'mousedown'
  | 'mouseup'
  | 'pointerdown'
  | 'pointerup'
  | 'pointermove'
  | 'pointerenter'
  | 'pointerleave'
  | 'scroll'
  | 'resize'
  | 'mount'
  | 'unmount'
  | 'update';

export interface StreetEvent<T = unknown> {
  readonly type: StreetEventType | string;
  readonly target: unknown;
  readonly data: T | undefined;
  readonly originalEvent: Event | undefined;
  readonly timestamp: number;
  defaultPrevented: boolean;
  stopPropagation(): void;
  preventDefault(): void;
}

export function createStreetEvent<T = unknown>(
  type: StreetEventType | string,
  target: unknown,
  data?: T,
  originalEvent?: Event,
): StreetEvent<T> {
  let _stopped = false;
  const ev: StreetEvent<T> = {
    type,
    target,
    data: data as T | undefined,
    originalEvent: originalEvent as Event | undefined,
    timestamp: Date.now(),
    defaultPrevented: false,
    stopPropagation() { _stopped = true; },
    preventDefault() { ev.defaultPrevented = true; },
  };
  return ev;
}

export type EventHandler<T = unknown> = (event: StreetEvent<T>) => void;
