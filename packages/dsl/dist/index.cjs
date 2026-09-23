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
  AppBuilder: () => AppBuilder,
  ContainerBuilderImpl: () => ContainerBuilderImpl,
  FormBuilderImpl: () => FormBuilderImpl,
  ListBuilderImpl: () => ListBuilderImpl,
  PageBuilderImpl: () => PageBuilderImpl,
  SectionBuilderImpl: () => SectionBuilderImpl,
  StreetApp: () => StreetApp,
  streetui: () => streetui
});
module.exports = __toCommonJS(index_exports);

// src/builders.ts
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
function containerProps(options) {
  const props = {};
  if (options.class !== void 0) props["class"] = options.class;
  if (options.id !== void 0) props["id"] = options.id;
  if (options.key !== void 0) props["key"] = options.key;
  return props;
}
var ContentBuilderBase = class {
  constructor(_node, _graph) {
    this._node = _node;
    this._graph = _graph;
  }
  heading(text, options = {}) {
    const nodeOpts = {
      props: {
        level: options.level ?? 1,
        ...options.class !== void 0 ? { class: options.class } : {},
        ...options.id !== void 0 ? { id: options.id } : {}
      }
    };
    const node = this._graph.createNode("heading", { parent: this._node, ...nodeOpts });
    const resolved = bindValue(this._graph, node, "text", text);
    node.setProp("text", resolved);
  }
  text(content, options = {}) {
    const props = {};
    if (options.class !== void 0) props["class"] = options.class;
    if (options.id !== void 0) props["id"] = options.id;
    const node = this._graph.createNode("text", { parent: this._node, props });
    const resolved = bindValue(this._graph, node, "text", content);
    node.setProp("text", resolved);
  }
  button(label, options = {}) {
    const props = {};
    if (options.class !== void 0) props["class"] = options.class;
    if (options.id !== void 0) props["id"] = options.id;
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
    const nodeOpts = {
      props,
      parent: this._node
    };
    if (options.id !== void 0) nodeOpts.key = options.id;
    const node = this._graph.createNode("input", nodeOpts);
    if (options.value !== void 0) {
      const resolved = bindValue(this._graph, node, "value", options.value);
      node.setProp("value", resolved);
    }
    if (options.disabled !== void 0) {
      const resolved = bindValue(this._graph, node, "disabled", options.disabled);
      node.setProp("disabled", resolved);
    }
    if (options.onInput !== void 0) {
      const handlerKey = `input:${node.id}`;
      this._graph.registerHandler(handlerKey, options.onInput);
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
    const node = this._graph.createNode("link", { parent: this._node, props });
    const resolved = bindValue(this._graph, node, "label", label);
    node.setProp("label", resolved);
    if (options.onClick !== void 0) {
      const handlerKey = `click:${node.id}`;
      this._graph.registerHandler(handlerKey, options.onClick);
      node.addEvent({ type: "click", handlerKey });
    }
  }
};
var ContainerBuilderBase = class extends ContentBuilderBase {
  section(key, builder, options = {}) {
    const node = this._graph.createNode("section", {
      key,
      parent: this._node,
      props: containerProps(options)
    });
    builder(new SectionBuilderImpl(node, this._graph));
  }
  container(key, builder, options = {}) {
    const node = this._graph.createNode("container", {
      key,
      parent: this._node,
      props: containerProps(options)
    });
    builder(new ContainerBuilderImpl(node, this._graph));
  }
  list(key, builder, options = {}) {
    const node = this._graph.createNode("list", {
      key,
      parent: this._node,
      props: containerProps(options)
    });
    builder(new ListBuilderImpl(node, this._graph));
  }
  form(key, builder, options = {}) {
    const props = containerProps(options);
    const node = this._graph.createNode("form", {
      key,
      parent: this._node,
      props
    });
    if (options.onSubmit !== void 0) {
      const handlerKey = `submit:${node.id}`;
      this._graph.registerHandler(handlerKey, options.onSubmit);
      node.addEvent({ type: "submit", handlerKey });
    }
    builder(new FormBuilderImpl(node, this._graph));
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

// src/dsl.ts
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  AppBuilder,
  ContainerBuilderImpl,
  FormBuilderImpl,
  ListBuilderImpl,
  PageBuilderImpl,
  SectionBuilderImpl,
  StreetApp,
  streetui
});
//# sourceMappingURL=index.cjs.map