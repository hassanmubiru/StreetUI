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
  DEFAULT_PERF_THRESHOLDS: () => DEFAULT_PERF_THRESHOLDS,
  createDevTools: () => createDevTools,
  diagnosePerformance: () => diagnosePerformance,
  escapeHtml: () => escapeHtml,
  inspectApplication: () => inspectApplication,
  inspectComponents: () => inspectComponents,
  inspectContext: () => inspectContext,
  inspectForm: () => inspectForm,
  inspectGraph: () => inspectGraph,
  inspectI18n: () => inspectI18n,
  inspectInteractions: () => inspectInteractions,
  inspectResource: () => inspectResource,
  inspectRouter: () => inspectRouter,
  inspectSignal: () => inspectSignal,
  nodeTypeStats: () => nodeTypeStats,
  printDiagnostics: () => printDiagnostics,
  printGraph: () => printGraph,
  renderDevToolsHTML: () => renderDevToolsHTML
});
module.exports = __toCommonJS(index_exports);

// src/inspector.ts
var import_core = require("@streetui/core");
function inspectGraph(graph) {
  return inspectNode(graph.root, 0);
}
function inspectNode(node, depth) {
  return {
    id: node.id,
    type: node.type,
    key: node.key,
    props: { ...node.props },
    eventTypes: node.events.map((e) => e.type),
    stateBindings: node.stateRefs.map((r) => `${r.propKey}\u2192${r.signalId}`),
    depth,
    children: node.children.map((c) => inspectNode(c, depth + 1))
  };
}
function printGraph(graph) {
  const lines = [];
  graph.walk((node, depth) => {
    const indent = "  ".repeat(depth);
    const props = Object.entries(node.props).filter(([k]) => !k.startsWith("_")).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(", ");
    const events = node.events.length > 0 ? ` [events: ${node.events.map((e) => e.type).join(", ")}]` : "";
    const stateRefs = node.stateRefs.length > 0 ? ` [signals: ${node.stateRefs.map((r) => r.propKey).join(", ")}]` : "";
    lines.push(`${indent}<${node.type}${props ? ` ${props}` : ""}${events}${stateRefs}>`);
  });
  return lines.join("\n");
}
function printDiagnostics(compiled) {
  if (compiled.diagnostics.diagnostics.length === 0) {
    return "(no diagnostics)";
  }
  return compiled.diagnostics.diagnostics.map(import_core.formatDiagnostic).join("\n");
}
function nodeTypeStats(graph) {
  const counts = {};
  graph.walk((node) => {
    counts[node.type] = (counts[node.type] ?? 0) + 1;
  });
  return counts;
}
function inspectComponents(graph) {
  const out = [];
  graph.walk((node, depth) => {
    if (node.type !== "component") return;
    const name = node.props["data-streetui-component"];
    out.push({
      id: node.id,
      key: node.key,
      name: typeof name === "string" ? name : "Component",
      depth,
      childCount: node.children.length
    });
  });
  return out;
}
function inspectInteractions(graph) {
  const overlays = [];
  const transitions = [];
  graph.walk((node, depth) => {
    const overlayFn = graph.getHandler(`__overlay__${node.id}`);
    if (overlayFn !== void 0) {
      const d = overlayFn();
      overlays.push({
        id: node.id,
        key: node.key,
        open: d.open.peek(),
        modal: d.modal,
        takesFocus: d.takesFocus,
        menu: d.menu,
        closeOnEscape: d.closeOnEscape,
        restoreFocus: d.restoreFocus,
        depth
      });
    }
    const transitionFn = graph.getHandler(`__transition__${node.id}`);
    if (transitionFn !== void 0) {
      const t = transitionFn();
      transitions.push({
        id: node.id,
        key: node.key,
        nodeType: node.type,
        duration: t.duration,
        appear: t.appear,
        depth
      });
    }
  });
  return { overlays, transitions };
}

// src/application.ts
var import_core2 = require("@streetui/core");
function collectPerf(node, distinctSignals, acc) {
  acc.totalNodes += 1;
  if (node.depth > acc.maxDepth) acc.maxDepth = node.depth;
  acc.eventHandlers += node.eventTypes.length;
  acc.stateBindings += node.stateBindings.length;
  if (node.children.length > acc.largestChildCount) acc.largestChildCount = node.children.length;
  for (const child of node.children) collectPerf(child, distinctSignals, acc);
}
function collectSignals(node, into) {
  for (const binding of node.stateBindings) {
    const arrow = binding.indexOf("\u2192");
    const signalId = arrow >= 0 ? binding.slice(arrow + 1) : binding;
    if (signalId.length > 0) into.add(signalId);
  }
  for (const child of node.children) collectSignals(child, into);
}
function inspectApplication(compiled) {
  const graph = inspectGraph(compiled.graph);
  const signals = /* @__PURE__ */ new Set();
  collectSignals(graph, signals);
  const pages = graph.children.filter((child) => child.type === "page").map((child) => ({ id: child.id, key: child.key }));
  const diags = compiled.diagnostics.diagnostics;
  const errors = diags.filter((d) => d.severity === "error").length;
  const perfAcc = { totalNodes: 0, maxDepth: 0, eventHandlers: 0, stateBindings: 0, largestChildCount: 0 };
  collectPerf(graph, signals.size, perfAcc);
  let reactiveLists = 0;
  for (const key of compiled.graph.handlers.keys()) {
    if (key.startsWith("__listplan__")) reactiveLists += 1;
  }
  return {
    identity: {
      name: compiled.name,
      version: compiled.version,
      compiledAt: compiled.compiledAt
    },
    graph,
    nodeStats: nodeTypeStats(compiled.graph),
    signals: [...signals].sort(),
    pages,
    diagnostics: {
      errors,
      warnings: diags.length - errors,
      messages: diags.map(import_core2.formatDiagnostic)
    },
    perf: {
      totalNodes: perfAcc.totalNodes,
      maxDepth: perfAcc.maxDepth,
      eventHandlers: perfAcc.eventHandlers,
      stateBindings: perfAcc.stateBindings,
      distinctSignals: signals.size,
      largestChildCount: perfAcc.largestChildCount,
      reactiveLists
    }
  };
}

// src/diagnostics.ts
var DEFAULT_PERF_THRESHOLDS = {
  maxNodes: 5e3,
  maxDepth: 32,
  maxChildCount: 1e3,
  maxSignals: 1e3
};
function diagnosePerformance(compiled, thresholds = {}) {
  const t = { ...DEFAULT_PERF_THRESHOLDS, ...thresholds };
  const { perf } = inspectApplication(compiled);
  const out = [];
  if (perf.totalNodes > t.maxNodes) {
    out.push({
      code: "large-graph",
      message: `Graph has ${perf.totalNodes} nodes (> ${t.maxNodes}); consider splitting the view or paginating.`,
      observed: perf.totalNodes,
      threshold: t.maxNodes
    });
  }
  if (perf.maxDepth > t.maxDepth) {
    out.push({
      code: "deep-tree",
      message: `Graph nests ${perf.maxDepth} levels deep (> ${t.maxDepth}); deep trees slow mount and reconciliation.`,
      observed: perf.maxDepth,
      threshold: t.maxDepth
    });
  }
  if (perf.largestChildCount > t.maxChildCount) {
    out.push({
      code: "large-list",
      message: `A single node has ${perf.largestChildCount} children (> ${t.maxChildCount}); large un-windowed lists dominate DOM cost.`,
      observed: perf.largestChildCount,
      threshold: t.maxChildCount
    });
  }
  if (perf.distinctSignals > t.maxSignals) {
    out.push({
      code: "high-signal-fanout",
      message: `${perf.distinctSignals} distinct signals are bound (> ${t.maxSignals}); heavy reactive fan-out increases update overhead.`,
      observed: perf.distinctSignals,
      threshold: t.maxSignals
    });
  }
  return out;
}

// src/inspect-reactive.ts
var import_state = require("@streetui/state");
function inspectSignal(source, options = {}) {
  const raw = source.peek();
  let value = raw;
  if (options.redact === true) value = "[redacted]";
  else if (typeof options.redact === "function") value = options.redact(raw);
  return {
    kind: (0, import_state.signalKind)(source),
    value,
    observerCount: (0, import_state.observerCount)(source)
  };
}
function inspectResource(resource, options = {}) {
  const error = resource.error.peek();
  const hasError = error !== void 0 && error !== null;
  const base = {
    status: resource.status.peek(),
    loading: resource.loading.peek(),
    isRefetching: resource.isRefetching.peek(),
    hasData: resource.data.peek() !== void 0,
    hasError,
    errorName: hasError ? errorConstructorName(error) : void 0
  };
  if (options.includeData !== true) return base;
  return {
    ...base,
    data: resource.data.peek(),
    ...hasError ? { errorMessage: errorMessageOf(error) } : {}
  };
}
function errorConstructorName(error) {
  if (error instanceof Error) return error.name;
  return typeof error;
}
function errorMessageOf(error) {
  if (error instanceof Error) return error.message;
  return String(error);
}
function inspectRouter(router) {
  const match = router.currentRoute.peek();
  const query = {};
  for (const [k, v] of match.query.entries()) query[k] = v;
  return {
    path: match.path,
    pattern: match.pattern,
    params: { ...match.params },
    query,
    isFallback: match.isFallback === true
  };
}
function inspectForm(form, options = {}) {
  const values = form.values.peek();
  const errorsRaw = form.errors.peek();
  const touchedRaw = form.touched.peek();
  const errors = {};
  for (const [k, v] of Object.entries(errorsRaw)) if (v !== void 0) errors[k] = v;
  const touched = {};
  for (const [k, v] of Object.entries(touchedRaw)) touched[k] = v === true;
  const base = {
    fields: Object.keys(values),
    errors,
    touched,
    dirty: form.dirty.peek(),
    valid: form.valid.peek(),
    status: form.status.peek()
  };
  if (options.includeValues !== true) return base;
  return { ...base, values: { ...values } };
}
function inspectContext(context) {
  return {
    description: context.id.description ?? "streetui.context",
    hasProvider: context.hasProvider()
  };
}
function inspectI18n(i18n, options = {}) {
  const base = {
    locale: i18n.locale.peek(),
    locales: [...i18n.locales]
  };
  if (options.checkKeys === void 0) return base;
  const missingKeys = options.checkKeys.filter((k) => !i18n.has(k));
  return { ...base, missingKeys };
}

// src/panels.ts
function createDevTools(compiled, sources = {}, options = {}) {
  let current = capture(compiled, sources, options);
  return {
    get snapshot() {
      return current;
    },
    refresh() {
      current = capture(compiled, sources, options);
      return current;
    },
    selectNode(id) {
      return findNode(current.graph, id);
    },
    format() {
      return formatSnapshot(current);
    }
  };
}
function capture(compiled, sources, options) {
  const app = inspectApplication(compiled);
  const application = {
    identity: app.identity,
    nodeCount: app.perf.totalNodes,
    maxDepth: app.perf.maxDepth,
    pages: app.pages,
    signalCount: app.signals.length,
    eventHandlers: app.perf.eventHandlers,
    stateBindings: app.perf.stateBindings,
    errors: app.diagnostics.errors,
    warnings: app.diagnostics.warnings
  };
  const live = {};
  if (sources.signals !== void 0) {
    for (const [label, sig] of Object.entries(sources.signals)) {
      live[label] = inspectSignal(
        sig,
        options.redactSignals !== void 0 ? { redact: options.redactSignals } : {}
      );
    }
  }
  const signals = { boundSignalIds: app.signals, live };
  const performance = {
    snapshot: app.perf,
    diagnostics: diagnosePerformance(compiled, options.perfThresholds)
  };
  const components = inspectComponents(compiled.graph);
  const interactions = inspectInteractions(compiled.graph);
  const diagnostics = {
    errors: app.diagnostics.errors,
    warnings: app.diagnostics.warnings,
    messages: app.diagnostics.messages
  };
  const snapshot = {
    application,
    graph: app.graph,
    signals,
    performance,
    components,
    overlays: interactions.overlays,
    transitions: interactions.transitions,
    diagnostics,
    ...sources.router !== void 0 ? { router: inspectRouter(sources.router) } : {},
    ...sources.resources !== void 0 ? { resources: mapInspect(sources.resources, (r) => inspectResource(r)) } : {},
    ...sources.forms !== void 0 ? { forms: mapInspect(sources.forms, (f) => inspectForm(f)) } : {},
    ...sources.contexts !== void 0 ? { contexts: mapInspect(sources.contexts, (c) => inspectContext(c)) } : {},
    ...sources.i18n !== void 0 ? {
      i18n: inspectI18n(
        sources.i18n,
        options.i18nCheckKeys !== void 0 ? { checkKeys: options.i18nCheckKeys } : {}
      )
    } : {}
  };
  return snapshot;
}
function mapInspect(source, inspect) {
  const out = {};
  for (const [label, value] of Object.entries(source)) out[label] = inspect(value);
  return out;
}
function findNode(node, id) {
  if (node.id === id) return node;
  for (const child of node.children) {
    const found = findNode(child, id);
    if (found !== void 0) return found;
  }
  return void 0;
}
function formatSnapshot(s) {
  const lines = [];
  const app = s.application;
  lines.push(`StreetUI DevTools \u2014 ${app.identity.name} v${app.identity.version}`);
  lines.push(
    `Application: ${app.nodeCount} nodes, depth ${app.maxDepth}, ${app.pages.length} page(s)`
  );
  lines.push(
    `  signals ${app.signalCount} \xB7 handlers ${app.eventHandlers} \xB7 bindings ${app.stateBindings} \xB7 errors ${app.errors} \xB7 warnings ${app.warnings}`
  );
  lines.push(`Signals: ${s.signals.boundSignalIds.length} bound in graph`);
  for (const [label, sig] of Object.entries(s.signals.live)) {
    lines.push(`  ${label} [${sig.kind}] = ${format(sig.value)} \xB7 observers ${sig.observerCount ?? "?"}`);
  }
  if (s.components.length > 0) {
    lines.push(`Components: ${s.components.length}`);
    for (const c of s.components) {
      lines.push(`  ${"  ".repeat(c.depth)}${c.name}${c.key !== void 0 ? ` (#${c.key})` : ""} \xB7 children ${c.childCount}`);
    }
  }
  if (s.overlays.length > 0) {
    lines.push(`Overlays: ${s.overlays.length}`);
    for (const o of s.overlays) {
      const kind = o.modal ? "modal" : o.menu ? "menu" : o.takesFocus ? "focusable" : "non-modal";
      lines.push(`  ${o.key ?? o.id} [${kind}] ${o.open ? "open" : "closed"}`);
    }
  }
  if (s.transitions.length > 0) {
    lines.push(`Transitions: ${s.transitions.length}`);
    for (const t of s.transitions) {
      lines.push(`  ${t.key ?? t.id} on <${t.nodeType}> \xB7 ${t.duration}ms${t.appear ? " \xB7 appear" : ""}`);
    }
  }
  if (s.router !== void 0) {
    lines.push(`Router: ${s.router.path} (${s.router.pattern})${s.router.isFallback ? " [fallback]" : ""}`);
  }
  if (s.resources !== void 0) {
    lines.push("Resources:");
    for (const [label, r] of Object.entries(s.resources)) {
      lines.push(`  ${label}: ${r.status}${r.loading ? " (loading)" : ""}${r.hasError ? ` !${r.errorName}` : ""}`);
    }
  }
  if (s.forms !== void 0) {
    lines.push("Forms:");
    for (const [label, f] of Object.entries(s.forms)) {
      lines.push(`  ${label}: ${f.valid ? "valid" : "invalid"} \xB7 ${f.status} \xB7 fields ${f.fields.length}`);
    }
  }
  if (s.contexts !== void 0) {
    lines.push("Contexts:");
    for (const [label, c] of Object.entries(s.contexts)) {
      lines.push(`  ${label} (${c.description}): ${c.hasProvider ? "provided" : "no provider"}`);
    }
  }
  if (s.i18n !== void 0) {
    const missing = s.i18n.missingKeys;
    lines.push(
      `i18n: ${s.i18n.locale} of [${s.i18n.locales.join(", ")}]${missing !== void 0 ? ` \xB7 missing ${missing.length}` : ""}`
    );
  }
  lines.push(
    `Performance: ${s.performance.diagnostics.length} diagnostic(s), ${s.performance.snapshot.totalNodes} nodes`
  );
  for (const d of s.performance.diagnostics) {
    lines.push(`  ${d.code}: ${d.message}`);
  }
  lines.push(
    `Diagnostics: ${s.diagnostics.errors} error(s), ${s.diagnostics.warnings} warning(s)`
  );
  for (const m of s.diagnostics.messages) {
    lines.push(`  ${m}`);
  }
  return lines.join("\n");
}
function format(value) {
  if (typeof value === "string") return JSON.stringify(value);
  if (value === null || value === void 0) return String(value);
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "[object]";
    }
  }
  return String(value);
}

// src/view.ts
function escapeHtml(value) {
  const s = typeof value === "string" ? value : stringifyValue(value);
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function stringifyValue(value) {
  if (value === null || value === void 0) return String(value);
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "[object]";
    }
  }
  return String(value);
}
function section(title, count, body) {
  const badge = count === void 0 ? "" : ` <span class="st-count">${count}</span>`;
  return `<section class="st-panel"><h2>${escapeHtml(title)}${badge}</h2>${body}</section>`;
}
function ul(items) {
  if (items.length === 0) return '<p class="st-empty">(none)</p>';
  return `<ul>${items.map((i) => `<li>${i}</li>`).join("")}</ul>`;
}
function renderDevToolsHTML(s) {
  const app = s.application;
  const parts = [];
  parts.push(
    section(
      "Application",
      void 0,
      `<p>${escapeHtml(app.identity.name)} <span class="st-dim">v${escapeHtml(app.identity.version)}</span></p><p class="st-dim">${app.nodeCount} nodes \xB7 depth ${app.maxDepth} \xB7 ${app.pages.length} page(s) \xB7 ${app.signalCount} signals \xB7 ${app.eventHandlers} handlers \xB7 ${app.stateBindings} bindings</p>`
    )
  );
  parts.push(
    section(
      "Components",
      s.components.length,
      ul(
        s.components.map(
          (c) => `<span class="st-depth" style="--d:${c.depth}"></span><code>${escapeHtml(c.name)}</code>` + (c.key !== void 0 ? ` <span class="st-key">#${escapeHtml(c.key)}</span>` : "") + ` <span class="st-dim">${c.childCount} child(ren)</span>`
        )
      )
    )
  );
  parts.push(section("Graph", void 0, `<pre class="st-tree">${escapeHtml(renderNodeTree(s.graph))}</pre>`));
  parts.push(
    section(
      "Signals",
      s.signals.boundSignalIds.length,
      `<p class="st-dim">${s.signals.boundSignalIds.length} bound in graph \xB7 effects shown as observer counts (no global effect registry)</p>` + ul(
        Object.entries(s.signals.live).map(
          ([label, sig]) => `<code>${escapeHtml(label)}</code> <span class="st-key">[${escapeHtml(sig.kind)}]</span> = <code>${escapeHtml(sig.value)}</code> <span class="st-dim">observers ${escapeHtml(sig.observerCount ?? "?")}</span>`
        )
      )
    )
  );
  if (s.router !== void 0) {
    parts.push(
      section(
        "Router",
        void 0,
        `<p><code>${escapeHtml(s.router.path)}</code> <span class="st-dim">(${escapeHtml(s.router.pattern)})${s.router.isFallback ? " \xB7 fallback" : ""}</span></p>`
      )
    );
  }
  if (s.resources !== void 0) {
    parts.push(
      section(
        "Resources",
        Object.keys(s.resources).length,
        ul(
          Object.entries(s.resources).map(
            ([label, r]) => `<code>${escapeHtml(label)}</code>: ${escapeHtml(r.status)}` + (r.loading ? ' <span class="st-dim">(loading)</span>' : "") + (r.hasError ? ` <span class="st-err">!${escapeHtml(r.errorName)}</span>` : "")
          )
        )
      )
    );
  }
  parts.push(
    section(
      "Overlays",
      s.overlays.length,
      ul(
        s.overlays.map((o) => {
          const kind = o.modal ? "modal" : o.menu ? "menu" : o.takesFocus ? "focusable" : "non-modal";
          return `<code>${escapeHtml(o.key ?? o.id)}</code> <span class="st-key">[${kind}]</span> <span class="st-dim">${o.open ? "open" : "closed"}${o.closeOnEscape ? " \xB7 esc" : ""}${o.restoreFocus ? " \xB7 restore" : ""}</span>`;
        })
      )
    )
  );
  parts.push(
    section(
      "Transitions",
      s.transitions.length,
      ul(
        s.transitions.map(
          (t) => `<code>${escapeHtml(t.key ?? t.id)}</code> on <code>&lt;${escapeHtml(t.nodeType)}&gt;</code> <span class="st-dim">${t.duration}ms${t.appear ? " \xB7 appear" : ""}</span>`
        )
      )
    )
  );
  if (s.forms !== void 0) {
    parts.push(
      section(
        "Forms",
        Object.keys(s.forms).length,
        ul(
          Object.entries(s.forms).map(
            ([label, f]) => `<code>${escapeHtml(label)}</code>: ${f.valid ? "valid" : "invalid"} \xB7 ${escapeHtml(f.status)} \xB7 ${f.fields.length} field(s)`
          )
        )
      )
    );
  }
  if (s.i18n !== void 0) {
    const missing = s.i18n.missingKeys;
    parts.push(
      section(
        "i18n",
        void 0,
        `<p><code>${escapeHtml(s.i18n.locale)}</code> of [${s.i18n.locales.map(escapeHtml).join(", ")}]${missing !== void 0 ? ` <span class="st-dim">\xB7 missing ${missing.length}</span>` : ""}</p>`
      )
    );
  }
  parts.push(
    section(
      "Performance",
      s.performance.diagnostics.length,
      `<p class="st-dim">Structural counts, not runtime timings \u2014 not a production profiler.</p>` + ul(s.performance.diagnostics.map((d) => `<code>${escapeHtml(d.code)}</code>: ${escapeHtml(d.message)}`))
    )
  );
  parts.push(
    section(
      "Diagnostics",
      s.diagnostics.errors + s.diagnostics.warnings,
      `<p class="st-dim">${s.diagnostics.errors} error(s) \xB7 ${s.diagnostics.warnings} warning(s)</p>` + ul(s.diagnostics.messages.map((m) => escapeHtml(m)))
    )
  );
  const title = `StreetUI DevTools \u2014 ${escapeHtml(app.identity.name)}`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title}</title><style>${DEVTOOLS_CSS}</style></head><body class="st-devtools"><header class="st-header"><h1>${title} <span class="st-dim">v${escapeHtml(app.identity.version)}</span></h1></header><main>${parts.join("")}</main></body></html>`;
}
function renderNodeTree(node) {
  const lines = [];
  const walk = (n) => {
    const indent = "  ".repeat(n.depth);
    const key = n.key !== void 0 ? ` #${n.key}` : "";
    lines.push(`${indent}<${n.type}${key}> ${n.id}`);
    for (const c of n.children) walk(c);
  };
  walk(node);
  return lines.join("\n");
}
var DEVTOOLS_CSS = [
  ".st-devtools{font:13px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;margin:0;color:#e6e6e6;background:#1e1e28}",
  ".st-header{padding:12px 16px;border-bottom:1px solid #333;background:#15151c}",
  ".st-header h1{font-size:14px;margin:0}",
  "main{padding:8px 16px}",
  ".st-panel{margin:12px 0;border:1px solid #2c2c38;border-radius:6px;overflow:hidden}",
  ".st-panel h2{font-size:12px;text-transform:uppercase;letter-spacing:.04em;margin:0;padding:6px 10px;background:#23232e}",
  ".st-panel ul{list-style:none;margin:0;padding:6px 10px}",
  ".st-panel li{padding:1px 0}",
  ".st-panel p{margin:6px 10px}",
  ".st-count{background:#3a3a4a;border-radius:10px;padding:0 7px;font-size:11px;float:right}",
  ".st-dim{color:#8a8a9a}.st-key{color:#7db4ff}.st-err{color:#ff8a8a}.st-empty{color:#6a6a7a}",
  ".st-tree{margin:6px 10px;white-space:pre;overflow:auto;color:#c8c8d4}",
  ".st-depth{display:inline-block}.st-depth{width:calc(var(--d,0)*12px)}",
  "code{color:#d7d7e0}"
].join("");
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  DEFAULT_PERF_THRESHOLDS,
  createDevTools,
  diagnosePerformance,
  escapeHtml,
  inspectApplication,
  inspectComponents,
  inspectContext,
  inspectForm,
  inspectGraph,
  inspectI18n,
  inspectInteractions,
  inspectResource,
  inspectRouter,
  inspectSignal,
  nodeTypeStats,
  printDiagnostics,
  printGraph,
  renderDevToolsHTML
});
//# sourceMappingURL=index.cjs.map