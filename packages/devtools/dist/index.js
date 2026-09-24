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
      largestChildCount: perfAcc.largestChildCount
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
  const snapshot = {
    application,
    graph: app.graph,
    signals,
    performance,
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
export {
  DEFAULT_PERF_THRESHOLDS,
  createDevTools,
  diagnosePerformance,
  inspectApplication,
  inspectContext,
  inspectForm,
  inspectGraph,
  inspectI18n,
  inspectResource,
  inspectRouter,
  inspectSignal,
  nodeTypeStats,
  printDiagnostics,
  printGraph
};
//# sourceMappingURL=index.js.map