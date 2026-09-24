// src/app.ts
import { streetui } from "@streetui/dsl";
import { signal, derived } from "@streetui/state";
import { compile } from "@streetui/compiler";
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
function snapshot(state) {
  return {
    count: state.count.peek(),
    name: state.name.peek(),
    showDetails: state.showDetails.peek(),
    todos: state.todos.peek().map((t) => ({ id: t.id, label: t.label }))
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

// src/document.ts
import { renderToString, serializeState } from "@streetui/renderer";
function renderDocument(seed) {
  const state = createState(seed);
  const compiled = compileApp(state);
  const body = renderToString(compiled);
  const island = serializeState({ [STATE_KEY]: snapshot(state) });
  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    "<title>StreetUI SSR</title>",
    "</head>",
    "<body>",
    `<div id="app">${body}</div>`,
    island,
    '<script type="module" src="/browser-entry.js"></script>',
    "</body>",
    "</html>"
  ].join("\n");
}

// src/browser-entry.ts
import { createRenderer, readState } from "@streetui/renderer";
import { BrowserDOMAdapter } from "@streetui/dom";
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
  STATE_KEY,
  buildApp,
  compileApp,
  createState,
  hydrateApp,
  renderDocument,
  snapshot
};
//# sourceMappingURL=index.js.map