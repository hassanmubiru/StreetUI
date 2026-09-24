// src/docs-app.ts
import { signal, derived } from "streetui";
import {
  createRouter,
  mountRouter,
  routerOutlet
} from "streetui";
var DOC_SECTIONS = [
  {
    slug: "getting-started",
    title: "Getting Started",
    body: "Install StreetUI, define an app with streetui.app(), add pages, compile and mount."
  },
  {
    slug: "architecture",
    title: "Architecture",
    body: "DSL compiles to a semantic application graph; the runtime binds signals; the renderer patches real DOM."
  },
  {
    slug: "api",
    title: "API",
    body: "Signals, derived, effect, when(), listOf, bound inputs, and the router: createRouter + mountRouter."
  }
];
function findSection(slug) {
  return DOC_SECTIONS.find((s) => s.slug === slug);
}
var EXAMPLES = [
  { id: 1, name: "Counter", tag: "state" },
  { id: 2, name: "Reactive list", tag: "list" },
  { id: 3, name: "Contact form", tag: "forms" },
  { id: 4, name: "Conditional panel", tag: "when" },
  { id: 5, name: "Docs router", tag: "router" }
];
function pageLayout(page, opts, body) {
  page.section(opts.id, (s) => {
    s.heading(opts.title, { level: 1, id: `${opts.id}-title` });
    s.container(`${opts.id}-body`, (content) => body(content), { id: `${opts.id}-body` });
  }, { id: `page-${opts.id}` });
}
function navLink(scope, router, label, href, id, exact = false) {
  scope.link(label, { href, id });
  scope.when(router.isActive(href, { exact }), (c) => {
    c.text(" (active)", { id: `${id}-active` });
  });
}
function docsShell(shell, router) {
  shell.section("nav", (n) => {
    n.heading("StreetUI", { level: 1, id: "brand" });
    navLink(n, router, "Home", "/", "nav-home", true);
    navLink(n, router, "Docs", "/docs", "nav-docs");
    navLink(n, router, "Examples", "/examples", "nav-examples");
    navLink(n, router, "About", "/about", "nav-about");
    n.link("GitHub", { href: "https://example.com/streetui", external: true, id: "nav-github" });
  }, { id: "site-nav" });
  routerOutlet(shell);
  shell.section("footer", (f) => {
    f.text("Built with StreetUI + @streetui/router.", { id: "footer-text" });
  }, { id: "site-footer" });
}
function buildRoutes(state) {
  const home = {
    path: "/",
    builder: (page) => pageLayout(page, { id: "home", title: "Build UIs from a semantic graph" }, (c) => {
      c.text("A TypeScript-first UI framework with its own reactivity and a keyed real-DOM reconciler.", {
        id: "home-tagline"
      });
      c.link("Read the docs", { href: "/docs", id: "home-docs-link" });
      c.link("See examples", { href: "/examples", id: "home-examples-link" });
    })
  };
  const docsIndex = {
    path: "/docs",
    builder: (page) => pageLayout(page, { id: "docs", title: "Documentation" }, (c) => {
      c.text("Choose a section:", { id: "docs-intro" });
      for (const section of DOC_SECTIONS) {
        c.link(section.title, { href: `/docs/${section.slug}`, id: `docs-link-${section.slug}` });
      }
    })
  };
  const docsSection = {
    path: "/docs/:section",
    builder: (page, ctx) => {
      const slug = ctx.params.section ?? "";
      const section = findSection(slug);
      pageLayout(page, { id: "docsection", title: section?.title ?? "Unknown section" }, (c) => {
        if (section !== void 0) {
          c.text(section.body, { id: "docsection-body-text" });
        } else {
          c.text(`No documentation section named "${slug}".`, { id: "docsection-missing" });
        }
        c.link("Back to docs", { href: "/docs", id: "docsection-back" });
      });
    }
  };
  const examples = {
    path: "/examples",
    builder: (page, ctx) => {
      state.filter.set(ctx.query.get("q") ?? "");
      const filtered = derived(() => {
        const q = state.filter.get().trim().toLowerCase();
        if (q === "") return EXAMPLES.slice();
        return EXAMPLES.filter(
          (e) => e.name.toLowerCase().includes(q) || e.tag.toLowerCase().includes(q)
        );
      });
      pageLayout(page, { id: "examples", title: "Examples" }, (c) => {
        c.text("Filter the examples:", { id: "examples-hint" });
        c.input({ id: "examples-filter", type: "search", placeholder: "Filter\u2026", bind: state.filter });
        c.listOf("examples", filtered, (item, _i, content) => {
          content.text(`${item.name} \u2014 ${item.tag}`, { id: `example-${item.id}` });
        }, { id: "examples-list" });
        c.when(derived(() => filtered.get().length === 0), (empty) => {
          empty.text("No examples match your filter.", { id: "examples-empty" });
        });
      });
    }
  };
  const about = {
    path: "/about",
    builder: (page) => pageLayout(page, { id: "about", title: "About" }, (c) => {
      c.text("StreetUI is a semantic UI framework. This docs site is built with it.", {
        id: "about-text"
      });
    })
  };
  const notFound = {
    path: "*",
    builder: (page, ctx) => pageLayout(page, { id: "notfound", title: "404 \u2014 Not found" }, (c) => {
      c.text(`Nothing here at ${ctx.path}.`, { id: "notfound-text" });
      c.link("Go home", { href: "/", id: "notfound-home" });
    })
  };
  return [home, docsIndex, docsSection, examples, about, notFound];
}
function createDocsApp(history) {
  const state = { filter: signal("") };
  const routesConfig = history !== void 0 ? { routes: buildRoutes(state), history } : { routes: buildRoutes(state) };
  const router = createRouter(routesConfig);
  return { router, state };
}
function mountDocsApp(container2, history) {
  const { router, state } = createDocsApp(history);
  const mounted = mountRouter(router, {
    container: container2,
    shell: (shell) => docsShell(shell, router)
  });
  return { router, state, unmount: () => mounted.unmount() };
}

// src/index.ts
var container = document.getElementById("app");
if (container !== null) {
  mountDocsApp(container);
}
//# sourceMappingURL=index.js.map