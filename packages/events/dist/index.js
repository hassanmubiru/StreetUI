// src/event-types.ts
function createStreetEvent(type, target, data, originalEvent) {
  let _stopped = false;
  const ev = {
    type,
    target,
    data,
    originalEvent,
    timestamp: Date.now(),
    defaultPrevented: false,
    stopPropagation() {
      _stopped = true;
    },
    preventDefault() {
      ev.defaultPrevented = true;
    }
  };
  return ev;
}

// src/event-bus.ts
var EventBus = class {
  _handlers = /* @__PURE__ */ new Map();
  on(type, handler) {
    let set = this._handlers.get(type);
    if (set === void 0) {
      set = /* @__PURE__ */ new Set();
      this._handlers.set(type, set);
    }
    set.add(handler);
    return () => this.off(type, handler);
  }
  off(type, handler) {
    this._handlers.get(type)?.delete(handler);
  }
  once(type, handler) {
    const wrapped = (event) => {
      handler(event);
      this.off(type, wrapped);
    };
    return this.on(type, wrapped);
  }
  emit(event) {
    const handlers = this._handlers.get(event.type);
    if (handlers === void 0) return;
    for (const h of handlers) {
      h(event);
    }
  }
  clear(type) {
    if (type !== void 0) {
      this._handlers.delete(type);
    } else {
      this._handlers.clear();
    }
  }
  listenerCount(type) {
    return this._handlers.get(type)?.size ?? 0;
  }
};
var globalEventBus = new EventBus();

// src/dom-bridge.ts
function bindDomEvent(element, domEventType, handler, options) {
  const listener = (e) => {
    const streetEvent = createStreetEvent(domEventType, element, void 0, e);
    handler(streetEvent);
  };
  element.addEventListener(domEventType, listener, options);
  return {
    remove() {
      element.removeEventListener(domEventType, listener, options);
    }
  };
}
var DomEventRegistry = class {
  _bindings = [];
  bind(element, type, handler, options) {
    this._bindings.push(bindDomEvent(element, type, handler, options));
  }
  removeAll() {
    for (const b of this._bindings) {
      b.remove();
    }
    this._bindings.length = 0;
  }
  get count() {
    return this._bindings.length;
  }
};
export {
  DomEventRegistry,
  EventBus,
  bindDomEvent,
  createStreetEvent,
  globalEventBus
};
//# sourceMappingURL=index.js.map