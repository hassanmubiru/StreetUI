// src/browser-entry.ts
import { createRenderer, readState } from "streetui";
import { BrowserDOMAdapter } from "streetui";

// src/app.ts
import { streetui } from "streetui";
import { signal, derived } from "streetui";
import { compile } from "streetui";
var STATE_KEY = "ssr-demo";
function createState(seed) {
  return {
    count: signal(seed?.count ?? 0),
    name: signal(seed?.name ?? "world"),
    showDetails: signal(seed?.showDetails ?? false),
    todos: signal(
      (seed?.todos ?? [
        { id: 1, label: "Render on the server" },
        { id: 2, label: "Ship HTML" },
        { id: 3, label: "Hydrate in place" }
      ]).map((t) => ({ id: t.id, label: t.label }))
    )
  };
}
function buildApp(page, state) {
  const countLabel = derived(() => `Count: ${state.count.get()}`);
  const greeting = derived(() => `Hello, ${state.name.get()}!`);
  page.heading("StreetUI \u2014 Universal Rendering", { id: "title" });
  page.section("counter", (s) => {
    s.text(countLabel, { id: "count" });
    s.button("Increment", {
      id: "inc",
      onClick: () => state.count.set(state.count.peek() + 1)
    });
  });
  page.section("greeter", (s) => {
    s.input({ id: "name-input", bind: state.name, placeholder: "your name" });
    s.text(greeting, { id: "greeting" });
  });
  page.section("details", (s) => {
    s.button("Toggle details", {
      id: "toggle",
      onClick: () => state.showDetails.set(!state.showDetails.peek())
    });
    s.when(state.showDetails, (b) => b.text("Server and client share one model.", { id: "detail" }));
  });
  page.section("todos", (s) => {
    s.heading("Todo", { id: "todos-title", level: 2 });
    s.listOf("todo-list", state.todos, (item, _i, c) => c.text(item.label));
  });
}
function compileApp(state) {
  const app = streetui.app({ name: "ssr-demo" });
  app.page("home", (page) => buildApp(page, state));
  return compile(app);
}

// src/browser-entry.ts
function hydrateApp(appContainer, stateRoot) {
  const dom = new BrowserDOMAdapter();
  const transferred = readState(dom, stateRoot ?? appContainer);
  const seed = transferred[STATE_KEY];
  const state = createState(seed);
  const compiled = compileApp(state);
  const renderer = createRenderer({ domAdapter: dom });
  const handle = renderer.hydrate(compiled, appContainer);
  return {
    state,
    unmount: () => handle.unmount()
  };
}
if (typeof document !== "undefined") {
  const boot = () => {
    const app = document.getElementById("app");
    if (app !== null) hydrateApp(app, document);
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
}
export {
  hydrateApp
};
//# sourceMappingURL=browser-entry.js.map