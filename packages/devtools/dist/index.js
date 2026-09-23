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
export {
  inspectGraph,
  nodeTypeStats,
  printDiagnostics,
  printGraph
};
//# sourceMappingURL=index.js.map