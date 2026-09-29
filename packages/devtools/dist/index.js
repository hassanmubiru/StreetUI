// src/inspector.ts
import { formatDiagnostic } from "@streetui/core";
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
  return compiled.diagnostics.diagnostics.map(formatDiagnostic).join("\n");
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
import { formatDiagnostic as formatDiagnostic2 } from "@streetui/core";
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
      messages: diags.map(formatDiagnostic2)
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
import {
  signalKind,
  observerCount
} from "@streetui/state";
function inspectSignal(source, options = {}) {
  const raw = source.peek();
  let value = raw;
  if (options.redact === true) value = "[redacted]";
  else if (typeof options.redact === "function") value = options.redact(raw);
  return {
    kind: signalKind(source),
    value,
    observerCount: observerCount(source)
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
function inspectMutation(mutation, options = {}) {
  const error = mutation.error.peek();
  const hasError = error !== void 0 && error !== null;
  const base = {
    status: mutation.status.peek(),
    pending: mutation.pending.peek(),
    hasData: mutation.data.peek() !== void 0,
    hasError,
    errorName: hasError ? errorConstructorName(error) : void 0
  };
  if (options.includeData !== true) return base;
  return {
    ...base,
    data: mutation.data.peek(),
    ...hasError ? { errorMessage: errorMessageOf(error) } : {}
  };
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

// src/inspect-detail.ts
import {
  signalKind as signalKind2,
  observerCount as observerCount2
} from "@streetui/state";
function inspectEvents(graph) {
  const nodes = [];
  const byType = {};
  let totalHandlers = 0;
  graph.walk((node, depth) => {
    if (node.events.length === 0) return;
    const types = node.events.map((e) => e.type);
    for (const t of types) {
      byType[t] = (byType[t] ?? 0) + 1;
      totalHandlers += 1;
    }
    nodes.push({
      id: node.id,
      nodeType: node.type,
      key: node.key,
      depth,
      eventTypes: [...types].sort()
    });
  });
  return { nodes, totalHandlers, byType };
}
function inspectSignalGraph(compiled, options = {}) {
  const graph = compiled.graph;
  const edges = [];
  const byId = /* @__PURE__ */ new Map();
  graph.walk((node) => {
    for (const ref of node.stateRefs) {
      edges.push({
        signalId: ref.signalId,
        nodeId: node.id,
        nodeType: node.type,
        propKey: ref.propKey
      });
      let entry = byId.get(ref.signalId);
      if (entry === void 0) {
        entry = { boundNodeIds: /* @__PURE__ */ new Set(), bindingCount: 0 };
        byId.set(ref.signalId, entry);
      }
      entry.boundNodeIds.add(node.id);
      entry.bindingCount += 1;
    }
  });
  const live = options.signalsById;
  const signals = [...byId.entries()].sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0).map(([signalId, entry]) => {
    const base = {
      signalId,
      boundNodeIds: [...entry.boundNodeIds],
      bindingCount: entry.bindingCount
    };
    const sig = live?.[signalId];
    if (sig === void 0) return base;
    const oc = observerCount2(sig);
    return {
      ...base,
      kind: signalKind2(sig),
      ...oc !== void 0 ? { observerCount: oc } : {}
    };
  });
  return { signals, edges };
}

// src/inspect-ssr.ts
import { analyzeGraph } from "@streetui/compiler/diagnostics";
function countType(graph, type) {
  let n = 0;
  graph.walk((node) => {
    if (node.type === type) n += 1;
  });
  return n;
}
function inspectHydration(compiled) {
  const graph = compiled.graph;
  const { summary } = analyzeGraph(graph);
  const dynamicNodes = summary.totalNodes - summary.staticNodes;
  const staticRatio = summary.totalNodes === 0 ? 0 : Math.round(summary.staticNodes / summary.totalNodes * 1e4) / 1e4;
  return {
    totalNodes: summary.totalNodes,
    staticNodes: summary.staticNodes,
    staticSubtrees: summary.staticSubtrees,
    dynamicNodes,
    dynamicTextNodes: summary.dynamicTextNodes,
    dynamicAttrNodes: summary.dynamicAttrNodes,
    eventNodes: summary.eventNodes,
    lists: summary.lists,
    conditionals: summary.conditionals,
    portals: countType(graph, "portal"),
    headAnchors: countType(graph, "head"),
    staticRatio
  };
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
  const events = inspectEvents(compiled.graph);
  const signalGraph = inspectSignalGraph(
    compiled,
    sources.signalsById !== void 0 ? { signalsById: sources.signalsById } : {}
  );
  const hydration = inspectHydration(compiled);
  const snapshot = {
    application,
    graph: app.graph,
    signals,
    performance,
    components,
    overlays: interactions.overlays,
    transitions: interactions.transitions,
    diagnostics,
    events,
    signalGraph,
    hydration,
    ...sources.router !== void 0 ? { router: inspectRouter(sources.router) } : {},
    ...sources.resources !== void 0 ? { resources: mapInspect(sources.resources, (r) => inspectResource(r)) } : {},
    ...sources.mutations !== void 0 ? { mutations: mapInspect(sources.mutations, (m) => inspectMutation(m)) } : {},
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
  if (s.mutations !== void 0) {
    lines.push("Mutations:");
    for (const [label, m] of Object.entries(s.mutations)) {
      lines.push(`  ${label}: ${m.status}${m.pending ? " (pending)" : ""}${m.hasError ? ` !${m.errorName}` : ""}`);
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
  lines.push(
    `Events: ${s.events.nodes.length} node(s), ${s.events.totalHandlers} handler(s)` + (Object.keys(s.events.byType).length > 0 ? ` \xB7 ${Object.entries(s.events.byType).map(([t, n]) => `${t}\xD7${n}`).join(", ")}` : "")
  );
  lines.push(
    `Signal graph: ${s.signalGraph.signals.length} signal(s), ${s.signalGraph.edges.length} binding edge(s)`
  );
  const h = s.hydration;
  lines.push(
    `SSR/Hydration: ${h.staticNodes}/${h.totalNodes} static (${(h.staticRatio * 100).toFixed(1)}%), ${h.dynamicNodes} dynamic \xB7 ${h.staticSubtrees} static subtree(s) \xB7 ${h.portals} portal(s), ${h.headAnchors} head anchor(s)`
  );
  lines.push("  (structural counts only \u2014 not wall-clock timings; browser gate BLOCKED)");
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

// src/interactive.ts
var DEVTOOLS_TABS = [
  { id: "components", label: "Component Tree" },
  { id: "inspector", label: "Component Inspector" },
  { id: "state", label: "Reactive State" },
  { id: "signalGraph", label: "Signal Graph" },
  { id: "router", label: "Router" },
  { id: "resources", label: "Resource / Async" },
  { id: "mutations", label: "Mutations" },
  { id: "events", label: "Events" },
  { id: "overlays", label: "Overlays" },
  { id: "performance", label: "Performance" },
  { id: "diagnostics", label: "Error Diagnostics" },
  { id: "hydration", label: "SSR / Hydration" }
];
var EMBED_ESCAPE = new RegExp("[<\\u2028\\u2029]", "g");
function embedJson(snapshot) {
  return JSON.stringify(snapshot).replace(EMBED_ESCAPE, (ch) => {
    const code = ch.charCodeAt(0).toString(16).padStart(4, "0");
    return `\\u${code}`;
  });
}
function renderInteractiveDevTools(snapshot, options = {}) {
  const app = snapshot.application;
  const title = options.title ?? `StreetUI DevTools \u2014 ${app.identity.name}`;
  const initialTab = options.initialTab ?? DEVTOOLS_TABS[0].id;
  const tabButtons = DEVTOOLS_TABS.map(
    (t) => `<button type="button" role="tab" class="st-tab" data-tab="${escapeHtml(t.id)}"${t.id === initialTab ? ' aria-selected="true"' : ' aria-selected="false"'}>${escapeHtml(t.label)}</button>`
  ).join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>${INTERACTIVE_CSS}</style></head><body class="st-dt"><header class="st-top"><h1>${escapeHtml(title)} <span class="st-dim">v${escapeHtml(app.identity.version)}</span></h1><button type="button" id="st-refresh" class="st-refresh">&#8635; Refresh</button></header><nav class="st-tabs" role="tablist" aria-label="DevTools panels">${tabButtons}</nav><main id="st-panel" class="st-body" role="tabpanel" aria-live="polite"></main><footer class="st-foot"><span class="st-dim">Structural inspection over one compiled graph. Not a production profiler; browser/AT conformance not claimed (gates BLOCKED).</span></footer><script type="application/json" id="st-data">${embedJson(snapshot)}</script><script>${CONTROLLER_JS.replace("__INITIAL_TAB__", JSON.stringify(initialTab))}</script></body></html>`;
}
var CONTROLLER_JS = [
  "(function(){",
  '"use strict";',
  "var INITIAL_TAB=__INITIAL_TAB__;",
  "function esc(v){",
  " if(v===null||v===undefined)return String(v);",
  " var s=typeof v==='string'?v:(typeof v==='object'?sj(v):String(v));",
  ` return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');`,
  "}",
  'function sj(v){try{return JSON.stringify(v);}catch(e){return "[object]";}}',
  'function read(){var el=document.getElementById("st-data");if(!el)return {};try{return JSON.parse(el.textContent||"{}");}catch(e){return {};}}',
  "var state={data:read(),tab:INITIAL_TAB,selected:null};",
  "function findNode(n,id){if(!n)return null;if(n.id===id)return n;var c=n.children||[];for(var i=0;i<c.length;i++){var f=findNode(c[i],id);if(f)return f;}return null;}",
  'function empty(m){return "<p class=\\"st-empty\\">"+esc(m||"(none)")+"</p>";}',
  'function kv(k,v){return "<div class=\\"st-kv\\"><span class=\\"st-k\\">"+esc(k)+"</span><span class=\\"st-v\\">"+esc(v)+"</span></div>";}',
  "function rComponents(){",
  " var cs=state.data.components||[];",
  ' if(!cs.length)return empty("No component() instances");',
  ' var h="<ul class=\\"st-list\\">";',
  " for(var i=0;i<cs.length;i++){var c=cs[i];",
  '  h+="<li class=\\"st-row st-click\\" data-node=\\""+esc(c.id||"")+"\\">"',
  '   +"<span class=\\"st-ind\\" style=\\"--d:"+(c.depth||0)+"\\"></span>"',
  '   +"<code>"+esc(c.name)+"</code>"',
  '   +(c.key!=null?" <span class=\\"st-key\\">#"+esc(c.key)+"</span>":"")',
  '   +" <span class=\\"st-dim\\">"+(c.childCount||0)+" child</span></li>";}',
  ' return h+"</ul><p class=\\"st-dim\\">Click a component to inspect it.</p>";',
  "}",
  "function rInspector(){",
  ' if(!state.selected)return empty("Select a node in Component Tree, Events or Overlays");',
  " var n=findNode(state.data.graph,state.selected);",
  ' if(!n)return empty("Node "+state.selected+" not found in current snapshot");',
  ' var h="<h3><code>&lt;"+esc(n.type)+"&gt;</code>"+(n.key!=null?" <span class=\\"st-key\\">#"+esc(n.key)+"</span>":"")+"</h3>";',
  ' h+=kv("id",n.id)+kv("depth",n.depth)+kv("children",(n.children||[]).length);',
  " var pk=Object.keys(n.props||{});",
  ' h+="<h4>Props</h4>"+(pk.length?pk.map(function(k){return kv(k,n.props[k]);}).join(""):empty("none"));',
  ' h+="<h4>Event types</h4>"+((n.eventTypes||[]).length?"<code>"+esc((n.eventTypes||[]).join(", "))+"</code>":empty("none"));',
  ' h+="<h4>State bindings</h4>"+((n.stateBindings||[]).length?"<ul class=\\"st-list\\">"+n.stateBindings.map(function(b){return "<li><code>"+esc(b)+"</code></li>";}).join("")+"</ul>":empty("none"));',
  " return h;",
  "}",
  "function rState(){",
  " var s=state.data.signals||{};var live=s.live||{};var ids=s.boundSignalIds||[];",
  ' var h="<p class=\\"st-dim\\">"+ids.length+" signal id(s) bound in graph. Effects are shown as observer counts (no global effect registry).</p>";',
  " var labels=Object.keys(live);",
  ' if(!labels.length)return h+empty("No live signals registered with DevTools");',
  ' h+="<ul class=\\"st-list\\">";',
  " for(var i=0;i<labels.length;i++){var l=labels[i];var sg=live[l];",
  '  h+="<li><code>"+esc(l)+"</code> <span class=\\"st-key\\">["+esc(sg.kind)+"]</span> = <code>"+esc(sg.value)+"</code> <span class=\\"st-dim\\">observers "+esc(sg.observerCount==null?"?":sg.observerCount)+"</span></li>";}',
  ' return h+"</ul>";',
  "}",
  "function rSignalGraph(){",
  " var g=state.data.signalGraph||{signals:[],edges:[]};",
  ' if(!(g.signals||[]).length)return empty("No signal bindings in graph");',
  ' var h="<p class=\\"st-dim\\">"+g.signals.length+" signal(s), "+(g.edges||[]).length+" binding edge(s)</p><ul class=\\"st-list\\">";',
  " for(var i=0;i<g.signals.length;i++){var sn=g.signals[i];",
  '  h+="<li><code>"+esc(sn.signalId)+"</code> <span class=\\"st-dim\\">&rarr; "+(sn.boundNodeIds||[]).length+" node(s), "+sn.bindingCount+" edge(s)</span>"',
  '   +(sn.kind?" <span class=\\"st-key\\">["+esc(sn.kind)+"]</span>":"")',
  '   +(sn.observerCount!=null?" <span class=\\"st-dim\\">obs "+esc(sn.observerCount)+"</span>":"")+"</li>";}',
  ' return h+"</ul>";',
  "}",
  "function rRouter(){",
  ' var r=state.data.router;if(!r)return empty("No router registered");',
  ' return kv("path",r.path)+kv("pattern",r.pattern)+kv("fallback",r.isFallback?"yes":"no")',
  '  +"<h4>Params</h4>"+(Object.keys(r.params||{}).length?Object.keys(r.params).map(function(k){return kv(k,r.params[k]);}).join(""):empty("none"))',
  '  +"<h4>Query</h4>"+(Object.keys(r.query||{}).length?Object.keys(r.query).map(function(k){return kv(k,r.query[k]);}).join(""):empty("none"));',
  "}",
  "function rResources(){",
  ' var rs=state.data.resources;if(!rs||!Object.keys(rs).length)return empty("No resources registered");',
  ' var ks=Object.keys(rs);var h="<ul class=\\"st-list\\">";',
  " for(var i=0;i<ks.length;i++){var r=rs[ks[i]];",
  '  h+="<li><code>"+esc(ks[i])+"</code>: <span class=\\"st-key\\">"+esc(r.status)+"</span>"',
  '   +(r.loading?" <span class=\\"st-dim\\">(loading)</span>":"")',
  '   +(r.isRefetching?" <span class=\\"st-dim\\">(refetching)</span>":"")',
  '   +(r.hasError?" <span class=\\"st-err\\">!"+esc(r.errorName)+"</span>":"")+"</li>";}',
  ' return h+"</ul>";',
  "}",
  "function rMutations(){",
  ' var ms=state.data.mutations;if(!ms||!Object.keys(ms).length)return empty("No mutations registered");',
  ' var ks=Object.keys(ms);var h="<ul class=\\"st-list\\">";',
  " for(var i=0;i<ks.length;i++){var m=ms[ks[i]];",
  '  h+="<li><code>"+esc(ks[i])+"</code>: <span class=\\"st-key\\">"+esc(m.status)+"</span>"',
  '   +(m.pending?" <span class=\\"st-dim\\">(pending)</span>":"")',
  '   +(m.hasError?" <span class=\\"st-err\\">!"+esc(m.errorName)+"</span>":"")+"</li>";}',
  ' return h+"</ul>";',
  "}",
  "function rEvents(){",
  " var e=state.data.events||{nodes:[],totalHandlers:0,byType:{}};",
  " var bt=e.byType||{};var bk=Object.keys(bt);",
  ' var h="<p class=\\"st-dim\\">"+(e.nodes||[]).length+" node(s), "+e.totalHandlers+" handler(s)</p>";',
  ' h+=bk.length?"<p>"+bk.map(function(t){return "<span class=\\"st-badge\\">"+esc(t)+" &times;"+bt[t]+"</span>";}).join(" ")+"</p>":"";',
  ' if(!(e.nodes||[]).length)return h+empty("No event handlers wired");',
  ' h+="<ul class=\\"st-list\\">";',
  " for(var i=0;i<e.nodes.length;i++){var n=e.nodes[i];",
  '  h+="<li class=\\"st-row st-click\\" data-node=\\""+esc(n.id)+"\\"><code>&lt;"+esc(n.nodeType)+"&gt;</code>"',
  '   +(n.key!=null?" <span class=\\"st-key\\">#"+esc(n.key)+"</span>":"")',
  '   +" <span class=\\"st-dim\\">"+esc((n.eventTypes||[]).join(", "))+"</span></li>";}',
  ' return h+"</ul>";',
  "}",
  "function rOverlays(){",
  ' var os=state.data.overlays||[];if(!os.length)return empty("No overlays wired");',
  ' var h="<ul class=\\"st-list\\">";',
  " for(var i=0;i<os.length;i++){var o=os[i];",
  '  var kind=o.modal?"modal":(o.menu?"menu":(o.takesFocus?"focusable":"non-modal"));',
  '  h+="<li class=\\"st-row st-click\\" data-node=\\""+esc(o.id)+"\\"><code>"+esc(o.key||o.id)+"</code> <span class=\\"st-key\\">["+kind+"]</span> <span class=\\"st-dim\\">"+(o.open?"open":"closed")+(o.closeOnEscape?" \\u00b7 esc":"")+(o.restoreFocus?" \\u00b7 restore":"")+"</span></li>";}',
  ' return h+"</ul>";',
  "}",
  "function rPerformance(){",
  " var p=state.data.performance||{snapshot:{},diagnostics:[]};var snap=p.snapshot||{};",
  ' var h="<p class=\\"st-warn\\">Structural counts, not wall-clock timings. A real render/interaction timeline needs a browser (gate BLOCKED); no timings are fabricated here.</p>";',
  " var sk=Object.keys(snap);",
  ' h+="<h4>Graph metrics</h4>"+(sk.length?sk.map(function(k){return kv(k,snap[k]);}).join(""):empty("none"));',
  " var d=p.diagnostics||[];",
  ' h+="<h4>Diagnostics ("+d.length+")</h4>"+(d.length?"<ul class=\\"st-list\\">"+d.map(function(x){return "<li><code>"+esc(x.code)+"</code>: "+esc(x.message)+"</li>";}).join("")+"</ul>":empty("none"));',
  " return h;",
  "}",
  "function rDiagnostics(){",
  " var d=state.data.diagnostics||{errors:0,warnings:0,messages:[]};",
  ' var h="<p class=\\"st-dim\\">"+d.errors+" error(s) \\u00b7 "+d.warnings+" warning(s) (compiler findings)</p>";',
  " var m=d.messages||[];",
  ' return h+(m.length?"<ul class=\\"st-list\\">"+m.map(function(x){return "<li>"+esc(x)+"</li>";}).join("")+"</ul>":empty("No diagnostics"));',
  "}",
  "function rHydration(){",
  ' var h2=state.data.hydration;if(!h2)return empty("No hydration inspection");',
  " var pct=(h2.staticRatio*100).toFixed(1);",
  ' var h="<p class=\\"st-warn\\">Structural static-vs-dynamic split only \\u2014 NOT wall-clock SSR/hydration timing (browser gate BLOCKED).</p>";',
  ' h+=kv("total nodes",h2.totalNodes)+kv("static nodes",h2.staticNodes+" ("+pct+"%)")+kv("dynamic nodes",h2.dynamicNodes)',
  '  +kv("static subtrees",h2.staticSubtrees)+kv("dynamic text",h2.dynamicTextNodes)+kv("dynamic attrs",h2.dynamicAttrNodes)',
  '  +kv("event nodes",h2.eventNodes)+kv("lists",h2.lists)+kv("conditionals",h2.conditionals)+kv("portals",h2.portals)+kv("head anchors",h2.headAnchors);',
  " return h;",
  "}",
  "var RENDERERS={components:rComponents,inspector:rInspector,state:rState,signalGraph:rSignalGraph,router:rRouter,resources:rResources,mutations:rMutations,events:rEvents,overlays:rOverlays,performance:rPerformance,diagnostics:rDiagnostics,hydration:rHydration};",
  'function renderTab(){var el=document.getElementById("st-panel");if(!el)return;var fn=RENDERERS[state.tab]||function(){return empty("Unknown panel");};',
  " el.innerHTML=fn();",
  ' var rows=el.querySelectorAll(".st-click");',
  ' for(var i=0;i<rows.length;i++){(function(row){row.addEventListener("click",function(){var id=row.getAttribute("data-node");if(id){state.selected=id;selectTab("inspector");}});})(rows[i]);}',
  "}",
  'function selectTab(id){state.tab=id;var tabs=document.querySelectorAll(".st-tab");for(var i=0;i<tabs.length;i++){var t=tabs[i];t.setAttribute("aria-selected",t.getAttribute("data-tab")===id?"true":"false");}renderTab();}',
  'function selectComponent(id){state.selected=id;selectTab("inspector");}',
  'function refresh(){var hook=window.__STREETUI_DEVTOOLS_REFRESH__;if(typeof hook!=="function")return false;var next=hook();if(next&&typeof next==="object"){state.data=next;renderTab();return true;}return false;}',
  "function bind(){",
  ' var tabs=document.querySelectorAll(".st-tab");',
  ' for(var i=0;i<tabs.length;i++){(function(t){t.addEventListener("click",function(){selectTab(t.getAttribute("data-tab"));});})(tabs[i]);}',
  ' var rb=document.getElementById("st-refresh");if(rb)rb.addEventListener("click",refresh);',
  "}",
  "window.__StreetUIDevTools={get data(){return state.data;},get tab(){return state.tab;},get selected(){return state.selected;},selectTab:selectTab,selectComponent:selectComponent,refresh:refresh,render:renderTab};",
  "bind();renderTab();",
  "})();"
].join("\n");
var INTERACTIVE_CSS = [
  "*{box-sizing:border-box}",
  ".st-dt{font:13px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;margin:0;color:#e6e6e6;background:#1e1e28;display:flex;flex-direction:column;min-height:100vh}",
  ".st-top{display:flex;align-items:center;justify-content:space-between;padding:10px 16px;border-bottom:1px solid #333;background:#15151c}",
  ".st-top h1{font-size:14px;margin:0}",
  ".st-refresh{font:inherit;color:#e6e6e6;background:#2c2c3a;border:1px solid #3a3a4a;border-radius:5px;padding:4px 10px;cursor:pointer}",
  ".st-refresh:hover{background:#37374a}",
  ".st-tabs{display:flex;flex-wrap:wrap;gap:2px;padding:6px 10px;border-bottom:1px solid #2c2c38;background:#191922}",
  ".st-tab{font:inherit;color:#b8b8c8;background:transparent;border:0;border-radius:5px;padding:5px 10px;cursor:pointer}",
  ".st-tab:hover{background:#26263200}",
  '.st-tab[aria-selected="true"]{background:#2f2f40;color:#fff}',
  ".st-body{flex:1;padding:12px 16px;overflow:auto}",
  ".st-body h3{font-size:13px;margin:2px 0 8px}.st-body h4{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#9a9aae;margin:14px 0 4px}",
  ".st-list{list-style:none;margin:0;padding:0}.st-list li{padding:2px 0}",
  ".st-row{display:flex;align-items:center;gap:6px}.st-click{cursor:pointer;border-radius:4px;padding:2px 4px}.st-click:hover{background:#26263a}",
  ".st-ind{display:inline-block;width:calc(var(--d,0)*12px)}",
  ".st-kv{display:flex;gap:10px;padding:1px 0}.st-k{color:#9a9aae;min-width:120px}.st-v{color:#d7d7e0;word-break:break-all}",
  ".st-badge{display:inline-block;background:#2c2c3a;border-radius:10px;padding:1px 8px;font-size:11px}",
  ".st-foot{padding:6px 16px;border-top:1px solid #2c2c38;background:#15151c}",
  ".st-dim{color:#8a8a9a}.st-key{color:#7db4ff}.st-err{color:#ff8a8a}.st-empty{color:#6a6a7a}.st-warn{color:#ffce8a;margin:0 0 10px}",
  "code{color:#d7d7e0}"
].join("");

// src/devtools-report.ts
function renderDevToolsReport(compiled, sources = {}, options = {}) {
  const session = createDevTools(compiled, sources, options);
  return renderDevToolsHTML(session.snapshot);
}
export {
  DEFAULT_PERF_THRESHOLDS,
  DEVTOOLS_TABS,
  createDevTools,
  diagnosePerformance,
  escapeHtml,
  inspectApplication,
  inspectComponents,
  inspectContext,
  inspectEvents,
  inspectForm,
  inspectGraph,
  inspectHydration,
  inspectI18n,
  inspectInteractions,
  inspectMutation,
  inspectResource,
  inspectRouter,
  inspectSignal,
  inspectSignalGraph,
  nodeTypeStats,
  printDiagnostics,
  printGraph,
  renderDevToolsHTML,
  renderDevToolsReport,
  renderInteractiveDevTools
};
//# sourceMappingURL=index.js.map