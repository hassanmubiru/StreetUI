// src/test-renderer.ts
import { resetIdCounter } from "@streetui/core";
import { compile } from "@streetui/compiler";
import { BrowserDOMAdapter } from "@streetui/dom";
import { createRenderer } from "@streetui/renderer";
function render(app) {
  const compiled = compile(app);
  const container = document.createElement("div");
  document.body.appendChild(container);
  const renderer = createRenderer({ domAdapter: new BrowserDOMAdapter() });
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
    resetIdCounter();
  });
}

// src/helpers.ts
import { resetIdCounter as resetIdCounter2 } from "@streetui/core";
import { flushSync } from "@streetui/scheduler";
import { compile as compile2 } from "@streetui/compiler";
import { BrowserDOMAdapter as BrowserDOMAdapter2 } from "@streetui/dom";
import {
  createRenderer as createRenderer2,
  renderToString,
  createHydrationDiagnosticCollector
} from "@streetui/renderer";
async function flushUpdates() {
  flushSync();
  await Promise.resolve();
  flushSync();
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
  resetIdCounter2();
  const serverHtml = renderToString(compile2(build()));
  const container = document.createElement("div");
  container.innerHTML = serverHtml;
  document.body.appendChild(container);
  const collector = options.collectDiagnostics === true ? createHydrationDiagnosticCollector() : void 0;
  resetIdCounter2();
  const renderer = createRenderer2({
    domAdapter: new BrowserDOMAdapter2(),
    ...collector !== void 0 ? { hydrationDiagnostics: collector.sink } : {}
  });
  const handle = renderer.hydrate(compile2(build()), container);
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
export {
  findAllByRole,
  findByRole,
  findByText,
  flushUpdates,
  render,
  renderOnce,
  renderServerThenHydrate,
  waitFor
};
//# sourceMappingURL=index.js.map