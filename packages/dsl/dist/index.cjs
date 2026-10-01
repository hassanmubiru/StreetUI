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

// packages/dsl/src/index.ts
var index_exports = {};
__export(index_exports, {
  AppBuilder: () => AppBuilder,
  ContainerBuilderImpl: () => ContainerBuilderImpl,
  FormBuilderImpl: () => FormBuilderImpl,
  ListBuilderImpl: () => ListBuilderImpl,
  PageBuilderImpl: () => PageBuilderImpl,
  SectionBuilderImpl: () => SectionBuilderImpl,
  StreetApp: () => StreetApp,
  component: () => component,
  isComponentDefinition: () => isComponentDefinition,
  isHeadContribution: () => isHeadContribution,
  isTransitionConfig: () => isTransitionConfig,
  reactiveListItemKey: () => reactiveListItemKey,
  reactiveListItemSignature: () => reactiveListItemSignature,
  resolveHead: () => resolveHead,
  resolveTransition: () => resolveTransition,
  streetui: () => streetui
});
module.exports = __toCommonJS(index_exports);

// packages/dsl/src/transition.ts
function classes(value) {
  if (value === void 0) return [];
  const out = [];
  for (const token of value.split(/\s+/)) {
    if (token.length > 0 && !out.includes(token)) out.push(token);
  }
  return out;
}
function merge(a, b) {
  const out = [...a];
  for (const token of b) if (!out.includes(token)) out.push(token);
  return out;
}
function resolveTransition(config) {
  const n = config.name;
  const enterActive = merge(
    classes(config.enter),
    classes(config.enterActive ?? (n !== void 0 ? `${n}-enter-active` : void 0))
  );
  const leaveActive = merge(
    classes(config.leave),
    classes(config.leaveActive ?? (n !== void 0 ? `${n}-leave-active` : void 0))
  );
  return {
    enterActive,
    enterFrom: classes(config.enterFrom ?? (n !== void 0 ? `${n}-enter-from` : void 0)),
    enterTo: classes(config.enterTo ?? (n !== void 0 ? `${n}-enter-to` : void 0)),
    leaveActive,
    leaveFrom: classes(config.leaveFrom ?? (n !== void 0 ? `${n}-leave-from` : void 0)),
    leaveTo: classes(config.leaveTo ?? (n !== void 0 ? `${n}-leave-to` : void 0)),
    appear: config.appear ?? false,
    duration: config.duration ?? 1e3
  };
}
function isTransitionConfig(value) {
  if (value === null || typeof value !== "object") return false;
  const o = value;
  return typeof o["name"] === "string" || typeof o["enter"] === "string" || typeof o["enterActive"] === "string" || typeof o["enterFrom"] === "string" || typeof o["leave"] === "string" || typeof o["leaveActive"] === "string" || typeof o["leaveFrom"] === "string";
}

// packages/dsl/src/head.ts
function metaDedupKey(m) {
  if (m.charset !== void 0) return "meta:charset";
  if (m.name !== void 0) return `meta:name=${m.name}`;
  if (m.property !== void 0) return `meta:property=${m.property}`;
  if (m.httpEquiv !== void 0) return `meta:http-equiv=${m.httpEquiv}`;
  return void 0;
}
function metaAttrs(m) {
  const attrs = {};
  if (m.charset !== void 0) attrs["charset"] = m.charset;
  if (m.name !== void 0) attrs["name"] = m.name;
  if (m.property !== void 0) attrs["property"] = m.property;
  if (m.httpEquiv !== void 0) attrs["http-equiv"] = m.httpEquiv;
  if (m.content !== void 0) attrs["content"] = m.content;
  return attrs;
}
function linkAttrs(l) {
  const attrs = { rel: l.rel, href: l.href };
  if (l.sizes !== void 0) attrs["sizes"] = l.sizes;
  if (l.type !== void 0) attrs["type"] = l.type;
  if (l.media !== void 0) attrs["media"] = l.media;
  if (l.as !== void 0) attrs["as"] = l.as;
  if (l.crossorigin !== void 0) attrs["crossorigin"] = l.crossorigin;
  if (l.hreflang !== void 0) attrs["hreflang"] = l.hreflang;
  return attrs;
}
function resolveHead(config) {
  const entries = [];
  if (config.charset !== void 0) {
    entries.push({ tag: "meta", dedupKey: "meta:charset", attrs: { charset: config.charset } });
  }
  if (config.base !== void 0) {
    entries.push({ tag: "base", dedupKey: "base", attrs: { href: config.base } });
  }
  if (config.title !== void 0) {
    entries.push({ tag: "title", dedupKey: "title", attrs: {}, text: config.title });
  }
  if (config.description !== void 0) {
    entries.push({
      tag: "meta",
      dedupKey: "meta:name=description",
      attrs: { name: "description", content: config.description }
    });
  }
  if (config.canonical !== void 0) {
    entries.push({
      tag: "link",
      dedupKey: "link:rel=canonical",
      attrs: { rel: "canonical", href: config.canonical }
    });
  }
  if (config.robots !== void 0) {
    entries.push({
      tag: "meta",
      dedupKey: "meta:name=robots",
      attrs: { name: "robots", content: config.robots }
    });
  }
  if (config.themeColor !== void 0) {
    entries.push({
      tag: "meta",
      dedupKey: "meta:name=theme-color",
      attrs: { name: "theme-color", content: config.themeColor }
    });
  }
  if (config.viewport !== void 0) {
    entries.push({
      tag: "meta",
      dedupKey: "meta:name=viewport",
      attrs: { name: "viewport", content: config.viewport }
    });
  }
  if (config.favicon !== void 0) {
    const l = typeof config.favicon === "string" ? { rel: "icon", href: config.favicon } : config.favicon;
    entries.push({ tag: "link", dedupKey: `link:rel=${l.rel}`, attrs: linkAttrs(l) });
  }
  if (config.openGraph !== void 0) {
    for (const key of Object.keys(config.openGraph)) {
      const property = `og:${key}`;
      entries.push({
        tag: "meta",
        dedupKey: `meta:property=${property}`,
        attrs: { property, content: config.openGraph[key] }
      });
    }
  }
  if (config.twitter !== void 0) {
    for (const key of Object.keys(config.twitter)) {
      const name = `twitter:${key}`;
      entries.push({
        tag: "meta",
        dedupKey: `meta:name=${name}`,
        attrs: { name, content: config.twitter[key] }
      });
    }
  }
  if (config.meta !== void 0) {
    for (const m of config.meta) {
      const key = metaDedupKey(m);
      if (key === void 0) continue;
      entries.push({ tag: "meta", dedupKey: key, attrs: metaAttrs(m) });
    }
  }
  if (config.link !== void 0) {
    for (const l of config.link) {
      entries.push({ tag: "link", dedupKey: `link:rel=${l.rel}:href=${l.href}`, attrs: linkAttrs(l) });
    }
  }
  return { entries };
}
function isHeadContribution(value) {
  return value !== null && typeof value === "object" && Array.isArray(value["entries"]);
}

// packages/dsl/src/builders.ts
var import_state = require("@streetui/state");
function isSignal(v) {
  return v !== null && typeof v === "object" && typeof v["get"] === "function" && typeof v["subscribe"] === "function";
}
function bindValue(graph, node, propKey, value) {
  if (isSignal(value)) {
    const signalId = `${node.id}:${propKey}`;
    node.stateRefs.push({ signalId, propKey });
    graph.registerHandler(`__signal__${signalId}`, value);
    return value.peek();
  }
  return value;
}
function applyA11yProps(props, options) {
  if (options.role !== void 0) props["role"] = options.role;
  if (options.tabIndex !== void 0) props["tabindex"] = String(options.tabIndex);
  if (options.ariaLabel !== void 0) props["aria-label"] = options.ariaLabel;
  if (options.ariaLabelledBy !== void 0) props["aria-labelledby"] = options.ariaLabelledBy;
  if (options.ariaDescribedBy !== void 0) props["aria-describedby"] = options.ariaDescribedBy;
  if (options.ariaExpanded !== void 0) props["aria-expanded"] = String(options.ariaExpanded);
  if (options.ariaControls !== void 0) props["aria-controls"] = options.ariaControls;
  if (options.ariaHidden !== void 0) props["aria-hidden"] = String(options.ariaHidden);
  if (options.ariaLive !== void 0) props["aria-live"] = options.ariaLive;
  if (options.ariaCurrent !== void 0) props["aria-current"] = String(options.ariaCurrent);
  if (options.ariaInvalid !== void 0) props["aria-invalid"] = String(options.ariaInvalid);
  if (options.ariaRequired !== void 0) props["aria-required"] = String(options.ariaRequired);
  if (options.ariaModal !== void 0) props["aria-modal"] = String(options.ariaModal);
  if (options.ariaOwns !== void 0) props["aria-owns"] = options.ariaOwns;
  if (options.ariaActiveDescendant !== void 0) props["aria-activedescendant"] = options.ariaActiveDescendant;
  if (options.ariaHasPopup !== void 0) props["aria-haspopup"] = String(options.ariaHasPopup);
  if (options.ariaSelected !== void 0) props["aria-selected"] = String(options.ariaSelected);
}
function registerTransition(graph, node, config) {
  if (config === void 0) return;
  const resolved = resolveTransition(config);
  graph.registerHandler(
    `__transition__${node.id}`,
    () => resolved
  );
}
function containerProps(options) {
  const props = {};
  if (options.class !== void 0) props["class"] = options.class;
  if (options.id !== void 0) props["id"] = options.id;
  if (options.key !== void 0) props["key"] = options.key;
  applyA11yProps(props, options);
  return props;
}
function itemIdentity(item, index) {
  if (item !== null && typeof item === "object") {
    const obj = item;
    if ("id" in obj) return `id:${String(obj["id"])}`;
    if ("key" in obj) return `key:${String(obj["key"])}`;
    return `idx:${index}`;
  }
  return `val:${String(item)}`;
}
function itemValueSignature(item) {
  try {
    return JSON.stringify(item) ?? String(item);
  } catch {
    return String(item);
  }
}
function reactiveListItemSignature(item) {
  return itemValueSignature(item);
}
function reactiveListItemKey(item, index) {
  return itemIdentity(item, index);
}
var OVERLAY_KINDS = {
  dialog: {
    role: "dialog",
    modal: true,
    takesFocus: true,
    ariaModal: true,
    defaultCloseOnEscape: true,
    defaultRestoreFocus: true
  },
  popover: {
    role: "dialog",
    modal: false,
    takesFocus: true,
    ariaModal: false,
    defaultCloseOnEscape: true,
    defaultRestoreFocus: true
  },
  tooltip: {
    role: "tooltip",
    modal: false,
    takesFocus: false,
    ariaModal: false,
    defaultCloseOnEscape: false,
    defaultRestoreFocus: false
  },
  dropdown: {
    role: "menu",
    modal: false,
    takesFocus: true,
    menu: true,
    ariaModal: false,
    defaultCloseOnEscape: true,
    defaultRestoreFocus: true
  },
  toast: {
    role: "status",
    modal: false,
    takesFocus: false,
    ariaModal: false,
    ariaLive: "polite",
    defaultCloseOnEscape: false,
    defaultRestoreFocus: false
  }
};
var ContentBuilderBase = class {
  constructor(_node, _graph) {
    this._node = _node;
    this._graph = _graph;
  }
  heading(text, options = {}) {
    const props = { level: options.level ?? 1 };
    if (options.class !== void 0) props["class"] = options.class;
    if (options.id !== void 0) props["id"] = options.id;
    applyA11yProps(props, options);
    const node = this._graph.createNode("heading", { parent: this._node, props });
    const resolved = bindValue(this._graph, node, "text", text);
    node.setProp("text", resolved);
  }
  text(content, options = {}) {
    const props = {};
    if (options.class !== void 0) props["class"] = options.class;
    if (options.id !== void 0) props["id"] = options.id;
    applyA11yProps(props, options);
    const node = this._graph.createNode("text", { parent: this._node, props });
    const resolved = bindValue(this._graph, node, "text", content);
    node.setProp("text", resolved);
  }
  button(label, options = {}) {
    const props = {};
    if (options.class !== void 0) props["class"] = options.class;
    if (options.id !== void 0) props["id"] = options.id;
    applyA11yProps(props, options);
    const node = this._graph.createNode("button", { parent: this._node, props });
    const resolved = bindValue(this._graph, node, "label", label);
    node.setProp("label", resolved);
    if (options.disabled !== void 0) {
      const resolvedDisabled = bindValue(this._graph, node, "disabled", options.disabled);
      node.setProp("disabled", resolvedDisabled);
    }
    if (options.onClick !== void 0) {
      const handlerKey = `click:${node.id}`;
      this._graph.registerHandler(handlerKey, options.onClick);
      node.addEvent({ type: "click", handlerKey });
    }
  }
  input(options = {}) {
    const props = {};
    props["inputType"] = options.type ?? "text";
    if (options.placeholder !== void 0) props["placeholder"] = options.placeholder;
    if (options.class !== void 0) props["class"] = options.class;
    if (options.id !== void 0) props["id"] = options.id;
    applyA11yProps(props, options);
    const nodeOpts = {
      props,
      parent: this._node
    };
    if (options.id !== void 0) nodeOpts.key = options.id;
    const node = this._graph.createNode("input", nodeOpts);
    const bindSignal = options.bind;
    const valueBindable = bindSignal !== void 0 ? bindSignal : options.value;
    const inputHandler = bindSignal !== void 0 ? (v) => bindSignal.set(v) : options.onInput;
    if (valueBindable !== void 0) {
      const resolved = bindValue(this._graph, node, "value", valueBindable);
      node.setProp("value", resolved);
    }
    if (options.disabled !== void 0) {
      const resolved = bindValue(this._graph, node, "disabled", options.disabled);
      node.setProp("disabled", resolved);
    }
    if (inputHandler !== void 0) {
      const handlerKey = `input:${node.id}`;
      this._graph.registerHandler(handlerKey, inputHandler);
      node.addEvent({ type: "input", handlerKey });
    }
    if (options.onChange !== void 0) {
      const handlerKey = `change:${node.id}`;
      this._graph.registerHandler(handlerKey, options.onChange);
      node.addEvent({ type: "change", handlerKey });
    }
  }
  image(options) {
    const props = {
      src: options.src,
      alt: options.alt
    };
    if (options.width !== void 0) props["width"] = options.width;
    if (options.height !== void 0) props["height"] = options.height;
    if (options.class !== void 0) props["class"] = options.class;
    if (options.id !== void 0) props["id"] = options.id;
    applyA11yProps(props, options);
    const nodeOpts = {
      props,
      parent: this._node
    };
    if (options.id !== void 0) nodeOpts.key = options.id;
    this._graph.createNode("image", nodeOpts);
  }
  link(label, options) {
    const props = {
      href: options.href,
      external: options.external ?? false
    };
    if (options.class !== void 0) props["class"] = options.class;
    if (options.id !== void 0) props["id"] = options.id;
    applyA11yProps(props, options);
    const node = this._graph.createNode("link", { parent: this._node, props });
    const resolved = bindValue(this._graph, node, "label", label);
    node.setProp("label", resolved);
    if (options.onClick !== void 0) {
      const handlerKey = `click:${node.id}`;
      this._graph.registerHandler(handlerKey, options.onClick);
      node.addEvent({ type: "click", handlerKey });
    }
  }
  code(source, options = {}) {
    const props = {};
    if (options.language !== void 0) props["data-language"] = options.language;
    if (options.class !== void 0) props["class"] = options.class;
    if (options.id !== void 0) props["id"] = options.id;
    applyA11yProps(props, options);
    const node = this._graph.createNode("code", { parent: this._node, props });
    const resolved = bindValue(this._graph, node, "text", source);
    node.setProp("text", resolved);
  }
};
var ContainerBuilderBase = class extends ContentBuilderBase {
  section(key, builder, options = {}) {
    const node = this._graph.createNode("section", {
      key,
      parent: this._node,
      props: containerProps(options)
    });
    registerTransition(this._graph, node, options.transition);
    builder(new SectionBuilderImpl(node, this._graph));
  }
  container(key, builder, options = {}) {
    const node = this._graph.createNode("container", {
      key,
      parent: this._node,
      props: containerProps(options)
    });
    registerTransition(this._graph, node, options.transition);
    builder(new ContainerBuilderImpl(node, this._graph));
  }
  list(key, builder, options = {}) {
    const node = this._graph.createNode("list", {
      key,
      parent: this._node,
      props: containerProps(options)
    });
    registerTransition(this._graph, node, options.transition);
    builder(new ListBuilderImpl(node, this._graph));
  }
  listOf(key, items, renderItem, options = {}) {
    const graph = this._graph;
    const node = graph.createNode("reactive-list", {
      key,
      parent: this._node,
      props: containerProps(options)
    });
    registerTransition(graph, node, options.transition);
    const signalId = `${node.id}:items`;
    node.stateRefs.push({ signalId, propKey: "items" });
    graph.registerHandler(`__signal__${signalId}`, items);
    const buildItem = (item, index) => {
      const itemKey = reactiveListItemKey(item, index);
      const itemNode = graph.createNode("list-item", {
        key: itemKey,
        // `_item` records the source item *reference* so the reconciler can
        // short-circuit unchanged rows by identity (no signature hashing); `_sig`
        // is the content signature used to detect an in-place data change when the
        // reference differs. Both are internal metadata (leading `_`) and never
        // reach the DOM.
        props: {
          key: itemKey,
          _sig: reactiveListItemSignature(item),
          // The item reference is stored as opaque internal metadata (never
          // rendered); cast through `unknown` since `T` is not a `PropValue`.
          _item: item
        }
      });
      renderItem(item, index, new ContainerBuilderImpl(itemNode, graph));
      registerTransition(graph, itemNode, options.itemTransition);
      return itemNode;
    };
    const buildPlan = (raw) => {
      const arr = Array.isArray(raw) ? raw : [];
      const plan = new Array(arr.length);
      for (let i = 0; i < arr.length; i++) {
        const item = arr[i];
        const index = i;
        plan[i] = {
          key: reactiveListItemKey(item, index),
          item,
          sig: () => reactiveListItemSignature(item),
          build: () => buildItem(item, index)
        };
      }
      return plan;
    };
    graph.registerHandler(`__listplan__${node.id}`, buildPlan);
    const current = isSignal(items) ? items.peek() : items;
    const initial = Array.isArray(current) ? current : [];
    initial.forEach((item, i) => {
      node.appendChild(buildItem(item, i));
    });
  }
  form(key, builder, options = {}) {
    const props = containerProps(options);
    const node = this._graph.createNode("form", {
      key,
      parent: this._node,
      props
    });
    registerTransition(this._graph, node, options.transition);
    if (options.onSubmit !== void 0) {
      const handlerKey = `submit:${node.id}`;
      this._graph.registerHandler(handlerKey, options.onSubmit);
      node.addEvent({ type: "submit", handlerKey });
    }
    builder(new FormBuilderImpl(node, this._graph));
  }
  when(condition, builder, elseBuilder, options = {}) {
    const graph = this._graph;
    const node = graph.createNode("conditional", {
      parent: this._node,
      props: containerProps({})
    });
    const branchTransition = options.transition !== void 0 && options.appear === true ? { ...options.transition, appear: true } : options.transition;
    const buildBranch = (build, tag) => {
      const branchKey = `when-${tag}:${node.id}`;
      const branch = graph.createNode("container", {
        key: branchKey,
        props: { key: branchKey }
      });
      registerTransition(graph, branch, branchTransition);
      build(new ContainerBuilderImpl(branch, graph));
      return branch;
    };
    const buildAll = (raw) => {
      if (raw) return [buildBranch(builder, "then")];
      return elseBuilder !== void 0 ? [buildBranch(elseBuilder, "else")] : [];
    };
    if (isSignal(condition)) {
      const signalId = `${node.id}:items`;
      node.stateRefs.push({ signalId, propKey: "items" });
      graph.registerHandler(`__signal__${signalId}`, condition);
      graph.registerHandler(`__listbuild__${node.id}`, buildAll);
      const current = condition.peek();
      for (const child of buildAll(current)) node.appendChild(child);
    } else {
      for (const child of buildAll(condition)) node.appendChild(child);
    }
  }
  errorBoundary(id, builder, options) {
    const sources = options.source === void 0 ? [] : Array.isArray(options.source) ? [...options.source] : [options.source];
    const localError = (0, import_state.signal)(void 0);
    const retryNonce = (0, import_state.signal)(0);
    const readError = () => {
      const local = localError.peek();
      if (local !== void 0 && local !== null) return local;
      for (const s of sources) {
        const e = s.peek();
        if (e !== void 0 && e !== null) return e;
      }
      return void 0;
    };
    const hasError = (0, import_state.derived)(() => {
      retryNonce.get();
      localError.get();
      for (const s of sources) s.get();
      return readError() !== void 0;
    });
    const retry = () => {
      localError.set(void 0);
      options.onRetry?.();
      retryNonce.update((n) => n + 1);
    };
    this.container(id, (c) => {
      c.when(
        hasError,
        // Error state → fallback. The fallback branch mounts exactly when the
        // boundary enters its error state, so this is also where the optional
        // `onError` reporting hook fires (observe-only; §6/§7).
        (fb) => {
          const currentError = readError();
          options.onError?.(currentError);
          options.fallback(fb, currentError, retry);
        },
        // Healthy state → body, guarded against synchronous build throws.
        (body) => {
          try {
            builder(body);
          } catch (err) {
            queueMicrotask(() => localError.set(err));
          }
        }
      );
    }, { id });
  }
  asyncBoundary(key, res, branches) {
    const isError = (0, import_state.derived)(() => res.status.get() === "error");
    const showSuccess = (0, import_state.derived)(
      () => res.status.get() !== "error" && res.data.get() !== void 0
    );
    const showLoading = (0, import_state.derived)(
      () => res.status.get() !== "error" && res.data.get() === void 0
    );
    const dataSignal = (0, import_state.derived)(() => res.data.get());
    const retry = () => {
      void res.refetch();
    };
    this.container(key, (c) => {
      c.when(isError, (fb) => branches.error?.(fb, res.error.peek(), retry));
      c.when(showSuccess, (sb) => branches.success(sb, dataSignal));
      c.when(showLoading, (lb) => branches.loading?.(lb));
    }, { key });
  }
  // ── Portals & overlays ──────────────────────────────────────────────────────
  portal(key, builder, options = {}) {
    const node = this._graph.createNode("portal", {
      key,
      parent: this._node,
      props: containerProps(options)
    });
    builder(new ContainerBuilderImpl(node, this._graph));
  }
  /**
   * Declare document metadata (2.0 §1–§3). Creates a `'head'` node — a neutral,
   * empty inline anchor at this position (one node / one element, so positional
   * hydration is preserved) — and registers a `__head__<id>` descriptor holding
   * this call's normalized, dedup-keyed {@link resolveHead} contribution. The
   * renderer applies it to `document.head` on the browser (adopting server tags
   * on hydration, cleaning up on unmount / route change) and emits the active
   * graph's merged metadata as a string on the server (`renderHead`).
   *
   * Multiple `head()` nodes may be live at once (app default + route + component)
   * — the renderer merges them and, per dedup key, the last in document order
   * wins (see head.ts). No new render path: this reuses the same graph-node +
   * handler-registry convention as overlays/transitions/components.
   */
  head(metadata) {
    const node = this._graph.createNode("head", {
      parent: this._node,
      props: { "data-streetui-head-anchor": "" }
    });
    const contribution = resolveHead(metadata);
    this._graph.registerHandler(
      `__head__${node.id}`,
      () => contribution
    );
  }
  /**
   * Shared assembly for every overlay kind: a `portal` node whose single child
   * is a `when(open, panel)` conditional. The panel container carries the
   * kind's ARIA semantics; `builder` fills it. An `__overlay__<portalId>`
   * descriptor is registered so the renderer wires focus/keyboard behavior to
   * the same `open` signal that drives the panel. Reuses existing primitives
   * (portal + when + container) — no new render path.
   */
  _overlay(kind, key, options, builder) {
    const graph = this._graph;
    const portalNode = graph.createNode("portal", {
      key,
      parent: this._node,
      props: { key }
    });
    const openBindable = options.open;
    const openSignal = isSignal(openBindable) ? openBindable : (0, import_state.signal)(openBindable);
    const panelOptions = {
      role: options.role ?? kind.role,
      ...kind.ariaModal ? { ariaModal: true } : {},
      ...kind.ariaLive !== void 0 ? { ariaLive: kind.ariaLive } : {},
      ...options.class !== void 0 ? { class: options.class } : {},
      ...options.ariaLabel !== void 0 ? { ariaLabel: options.ariaLabel } : {},
      ...options.ariaLabelledBy !== void 0 ? { ariaLabelledBy: options.ariaLabelledBy } : {},
      ...options.ariaDescribedBy !== void 0 ? { ariaDescribedBy: options.ariaDescribedBy } : {}
    };
    const portalBuilder = new ContainerBuilderImpl(portalNode, graph);
    portalBuilder.when(
      openSignal,
      (panelHost) => {
        panelHost.container(`${key}__panel`, builder, panelOptions);
      },
      void 0,
      // Overlay open/close rides the panel's `when`; a transition animates the
      // panel in on open and — via the reconciler's deferred-leave — plays the
      // leave before the panel is removed (§10). Focus is restored at close-
      // request time (see wireOverlayBehavior), so it never stays trapped inside
      // a panel that is animating away.
      options.transition !== void 0 ? { transition: options.transition } : {}
    );
    const descriptor = {
      open: openSignal,
      modal: kind.modal,
      takesFocus: kind.takesFocus,
      menu: kind.menu ?? false,
      closeOnEscape: options.closeOnEscape ?? kind.defaultCloseOnEscape,
      restoreFocus: options.restoreFocus ?? kind.defaultRestoreFocus,
      ...options.initialFocusId !== void 0 ? { initialFocusId: options.initialFocusId } : {},
      ...options.onClose !== void 0 ? { onClose: options.onClose } : {}
    };
    graph.registerHandler(
      `__overlay__${portalNode.id}`,
      () => descriptor
    );
  }
  dialog(key, options, builder) {
    this._overlay(OVERLAY_KINDS.dialog, key, options, builder);
  }
  popover(key, options, builder) {
    this._overlay(OVERLAY_KINDS.popover, key, options, builder);
  }
  tooltip(key, options, builder) {
    this._overlay(OVERLAY_KINDS.tooltip, key, options, builder);
  }
  dropdown(key, options, builder) {
    this._overlay(OVERLAY_KINDS.dropdown, key, options, builder);
  }
  toast(key, options, builder) {
    this._overlay(OVERLAY_KINDS.toast, key, options, builder);
  }
  // ── Components ────────────────────────────────────────────────────────────
  /**
   * Instantiate a reusable component (§3–§9). Creates a `'component'` node
   * (rendered as a `<div>` wrapper — preserves the one-node/one-element
   * positional-hydration invariant), then runs `def.setup(props, ctx)`
   * synchronously to obtain the render function and fills the component's own
   * container scope with it — structurally identical to `container`/
   * `errorBoundary`. Cleanups the setup registers via `ctx.effect`/
   * `ctx.onCleanup` are collected into a closure and exposed to the renderer
   * through a `__component__<id>` handler (mirroring `__overlay__`); the mount/
   * hydrate paths read it and route each into `NodeInstance.trackCleanup`, so
   * teardown runs (children-first) when the component leaves the graph.
   *
   * `setup` runs once per instance here at build time. When this component sits
   * inside a keyed list / conditional, a rebuild disposes the old instance
   * (running its cleanups + pruning its `__component__` entry) and re-runs this
   * method for the new node — so re-invocation is safe and leak-free.
   */
  component(key, def, props, children) {
    const graph = this._graph;
    const node = graph.createNode("component", {
      key,
      parent: this._node,
      // `data-streetui-component` is a non-underscore prop, so it reaches the
      // DOM as an attribute and is visible to DevTools (§21) — unlike the
      // internal `_`-prefixed metadata the renderer hides.
      props: { key, "data-streetui-component": def.name }
    });
    const cleanups = [];
    const ctx = {
      key,
      onCleanup(fn) {
        cleanups.push(fn);
      },
      effect(fn) {
        cleanups.push((0, import_state.effect)(fn));
      },
      renderChildren(content) {
        if (children !== void 0) children(content);
      }
    };
    let render;
    try {
      render = def.setup(props, ctx);
      render(new ContainerBuilderImpl(node, graph));
    } catch (err) {
      queueMicrotask(() => {
        throw err;
      });
    }
    if (cleanups.length > 0) {
      graph.registerHandler(
        `__component__${node.id}`,
        () => cleanups
      );
    }
  }
};
var SectionBuilderImpl = class extends ContainerBuilderBase {
};
var ContainerBuilderImpl = class extends ContainerBuilderBase {
};
var FormBuilderImpl = class extends ContainerBuilderBase {
};
var ListBuilderImpl = class extends ContentBuilderBase {
  item(key, builder, options = {}) {
    const node = this._graph.createNode("list-item", {
      key,
      parent: this._node,
      props: containerProps(options)
    });
    registerTransition(this._graph, node, options.transition);
    builder(new ContainerBuilderImpl(node, this._graph));
  }
};
var PageBuilderImpl = class extends ContainerBuilderBase {
};
var AppBuilder = class {
  constructor(_graph) {
    this._graph = _graph;
  }
  page(key, builder) {
    const node = this._graph.createNode("page", {
      key,
      parent: this._graph.root,
      props: { key }
    });
    builder(new PageBuilderImpl(node, this._graph));
  }
};

// packages/dsl/src/component.ts
function component(setup, options = {}) {
  return {
    __streetui_component: true,
    name: options.name ?? setup.name ?? "Component",
    setup
  };
}
function isComponentDefinition(value) {
  return value !== null && typeof value === "object" && value.__streetui_component === true;
}

// packages/dsl/src/dsl.ts
var import_graph = require("@streetui/graph");
var StreetApp = class {
  _graph;
  _builder;
  constructor(options) {
    const graphOpts = { name: options.name };
    if (options.version !== void 0) graphOpts.version = options.version;
    this._graph = new import_graph.ApplicationGraph(graphOpts);
    this._builder = new AppBuilder(this._graph);
  }
  page(key, builder) {
    this._builder.page(key, builder);
    return this;
  }
  /** Compile to ApplicationGraph — validates and returns the graph. */
  build() {
    const dc = this._graph.validate();
    dc.throwIfErrors();
    return this._graph;
  }
  /** Access graph before building (useful for inspection). */
  get graph() {
    return this._graph;
  }
};
var streetui = {
  app(options) {
    return new StreetApp(options);
  }
};
//# sourceMappingURL=index.cjs.map
