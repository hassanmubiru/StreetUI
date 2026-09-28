// src/compile.ts
import { DiagnosticCollector as DiagnosticCollector2 } from "@streetui/core";

// src/validation/validator.ts
import { DiagnosticCollector } from "@streetui/core";
function validateGraph(graph) {
  const dc = new DiagnosticCollector();
  dc.merge(graph.validate());
  const pages = graph.findByType("page");
  if (pages.length === 0) {
    dc.warn(
      "COMPILER_NO_PAGES",
      "Application has no pages defined. At least one page is recommended."
    );
  }
  graph.walk((node) => {
    validateNode(node, dc);
  });
  return dc;
}
function validateNode(node, dc) {
  switch (node.type) {
    case "heading": {
      const text = node.getProp("text");
      if (text === void 0 || text === "") {
        dc.warn("COMPILER_EMPTY_HEADING", `Heading node "${node.id}" has no text content`, {
          nodeId: node.id
        });
      }
      break;
    }
    case "image": {
      const src = node.getProp("src");
      const alt = node.getProp("alt");
      if (!src) {
        dc.error("COMPILER_IMAGE_NO_SRC", `Image node "${node.id}" is missing src`, {
          nodeId: node.id
        });
      }
      if (!alt) {
        dc.warn("COMPILER_IMAGE_NO_ALT", `Image node "${node.id}" is missing alt text`, {
          nodeId: node.id
        });
      }
      break;
    }
    case "link": {
      const href = node.getProp("href");
      if (!href) {
        dc.error("COMPILER_LINK_NO_HREF", `Link node "${node.id}" is missing href`, {
          nodeId: node.id
        });
      }
      break;
    }
    default:
      break;
  }
}

// src/transform/transform.ts
function transformGraph(graph) {
  graph.walk((node, depth) => {
    applyDefaults(node);
    ensureRenderKey(node, depth);
  });
}
function applyDefaults(node) {
  switch (node.type) {
    case "heading": {
      if (node.getProp("level") === void 0) {
        node.setProp("level", 1);
      }
      break;
    }
    case "input": {
      if (node.getProp("inputType") === void 0) {
        node.setProp("inputType", "text");
      }
      break;
    }
    case "link": {
      if (node.getProp("external") === void 0) {
        node.setProp("external", false);
      }
      break;
    }
    default:
      break;
  }
}
function ensureRenderKey(node, depth) {
  if (node.getProp("_renderKey") === void 0) {
    const key = node.key ?? `${node.type}:${node.id}:${depth}`;
    node.setProp("_renderKey", key);
  }
}

// src/compile.ts
function compile(app, options = {}) {
  const strict = options.strict ?? true;
  const strictWarnings = options.strictWarnings ?? false;
  const dc = new DiagnosticCollector2();
  const graph = app.graph;
  const validationDc = validateGraph(graph);
  dc.merge(validationDc);
  if (strict && dc.hasErrors) {
    dc.throwIfErrors();
  }
  if (strictWarnings && dc.hasWarnings) {
    throw new Error(
      `[StreetUI Compiler] Compilation failed: warnings treated as errors.
` + dc.diagnostics.filter((d) => d.severity === "warning").map((d) => `  [${d.code}] ${d.message}`).join("\n")
    );
  }
  transformGraph(graph);
  return {
    graph,
    diagnostics: dc,
    name: graph.name,
    version: graph.version,
    compiledAt: Date.now()
  };
}
function compileGraph(graph, options = {}) {
  const strict = options.strict ?? true;
  const dc = new DiagnosticCollector2();
  const validationDc = validateGraph(graph);
  dc.merge(validationDc);
  if (strict && dc.hasErrors) {
    dc.throwIfErrors();
  }
  transformGraph(graph);
  return {
    graph,
    diagnostics: dc,
    name: graph.name,
    version: graph.version,
    compiledAt: Date.now()
  };
}
export {
  compile,
  compileGraph,
  transformGraph,
  validateGraph
};
//# sourceMappingURL=index.js.map