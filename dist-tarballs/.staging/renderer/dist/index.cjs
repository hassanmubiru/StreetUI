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
  HeadManager: () => HeadManager,
  NodeInstance: () => NodeInstance,
  STATE_MARKER_ATTR: () => STATE_MARKER_ATTR,
  StreetRenderHandle: () => StreetRenderHandle,
  StreetRendererImpl: () => StreetRendererImpl,
  TransitionController: () => TransitionController,
  applyNodeProps: () => applyNodeProps,
  applyProp: () => applyProp,
  buttonUpdate: () => buttonUpdate,
  consoleHydrationDiagnosticSink: () => consoleHydrationDiagnosticSink,
  createHydrationDiagnosticCollector: () => createHydrationDiagnosticCollector,
  createRenderContext: () => createRenderContext,
  createRenderer: () => createRenderer,
  formatHydrationDiagnostic: () => formatHydrationDiagnostic,
  getResolvedTransition: () => getResolvedTransition,
  headingUpdate: () => headingUpdate,
  hydrateGraph: () => hydrateGraph,
  inputUpdate: () => inputUpdate,
  linkUpdate: () => linkUpdate,
  mountGraph: () => mountGraph,
  mountNode: () => mountNode,
  patchNode: () => patchNode,
  patchProp: () => patchProp,
  readState: () => readState,
  reconcileChildren: () => reconcileChildren,
  reconcileChildrenByPlan: () => reconcileChildrenByPlan,
  renderHead: () => renderHead,
  renderToString: () => renderToString,
  resolveTag: () => resolveTag,
  runElementTransition: () => runElementTransition,
  serializeState: () => serializeState,
  textUpdate: () => textUpdate,
  wireComponentBehavior: () => wireComponentBehavior,
  wireEvents: () => wireEvents,
  wireHeadBehavior: () => wireHeadBehavior,
  wireOverlayBehavior: () => wireOverlayBehavior,
  wireReactiveList: () => wireReactiveList,
  wireSignalBindings: () => wireSignalBindings
});
module.exports = __toCommonJS(index_exports);

// src/render-context.ts
function createRenderContext(dom, graph, container, hydrationDiagnostics, staticHTML) {
  return {
    dom,
    graph,
    instances: /* @__PURE__ */ new Map(),
    container,
    ...hydrationDiagnostics !== void 0 ? { hydrationDiagnostics } : {},
    ...staticHTML !== void 0 ? { staticHTML } : {}
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
  if (node.events.length === 0) return;
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

// src/mount.ts
var import_dom2 = require("@streetui/dom");

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
  "reactive-list": "ul",
  // A portal renders as a neutral inline anchor <div> at its declaration site;
  // its children are relocated to a document.body container on the browser
  // (see the portal branch in mount.ts). On the server (no body) it renders
  // inline, so the anchor tag is what SSR/hydration positionally match on.
  portal: "div",
  // A `head()` node renders as a neutral, empty inline anchor <div> at its
  // declaration site (like a portal anchor). Its actual contribution — title/
  // meta/link/etc. — is applied to `document.head` by `wireHeadBehavior` on the
  // browser, and emitted separately by `renderHead()` on the server. Keeping a
  // one-node/one-element anchor preserves positional hydration.
  head: "div"
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
function reconcileChildren(ctx, parentDom, oldInstances, newNodes, mountFn, hooks) {
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
      const reclaimed = hooks?.takeLeaving(key);
      if (reclaimed !== void 0) {
        patchExistingInstance(ctx, reclaimed, newNode);
        reconcileItemChildren(ctx, reclaimed, newNode, mountFn);
        hooks?.onEnter(reclaimed);
        newInstances.push(reclaimed);
      } else {
        const inst = mountFn(newNode, parentDom);
        hooks?.onEnter(inst);
        newInstances.push(inst);
      }
    }
  }
  const removed = [];
  for (const inst of oldInstances) {
    const key = inst.graphNode.key ?? inst.graphNode.id;
    if (usedKeys.has(key)) continue;
    if (hooks !== void 0 && hooks.beginLeave(inst)) continue;
    const parent = ctx.dom.parentNode(inst.domNode);
    if (parent !== null) ctx.dom.removeChild(parent, inst.domNode);
    inst.dispose();
    removed.push(inst);
  }
  reorderDom(ctx, parentDom, newInstances);
  return { instances: newInstances, removed };
}
function reconcileChildrenByPlan(ctx, parentDom, oldInstances, plan, mountFn, hooks) {
  const oldByKey = /* @__PURE__ */ new Map();
  for (const inst of oldInstances) {
    oldByKey.set(inst.graphNode.key ?? inst.graphNode.id, inst);
  }
  const newInstances = [];
  const usedKeys = /* @__PURE__ */ new Set();
  const built = [];
  for (const entry of plan) {
    const existing = oldByKey.get(entry.key);
    if (existing !== void 0) {
      usedKeys.add(entry.key);
      const oldItem = existing.graphNode.getProp("_item");
      if (!Object.is(oldItem, entry.item)) {
        const newSig = entry.sig();
        const oldSig = existing.graphNode.getProp("_sig");
        if (!Object.is(oldSig, newSig)) {
          const freshNode = entry.build();
          built.push(freshNode);
          patchExistingInstance(ctx, existing, freshNode);
          reconcileItemChildren(ctx, existing, freshNode, mountFn);
          existing.graphNode.setProp("_sig", newSig);
        }
        existing.graphNode.setProp("_item", entry.item);
      }
      newInstances.push(existing);
    } else {
      const reclaimed = hooks?.takeLeaving(entry.key);
      if (reclaimed !== void 0) {
        const freshNode = entry.build();
        built.push(freshNode);
        patchExistingInstance(ctx, reclaimed, freshNode);
        reconcileItemChildren(ctx, reclaimed, freshNode, mountFn);
        reclaimed.graphNode.setProp("_sig", freshNode.getProp("_sig"));
        reclaimed.graphNode.setProp("_item", entry.item);
        hooks?.onEnter(reclaimed);
        newInstances.push(reclaimed);
      } else {
        const freshNode = entry.build();
        built.push(freshNode);
        const inst = mountFn(freshNode, parentDom);
        hooks?.onEnter(inst);
        newInstances.push(inst);
      }
    }
  }
  const removed = [];
  for (const inst of oldInstances) {
    const key = inst.graphNode.key ?? inst.graphNode.id;
    if (usedKeys.has(key)) continue;
    if (hooks !== void 0 && hooks.beginLeave(inst)) continue;
    const parent = ctx.dom.parentNode(inst.domNode);
    if (parent !== null) ctx.dom.removeChild(parent, inst.domNode);
    inst.dispose();
    removed.push(inst);
  }
  reorderDomMinimal(ctx, parentDom, oldInstances, newInstances);
  return { instances: newInstances, removed, built };
}
function reorderDomMinimal(ctx, parentDom, oldInstances, newInstances) {
  const n = newInstances.length;
  if (n === 0) return;
  const oldIndexOf = /* @__PURE__ */ new Map();
  for (let i = 0; i < oldInstances.length; i++) oldIndexOf.set(oldInstances[i], i);
  const source = new Array(n);
  let moved = false;
  let lastSeen = -1;
  for (let i = 0; i < n; i++) {
    const oi = oldIndexOf.get(newInstances[i]);
    if (oi === void 0) {
      source[i] = -1;
      moved = true;
    } else {
      source[i] = oi;
      if (oi < lastSeen) moved = true;
      else lastSeen = oi;
    }
  }
  if (!moved) return;
  const keep = longestIncreasingSubsequence(source);
  let refNode = null;
  for (let i = n - 1; i >= 0; i--) {
    const domNode = newInstances[i].domNode;
    if (source[i] === -1 || !keep.has(i)) {
      if (ctx.dom.nextSibling(domNode) !== refNode) {
        ctx.dom.insertBefore(parentDom, domNode, refNode);
      }
    }
    refNode = domNode;
  }
}
function longestIncreasingSubsequence(source) {
  const keep = /* @__PURE__ */ new Set();
  const n = source.length;
  const tails = [];
  const prev = new Array(n).fill(-1);
  for (let i = 0; i < n; i++) {
    const v = source[i];
    if (v < 0) continue;
    let lo = 0;
    let hi = tails.length;
    while (lo < hi) {
      const mid = lo + hi >> 1;
      if (source[tails[mid]] < v) lo = mid + 1;
      else hi = mid;
    }
    if (lo > 0) prev[i] = tails[lo - 1];
    tails[lo] = i;
  }
  let idx = tails.length > 0 ? tails[tails.length - 1] : -1;
  while (idx >= 0) {
    keep.add(idx);
    idx = prev[idx];
  }
  return keep;
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

// src/transition.ts
function getResolvedTransition(graph, nodeId) {
  const fn = graph.getHandler(`__transition__${nodeId}`);
  return fn === void 0 ? void 0 : fn();
}
function host() {
  return globalThis;
}
function nextFrame(cb) {
  const h = host();
  const raf = h.requestAnimationFrame;
  if (typeof raf === "function") {
    raf(() => raf(cb));
  } else {
    h.setTimeout(cb, 0);
  }
}
function splitClass(value) {
  if (value === null) return [];
  const out = [];
  for (const t of value.split(/\s+/)) if (t.length > 0) out.push(t);
  return out;
}
function addClasses(dom, el, classes) {
  if (classes.length === 0) return;
  const current = splitClass(dom.getAttribute(el, "class"));
  let changed = false;
  for (const c of classes) {
    if (!current.includes(c)) {
      current.push(c);
      changed = true;
    }
  }
  if (changed) dom.setAttribute(el, "class", current.join(" "));
}
function removeClasses(dom, el, classes) {
  if (classes.length === 0) return;
  const current = splitClass(dom.getAttribute(el, "class"));
  const next = current.filter((c) => !classes.includes(c));
  if (next.length !== current.length) {
    if (next.length === 0) dom.removeAttribute(el, "class");
    else dom.setAttribute(el, "class", next.join(" "));
  }
}
function startRun(dom, el, active, from, to, duration, onDone) {
  const h = host();
  let finished = false;
  let timer = null;
  const onEvent = (e) => {
    if (e.target !== el) return;
    finish();
  };
  const detach = () => {
    dom.removeEventListener(el, "transitionend", onEvent);
    dom.removeEventListener(el, "animationend", onEvent);
    if (timer !== null) {
      h.clearTimeout(timer);
      timer = null;
    }
  };
  const finish = () => {
    if (finished) return;
    finished = true;
    detach();
    removeClasses(dom, el, active);
    removeClasses(dom, el, to);
    removeClasses(dom, el, from);
    onDone();
  };
  addClasses(dom, el, from);
  addClasses(dom, el, active);
  dom.addEventListener(el, "transitionend", onEvent);
  dom.addEventListener(el, "animationend", onEvent);
  timer = h.setTimeout(finish, duration);
  nextFrame(() => {
    if (finished) return;
    removeClasses(dom, el, from);
    addClasses(dom, el, to);
  });
  return {
    cancel: () => {
      if (finished) return;
      finished = true;
      detach();
      removeClasses(dom, el, active);
      removeClasses(dom, el, to);
      removeClasses(dom, el, from);
    }
  };
}
function runElementTransition(dom, el, rt, phase, onDone) {
  if (dom.body() === null || !dom.isElement(el)) {
    onDone();
    return { cancel: () => {
    } };
  }
  const active = phase === "enter" ? rt.enterActive : rt.leaveActive;
  const from = phase === "enter" ? rt.enterFrom : rt.leaveFrom;
  const to = phase === "enter" ? rt.enterTo : rt.leaveTo;
  return startRun(dom, el, active, from, to, rt.duration, onDone);
}
var TransitionController = class {
  constructor(dom, graph, finalize) {
    this.dom = dom;
    this.graph = graph;
    this.finalize = finalize;
  }
  leaving = /* @__PURE__ */ new Map();
  /** True only in a real DOM environment (browser). */
  get browser() {
    return this.dom.body() !== null;
  }
  keyOf(inst) {
    return inst.graphNode.key ?? inst.graphNode.id;
  }
  resolved(node) {
    return getResolvedTransition(this.graph, node.id);
  }
  /** Run the enter animation for `inst` if it carries a transition (browser only). */
  enter(inst) {
    if (!this.browser) return;
    const rt = this.resolved(inst.graphNode);
    if (rt === void 0) return;
    const el = inst.domNode;
    if (!this.dom.isElement(el)) return;
    startRun(this.dom, el, rt.enterActive, rt.enterFrom, rt.enterTo, rt.duration, () => {
    });
  }
  /**
   * Play `appear` for any initial child that opted into it (fresh browser mount
   * only — hydration must never animate appear, §22, and this is called only on
   * the mount path).
   */
  appear(children) {
    if (!this.browser) return;
    for (const child of children) {
      const rt = this.resolved(child.graphNode);
      if (rt !== void 0 && rt.appear) this.enter(child);
    }
  }
  hooks() {
    return {
      takeLeaving: (key) => {
        const entry = this.leaving.get(key);
        if (entry === void 0) return void 0;
        entry.run.cancel();
        this.leaving.delete(key);
        return entry.inst;
      },
      beginLeave: (inst) => {
        if (!this.browser) return false;
        const rt = this.resolved(inst.graphNode);
        if (rt === void 0) return false;
        const el = inst.domNode;
        if (!this.dom.isElement(el)) return false;
        const key = this.keyOf(inst);
        const prior = this.leaving.get(key);
        if (prior !== void 0) prior.run.cancel();
        const run = startRun(
          this.dom,
          el,
          rt.leaveActive,
          rt.leaveFrom,
          rt.leaveTo,
          rt.duration,
          () => {
            const current = this.leaving.get(key);
            if (current !== void 0 && current.run === run) {
              this.leaving.delete(key);
              this.finalize(inst);
            }
          }
        );
        this.leaving.set(key, { inst, run });
        return true;
      },
      onEnter: (inst) => this.enter(inst)
    };
  }
};

// src/head.ts
var import_dom = require("@streetui/dom");
var HEAD_MARKER = "data-streetui-head";
var HEAD_KEY = "data-streetui-head-key";
function isSignalLike(v) {
  return v !== null && typeof v === "object" && typeof v["subscribe"] === "function" && typeof v["peek"] === "function";
}
function readValue(v) {
  if (isSignalLike(v)) return String(v.peek() ?? "");
  return String(v ?? "");
}
function resolveEntry(entry) {
  const attrs = {};
  for (const key of Object.keys(entry.attrs)) {
    attrs[key] = readValue(entry.attrs[key]);
  }
  const resolved = { tag: entry.tag, attrs };
  if (entry.tag === "title") {
    return { ...resolved, text: readValue(entry.text) };
  }
  return resolved;
}
var HeadManager = class {
  _dom;
  _head;
  _contributions = /* @__PURE__ */ new Map();
  _applied = /* @__PURE__ */ new Map();
  _order = 0;
  _adopted = false;
  constructor(dom, head) {
    this._dom = dom;
    this._head = head;
  }
  /** Register (or replace) a node's contribution and re-apply the merged result. */
  register(nodeId, entries) {
    this._contributions.set(nodeId, { order: this._order++, entries });
    this.apply();
  }
  /** Withdraw a node's contribution (unmount / route change) and re-apply. */
  unregister(nodeId) {
    if (this._contributions.delete(nodeId)) this.apply();
  }
  /** Recompute the merged head and patch `document.head` to match. */
  apply() {
    if (!this._adopted) {
      this._adoptServerTags();
      this._adopted = true;
    }
    const ordered = [...this._contributions.values()].sort((a, b) => a.order - b.order);
    const merged = /* @__PURE__ */ new Map();
    for (const contribution of ordered) {
      for (const entry of contribution.entries) {
        merged.set(entry.dedupKey, resolveEntry(entry));
      }
    }
    for (const [key, desired] of merged) {
      const existing = this._applied.get(key);
      if (existing !== void 0 && existing.tag === desired.tag) {
        this._reconcileAttrs(existing, desired);
      } else {
        if (existing !== void 0) {
          this._dom.removeChild(this._head, existing.el);
          this._applied.delete(key);
        }
        const el = this._createTag(key, desired);
        this._dom.appendChild(this._head, el);
        this._applied.set(key, { el, attrKeys: new Set(Object.keys(desired.attrs)), tag: desired.tag });
      }
    }
    for (const [key, record] of [...this._applied]) {
      if (!merged.has(key)) {
        this._dom.removeChild(this._head, record.el);
        this._applied.delete(key);
      }
    }
  }
  _createTag(key, desired) {
    const el = this._dom.createElement(desired.tag);
    this._dom.setAttribute(el, HEAD_MARKER, "");
    this._dom.setAttribute(el, HEAD_KEY, key);
    for (const attr of Object.keys(desired.attrs)) {
      this._dom.setAttribute(el, attr, desired.attrs[attr]);
    }
    if (desired.tag === "title") this._dom.setTextContent(el, desired.text ?? "");
    return el;
  }
  _reconcileAttrs(record, desired) {
    const nextKeys = new Set(Object.keys(desired.attrs));
    for (const attr of record.attrKeys) {
      if (!nextKeys.has(attr)) this._dom.removeAttribute(record.el, attr);
    }
    for (const attr of nextKeys) {
      this._dom.setAttribute(record.el, attr, desired.attrs[attr]);
    }
    if (desired.tag === "title") this._dom.setTextContent(record.el, desired.text ?? "");
    record.attrKeys = nextKeys;
  }
  /**
   * Seed `_applied` from server-emitted `[data-streetui-head-key]` tags already
   * in `document.head`. The subsequent diff reuses these elements when the
   * client desires the same key (no duplicate), rewrites them if the value
   * changed, or removes them if the client graph no longer wants them.
   */
  _adoptServerTags() {
    for (const child of this._dom.childNodes(this._head)) {
      if (!this._dom.isElement(child)) continue;
      const el = child;
      const key = this._dom.getAttribute(el, HEAD_KEY);
      if (key === null) continue;
      this._applied.set(key, {
        el,
        attrKeys: new Set(this._attrNames(el)),
        tag: this._dom.tagName(el)
      });
    }
  }
  /** The framework-managed attribute names currently on a server tag. */
  _attrNames(el) {
    const names = [];
    if (this._dom.getAttribute(el, HEAD_MARKER) !== null) names.push(HEAD_MARKER);
    if (this._dom.getAttribute(el, HEAD_KEY) !== null) names.push(HEAD_KEY);
    return names;
  }
};
function getHeadManager(ctx) {
  const head = ctx.dom.head();
  if (head === null) return null;
  const mutable = ctx;
  if (mutable.head === void 0) mutable.head = new HeadManager(ctx.dom, head);
  return mutable.head;
}
function wireHeadBehavior(ctx, graphNode, instance) {
  const manager = getHeadManager(ctx);
  if (manager === null) return;
  const descFn = ctx.graph.getHandler(`__head__${graphNode.id}`);
  if (descFn === void 0) return;
  const contribution = descFn();
  const nodeId = graphNode.id;
  manager.register(nodeId, contribution.entries);
  for (const entry of contribution.entries) {
    for (const attrKey of Object.keys(entry.attrs)) {
      const v = entry.attrs[attrKey];
      if (isSignalLike(v)) {
        instance.trackCleanup(v.subscribe(() => manager.apply()));
      }
    }
    if (isSignalLike(entry.text)) {
      instance.trackCleanup(entry.text.subscribe(() => manager.apply()));
    }
  }
  instance.trackCleanup(() => manager.unregister(nodeId));
}
function renderHead(compiled) {
  const graph = compiled.graph;
  const merged = /* @__PURE__ */ new Map();
  graph.walk((node) => {
    if (node.type !== "head") return;
    const descFn = graph.getHandler(`__head__${node.id}`);
    if (descFn === void 0) return;
    for (const entry of descFn().entries) {
      merged.set(entry.dedupKey, resolveEntry(entry));
    }
  });
  if (merged.size === 0) return "";
  const dom = new import_dom.ServerDOMAdapter();
  let out = "";
  for (const [key, desired] of merged) {
    const el = dom.createElement(desired.tag);
    dom.setAttribute(el, HEAD_MARKER, "");
    dom.setAttribute(el, HEAD_KEY, key);
    for (const attr of Object.keys(desired.attrs)) {
      dom.setAttribute(el, attr, desired.attrs[attr]);
    }
    if (desired.tag === "title") dom.setTextContent(el, desired.text ?? "");
    out += dom.serializeOuter(el);
  }
  return out;
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
  const staticHTML = ctx.staticHTML;
  if (staticHTML !== void 0 && dom.createRawHTML !== void 0) {
    const precomputed = staticHTML.get(graphNode.id);
    if (precomputed !== void 0) {
      const raw = dom.createRawHTML(precomputed);
      dom.appendChild(parentDom, raw);
      const instance2 = new NodeInstance(graphNode, raw);
      ctx.instances.set(graphNode.id, instance2);
      return instance2;
    }
  }
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
    const instance2 = new NodeInstance(graphNode, el2);
    ctx.instances.set(graphNode.id, instance2);
    wireEvents(dom, graph, graphNode, el2, instance2);
    if (graphNode.stateRefs.length !== 0) {
      wireSignalBindings(ctx, graphNode, instance2, textUpdate(dom, el2, textNode));
    }
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
    if (graphNode.stateRefs.length !== 0) {
      wireSignalBindings(ctx, graphNode, instance2, headingUpdate(dom, el2));
    }
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
    if (graphNode.stateRefs.length !== 0) {
      wireSignalBindings(ctx, graphNode, instance2, inputUpdate(dom, el2));
    }
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
    if (graphNode.stateRefs.length !== 0) {
      wireSignalBindings(ctx, graphNode, instance2, linkUpdate(dom, el2));
    }
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
    if (graphNode.stateRefs.length !== 0) {
      wireSignalBindings(ctx, graphNode, instance2, buttonUpdate(dom, el2));
    }
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
    wireReactiveList(ctx, graphNode, instance2, el2, true);
    return instance2;
  }
  if (graphNode.type === "portal") {
    const anchor = dom.createElement(resolveTag("portal"));
    dom.setAttribute(anchor, "data-streetui-portal", "");
    applyNodeProps(ctx, graphNode, anchor);
    const instance2 = new NodeInstance(graphNode, anchor);
    ctx.instances.set(graphNode.id, instance2);
    const body = dom.body();
    let target = anchor;
    if (body !== null) {
      const portalContainer = dom.createElement("div");
      dom.setAttribute(portalContainer, "data-streetui-portal-container", "");
      dom.appendChild(body, portalContainer);
      instance2.trackCleanup(() => dom.removeChild(body, portalContainer));
      target = portalContainer;
    }
    for (const child of graphNode.children) {
      instance2.addChild(mountNode(ctx, child, target));
    }
    dom.appendChild(parentDom, anchor);
    wireOverlayBehavior(ctx, graphNode, instance2, target);
    return instance2;
  }
  if (graphNode.type === "head") {
    const anchor = dom.createElement(resolveTag("head"));
    dom.setAttribute(anchor, "data-streetui-head-anchor", "");
    applyNodeProps(ctx, graphNode, anchor);
    const instance2 = new NodeInstance(graphNode, anchor);
    ctx.instances.set(graphNode.id, instance2);
    dom.appendChild(parentDom, anchor);
    wireHeadBehavior(ctx, graphNode, instance2);
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
  const instance = new NodeInstance(graphNode, el);
  ctx.instances.set(graphNode.id, instance);
  if (graphNode.type === "form") {
    wireEvents(dom, graph, graphNode, el, instance);
  }
  for (const child of graphNode.children) {
    const childInstance = mountNode(ctx, child, el);
    instance.addChild(childInstance);
  }
  dom.appendChild(parentDom, el);
  if (graphNode.type === "component") wireComponentBehavior(ctx, graphNode, instance);
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
function linkUpdate(dom, el) {
  return (propKey, value) => {
    if (propKey === "label") {
      dom.setTextContent(el, String(value ?? ""));
    } else if (propKey === "href") {
      dom.setAttribute(el, "href", String(value ?? ""));
    } else {
      applyProp(dom, el, propKey, value);
    }
  };
}
function applyNodeProps(ctx, graphNode, el) {
  const props = graphNode.props;
  for (const key in props) {
    if (!Object.hasOwn(props, key)) continue;
    if (SKIP_PROP_KEYS.has(key)) continue;
    applyProp(ctx.dom, el, key, props[key]);
  }
}
function wireSignalBindings(ctx, graphNode, instance, onUpdate) {
  if (graphNode.stateRefs.length === 0) return;
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
function wireReactiveList(ctx, graphNode, instance, el, runAppear = false) {
  const plan = ctx.graph.getHandler(`__listplan__${graphNode.id}`);
  const build = ctx.graph.getHandler(`__listbuild__${graphNode.id}`);
  if (plan === void 0 && build === void 0) return;
  const controller = new TransitionController(ctx.dom, ctx.graph, (leaving) => {
    const parent = ctx.dom.parentNode(leaving.domNode);
    if (parent !== null) ctx.dom.removeChild(parent, leaving.domNode);
    leaving.dispose();
    forgetInstance(ctx, leaving);
    ctx.graph.detachNode(leaving.graphNode);
  });
  const hooks = controller.hooks();
  if (runAppear) controller.appear(instance.children);
  for (const stateRef of graphNode.stateRefs) {
    if (stateRef.propKey !== "items") continue;
    const sig = ctx.graph.getHandler(`__signal__${stateRef.signalId}`);
    if (sig === void 0 || typeof sig.subscribe !== "function") continue;
    const unsub = sig.subscribe((value) => {
      if (plan !== void 0) {
        reconcileReactiveListByPlan(ctx, graphNode, instance, el, plan(value), hooks);
      } else {
        reconcileReactiveList(ctx, graphNode, instance, el, build(value), hooks);
      }
    });
    instance.trackCleanup(unsub);
  }
}
function reconcileReactiveListByPlan(ctx, listNode, listInstance, listEl, plan, hooks) {
  const oldInstances = [...listInstance.children];
  const result = reconcileChildrenByPlan(
    ctx,
    listEl,
    oldInstances,
    plan,
    (node, parent) => mountNode(ctx, node, parent),
    hooks
  );
  listInstance.children.length = 0;
  for (const inst of result.instances) listInstance.children.push(inst);
  for (const removed of result.removed) {
    forgetInstance(ctx, removed);
    ctx.graph.detachNode(removed.graphNode);
  }
  const adopted = new Set(result.instances.map((i) => i.graphNode));
  for (const node of result.built ?? []) {
    if (!adopted.has(node)) ctx.graph.detachNode(node);
  }
  for (const child of [...listNode.children]) listNode.removeChild(child);
  for (const inst of result.instances) listNode.appendChild(inst.graphNode);
}
function reconcileReactiveList(ctx, listNode, listInstance, listEl, newNodes, hooks) {
  const oldInstances = [...listInstance.children];
  const result = reconcileChildren(
    ctx,
    listEl,
    oldInstances,
    newNodes,
    (node, parent) => mountNode(ctx, node, parent),
    hooks
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
function wireOverlayBehavior(ctx, graphNode, instance, target) {
  const { dom, graph } = ctx;
  if (dom.body() === null) return;
  const descFn = graph.getHandler(`__overlay__${graphNode.id}`);
  if (descFn === void 0) return;
  const desc = descFn();
  const openSig = desc.open;
  if (openSig === void 0 || typeof openSig.subscribe !== "function") return;
  let active = [];
  let saved = null;
  const teardown = () => {
    for (const fn of active) fn();
    active = [];
  };
  const onOpenChange = (isOpen) => {
    if (isOpen) {
      if (desc.restoreFocus) saved = (0, import_dom2.saveFocus)(dom);
      if (desc.modal) {
        active.push((0, import_dom2.trapFocus)(dom, target));
        active.push((0, import_dom2.containFocus)(dom, target));
      }
      if (desc.menu) {
        active.push((0, import_dom2.rovingMenu)(dom, target));
      }
      if (desc.takesFocus) (0, import_dom2.focusInitial)(dom, target, desc.initialFocusId);
      if (desc.closeOnEscape && desc.onClose !== void 0) {
        active.push((0, import_dom2.onEscape)(dom, target, desc.onClose));
      }
    } else {
      teardown();
      if (desc.restoreFocus && saved !== null) {
        (0, import_dom2.restoreFocus)(dom, saved);
        saved = null;
      }
    }
  };
  const unsub = openSig.subscribe(onOpenChange);
  instance.trackCleanup(unsub);
  instance.trackCleanup(teardown);
  if (openSig.peek() === true) onOpenChange(true);
}
function wireComponentBehavior(ctx, graphNode, instance) {
  const fn = ctx.graph.getHandler(`__component__${graphNode.id}`);
  if (fn === void 0) return;
  for (const cleanup of fn()) instance.trackCleanup(cleanup);
}

// src/renderer.ts
var import_dom3 = require("@streetui/dom");

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
      if (graphNode.stateRefs.length !== 0) {
        wireSignalBindings(ctx, graphNode, instance, textUpdate(dom, domNode, textNode));
      }
      return instance;
    }
    case "heading": {
      const instance = new NodeInstance(graphNode, domNode);
      ctx.instances.set(graphNode.id, instance);
      wireEvents(dom, graph, graphNode, domNode, instance);
      if (graphNode.stateRefs.length !== 0) {
        wireSignalBindings(ctx, graphNode, instance, headingUpdate(dom, domNode));
      }
      return instance;
    }
    case "input": {
      const instance = new NodeInstance(graphNode, domNode);
      ctx.instances.set(graphNode.id, instance);
      const value = graphNode.getProp("value");
      if (value !== void 0) dom.setProperty(domNode, "value", String(value));
      wireEvents(dom, graph, graphNode, domNode, instance);
      if (graphNode.stateRefs.length !== 0) {
        wireSignalBindings(ctx, graphNode, instance, inputUpdate(dom, domNode));
      }
      return instance;
    }
    case "button": {
      const instance = new NodeInstance(graphNode, domNode);
      ctx.instances.set(graphNode.id, instance);
      wireEvents(dom, graph, graphNode, domNode, instance);
      if (graphNode.stateRefs.length !== 0) {
        wireSignalBindings(ctx, graphNode, instance, buttonUpdate(dom, domNode));
      }
      return instance;
    }
    case "image":
    case "link": {
      const instance = new NodeInstance(graphNode, domNode);
      ctx.instances.set(graphNode.id, instance);
      if (graphNode.type === "link") {
        wireEvents(dom, graph, graphNode, domNode, instance);
        if (graphNode.stateRefs.length !== 0) {
          wireSignalBindings(ctx, graphNode, instance, linkUpdate(dom, domNode));
        }
      }
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
    case "portal": {
      const instance = new NodeInstance(graphNode, domNode);
      ctx.instances.set(graphNode.id, instance);
      const body = dom.body();
      let target = domNode;
      if (body !== null) {
        const portalContainer = dom.createElement("div");
        dom.setAttribute(portalContainer, "data-streetui-portal-container", "");
        for (const child of dom.childNodes(domNode)) {
          dom.appendChild(portalContainer, child);
        }
        dom.appendChild(body, portalContainer);
        instance.trackCleanup(() => dom.removeChild(body, portalContainer));
        target = portalContainer;
      }
      hydrateChildren(ctx, graphNode, instance, target, path);
      wireOverlayBehavior(ctx, graphNode, instance, target);
      return instance;
    }
    case "head": {
      const instance = new NodeInstance(graphNode, domNode);
      ctx.instances.set(graphNode.id, instance);
      wireHeadBehavior(ctx, graphNode, instance);
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
      if (graphNode.type === "component") wireComponentBehavior(ctx, graphNode, instance);
      return instance;
    }
  }
}
function hydrateChildren(ctx, parentGraphNode, parentInstance, parentDom, parentPath) {
  const expected = parentGraphNode.children;
  const actual = elementChildren(ctx, parentDom);
  let cursor = 0;
  const diag = ctx.hydrationDiagnostics !== void 0;
  for (let i = 0; i < expected.length; i++) {
    const childNode = expected[i];
    const want = expectedTag(ctx, childNode);
    const childPath = diag ? `${parentPath} / ${childNode.type}[${i}]` : parentPath;
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
    this._dom = options.domAdapter ?? new import_dom3.BrowserDOMAdapter();
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
var import_dom5 = require("@streetui/dom");

// src/static-ssr-plan.ts
var import_diagnostics = require("@streetui/compiler/diagnostics");
var import_dom4 = require("@streetui/dom");
function collectMaximalStaticRoots(graph) {
  const analysis = (0, import_diagnostics.analyzeGraph)(graph);
  const roots = [];
  const walk = (node) => {
    if (node.type !== "application") {
      const a = analysis.nodes.get(node.id);
      if (a !== void 0 && a.isStaticSubtree) {
        roots.push(node);
        return;
      }
    }
    for (const child of node.children) walk(child);
  };
  walk(graph.root);
  return roots;
}
function serializeStaticSubtree(dom, graph, root) {
  const container = dom.createElement("div");
  const ctx = createRenderContext(dom, graph, container);
  const instance = mountNode(ctx, root, container);
  const html = dom.serializeInner(container);
  instance.dispose();
  ctx.instances.clear();
  return html;
}
function buildStaticSSRPlan(compiled) {
  const graph = compiled.graph;
  const roots = collectMaximalStaticRoots(graph);
  const plan = /* @__PURE__ */ new Map();
  if (roots.length === 0) return plan;
  const dom = new import_dom4.ServerDOMAdapter();
  for (const root of roots) {
    plan.set(root.id, serializeStaticSubtree(dom, graph, root));
  }
  return plan;
}
var PLAN_CACHE = /* @__PURE__ */ new WeakMap();
function getStaticSSRPlan(compiled) {
  let plan = PLAN_CACHE.get(compiled);
  if (plan === void 0) {
    plan = buildStaticSSRPlan(compiled);
    PLAN_CACHE.set(compiled, plan);
  }
  return plan;
}

// src/ssr.ts
function renderToString(compiled, options = {}) {
  const dom = options.domAdapter ?? new import_dom5.ServerDOMAdapter();
  const plan = options.staticPlan === null ? void 0 : options.staticPlan ?? getStaticSSRPlan(compiled);
  const staticHTML = plan !== void 0 && plan.size > 0 ? plan : void 0;
  const container = dom.createElement("div");
  const ctx = createRenderContext(dom, compiled.graph, container, void 0, staticHTML);
  const rootInstance = mountGraph(ctx);
  const html = dom.serializeInner(container);
  rootInstance.dispose();
  ctx.instances.clear();
  return html;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  HeadManager,
  NodeInstance,
  STATE_MARKER_ATTR,
  StreetRenderHandle,
  StreetRendererImpl,
  TransitionController,
  applyNodeProps,
  applyProp,
  buttonUpdate,
  consoleHydrationDiagnosticSink,
  createHydrationDiagnosticCollector,
  createRenderContext,
  createRenderer,
  formatHydrationDiagnostic,
  getResolvedTransition,
  headingUpdate,
  hydrateGraph,
  inputUpdate,
  linkUpdate,
  mountGraph,
  mountNode,
  patchNode,
  patchProp,
  readState,
  reconcileChildren,
  reconcileChildrenByPlan,
  renderHead,
  renderToString,
  resolveTag,
  runElementTransition,
  serializeState,
  textUpdate,
  wireComponentBehavior,
  wireEvents,
  wireHeadBehavior,
  wireOverlayBehavior,
  wireReactiveList,
  wireSignalBindings
});
//# sourceMappingURL=index.cjs.map