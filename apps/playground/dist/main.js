// src/main.ts
import { signal, derived } from "@streetui/state";
import { streetui } from "@streetui/dsl";
import { compile } from "@streetui/compiler";
import { createRuntime } from "@streetui/runtime";
import { createRenderer } from "@streetui/renderer";
import { printGraph, nodeTypeStats } from "@streetui/devtools";
var count = signal(0);
var inputValue = signal("");
var doubled = derived(() => count.get() * 2);
var app = streetui.app({ name: "StreetUI Playground", version: "1.0.0" });
app.page("home", (page) => {
  page.section("header", (section) => {
    section.heading("StreetUI Playground", { level: 1, id: "title" });
    section.text(
      "A TypeScript-first semantic framework with its own renderer. No React. No Vue.",
      { id: "subtitle" }
    );
  });
  page.section("counter-section", (section) => {
    section.heading("Reactive Counter", { level: 2 });
    section.text("Count:", { id: "count-label" });
    section.text(count, { id: "count-value" });
    section.text("Doubled:", { id: "doubled-label" });
    section.text(doubled, { id: "doubled-value" });
    section.container("counter-buttons", (container) => {
      container.button("\u2212 Decrement", {
        id: "dec-btn",
        onClick: () => count.update((n) => n - 1)
      });
      container.button("+ Increment", {
        id: "inc-btn",
        onClick: () => count.update((n) => n + 1)
      });
      container.button("Reset", {
        id: "reset-btn",
        onClick: () => count.set(0)
      });
    });
  });
  page.section("input-section", (section) => {
    section.heading("Reactive Input", { level: 2 });
    section.input({
      id: "demo-input",
      placeholder: "Type something\u2026",
      value: inputValue,
      onInput: (v) => inputValue.set(v)
    });
    section.text("You typed:", { id: "typed-label" });
    section.text(inputValue, { id: "typed-value" });
  });
  page.section("list-section", (section) => {
    section.heading("Framework Pipeline", { level: 2 });
    section.list("pipeline", (list) => {
      const steps = ["DSL", "Compiler", "Semantic Graph", "Runtime", "Renderer", "DOM"];
      for (const step of steps) {
        list.item(step, (item) => {
          item.text(step);
        });
      }
    });
  });
});
var compiled = compile(app);
console.group("[StreetUI DevTools] Graph");
console.log(printGraph(compiled.graph));
console.log("Node stats:", nodeTypeStats(compiled.graph));
console.groupEnd();
function mountApp() {
  const container = document.getElementById("app");
  if (container === null) {
    console.error("[StreetUI] #app container not found in DOM");
    return;
  }
  const renderer = createRenderer();
  const runtime = createRuntime({ renderer });
  const mounted = runtime.mount(compiled, container);
  console.log("[StreetUI] Application mounted:", compiled.name, compiled.version);
  window["streetui"] = {
    count,
    inputValue,
    doubled,
    mounted,
    compiled
  };
}
if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountApp);
  } else {
    mountApp();
  }
}
//# sourceMappingURL=main.js.map