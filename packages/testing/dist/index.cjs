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
  render: () => render,
  renderOnce: () => renderOnce
});
module.exports = __toCommonJS(index_exports);

// src/test-renderer.ts
var import_core = require("@streetui/core");
var import_compiler = require("@streetui/compiler");
var import_dom = require("@streetui/dom");
var import_renderer = require("@streetui/renderer");
function render(app) {
  const compiled = (0, import_compiler.compile)(app);
  const container = document.createElement("div");
  document.body.appendChild(container);
  const renderer = (0, import_renderer.createRenderer)({ domAdapter: new import_dom.BrowserDOMAdapter() });
  const handle = renderer.mount(compiled, container);
  return {
    container,
    handle,
    unmount() {
      handle.unmount();
      if (container.parentNode !== null) {
        container.parentNode.removeChild(container);
      }
    },
    flush() {
      handle.flush();
    },
    getByTag(tag) {
      const el = container.querySelector(tag);
      if (el === null) {
        throw new Error(`[StreetUI Testing] Element <${tag}> not found in render output`);
      }
      return el;
    },
    getAllByTag(tag) {
      return Array.from(container.querySelectorAll(tag));
    },
    getByText(text) {
      const all = Array.from(container.querySelectorAll("*"));
      const match = all.find(
        (el) => el.children.length === 0 && el.textContent?.includes(text)
      );
      if (match === void 0) {
        throw new Error(`[StreetUI Testing] No element with text "${text}" found`);
      }
      return match;
    },
    getAllByText(text) {
      return Array.from(container.querySelectorAll("*")).filter(
        (el) => el.textContent?.includes(text)
      );
    },
    query(selector) {
      return container.querySelector(selector);
    },
    queryAll(selector) {
      return Array.from(container.querySelectorAll(selector));
    },
    find(selector) {
      const el = container.querySelector(selector);
      if (el === null) {
        throw new Error(`[StreetUI Testing] Selector "${selector}" matched nothing`);
      }
      return el;
    }
  };
}
function renderOnce(app, testFn) {
  const result = render(app);
  return Promise.resolve(testFn(result)).finally(() => {
    result.unmount();
    (0, import_core.resetIdCounter)();
  });
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  render,
  renderOnce
});
//# sourceMappingURL=index.cjs.map