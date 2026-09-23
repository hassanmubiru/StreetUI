// src/counter-app.ts
import { signal } from "@streetui/state";
import { streetui } from "@streetui/dsl";
import { compile } from "@streetui/compiler";
import { createRuntime } from "@streetui/runtime";
import { createRenderer } from "@streetui/renderer";
function createCounterApp() {
  const count = signal(0);
  const app = streetui.app({ name: "Counter", version: "1.0.0" });
  app.page("home", (page) => {
    page.section("main", (section) => {
      section.heading("StreetUI Counter", { level: 1, id: "app-title" });
      section.text(count, { id: "count-display" });
      section.text("Clicks are handled by StreetUI's own runtime and renderer.", {
        id: "description"
      });
      section.button("Increment", {
        id: "increment-btn",
        onClick: () => {
          count.update((n) => n + 1);
        }
      });
      section.button("Reset", {
        id: "reset-btn",
        onClick: () => {
          count.set(0);
        }
      });
    });
  });
  const compiled = compile(app);
  return { compiled, count };
}
function mountCounterApp(container) {
  const { compiled, count } = createCounterApp();
  const renderer = createRenderer();
  const runtime = createRuntime({ renderer });
  const mounted = runtime.mount(compiled, container);
  return {
    count,
    mounted,
    unmount: () => mounted.unmount()
  };
}
export {
  createCounterApp,
  mountCounterApp
};
//# sourceMappingURL=index.js.map