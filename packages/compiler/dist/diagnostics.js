// src/analysis/analyze.ts
var TEXT_PROP_KEYS = /* @__PURE__ */ new Set(["text", "label", "value"]);
function analyzeGraph(graph) {
  const nodes = /* @__PURE__ */ new Map();
  const summary = {
    totalNodes: 0,
    staticNodes: 0,
    staticSubtrees: 0,
    dynamicTextNodes: 0,
    dynamicAttrNodes: 0,
    eventNodes: 0,
    lists: 0,
    conditionals: 0
  };
  const visit = (node) => {
    let allChildrenStatic = true;
    for (const child of node.children) {
      const childSubtreeStatic = visit(child);
      if (!childSubtreeStatic) allChildrenStatic = false;
    }
    let hasDynamicText = false;
    let hasDynamicAttr = false;
    for (const ref of node.stateRefs) {
      if (TEXT_PROP_KEYS.has(ref.propKey)) hasDynamicText = true;
      else hasDynamicAttr = true;
    }
    const hasEvents = node.events.length > 0;
    const isList = node.type === "reactive-list";
    const isConditional = node.type === "conditional";
    const isStatic = node.stateRefs.length === 0 && !hasEvents && !isList && !isConditional;
    const isStaticSubtree = isStatic && allChildrenStatic;
    nodes.set(node.id, {
      isStatic,
      isStaticSubtree,
      hasDynamicText,
      hasDynamicAttr,
      hasEvents,
      isList,
      isConditional
    });
    summary.totalNodes += 1;
    if (isStatic) summary.staticNodes += 1;
    if (isStaticSubtree) summary.staticSubtrees += 1;
    if (hasDynamicText) summary.dynamicTextNodes += 1;
    if (hasDynamicAttr) summary.dynamicAttrNodes += 1;
    if (hasEvents) summary.eventNodes += 1;
    if (isList) summary.lists += 1;
    if (isConditional) summary.conditionals += 1;
    return isStaticSubtree;
  };
  visit(graph.root);
  return { nodes, summary };
}

// src/analysis/inspect.ts
function inspectCompilation(graph) {
  const analysis = analyzeGraph(graph);
  const nodes = [];
  const walk = (node, depth) => {
    const a = analysis.nodes.get(node.id);
    if (a !== void 0) {
      const classification = a.isStaticSubtree ? "static-subtree-root" : a.isStatic ? "static" : "dynamic";
      nodes.push({
        id: node.id,
        type: node.type,
        depth,
        classification,
        dynamicText: a.hasDynamicText,
        dynamicAttrs: a.hasDynamicAttr,
        events: node.events.map((e) => e.type),
        boundProps: node.stateRefs.map((r) => r.propKey),
        isList: a.isList,
        isConditional: a.isConditional,
        hydration: a.isStaticSubtree ? "adopt-static" : "verify-dynamic"
      });
    }
    for (const child of node.children) walk(child, depth + 1);
  };
  walk(graph.root, 0);
  const staticRatio = analysis.summary.totalNodes === 0 ? 0 : analysis.summary.staticNodes / analysis.summary.totalNodes;
  return {
    name: graph.name,
    version: graph.version,
    summary: { ...analysis.summary, staticRatio: +staticRatio.toFixed(4) },
    nodes
  };
}
function formatInspection(inspection) {
  const s = inspection.summary;
  const lines = [];
  lines.push(`StreetUI compiler inspection \u2014 ${inspection.name} v${inspection.version}`);
  lines.push(
    `  nodes=${s.totalNodes} static=${s.staticNodes} staticSubtrees=${s.staticSubtrees} dynamicText=${s.dynamicTextNodes} dynamicAttrs=${s.dynamicAttrNodes} events=${s.eventNodes} lists=${s.lists} conditionals=${s.conditionals} staticRatio=${(s.staticRatio * 100).toFixed(1)}%`
  );
  for (const n of inspection.nodes) {
    const flags = [];
    if (n.dynamicText) flags.push("text");
    if (n.dynamicAttrs) flags.push("attr:" + n.boundProps.join(","));
    if (n.events.length > 0) flags.push("on:" + n.events.join(","));
    if (n.isList) flags.push("list");
    if (n.isConditional) flags.push("cond");
    lines.push(
      `  ${"  ".repeat(n.depth)}${n.type}#${n.id} [${n.classification}]` + (flags.length > 0 ? ` {${flags.join(" ")}}` : "")
    );
  }
  return lines.join("\n");
}
export {
  analyzeGraph,
  formatInspection,
  inspectCompilation
};
//# sourceMappingURL=diagnostics.js.map