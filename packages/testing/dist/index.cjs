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
  findAllByRole: () => findAllByRole,
  findByRole: () => findByRole,
  findByText: () => findByText,
  flushUpdates: () => flushUpdates,
  render: () => render,
  renderOnce: () => renderOnce,
  renderServerThenHydrate: () => renderServerThenHydrate,
  waitFor: () => waitFor
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

// src/helpers.ts
var import_core2 = require("@streetui/core");
var import_scheduler = require("@streetui/scheduler");
var import_compiler2 = require("@streetui/compiler");
var import_dom2 = require("@streetui/dom");
var import_renderer2 = require("@streetui/renderer");
async function flushUpdates() {
  (0, import_scheduler.flushSync)();
  await Promise.resolve();
  (0, import_scheduler.flushSync)();
}
async function waitFor(check, options = {}) {
  const timeout = options.timeout ?? 1e3;
  const interval = options.interval ?? 10;
  const deadline = Date.now() + timeout;
  let lastError;
  for (; ; ) {
    await flushUpdates();
    try {
      const result = check();
      if (result) return result;
      lastError = new Error("[StreetUI Testing] waitFor: condition was falsy");
    } catch (err) {
      lastError = err;
    }
    if (Date.now() >= deadline) {
      throw lastError instanceof Error ? lastError : new Error(String(lastError));
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
}
function findByText(container, text) {
  const match = Array.from(container.querySelectorAll("*")).find(
    (el) => el.children.length === 0 && (el.textContent?.includes(text) ?? false)
  );
  if (match === void 0) {
    throw new Error(`[StreetUI Testing] No element with text "${text}" found`);
  }
  return match;
}
function implicitRole(el) {
  const tag = el.tagName.toLowerCase();
  switch (tag) {
    case "button":
      return "button";
    case "a":
      return el.hasAttribute("href") ? "link" : null;
    case "nav":
      return "navigation";
    case "h1":
    case "h2":
    case "h3":
    case "h4":
    case "h5":
    case "h6":
      return "heading";
    case "input": {
      const type = (el.getAttribute("type") ?? "text").toLowerCase();
      if (type === "checkbox") return "checkbox";
      if (type === "radio") return "radio";
      if (type === "button" || type === "submit") return "button";
      return "textbox";
    }
    case "form":
      return "form";
    default:
      return null;
  }
}
function accessibleName(el) {
  return (el.getAttribute("aria-label") ?? el.textContent ?? "").trim();
}
function findAllByRole(container, role, options = {}) {
  const all = Array.from(container.querySelectorAll("*"));
  return all.filter((el) => {
    const explicit = el.getAttribute("role");
    const matches = explicit === role || explicit === null && implicitRole(el) === role;
    if (!matches) return false;
    if (options.name !== void 0) {
      return accessibleName(el).includes(options.name);
    }
    return true;
  });
}
function findByRole(container, role, options = {}) {
  const matches = findAllByRole(container, role, options);
  if (matches.length === 0) {
    const named = options.name !== void 0 ? ` with name "${options.name}"` : "";
    throw new Error(`[StreetUI Testing] No element with role "${role}"${named} found`);
  }
  if (matches.length > 1) {
    throw new Error(
      `[StreetUI Testing] Found ${matches.length} elements with role "${role}" \u2014 refine with { name }`
    );
  }
  return matches[0];
}
function renderServerThenHydrate(build, options = {}) {
  (0, import_core2.resetIdCounter)();
  const serverHtml = (0, import_renderer2.renderToString)((0, import_compiler2.compile)(build()));
  const container = document.createElement("div");
  container.innerHTML = serverHtml;
  document.body.appendChild(container);
  const collector = options.collectDiagnostics === true ? (0, import_renderer2.createHydrationDiagnosticCollector)() : void 0;
  (0, import_core2.resetIdCounter)();
  const renderer = (0, import_renderer2.createRenderer)({
    domAdapter: new import_dom2.BrowserDOMAdapter(),
    ...collector !== void 0 ? { hydrationDiagnostics: collector.sink } : {}
  });
  const handle = renderer.hydrate((0, import_compiler2.compile)(build()), container);
  return {
    container,
    serverHtml,
    handle,
    diagnostics: collector?.diagnostics ?? [],
    flush() {
      handle.flush();
    },
    unmount() {
      handle.unmount();
      if (container.parentNode !== null) container.parentNode.removeChild(container);
    }
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  findAllByRole,
  findByRole,
  findByText,
  flushUpdates,
  render,
  renderOnce,
  renderServerThenHydrate,
  waitFor
});
//# sourceMappingURL=index.cjs.map