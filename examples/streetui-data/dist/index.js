// src/data-app.ts
import { derived, resource } from "streetui";
import {
  createRouter,
  mountRouter,
  routerOutlet
} from "streetui";
async function fetchProducts(baseUrl, signal2) {
  const response = await fetch(`${baseUrl}/api/products`, { signal: signal2 });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return await response.json();
}
async function fetchProduct(baseUrl, id, signal2) {
  const products = await fetchProducts(baseUrl, signal2);
  const found = products.find((p) => p.id === id);
  if (found === void 0) throw new Error(`Product ${id} not found`);
  return found;
}
function pageLayout(scope, opts, body) {
  scope.section(opts.id, (s) => {
    s.heading(opts.title, { level: 1, id: `${opts.id}-title` });
    s.container(`${opts.id}-body`, (content) => body(content), { id: `${opts.id}-body` });
  }, { id: `page-${opts.id}` });
}
function buildRoutes(opts) {
  const home = {
    path: "/",
    builder: (page) => pageLayout(page, { id: "home", title: "StreetUI Store" }, (c) => {
      c.text("A data-driven demo backed by a real HTTP API.", { id: "home-tagline" });
      c.link("Browse products", { href: "/products", id: "home-products-link" });
    })
  };
  const products = {
    path: "/products",
    builder: (page, ctx) => {
      const res = resource(
        ({ signal: signal2 }) => fetchProducts(opts.baseUrl, signal2),
        { onCleanup: ctx.onCleanup }
      );
      opts.onProductsResource?.(res);
      const list = derived(() => res.data.get() ?? []);
      const showEmpty = derived(
        () => res.status.get() === "success" && list.get().length === 0
      );
      pageLayout(page, { id: "products", title: "Products" }, (c) => {
        c.errorBoundary("products-boundary", (body) => {
          body.when(derived(() => res.loading.get() && res.data.get() === void 0), (l) => {
            l.text("Loading products\u2026", { id: "products-loading" });
          });
          body.listOf("products", list, (item, _i, content) => {
            content.text(`${item.name} \u2014 $${item.price}`, { id: `product-${item.id}` });
            content.link("Details", { href: `/products/${item.id}`, id: `product-link-${item.id}` });
          }, { id: "products-list" });
          body.when(showEmpty, (e) => {
            e.text("No products available.", { id: "products-empty" });
          });
        }, {
          source: res.error,
          onRetry: () => {
            void res.refetch();
          },
          fallback: (fb, error, retry) => {
            fb.text(`Unable to load products (${error.message}).`, { id: "products-error" });
            fb.button("Retry", { id: "products-retry", onClick: retry });
          }
        });
      });
    }
  };
  const productDetail = {
    path: "/products/:id",
    builder: (page, ctx) => {
      const id = Number(ctx.params.id ?? "0");
      const res = resource(
        ({ signal: signal2 }) => fetchProduct(opts.baseUrl, id, signal2),
        { onCleanup: ctx.onCleanup }
      );
      opts.onProductResource?.(res);
      const name = derived(() => res.data.get()?.name ?? "");
      const price = derived(() => res.data.get()?.price ?? 0);
      pageLayout(page, { id: "detail", title: "Product" }, (c) => {
        c.errorBoundary("detail-boundary", (body) => {
          body.when(res.loading, (l) => l.text("Loading\u2026", { id: "detail-loading" }));
          body.when(derived(() => res.status.get() === "success"), (ok) => {
            ok.heading(name, { level: 2, id: "detail-name" });
            ok.text(price, { id: "detail-price" });
          });
          body.link("Back to products", { href: "/products", id: "detail-back" });
        }, {
          source: res.error,
          onRetry: () => {
            void res.refetch();
          },
          fallback: (fb, error, retry) => {
            fb.text(`Unable to load product (${error.message}).`, { id: "detail-error" });
            fb.button("Retry", { id: "detail-retry", onClick: retry });
          }
        });
      });
    }
  };
  const notFound = {
    path: "*",
    builder: (page, ctx) => pageLayout(page, { id: "notfound", title: "404 \u2014 Not found" }, (c) => {
      c.text(`Nothing here at ${ctx.path}.`, { id: "notfound-text" });
      c.link("Go home", { href: "/", id: "notfound-home" });
    })
  };
  return [home, products, productDetail, notFound];
}
function dataShell(shell, router) {
  shell.section("nav", (n) => {
    n.heading("StreetUI Store", { level: 1, id: "brand" });
    n.link("Home", { href: "/", id: "nav-home" });
    n.link("Products", { href: "/products", id: "nav-products" });
  }, { id: "site-nav" });
  routerOutlet(shell);
}
function createDataApp(opts) {
  const routesConfig = opts.history !== void 0 ? { routes: buildRoutes(opts), history: opts.history } : { routes: buildRoutes(opts) };
  const router = createRouter(routesConfig);
  return { router };
}
function mountDataApp(container, opts) {
  const { router } = createDataApp(opts);
  const mounted = mountRouter(router, {
    container,
    shell: (shell) => dataShell(shell, router)
  });
  return { router, unmount: () => mounted.unmount() };
}

// src/api-server.ts
import { createServer } from "node:http";
var DEFAULT_PRODUCTS = [
  { id: 1, name: "Antminer S21", price: 3999 },
  { id: 2, name: "Whatsminer M60", price: 3499 },
  { id: 3, name: "Avalon A1466", price: 2899 }
];
function createProductApi(initial = DEFAULT_PRODUCTS) {
  let products = initial;
  let forceFail = false;
  let delayMs = 0;
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const respond = () => {
      if (req.method === "GET" && url.pathname === "/api/products") {
        if (forceFail || url.searchParams.get("fail") === "1") {
          res.statusCode = 500;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ error: "Internal Server Error" }));
          return;
        }
        res.statusCode = 200;
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify(products));
        return;
      }
      res.statusCode = 404;
      res.end("Not found");
    };
    if (delayMs > 0) setTimeout(respond, delayMs);
    else respond();
  });
  return {
    server,
    listen() {
      return new Promise((resolve) => {
        server.listen(0, () => {
          const addr = server.address();
          const port = typeof addr === "object" && addr !== null ? addr.port : 0;
          resolve(`http://localhost:${port}`);
        });
      });
    },
    close() {
      return new Promise((resolve, reject) => {
        server.close((err) => err ? reject(err) : resolve());
      });
    },
    setProducts(next) {
      products = next;
    },
    setFail(fail) {
      forceFail = fail;
    },
    setDelay(ms) {
      delayMs = ms;
    }
  };
}

// src/index.ts
var root = document.getElementById("app");
if (root !== null) {
  mountDataApp(root, { baseUrl: window.location.origin });
}
export {
  createDataApp,
  createProductApi,
  fetchProduct,
  fetchProducts,
  mountDataApp
};
//# sourceMappingURL=index.js.map