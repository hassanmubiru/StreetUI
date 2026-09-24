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
  ROUTER_OUTLET_ID: () => ROUTER_OUTLET_ID,
  createBrowserHistory: () => createBrowserHistory,
  createMemoryHistory: () => createMemoryHistory,
  createRouter: () => createRouter,
  matchPattern: () => matchPattern,
  matchRoutes: () => matchRoutes,
  mountRouter: () => mountRouter,
  normalizePath: () => normalizePath,
  routerOutlet: () => routerOutlet,
  splitTarget: () => splitTarget
});
module.exports = __toCommonJS(index_exports);

// src/matching.ts
function segments(path) {
  return path.split("/").filter((s) => s.length > 0);
}
function normalizePath(path) {
  let p = path.trim();
  if (p === "") return "/";
  if (!p.startsWith("/")) p = `/${p}`;
  if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
  return p;
}
function matchPattern(pattern, pathname) {
  if (pattern === "*") {
    return { "*": normalizePath(pathname).slice(1) };
  }
  const patSegs = segments(pattern);
  const pathSegs = segments(normalizePath(pathname));
  const params = {};
  for (let i = 0; i < patSegs.length; i++) {
    const patSeg = patSegs[i];
    if (patSeg === "*") {
      params["*"] = pathSegs.slice(i).map((s) => decodeURIComponent(s)).join("/");
      return params;
    }
    const pathSeg = pathSegs[i];
    if (pathSeg === void 0) return null;
    if (patSeg.startsWith(":")) {
      const name = patSeg.slice(1);
      if (name === "") return null;
      params[name] = decodeURIComponent(pathSeg);
      continue;
    }
    if (patSeg !== pathSeg) return null;
  }
  if (pathSegs.length !== patSegs.length) return null;
  return params;
}
function matchRoutes(routes, pathname) {
  for (const route of routes) {
    const params = matchPattern(route.path, pathname);
    if (params !== null) return { route, params };
  }
  return null;
}
function splitTarget(to) {
  const hashIndex = to.indexOf("#");
  const withoutHash = hashIndex >= 0 ? to.slice(0, hashIndex) : to;
  const qIndex = withoutHash.indexOf("?");
  if (qIndex < 0) return { pathname: normalizePath(withoutHash), search: "" };
  return {
    pathname: normalizePath(withoutHash.slice(0, qIndex)),
    search: withoutHash.slice(qIndex + 1)
  };
}

// src/history.ts
function buildLocation(pathname, search) {
  return { pathname, search };
}
function toUrl(pathname, search) {
  return search.length > 0 ? `${pathname}?${search}` : pathname;
}
function createBrowserHistory() {
  const listeners = /* @__PURE__ */ new Set();
  const notify = () => {
    for (const cb of listeners) cb();
  };
  const onPopState = () => notify();
  window.addEventListener("popstate", onPopState);
  const current = () => {
    const loc = window.location;
    return buildLocation(loc.pathname, loc.search.replace(/^\?/, ""));
  };
  return {
    location: current,
    push(pathname, search) {
      window.history.pushState({}, "", toUrl(pathname, search));
      notify();
    },
    replace(pathname, search) {
      window.history.replaceState({}, "", toUrl(pathname, search));
      notify();
    },
    back() {
      window.history.back();
    },
    forward() {
      window.history.forward();
    },
    listen(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    dispose() {
      window.removeEventListener("popstate", onPopState);
      listeners.clear();
    }
  };
}
function createMemoryHistory(initial = "/") {
  const listeners = /* @__PURE__ */ new Set();
  const notify = () => {
    for (const cb of listeners) cb();
  };
  const parse = (entry) => {
    const qIndex = entry.indexOf("?");
    if (qIndex < 0) return buildLocation(entry, "");
    return buildLocation(entry.slice(0, qIndex), entry.slice(qIndex + 1));
  };
  const stack = [initial];
  let index = 0;
  return {
    location() {
      return parse(stack[index]);
    },
    push(pathname, search) {
      stack.splice(index + 1);
      stack.push(toUrl(pathname, search));
      index = stack.length - 1;
      notify();
    },
    replace(pathname, search) {
      stack[index] = toUrl(pathname, search);
      notify();
    },
    back() {
      if (index > 0) {
        index--;
        notify();
      }
    },
    forward() {
      if (index < stack.length - 1) {
        index++;
        notify();
      }
    },
    listen(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    dispose() {
      listeners.clear();
    }
  };
}

// src/router.ts
var import_state = require("@streetui/state");
var DEFAULT_NOT_FOUND = {
  path: "*",
  builder: (page) => {
    page.section("not-found", (s) => {
      s.heading("404 \u2014 Page not found", { level: 1, id: "not-found-title" });
      s.text("The page you were looking for does not exist.", { id: "not-found-text" });
      s.link("Go home", { href: "/", id: "not-found-home" });
    }, { id: "not-found" });
  }
};
function createRouter(options) {
  const routes = options.routes;
  const history = options.history ?? createBrowserHistory();
  const fallback = options.notFound ?? DEFAULT_NOT_FOUND;
  const resolve = () => {
    const loc = history.location();
    const pathname = normalizePath(loc.pathname);
    const query = new URLSearchParams(loc.search);
    const matched = matchRoutes(routes, pathname);
    if (matched !== null) {
      return {
        path: pathname,
        pattern: matched.route.path,
        params: matched.params,
        query,
        route: matched.route,
        // A catch-all `*` match is the 404 route whether user-supplied or built-in.
        isFallback: matched.route.path === "*"
      };
    }
    const fallbackParams = matchRoutes([fallback], pathname)?.params ?? {};
    return {
      path: pathname,
      pattern: fallback.path,
      params: fallbackParams,
      query,
      route: fallback,
      isFallback: true
    };
  };
  const current = (0, import_state.signal)(resolve());
  const stopListening = history.listen(() => {
    current.set(resolve());
  });
  const navigate = (to, opts = {}) => {
    const { pathname, search } = splitTarget(to);
    if (opts.replace === true) history.replace(pathname, search);
    else history.push(pathname, search);
  };
  const isActive = (path, opts = {}) => {
    const target = normalizePath(path);
    const exact = opts.exact === true;
    return (0, import_state.derived)(() => {
      const activePath = current.get().path;
      if (activePath === target) return true;
      if (exact || target === "/") return false;
      return activePath.startsWith(`${target}/`);
    });
  };
  return {
    currentRoute: current,
    navigate,
    back: () => history.back(),
    forward: () => history.forward(),
    isActive,
    destroy: () => {
      stopListening();
      history.dispose();
    }
  };
}

// src/mount-router.ts
var import_dsl = require("@streetui/dsl");
var import_compiler = require("@streetui/compiler");
var import_runtime = require("@streetui/runtime");
var import_renderer = require("@streetui/renderer");
var import_core = require("@streetui/core");
var ROUTER_OUTLET_ID = "streetui-router-outlet";
function routerOutlet(scope, id = ROUTER_OUTLET_ID) {
  scope.container("router-outlet", () => {
  }, { id });
}
function isExternalHref(href) {
  return /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(href) || // scheme: http:, https:, mailto:, tel:
  href.startsWith("//");
}
function mountRouter(router, options) {
  const { container } = options;
  const renderer = options.renderer ?? (0, import_renderer.createRenderer)();
  const outletId = options.outletId ?? ROUTER_OUTLET_ID;
  const interceptLinks = options.interceptLinks ?? true;
  const hydrateMode = options.hydrate ?? false;
  let shellMounted = null;
  let outlet;
  if (options.shell !== void 0) {
    const shellApp = import_dsl.streetui.app({ name: "router-shell" });
    const shellBuilder = options.shell;
    shellApp.page("shell", (page) => shellBuilder(page, router));
    const shellRuntime = (0, import_runtime.createRuntime)({ renderer });
    const shellCompiled = (0, import_compiler.compile)(shellApp);
    if (hydrateMode) {
      for (const node of shellCompiled.graph.findAll((n) => n.getProp("id") === outletId)) {
        node.setProp("_hydrationBoundary", true);
      }
    }
    shellMounted = hydrateMode ? shellRuntime.hydrate(shellCompiled, container) : shellRuntime.mount(shellCompiled, container);
    const found = container.querySelector(`[id="${outletId}"]`);
    if (found === null) {
      throw new Error(
        `[Router] The shell must contain a route outlet. Call routerOutlet(scope) (or add a container with id="${outletId}") inside your shell builder.`
      );
    }
    outlet = found;
  } else {
    outlet = container;
  }
  let active = null;
  let firstRender = hydrateMode;
  const disposeActive = () => {
    if (active === null) return;
    active.registry.run();
    active.mounted.unmount();
    active = null;
  };
  const renderRoute = (match) => {
    disposeActive();
    const registry = new import_core.CleanupRegistry();
    const ctx = {
      path: match.path,
      pattern: match.pattern,
      params: match.params,
      query: match.query,
      onCleanup: (fn) => registry.add(fn)
    };
    const routeApp = import_dsl.streetui.app({ name: `route:${match.pattern}` });
    routeApp.page("route", (page) => match.route.builder(page, ctx));
    const runtime = (0, import_runtime.createRuntime)({ renderer });
    const routeCompiled = (0, import_compiler.compile)(routeApp);
    const mounted = firstRender ? runtime.hydrate(routeCompiled, outlet) : runtime.mount(routeCompiled, outlet);
    firstRender = false;
    active = { registry, mounted };
  };
  renderRoute(router.currentRoute.peek());
  const stopRouteSub = router.currentRoute.subscribe((match) => renderRoute(match));
  const onClick = (event) => {
    if (event.defaultPrevented) return;
    const mouse = event;
    if (typeof mouse.button === "number" && mouse.button !== 0) return;
    if (mouse.metaKey || mouse.ctrlKey || mouse.shiftKey || mouse.altKey) return;
    const target = event.target;
    const anchor = target?.closest?.("a") ?? null;
    if (anchor === null) return;
    const targetAttr = anchor.getAttribute("target");
    if (targetAttr !== null && targetAttr !== "_self") return;
    const href = anchor.getAttribute("href");
    if (href === null || href === "" || href.startsWith("#")) return;
    if (isExternalHref(href)) return;
    event.preventDefault();
    router.navigate(href);
  };
  if (interceptLinks) {
    container.addEventListener("click", onClick);
  }
  return {
    outlet,
    unmount() {
      if (interceptLinks) container.removeEventListener("click", onClick);
      stopRouteSub();
      disposeActive();
      shellMounted?.unmount();
      router.destroy();
    }
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ROUTER_OUTLET_ID,
  createBrowserHistory,
  createMemoryHistory,
  createRouter,
  matchPattern,
  matchRoutes,
  mountRouter,
  normalizePath,
  routerOutlet,
  splitTarget
});
//# sourceMappingURL=index.cjs.map