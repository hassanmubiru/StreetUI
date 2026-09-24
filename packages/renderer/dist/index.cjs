"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  NodeInstance: () => NodeInstance,
  STATE_MARKER_ATTR: () => STATE_MARKER_ATTR,
  StreetRenderHandle: () => StreetRenderHandle,
  StreetRendererImpl: () => StreetRendererImpl,
  applyNodeProps: () => applyNodeProps,
  applyProp: () => applyProp,
  buttonUpdate: () => buttonUpdate,
  consoleHydrationDiagnosticSink: () => consoleHydrationDiagnosticSink,
  createHydrationDiagnosticCollector: () => createHydrationDiagnosticCollector,
  createRenderContext: () => createRenderContext,
  createRenderer: () => createRenderer,
  formatHydrationDiagnostic: () => formatHydrationDiagnostic,
  headingUpdate: () => headingUpdate,
  hydrateGraph: () => hydrateGraph,
  inputUpdate: () => inputUpdate,
  mountGraph: () => mountGraph,
  mountNode: () => mountNode,
  patchNode: () => patchNode,
  patchProp: () => patchProp,
  readState: () => readState,
  reconcileChildren: () => reconcileChildren,
  renderToString: () => renderToString,
  resolveTag: () => resolveTag,
  serializeState: () => serializeState,
  textUpdate: () => textUpdate,
  wireEvents: () => wireEvents,
  wireReactiveList: () => wireReactiveList,
  wireSignalBindings: () => wireSignalBindings
});
module.exports = __toCommonJS(index_exports);

// src/render-context.ts
function createRenderContext(dom, graph, container, hydrationDiagnostics) {
  return {
    dom,
    graph,
    instances: /* @__PURE__ */ new Map(),
    container,
    ...hydrationDiagnostics !== void 0 ? { hydrationDiagnostics } : {}
  };
}

// src/node-instance.ts
var import_core = require("@streetui/core");
var NodeInstance = class {
  graphNode;
  /** The primary DOM node for this instance (element or text node). */
  domNode;
  children = [];
  cleanup = new import_core.CleanupRegistry();
  constructor(graphNode, domNode) {
    this.graphNode = graphNode;
    this.domNode = domNode;
  }
  addChild(child) {
    this.children.push(child);
  }
  /** Subscribe to a signal; auto-cleanup on unmount. */
  trackSignal(sig, handler) {
    const unsub = sig.subscribe(handler);
    this.cleanup.add(unsub);
  }
  /** Register a raw cleanup fn (DOM event removal, etc.). */
  trackCleanup(fn) {
    this.cleanup.add(fn);
  }
  dispose() {
    for (const child of this.children) {
      child.dispose();
    }
    this.cleanup.run();
  }
};

// src/attributes.ts
var DOM_PROPERTIES = /* @__PURE__ */ new Set([
  "value",
  "checked",
  "selected",
  "indeterminate",
  "innerHTML",
  "textContent",
  "innerText",
  "scrollTop",
  "scrollLeft"
]);
var BOOLEAN_ATTRS = /* @__PURE__ */ new Set([
  "disabled",
  "readonly",
  "required",
  "checked",
  "selected",
  "multiple",
  "autofocus",
  "autoplay",
  "controls",
  "default",
  "defer",
  "formnovalidate",
  "hidden",
  "ismap",
  "loop",
  "novalidate",
  "open",
  "reversed",
  "scoped",
  "seamless"
]);
function applyProp(dom, element, name, value) {
  if (name.startsWith("_")) return;
  if (name.startsWith("on")) return;
  if (DOM_PROPERTIES.has(name)) {
    dom.setProperty(element, name, value);
    return;
  }
  if (BOOLEAN_ATTRS.has(name)) {
    if (value === true || value === "" || value === name) {
      dom.setAttribute(element, name, "");
    } else {
      dom.removeAttribute(element, name);
    }
    return;
  }
  if (name === "class" || name === "className") {
    dom.setAttribute(element, "class", String(value ?? ""));
    return;
  }
  if (name === "style" && typeof value === "object" && value !== null) {
    const el = element;
    const styles = value;
    for (const [k, v] of Object.entries(styles)) {
      el.style.setProperty(k, v);
    }
    return;
  }
  if (value === null || value === void 0 || value === false) {
    dom.removeAttribute(element, name);
    return;
  }
  dom.setAttribute(element, name, String(value));
}
function patchProp(dom, element, name, oldValue, newValue) {
  if (Object.is(oldValue, newValue)) return;
  applyProp(dom, element, name, newValue);
}

// src/events.ts
function wireEvents(dom, graph, node, element, instance) {
  for (const eventDesc of node.events) {
    const handler = graph.getHandler(eventDesc.handlerKey);
    if (handler === void 0) continue;
    const domListener = (domEvent) => {
      if (eventDesc.type === "input" || eventDesc.type === "change") {
        const input = domEvent.target;
        handler(input.value);
      } else if (eventDesc.type === "submit") {
        domEvent.preventDefault();
        handler(domEvent);
      } else {
        handler();
      }
    };
    dom.addEventListener(element, eventDesc.type, domListener);
    instance.trackCleanup(() => {
      dom.removeEventListener(element, eventDesc.type, domListener);
    });
  }
}

// src/tag-map.ts
var TAG_MAP = {
  application: "div",
  page: "div",
  section: "section",
  container: "div",
  heading: "h1",
  text: "span",
  button: "button",
  input: "input",
  form: "form",
  list: "ul",
  "list-item": "li",
  image: "img",
  link: "a",
  component: "div",
  slot: "div",
  fragment: "div",
  "reactive-list": "ul"
};
function resolveTag(type) {
  return TAG_MAP[type] ?? "div";
}

// src/patch.ts
function patchNode(ctx, graphNode, propKey, newValue) {
  const instance = ctx.instances.get(graphNode.id);
  if (instance === void 0) return;
  const domNode = instance.domNode;
  if (!ctx.dom.isElement(domNode)) return;
  const oldValue = graphNode.getProp(propKey);
  switch (propKey) {
    case "text":
      if (!Object.is(oldValue, newValue)) {
        ctx.dom.setTextContent(domNode, String(newValue ?? ""));
        graphNode.setProp("text", String(newValue ?? ""));
      }
      break;
    case "label":
      if (!Object.is(oldValue, newValue)) {
        ctx.dom.setTextContent(domNode, String(newValue ?? ""));
        graphNode.setProp("label", String(newValue ?? ""));
      }
      break;
    case "disabled":
      if (newValue === true) {
        ctx.dom.setAttribute(domNode, "disabled", "");
      } else {
        ctx.dom.removeAttribute(domNode, "disabled");
      }
      graphNode.setProp("disabled", Boolean(newValue));
      break;
    case "value":
      if (!Object.is(oldValue, newValue)) {
        ctx.dom.setProperty(domNode, "value", String(newValue ?? ""));
        graphNode.setProp("value", String(newValue ?? ""));
      }
      break;
    default:
      patchProp(ctx.dom, domNode, propKey, oldValue, newValue);
      graphNode.setProp(propKey, newValue);
      break;
  }
}

// src/reconciliation.ts
function reconcileChildren(ctx, parentDom, oldInstances, newNodes, mountFn) {
  const oldByKey = /* @__PURE__ */ new Map();
  for (const inst of oldInstances) {
    const key = inst.graphNode.key ?? inst.graphNode.id;
    oldByKey.set(key, inst);
  }
  const newInstances = [];
  const usedKeys = /* @__PURE__ */ new Set();
  for (const newNode of newNodes) {
    const key = newNode.key ?? newNode.id;
    const existing = oldByKey.get(key);
    if (existing !== void 0) {
      usedKeys.add(key);
      const oldSig = existing.graphNode.getProp("_sig");
      const newSig = newNode.getProp("_sig");
      patchExistingInstance(ctx, existing, newNode);
      if (!Object.is(oldSig, newSig)) {
        reconcileItemChildren(ctx, existing, newNode, mountFn);
      }
      newInstances.push(existing);
    } else {
      const inst = mountFn(newNode, parentDom);
      newInstances.push(inst);
    }
  }
  const removed = [];
  for (const inst of oldInstances) {
    const key = inst.graphNode.key ?? inst.graphNode.id;
    if (!usedKeys.has(key)) {
      removed.push(inst);
    }
  }
  for (const inst of removed) {
    const parent = ctx.dom.parentNode(inst.domNode);
    if (parent !== null) {
      ctx.dom.removeChild(parent, inst.domNode);
    }
    inst.dispose();
  }
  reorderDom(ctx, parentDom, newInstances);
  return { instances: newInstances, removed };
}
function reconcileItemChildren(ctx, itemInstance, newItemNode, mountFn) {
  const el = itemInstance.domNode;
  if (!ctx.dom.isElement(el)) return;
  const oldChildren = [...itemInstance.children];
  const newChildNodes = [...newItemNode.children];
  const nextChildren = [];
  const kept = /* @__PURE__ */ new Set();
  for (let i = 0; i < newChildNodes.length; i++) {
    const newChild = newChildNodes[i];
    const oldChild = oldChildren[i];
    if (oldChild !== void 0 && oldChild.graphNode.type === newChild.type) {
      patchExistingInstance(ctx, oldChild, newChild);
      reconcileItemChildren(ctx, oldChild, newChild, mountFn);
      nextChildren.push(oldChild);
      kept.add(oldChild);
    } else {
      itemInstance.graphNode.appendChild(newChild);
      const inst = mountFn(newChild, el);
      nextChildren.push(inst);
    }
  }
  for (const old of oldChildren) {
    if (kept.has(old)) continue;
    const parent = ctx.dom.parentNode(old.domNode);
    if (parent !== null) ctx.dom.removeChild(parent, old.domNode);
    old.dispose();
    forgetInstanceTree(ctx, old);
    ctx.graph.detachNode(old.graphNode);
  }
  reorderDom(ctx, el, nextChildren);
  itemInstance.children.length = 0;
  for (const c of nextChildren) itemInstance.children.push(c);
  for (const c of [...itemInstance.graphNode.children]) {
    itemInstance.graphNode.removeChild(c);
  }
  for (const c of nextChildren) itemInstance.graphNode.appendChild(c.graphNode);
}
function reorderDom(ctx, parentDom, instances) {
  let referenceNode = null;
  for (let i = instances.length - 1; i >= 0; i--) {
    const inst = instances[i];
    if (inst === void 0) continue;
    const domNode = inst.domNode;
    const currentNext = ctx.dom.nextSibling(domNode);
    if (currentNext !== referenceNode) {
      ctx.dom.insertBefore(parentDom, domNode, referenceNode);
    }
    referenceNode = domNode;
  }
}
function forgetInstanceTree(ctx, instance) {
  ctx.instances.delete(instance.graphNode.id);
  for (const child of instance.children) forgetInstanceTree(ctx, child);
}
function patchExistingInstance(ctx, instance, newNode) {
  const oldNode = instance.graphNode;
  for (const [key, newVal] of Object.entries(newNode.props)) {
    const oldVal = oldNode.getProp(key);
    if (!Object.is(oldVal, newVal)) {
      patchNode(ctx, instance.graphNode, key, newVal);
    }
  }
}

// src/mount.ts
var SKIP_PROP_KEYS = /* @__PURE__ */ new Set([
  "text",
  "label",
  "level",
  "inputType",
  "src",
  "alt",
  "href",
  "external",
  "value",
  "placeholder",
  "disabled",
  "_renderKey",
  "key",
  "name"
]);
function mountGraph(ctx) {
  return mountNode(ctx, ctx.graph.root, ctx.container);
}
function mountNode(ctx, graphNode, parentDom) {
  const { dom, graph } = ctx;
  if (graphNode.type === "application") {
    const instance2 = new NodeInstance(graphNode, parentDom);
    ctx.instances.set(graphNode.id, instance2);
    for (const child of graphNode.children) {
      const childInstance = mountNode(ctx, child, parentDom);
      instance2.addChild(childInstance);
    }
    return instance2;
  }
  if (graphNode.type === "text") {
    const text = String(graphNode.getProp("text") ?? "");
    const el2 = dom.createElement("span");
    const textNode = dom.createTextNode(text);
    dom.appendChild(el2, textNode);
    applyNodeProps(ctx, graphNode, el2);
    wireEvents(dom, graph, graphNode, el2, new NodeInstance(graphNode, el2));
    const instance2 = new NodeInstance(graphNode, el2);
    ctx.instances.set(graphNode.id, instance2);
    wireSignalBindings(ctx, graphNode, instance2, textUpdate(dom, el2, textNode));
    dom.appendChild(parentDom, el2);
    return instance2;
  }
  if (graphNode.type === "heading") {
    const level = graphNode.getProp("level") ?? 1;
    const tag2 = `h${level}`;
    const el2 = dom.createElement(tag2);
    const text = String(graphNode.getProp("text") ?? "");
    dom.setTextContent(el2, text);
    applyNodeProps(ctx, graphNode, el2);
    const instance2 = new NodeInstance(graphNode, el2);
    ctx.instances.set(graphNode.id, instance2);
    wireEvents(dom, graph, graphNode, el2, instance2);
    wireSignalBindings(ctx, graphNode, instance2, headingUpdate(dom, el2));
    dom.appendChild(parentDom, el2);
    return instance2;
  }
  if (graphNode.type === "input") {
    const el2 = dom.createElement("input");
    const inputType = String(graphNode.getProp("inputType") ?? "text");
    dom.setAttribute(el2, "type", inputType);
    const placeholder = graphNode.getProp("placeholder");
    if (placeholder !== void 0) dom.setAttribute(el2, "placeholder", String(placeholder));
    const value = graphNode.getProp("value");
    if (value !== void 0) dom.setProperty(el2, "value", String(value));
    applyNodeProps(ctx, graphNode, el2);
    const instance2 = new NodeInstance(graphNode, el2);
    ctx.instances.set(graphNode.id, instance2);
    wireEvents(dom, graph, graphNode, el2, instance2);
    wireSignalBindings(ctx, graphNode, instance2, inputUpdate(dom, el2));
    dom.appendChild(parentDom, el2);
    return instance2;
  }
  if (graphNode.type === "image") {
    const el2 = dom.createElement("img");
    const src = graphNode.getProp("src");
    const alt = graphNode.getProp("alt");
    if (src !== void 0) dom.setAttribute(el2, "src", String(src));
    if (alt !== void 0) dom.setAttribute(el2, "alt", String(alt));
    const width = graphNode.getProp("width");
    const height = graphNode.getProp("height");
    if (width !== void 0) dom.setAttribute(el2, "width", String(width));
    if (height !== void 0) dom.setAttribute(el2, "height", String(height));
    applyNodeProps(ctx, graphNode, el2);
    const instance2 = new NodeInstance(graphNode, el2);
    ctx.instances.set(graphNode.id, instance2);
    dom.appendChild(parentDom, el2);
    return instance2;
  }
  if (graphNode.type === "link") {
    const el2 = dom.createElement("a");
    const href = graphNode.getProp("href");
    const label = graphNode.getProp("label");
    const external = graphNode.getProp("external");
    if (href !== void 0) dom.setAttribute(el2, "href", String(href));
    if (label !== void 0) dom.setTextContent(el2, String(label));
    if (external === true) {
      dom.setAttribute(el2, "target", "_blank");
      dom.setAttribute(el2, "rel", "noopener noreferrer");
    }
    applyNodeProps(ctx, graphNode, el2);
    const instance2 = new NodeInstance(graphNode, el2);
    ctx.instances.set(graphNode.id, instance2);
    wireEvents(dom, graph, graphNode, el2, instance2);
    dom.appendChild(parentDom, el2);
    return instance2;
  }
  if (graphNode.type === "button") {
    const el2 = dom.createElement("button");
    const label = graphNode.getProp("label");
    if (label !== void 0) dom.setTextContent(el2, String(label));
    const disabled = graphNode.getProp("disabled");
    if (disabled === true) dom.setAttribute(el2, "disabled", "");
    applyNodeProps(ctx, graphNode, el2);
    const instance2 = new NodeInstance(graphNode, el2);
    ctx.instances.set(graphNode.id, instance2);
    wireEvents(dom, graph, graphNode, el2, instance2);
    wireSignalBindings(ctx, graphNode, instance2, buttonUpdate(dom, el2));
    dom.appendChild(parentDom, el2);
    return instance2;
  }
  if (graphNode.type === "reactive-list" || graphNode.type === "conditional") {
    const tag2 = resolveTag(graphNode.type);
    const el2 = dom.createElement(tag2);
    applyNodeProps(ctx, graphNode, el2);
    const instance2 = new NodeInstance(graphNode, el2);
    ctx.instances.set(graphNode.id, instance2);
    for (const child of graphNode.children) {
      const childInstance = mountNode(ctx, child, el2);
      instance2.addChild(childInstance);
    }
    dom.appendChild(parentDom, el2);
    wireReactiveList(ctx, graphNode, instance2, el2);
    return instance2;
  }
  const tag = resolveTag(graphNode.type);
  const el = dom.createElement(tag);
  applyNodeProps(ctx, graphNode, el);
  if (graphNode.type === "list-item") {
    const itemKey = graphNode.getProp("key");
    if (itemKey !== void 0) {
      dom.setAttribute(el, "data-streetui-key", String(itemKey));
    }
  }
  if (graphNode.type === "form") {
    wireEvents(dom, graph, graphNode, el, new NodeInstance(graphNode, el));
  }
  const instance = new NodeInstance(graphNode, el);
  ctx.instances.set(graphNode.id, instance);
  for (const child of graphNode.children) {
    const childInstance = mountNode(ctx, child, el);
    instance.addChild(childInstance);
  }
  dom.appendChild(parentDom, el);
  return instance;
}
function textUpdate(dom, el, textNode) {
  return (propKey, value) => {
    if (propKey === "text") {
      dom.setTextContent(textNode, String(value ?? ""));
    } else {
      applyProp(dom, el, propKey, value);
    }
  };
}
function headingUpdate(dom, el) {
  return (propKey, value) => {
    if (propKey === "text") {
      dom.setTextContent(el, String(value ?? ""));
    } else {
      applyProp(dom, el, propKey, value);
    }
  };
}
function inputUpdate(dom, el) {
  return (propKey, value) => {
    if (propKey === "value") {
      dom.setProperty(el, "value", String(value ?? ""));
    } else {
      applyProp(dom, el, propKey, value);
    }
  };
}
function buttonUpdate(dom, el) {
  return (propKey, value) => {
    if (propKey === "label") {
      dom.setTextContent(el, String(value ?? ""));
    } else if (propKey === "disabled") {
      if (value === true) {
        dom.setAttribute(el, "disabled", "");
      } else {
        dom.removeAttribute(el, "disabled");
      }
    } else {
      applyProp(dom, el, propKey, value);
    }
  };
}
function applyNodeProps(ctx, graphNode, el) {
  for (const [key, value] of Object.entries(graphNode.props)) {
    if (SKIP_PROP_KEYS.has(key)) continue;
    applyProp(ctx.dom, el, key, value);
  }
}
function wireSignalBindings(ctx, graphNode, instance, onUpdate) {
  for (const stateRef of graphNode.stateRefs) {
    const signalKey = `__signal__${stateRef.signalId}`;
    const maybeSig = ctx.graph.getHandler(signalKey);
    if (maybeSig === void 0 || typeof maybeSig.subscribe !== "function") continue;
    const unsub = maybeSig.subscribe((value) => {
      onUpdate(stateRef.propKey, value);
    });
    instance.trackCleanup(unsub);
  }
}
function wireReactiveList(ctx, graphNode, instance, el) {
  const build = ctx.graph.getHandler(`__listbuild__${graphNode.id}`);
  if (build === void 0) return;
  for (const stateRef of graphNode.stateRefs) {
    if (stateRef.propKey !== "items") continue;
    const sig = ctx.graph.getHandler(`__signal__${stateRef.signalId}`);
    if (sig === void 0 || typeof sig.subscribe !== "function") continue;
    const unsub = sig.subscribe((value) => {
      reconcileReactiveList(ctx, graphNode, instance, el, build(value));
    });
    instance.trackCleanup(unsub);
  }
}
function reconcileReactiveList(ctx, listNode, listInstance, listEl, newNodes) {
  const oldInstances = [...listInstance.children];
  const result = reconcileChildren(
    ctx,
    listEl,
    oldInstances,
    newNodes,
    (node, parent) => mountNode(ctx, node, parent)
  );
  listInstance.children.length = 0;
  for (const inst of result.instances) listInstance.children.push(inst);
  for (const removed of result.removed) {
    forgetInstance(ctx, removed);
    ctx.graph.detachNode(removed.graphNode);
  }
  const adopted = new Set(result.instances.map((i) => i.graphNode));
  for (const built of newNodes) {
    if (!adopted.has(built)) ctx.graph.detachNode(built);
  }
  for (const child of [...listNode.children]) listNode.removeChild(child);
  for (const inst of result.instances) listNode.appendChild(inst.graphNode);
}
function forgetInstance(ctx, instance) {
  ctx.instances.delete(instance.graphNode.id);
  for (const child of instance.children) forgetInstance(ctx, child);
}

// src/renderer.ts
var import_dom = require("@streetui/dom");

// src/hydration-diagnostics.ts
function formatHydrationDiagnostic(d) {
  const at = ` at ${d.path}`;
  switch (d.type) {
    case "tag-mismatch":
      return `Hydration mismatch${at} \u2014 Expected: ${d.expected} / Found: ${d.found} / Action: ${d.action}`;
    case "missing-element":
      return `Hydration mismatch${at} \u2014 Expected: ${d.expected} / Found: (nothing) / Action: ${d.action}`;
    case "surplus-element":
      return `Hydration mismatch${at} \u2014 Expected: (nothing) / Found: ${d.found} / Action: ${d.action}`;
  }
}
function createHydrationDiagnosticCollector() {
  const diagnostics = [];
  return {
    diagnostics,
    sink: {
      report(d) {
        diagnostics.push(d);
      }
    }
  };
}
function consoleHydrationDiagnosticSink(logger = console) {
  return {
    report(d) {
      logger.warn(d.message);
    }
  };
}

// src/hydrate.ts
function hydrateGraph(ctx) {
  const root = ctx.graph.root;
  const instance = new NodeInstance(root, ctx.container);
  ctx.instances.set(root.id, instance);
  hydrateChildren(ctx, root, instance, ctx.container, "app");
  return instance;
}
function hydrateNode(ctx, graphNode, domNode, path) {
  const { dom, graph } = ctx;
  switch (graphNode.type) {
    case "text": {
      let textNode = dom.firstChild(domNode);
      if (textNode === null || !dom.isTextNode(textNode)) {
        const created = dom.createTextNode(String(graphNode.getProp("text") ?? ""));
        dom.appendChild(domNode, created);
        textNode = created;
      }
      const instance = new NodeInstance(graphNode, domNode);
      ctx.instances.set(graphNode.id, instance);
      wireEvents(dom, graph, graphNode, domNode, instance);
      wireSignalBindings(ctx, graphNode, instance, textUpdate(dom, domNode, textNode));
      return instance;
    }
    case "heading": {
      const instance = new NodeInstance(graphNode, domNode);
      ctx.instances.set(graphNode.id, instance);
      wireEvents(dom, graph, graphNode, domNode, instance);
      wireSignalBindings(ctx, graphNode, instance, headingUpdate(dom, domNode));
      return instance;
    }
    case "input": {
      const instance = new NodeInstance(graphNode, domNode);
      ctx.instances.set(graphNode.id, instance);
      const value = graphNode.getProp("value");
      if (value !== void 0) dom.setProperty(domNode, "value", String(value));
      wireEvents(dom, graph, graphNode, domNode, instance);
      wireSignalBindings(ctx, graphNode, instance, inputUpdate(dom, domNode));
      return instance;
    }
    case "button": {
      const instance = new NodeInstance(graphNode, domNode);
      ctx.instances.set(graphNode.id, instance);
      wireEvents(dom, graph, graphNode, domNode, instance);
      wireSignalBindings(ctx, graphNode, instance, buttonUpdate(dom, domNode));
      return instance;
    }
    case "image":
    case "link": {
      const instance = new NodeInstance(graphNode, domNode);
      ctx.instances.set(graphNode.id, instance);
      if (graphNode.type === "link") wireEvents(dom, graph, graphNode, domNode, instance);
      return instance;
    }
    case "reactive-list":
    case "conditional": {
      const instance = new NodeInstance(graphNode, domNode);
      ctx.instances.set(graphNode.id, instance);
      hydrateChildren(ctx, graphNode, instance, domNode, path);
      wireReactiveList(ctx, graphNode, instance, domNode);
      return instance;
    }
    default: {
      const instance = new NodeInstance(graphNode, domNode);
      ctx.instances.set(graphNode.id, instance);
      if (graphNode.type === "form") {
        wireEvents(dom, graph, graphNode, domNode, instance);
      }
      if (graphNode.getProp("_hydrationBoundary") === true) {
        return instance;
      }
      hydrateChildren(ctx, graphNode, instance, domNode, path);
      return instance;
    }
  }
}
function hydrateChildren(ctx, parentGraphNode, parentInstance, parentDom, parentPath) {
  const expected = parentGraphNode.children;
  const actual = elementChildren(ctx, parentDom);
  let cursor = 0;
  for (let i = 0; i < expected.length; i++) {
    const childNode = expected[i];
    const want = expectedTag(ctx, childNode);
    const childPath = `${parentPath} / ${childNode.type}[${i}]`;
    const actualEl = actual[cursor];
    if (actualEl !== void 0 && ctx.dom.isElement(actualEl) && ctx.dom.tagName(actualEl) === want) {
      const inst = hydrateNode(ctx, childNode, actualEl, childPath);
      parentInstance.addChild(inst);
      cursor++;
    } else {
      const ref = actualEl ?? null;
      const inst = mountFreshAt(ctx, childNode, parentDom, ref);
      parentInstance.addChild(inst);
      if (actualEl !== void 0) {
        const found = ctx.dom.isElement(actualEl) ? ctx.dom.tagName(actualEl) : null;
        reportHydrationDiagnostic(ctx, {
          type: "tag-mismatch",
          expected: want,
          found,
          path: childPath,
          nodeId: childNode.id,
          nodeType: childNode.type,
          action: "mounted fresh subtree in place"
        });
        ctx.dom.removeChild(parentDom, actualEl);
        cursor++;
      } else {
        reportHydrationDiagnostic(ctx, {
          type: "missing-element",
          expected: want,
          found: null,
          path: childPath,
          nodeId: childNode.id,
          nodeType: childNode.type,
          action: "mounted fresh subtree"
        });
      }
    }
  }
  for (let i = cursor; i < actual.length; i++) {
    const surplus = actual[i];
    reportHydrationDiagnostic(ctx, {
      type: "surplus-element",
      expected: null,
      found: ctx.dom.isElement(surplus) ? ctx.dom.tagName(surplus) : null,
      path: `${parentPath} / [surplus ${i}]`,
      nodeId: null,
      nodeType: null,
      action: "removed surplus server element"
    });
    ctx.dom.removeChild(parentDom, surplus);
  }
}
function reportHydrationDiagnostic(ctx, d) {
  const sink = ctx.hydrationDiagnostics;
  if (sink === void 0) return;
  sink.report({ ...d, message: formatHydrationDiagnostic(d) });
}
function mountFreshAt(ctx, node, parentDom, ref) {
  const inst = mountNode(ctx, node, parentDom);
  if (ref !== null) {
    ctx.dom.insertBefore(parentDom, inst.domNode, ref);
  }
  return inst;
}
function elementChildren(ctx, parent) {
  const out = [];
  for (const node of ctx.dom.childNodes(parent)) {
    if (ctx.dom.isElement(node)) out.push(node);
  }
  return out;
}
function expectedTag(ctx, graphNode) {
  switch (graphNode.type) {
    case "text":
      return "span";
    case "heading": {
      const level = graphNode.getProp("level") ?? 1;
      return `h${level}`;
    }
    case "input":
      return "input";
    case "image":
      return "img";
    case "link":
      return "a";
    case "button":
      return "button";
    default:
      return resolveTag(graphNode.type);
  }
}

// src/render-handle.ts
var StreetRenderHandle = class {
  _disposed = false;
  _ctx;
  _rootInstance;
  constructor(ctx, rootInstance) {
    this._ctx = ctx;
    this._rootInstance = rootInstance;
  }
  flush() {
    if (this._disposed) return;
  }
  unmount() {
    if (this._disposed) return;
    this._disposed = true;
    this._rootInstance.dispose();
    const dom = this._ctx.dom;
    const container = this._ctx.container;
    for (const child of dom.childNodes(container)) {
      dom.removeChild(container, child);
    }
    this._ctx.instances.clear();
  }
};

// src/renderer.ts
var StreetRendererImpl = class {
  _dom;
  _hydrationDiagnostics;
  constructor(options = {}) {
    this._dom = options.domAdapter ?? new import_dom.BrowserDOMAdapter();
    if (options.hydrationDiagnostics !== void 0) {
      this._hydrationDiagnostics = options.hydrationDiagnostics;
    }
  }
  mount(compiled, container) {
    const ctx = createRenderContext(this._dom, compiled.graph, container);
    const rootInstance = mountGraph(ctx);
    this._wireSignals(ctx, rootInstance);
    return new StreetRenderHandle(ctx, rootInstance);
  }
  /**
   * Hydrate a container that already holds server-rendered HTML for this
   * application. Instead of recreating the DOM, it walks the semantic graph
   * against the existing nodes, adopting matching elements and attaching
   * behavior (events + signal subscriptions). Mismatched subtrees are locally
   * replaced. Returns the same handle type as `mount`.
   */
  hydrate(compiled, container) {
    const ctx = createRenderContext(
      this._dom,
      compiled.graph,
      container,
      this._hydrationDiagnostics
    );
    const rootInstance = hydrateGraph(ctx);
    this._wireSignals(ctx, rootInstance);
    return new StreetRenderHandle(ctx, rootInstance);
  }
  _wireSignals(ctx, rootInstance) {
  }
};
function createRenderer(options) {
  return new StreetRendererImpl(options);
}

// src/dehydrate.ts
var STATE_MARKER_ATTR = "data-streetui-state";
function escapeForScript(json) {
  let out = "";
  for (const ch of json) {
    const code = ch.charCodeAt(0);
    if (ch === "<") out += "\\u003c";
    else if (ch === ">") out += "\\u003e";
    else if (ch === "&") out += "\\u0026";
    else if (code === 8232) out += "\\u2028";
    else if (code === 8233) out += "\\u2029";
    else out += ch;
  }
  return out;
}
function serializeState(state) {
  if (Object.keys(state).length === 0) return "";
  const json = escapeForScript(JSON.stringify(state));
  return `<script type="application/json" ${STATE_MARKER_ATTR}>${json}</script>`;
}
function readState(dom, root) {
  const el = dom.querySelector(root, `script[${STATE_MARKER_ATTR}]`);
  if (el === null) return {};
  const text = dom.getTextContent(el);
  if (text === null || text.length === 0) return {};
  try {
    const parsed = JSON.parse(text);
    if (parsed !== null && typeof parsed === "object") {
      return parsed;
    }
    return {};
  } catch {
    return {};
  }
}

// src/ssr.ts
var import_dom2 = require("@streetui/dom");
function renderToString(compiled, options = {}) {
  const dom = options.domAdapter ?? new import_dom2.ServerDOMAdapter();
  const container = dom.createElement("div");
  const ctx = createRenderContext(dom, compiled.graph, container);
  const rootInstance = mountGraph(ctx);
  const html = dom.serializeInner(container);
  rootInstance.dispose();
  ctx.instances.clear();
  return html;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  NodeInstance,
  STATE_MARKER_ATTR,
  StreetRenderHandle,
  StreetRendererImpl,
  applyNodeProps,
  applyProp,
  buttonUpdate,
  consoleHydrationDiagnosticSink,
  createHydrationDiagnosticCollector,
  createRenderContext,
  createRenderer,
  formatHydrationDiagnostic,
  headingUpdate,
  hydrateGraph,
  inputUpdate,
  mountGraph,
  mountNode,
  patchNode,
  patchProp,
  readState,
  reconcileChildren,
  renderToString,
  resolveTag,
  serializeState,
  textUpdate,
  wireEvents,
  wireReactiveList,
  wireSignalBindings
});
//# sourceMappingURL=index.cjs.map