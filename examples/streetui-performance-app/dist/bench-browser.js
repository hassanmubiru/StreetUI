// src/routed.ts
import {
  createRouter,
  mountRouter,
  createMemoryHistory,
  createBrowserHistory
} from "streetui";

// src/deps.ts
import { signal, derived, resource } from "streetui";
import { createI18n } from "streetui";
import { createForm, required, minLength, email } from "streetui";
import { createContext } from "streetui";

// src/data.ts
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = a + 1831565813 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
var FIRST = ["Ada", "Grace", "Alan", "Linus", "Edsger", "Barbara", "Ken", "Margaret", "Donald", "Katherine"];
var LAST = ["Lovelace", "Hopper", "Turing", "Torvalds", "Dijkstra", "Liskov", "Thompson", "Hamilton", "Knuth", "Johnson"];
var ROLES = ["admin", "editor", "viewer"];
var STATUSES = ["active", "invited", "suspended"];
var TEAMS = ["Platform", "Growth", "Payments", "Infra", "Mobile", "Data"];
function makeUsers(count, seed = 5338606) {
  const rand = mulberry32(seed);
  const rows = new Array(count);
  for (let i = 0; i < count; i++) {
    const first = FIRST[Math.floor(rand() * FIRST.length)];
    const last = LAST[Math.floor(rand() * LAST.length)];
    const role = ROLES[Math.floor(rand() * ROLES.length)];
    const status = STATUSES[Math.floor(rand() * STATUSES.length)];
    const team = TEAMS[Math.floor(rand() * TEAMS.length)];
    const score = Math.floor(rand() * 1e3);
    rows[i] = {
      id: i + 1,
      name: `${first} ${last}`,
      email: `${first}.${last}.${i + 1}`.toLowerCase() + "@example.com",
      role,
      status,
      score,
      team
    };
  }
  return rows;
}
function selectRows(rows, opts) {
  const q = opts.query.trim().toLowerCase();
  let out = rows.filter((r) => {
    if (opts.role !== "all" && r.role !== opts.role) return false;
    if (q.length === 0) return true;
    return r.name.toLowerCase().includes(q) || r.email.includes(q) || r.team.toLowerCase().includes(q);
  });
  const dir = opts.sortDir === "asc" ? 1 : -1;
  const key = opts.sortKey;
  out = out.slice().sort((a, b) => {
    const av = a[key];
    const bv = b[key];
    if (av < bv) return -1 * dir;
    if (av > bv) return 1 * dir;
    return (a.id - b.id) * dir;
  });
  return out;
}

// src/deps.ts
var ThemeContext = createContext({ name: "light" }, "theme");
var MESSAGES = {
  en: {
    appTitle: "StreetUI Console",
    navHome: "Overview",
    navDashboard: "Dashboard",
    navUsers: "Users",
    navSettings: "Settings",
    usersHeading: "Users ({count})",
    searchPlaceholder: "Search users\u2026",
    filterAll: "All roles",
    totalUsers: "Total users: {count}",
    activeUsers: "Active: {count}",
    avgScore: "Average score: {score}",
    settingsHeading: "Settings",
    save: "Save",
    reset: "Reset",
    openModal: "Open confirmation",
    confirm: "Confirm",
    cancel: "Cancel",
    detailHeading: "User #{id}",
    loading: "Loading\u2026",
    retry: "Retry"
  },
  fr: {
    appTitle: "Console StreetUI",
    navHome: "Aper\xE7u",
    navDashboard: "Tableau de bord",
    navUsers: "Utilisateurs",
    navSettings: "Param\xE8tres",
    usersHeading: "Utilisateurs ({count})",
    searchPlaceholder: "Rechercher\u2026",
    filterAll: "Tous les r\xF4les",
    totalUsers: "Total : {count}",
    activeUsers: "Actifs : {count}",
    avgScore: "Score moyen : {score}",
    settingsHeading: "Param\xE8tres",
    save: "Enregistrer",
    reset: "R\xE9initialiser",
    openModal: "Ouvrir la confirmation",
    confirm: "Confirmer",
    cancel: "Annuler",
    detailHeading: "Utilisateur n\xB0{id}",
    loading: "Chargement\u2026",
    retry: "R\xE9essayer"
  }
};
var DEFAULT_ROWS = 1e4;
var DEFAULT_CONTROLS = 1e3;
function createDeps(options = {}) {
  const { seed, sizing, loadUser, detailId } = options;
  const rowCount = sizing?.rows ?? seed?.rows ?? DEFAULT_ROWS;
  const controlsCount = sizing?.controls ?? seed?.controls ?? DEFAULT_CONTROLS;
  const rows = makeUsers(rowCount);
  const query = signal(seed?.query ?? "");
  const roleFilter = signal(seed?.role ?? "all");
  const sortKey = signal("id");
  const sortDir = signal("asc");
  const visibleRows = derived(
    () => selectRows(rows, {
      query: query.get(),
      role: roleFilter.get(),
      sortKey: sortKey.get(),
      sortDir: sortDir.get()
    })
  );
  const totalCount = derived(() => visibleRows.get().length);
  const activeCount = derived(() => visibleRows.get().filter((r) => r.status === "active").length);
  const avgScore = derived(() => {
    const v = visibleRows.get();
    if (v.length === 0) return 0;
    let sum = 0;
    for (const r of v) sum += r.score;
    return Math.round(sum / v.length);
  });
  const toggles = new Array(controlsCount);
  for (let i = 0; i < controlsCount; i++) toggles[i] = signal(false);
  const toggledCount = derived(() => {
    let n = 0;
    for (const t of toggles) if (t.get()) n++;
    return n;
  });
  const notifications = signal([]);
  const modalOpen = signal(false);
  let notifId = 0;
  const i18n = createI18n({
    locale: seed?.locale ?? "en",
    messages: MESSAGES,
    fallbackLocale: "en"
  });
  const settingsForm = createForm({
    initialValues: { displayName: "", contactEmail: "" },
    validators: {
      displayName: [required(), minLength(2)],
      contactEmail: [required(), email()]
    }
  });
  const userDetail = resource(
    async ({ signal: abort }) => {
      const id = detailId ?? 1;
      if (loadUser) return loadUser(id);
      return await new Promise((res, rej) => {
        queueMicrotask(() => {
          if (abort.aborted) {
            rej(new DOMException("Aborted", "AbortError"));
            return;
          }
          const row = rows[(id - 1) % rows.length];
          res({ id, name: row?.name ?? `User ${id}`, bio: `Profile for user #${id}.` });
        });
      });
    },
    { immediate: detailId !== void 0 }
  );
  const deps = {
    rows,
    controlsCount,
    query,
    roleFilter,
    sortKey,
    sortDir,
    visibleRows,
    totalCount,
    activeCount,
    avgScore,
    toggles,
    toggledCount,
    notifications,
    modalOpen,
    i18n,
    settingsForm,
    userDetail,
    notify(text) {
      notifId += 1;
      notifications.set([...notifications.peek(), { id: notifId, text }]);
    },
    pushToggle(index) {
      const t = toggles[index];
      if (t !== void 0) t.set(!t.peek());
    }
  };
  return deps;
}
function snapshot(deps) {
  return {
    locale: deps.i18n.locale.peek(),
    query: deps.query.peek(),
    role: deps.roleFilter.peek(),
    rows: deps.rows.length,
    controls: deps.controlsCount
  };
}
var STATE_KEY = "performance-app";

// src/shell.ts
import { derived as derived2 } from "streetui";
import { routerOutlet } from "streetui";
function buildShell(shell, router, deps) {
  const { i18n } = deps;
  const theme = ThemeContext.consume();
  shell.section("header", (h) => {
    h.heading(i18n.t("appTitle"), { id: "app-title", level: 1 });
    h.text(derived2(() => `theme:${theme.name}`), { id: "theme-flag" });
    h.button("lang", {
      id: "lang-toggle",
      onClick: () => i18n.setLocale(i18n.locale.peek() === "en" ? "fr" : "en")
    });
  }, { id: "app-header" });
  shell.section("nav", (n) => {
    n.link(i18n.t("navHome"), { href: "/", id: "nav-home" });
    n.link(i18n.t("navDashboard"), { href: "/dashboard", id: "nav-dashboard" });
    n.link(i18n.t("navUsers"), { href: "/users", id: "nav-users" });
    n.link(i18n.t("navSettings"), { href: "/settings", id: "nav-settings" });
  }, { id: "app-nav" });
  shell.section("sidebar", (s) => {
    s.text(derived2(() => i18n.translate("totalUsers", { count: deps.totalCount.get() })), { id: "side-total" });
    s.text(derived2(() => i18n.translate("activeUsers", { count: deps.activeCount.get() })), { id: "side-active" });
  }, { id: "app-sidebar" });
  routerOutlet(shell);
}

// src/views.ts
import { derived as derived3 } from "streetui";
function buildOverview(page, deps) {
  const { i18n } = deps;
  page.section("overview", (s) => {
    s.heading(i18n.t("navHome"), { id: "overview-heading", level: 2 });
    s.text(derived3(() => i18n.translate("totalUsers", { count: deps.totalCount.get() })), { id: "overview-total" });
    s.text(derived3(() => i18n.translate("avgScore", { score: deps.avgScore.get() })), { id: "overview-avg" });
    s.link(i18n.t("navUsers"), { href: "/users", id: "overview-go-users" });
  }, { id: "route-overview" });
}
function buildDashboard(page, deps) {
  const { i18n, notifications } = deps;
  page.section("dashboard", (s) => {
    s.heading(i18n.t("navDashboard"), { id: "dashboard-heading", level: 2 });
    s.section("metrics", (m) => {
      m.text(derived3(() => i18n.translate("totalUsers", { count: deps.totalCount.get() })), { id: "metric-total" });
      m.text(derived3(() => i18n.translate("activeUsers", { count: deps.activeCount.get() })), { id: "metric-active" });
      m.text(derived3(() => i18n.translate("avgScore", { score: deps.avgScore.get() })), { id: "metric-avg" });
      m.text(derived3(() => `toggled:${deps.toggledCount.get()}`), { id: "metric-toggled" });
    }, { id: "dashboard-metrics" });
    s.button("notify", { id: "dashboard-notify", onClick: () => deps.notify("event") });
    s.text(derived3(() => `notifications:${notifications.get().length}`), { id: "notify-count" });
    s.listOf("notifications", notifications, (n, _i, c) => {
      c.text(`#${n.id} ${n.text}`, { class: "notification" });
    }, { id: "notify-list" });
  }, { id: "route-dashboard" });
}
var ROLE_OPTIONS = ["all", "admin", "editor", "viewer"];
var SORT_OPTIONS = ["id", "name", "role", "status", "score", "team"];
function buildUsers(page, deps) {
  const { i18n, query, roleFilter, sortKey, sortDir, visibleRows } = deps;
  page.section("users", (s) => {
    s.heading(derived3(() => i18n.translate("usersHeading", { count: deps.totalCount.get() })), {
      id: "users-heading",
      level: 2
    });
    s.section("users-toolbar", (t) => {
      t.input({ id: "users-search", bind: query, type: "search", placeholder: i18n.translate("searchPlaceholder") });
      for (const role of ROLE_OPTIONS) {
        t.button(role, { id: `filter-${role}`, onClick: () => roleFilter.set(role) });
      }
      for (const key of SORT_OPTIONS) {
        t.button(`sort:${key}`, { id: `sort-${key}`, onClick: () => sortKey.set(key) });
      }
      t.button("dir", {
        id: "sort-dir",
        onClick: () => sortDir.set(sortDir.peek() === "asc" ? "desc" : "asc")
      });
    }, { id: "users-toolbar" });
    s.listOf("rows", visibleRows, (row, _i, c) => {
      c.text(`${row.id}`, { class: "cell cell-id" });
      c.text(row.name, { class: "cell cell-name" });
      c.text(row.email, { class: "cell cell-email" });
      c.text(row.role, { class: "cell cell-role" });
      c.text(row.status, { class: "cell cell-status" });
      c.text(`${row.score}`, { class: "cell cell-score" });
      c.text(row.team, { class: "cell cell-team" });
    }, { id: "users-table" });
  }, { id: "route-users" });
}
function buildControls(page, deps) {
  page.section("controls", (s) => {
    s.heading("Controls", { id: "controls-heading", level: 2 });
    s.text(derived3(() => `toggled:${deps.toggledCount.get()}`), { id: "controls-count" });
    s.section("controls-grid", (g) => {
      for (let i = 0; i < deps.controlsCount; i++) {
        const sig = deps.toggles[i];
        g.button(derived3(() => sig.get() ? "on" : "off"), {
          id: `toggle-${i}`,
          onClick: () => sig.set(!sig.peek())
        });
      }
    }, { id: "controls-grid" });
  }, { id: "route-controls" });
}
function buildSettings(page, deps) {
  const { i18n, settingsForm: form, modalOpen } = deps;
  page.section("settings", (s) => {
    s.heading(i18n.t("settingsHeading"), { id: "settings-heading", level: 2 });
    const name = form.field("displayName");
    const contact = form.field("contactEmail");
    s.form("settings-form", (f) => {
      f.input({ id: "displayName", bind: name.value, placeholder: "display name" });
      f.when(
        derived3(() => name.touched.get() && !name.valid.get()),
        (b) => b.text(derived3(() => name.error.get() ?? ""), { id: "displayName-error" })
      );
      f.input({ id: "contactEmail", bind: contact.value, type: "email", placeholder: "email" });
      f.when(
        derived3(() => contact.touched.get() && !contact.valid.get()),
        (b) => b.text(derived3(() => contact.error.get() ?? ""), { id: "contactEmail-error" })
      );
      f.button(i18n.t("save"), { id: "settings-save", disabled: derived3(() => !form.valid.get()), onClick: () => void form.submit() });
      f.button(i18n.t("reset"), { id: "settings-reset", onClick: () => form.reset() });
    }, { id: "settings-form" });
    s.button(i18n.t("openModal"), { id: "open-modal", onClick: () => modalOpen.set(true) });
    s.when(modalOpen, (m) => {
      m.section("modal", (d) => {
        d.text("Are you sure?", { id: "modal-body" });
        d.button(i18n.t("confirm"), { id: "modal-confirm", onClick: () => {
          deps.notify("confirmed");
          modalOpen.set(false);
        } });
        d.button(i18n.t("cancel"), { id: "modal-cancel", onClick: () => modalOpen.set(false) });
      }, { id: "modal" });
    });
  }, { id: "route-settings" });
}
function buildUserDetail(page, deps, ctx) {
  const { i18n, userDetail } = deps;
  const id = Number(ctx.params.id ?? "0");
  ctx.onCleanup(() => userDetail.dispose());
  page.section("user-detail", (s) => {
    s.heading(derived3(() => i18n.translate("detailHeading", { id })), { id: "detail-heading", level: 2 });
    s.errorBoundary("detail-boundary", (b) => {
      b.when(userDetail.loading, (l) => l.text(i18n.t("loading"), { id: "detail-loading" }));
      b.when(
        derived3(() => userDetail.data.get() !== void 0),
        (d) => d.text(derived3(() => userDetail.data.get()?.name ?? ""), { id: "detail-name" })
      );
    }, {
      source: userDetail.error,
      onRetry: () => void userDetail.refetch(),
      fallback: (fb, _err, retry) => {
        fb.text("Failed to load user.", { id: "detail-error" });
        fb.button(i18n.t("retry"), { id: "detail-retry", onClick: retry });
      }
    });
  }, { id: "route-detail" });
}

// src/routed.ts
function routes(deps) {
  return [
    { path: "/", builder: (page) => buildOverview(page, deps) },
    { path: "/dashboard", builder: (page) => buildDashboard(page, deps) },
    { path: "/users", builder: (page) => buildUsers(page, deps) },
    { path: "/users/:id", builder: (page, ctx) => buildUserDetail(page, deps, ctx) },
    { path: "/settings", builder: (page) => buildSettings(page, deps) },
    { path: "*", builder: (page) => page.section("nf", (s) => s.heading("Not found", { id: "nf", level: 2 })) }
  ];
}
function mountPerfApp(container, opts = {}) {
  const deps = opts.deps ?? createDeps();
  const theme = opts.theme ?? { name: "light" };
  const history = opts.useBrowserHistory ? createBrowserHistory() : createMemoryHistory(opts.path ?? "/");
  const router = createRouter({ routes: routes(deps), history });
  const mounted = ThemeContext.provide(
    theme,
    () => mountRouter(router, {
      container,
      ...opts.hydrate !== void 0 ? { hydrate: opts.hydrate } : {},
      ...opts.renderer !== void 0 ? { renderer: opts.renderer } : {},
      shell: (sh) => buildShell(sh, router, deps)
    })
  );
  return {
    deps,
    router,
    mounted,
    unmount() {
      mounted.unmount();
      router.destroy();
      deps.userDetail.dispose();
      deps.settingsForm.dispose();
    }
  };
}

// src/browser-entry.ts
import { createRenderer, readState, BrowserDOMAdapter } from "streetui";

// src/index.ts
import { streetui, derived as derived4 } from "streetui";
import { compile } from "streetui";
var VIEWS = {
  overview: buildOverview,
  dashboard: buildDashboard,
  users: buildUsers,
  controls: buildControls,
  settings: buildSettings
};
function buildComposedPage(page, deps, view) {
  const { i18n } = deps;
  const theme = ThemeContext.consume();
  page.section("header", (h) => {
    h.heading(i18n.t("appTitle"), { id: "app-title", level: 1 });
    h.text(derived4(() => `theme:${theme.name}`), { id: "theme-flag" });
    h.button("lang", {
      id: "lang-toggle",
      onClick: () => i18n.setLocale(i18n.locale.peek() === "en" ? "fr" : "en")
    });
  }, { id: "app-header" });
  page.section("nav", (n) => {
    n.link(i18n.t("navHome"), { href: "/", id: "nav-home" });
    n.link(i18n.t("navDashboard"), { href: "/dashboard", id: "nav-dashboard" });
    n.link(i18n.t("navUsers"), { href: "/users", id: "nav-users" });
    n.link(i18n.t("navSettings"), { href: "/settings", id: "nav-settings" });
  }, { id: "app-nav" });
  page.section("sidebar", (s) => {
    s.text(derived4(() => i18n.translate("totalUsers", { count: deps.totalCount.get() })), { id: "side-total" });
    s.text(derived4(() => i18n.translate("activeUsers", { count: deps.activeCount.get() })), { id: "side-active" });
  }, { id: "app-sidebar" });
  VIEWS[view](page, deps);
}
function compilePage(deps, view = "users", theme = { name: "light" }) {
  return ThemeContext.provide(theme, () => {
    const app = streetui.app({ name: "performance-app" });
    app.page("home", (page) => buildComposedPage(page, deps, view));
    return compile(app);
  });
}

// src/browser-entry.ts
function hydrateApp(container, opts = {}) {
  const dom = new BrowserDOMAdapter();
  const transferred = readState(dom, opts.stateRoot ?? container);
  const seed = transferred[STATE_KEY];
  const deps = createDeps(seed !== void 0 ? { seed } : {});
  const compiled = compilePage(deps, opts.view ?? "users", opts.theme);
  const renderer = createRenderer({ domAdapter: dom });
  const handle = renderer.hydrate(compiled, container);
  return {
    deps,
    unmount() {
      handle.unmount();
      deps.userDetail.dispose();
      deps.settingsForm.dispose();
    }
  };
}
if (typeof document !== "undefined") {
  const boot = () => {
    const app = document.getElementById("app");
    if (app !== null) hydrateApp(app, { stateRoot: document });
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
}

// src/server-entry.ts
import { renderToString, serializeState } from "streetui";
function renderIsland(options = {}) {
  const view = options.view ?? "users";
  const theme = options.theme ?? { name: "light" };
  const deps = createDeps(options);
  const compiled = compilePage(deps, view, theme);
  const body = renderToString(compiled);
  const stateScript = serializeState({ [STATE_KEY]: snapshot(deps) });
  const island = `<div id="app">${body}</div>${stateScript}`;
  return {
    html: island,
    body,
    stateScript,
    bytes: Buffer.byteLength(island, "utf8")
  };
}

// src/bench-browser.ts
var now = () => performance.now();
var nextFrame = () => new Promise((r) => requestAnimationFrame(() => r(performance.now())));
var settle = async () => {
  await nextFrame();
  await nextFrame();
};
async function measureOp(root, op) {
  let count = 0;
  const obs = new MutationObserver((records) => {
    for (const r of records) {
      count += r.addedNodes.length + r.removedNodes.length;
      if (r.type === "attributes" || r.type === "characterData") count += 1;
    }
  });
  obs.observe(root, { childList: true, subtree: true, attributes: true, characterData: true });
  const t0 = now();
  op();
  const ms = now() - t0;
  await settle();
  obs.disconnect();
  return { ms, domMutations: count };
}
async function measureFrames(durationMs, drive) {
  let frames = 0, maxFrameMs = 0, longFrames60 = 0, longFrames120 = 0, i = 0;
  let last = await nextFrame();
  const end = last + durationMs;
  for (; ; ) {
    drive(i++);
    const t = await nextFrame();
    const dt = t - last;
    last = t;
    frames++;
    if (dt > maxFrameMs) maxFrameMs = dt;
    if (dt > 16.67) longFrames60++;
    if (dt > 8.33) longFrames120++;
    if (t >= end) break;
  }
  return { frames, maxFrameMs: Math.round(maxFrameMs * 100) / 100, longFrames60, longFrames120 };
}
function heap() {
  return typeof performance.memory?.usedJSHeapSize === "number" ? performance.memory.usedJSHeapSize : null;
}
async function run() {
  const longTasks = [];
  let lto = null;
  try {
    lto = new PerformanceObserver((list) => {
      for (const e of list.getEntries()) longTasks.push(e.duration);
    });
    lto.observe({ entryTypes: ["longtask"] });
  } catch {
    lto = null;
  }
  const host = document.createElement("div");
  document.body.appendChild(host);
  const tMount0 = now();
  let app = mountPerfApp(host, { path: "/users", deps: createDeps() });
  const initialMountMs = now() - tMount0;
  await settle();
  const domNodeCount = host.querySelectorAll("*").length;
  const searchNarrow = await measureOp(host, () => app.deps.query.set("aa"));
  const searchClear = await measureOp(host, () => app.deps.query.set(""));
  const reverse = await measureOp(host, () => app.deps.sortDir.set("desc"));
  const listFrames = await measureFrames(500, (i) => app.deps.sortDir.set(i % 2 ? "asc" : "desc"));
  app.unmount();
  app = mountPerfApp(host, { path: "/", deps: createDeps() });
  const ctrlHost = document.createElement("div");
  document.body.appendChild(ctrlHost);
  const ctrlApp = mountPerfApp(ctrlHost, { path: "/", deps: createDeps() });
  ctrlApp.router.navigate("/settings");
  const toggleOne = await measureOp(ctrlHost, () => ctrlApp.deps.pushToggle(500));
  ctrlApp.unmount();
  ctrlHost.remove();
  const navMs = [];
  for (const to of ["/dashboard", "/users", "/settings", "/"]) {
    const t0 = now();
    app.router.navigate(to);
    await settle();
    navMs.push(now() - t0);
  }
  app.unmount();
  const island = renderIsland({ view: "users" });
  const hydHost = document.createElement("div");
  hydHost.innerHTML = island.html;
  document.body.appendChild(hydHost);
  const appNode = hydHost.querySelector("#app");
  const beforeCount = appNode.querySelectorAll("*").length;
  const hyd = await measureOp(appNode, () => {
    const h = hydrateApp(appNode, { stateRoot: hydHost, view: "users" });
    hydHost.__h = h;
  });
  const afterCount = appNode.querySelectorAll("*").length;
  hydHost.__h?.unmount();
  hydHost.remove();
  const heapBefore = heap();
  const heapSamples = [];
  for (let c = 0; c < 6; c++) {
    const h = document.createElement("div");
    document.body.appendChild(h);
    const a = mountPerfApp(h, { path: "/users", deps: createDeps({ sizing: { rows: 2e3, controls: 200 } }) });
    a.deps.query.set("a");
    a.deps.query.set("");
    a.router.navigate("/settings");
    a.router.navigate("/");
    a.unmount();
    h.remove();
    await settle();
    heapSamples.push(heap());
  }
  const heapAfter = heap();
  lto?.disconnect();
  host.remove();
  const ref = { frame60Ms: 16.67, frame120Ms: 8.33 };
  return {
    initialMountUsers10k: { ms: Math.round(initialMountMs * 100) / 100, domNodeCount },
    reactiveSearch: { narrow: searchNarrow, clear: searchClear },
    reverse,
    fineGrainedToggle1of1000: toggleOne,
    routerNavigationMs: navMs.map((m) => Math.round(m * 100) / 100),
    hydrateUsers10k: {
      ms: Math.round(hyd.ms * 100) / 100,
      nodesBefore: beforeCount,
      nodesAfter: afterCount,
      addedDuringHydration: hyd.domMutations,
      adoptedWithoutRecreating: afterCount === beforeCount
    },
    frames: { budgetReference: ref, bigListReorder: listFrames },
    memory: {
      available: heapBefore !== null,
      usedJSHeapBefore: heapBefore,
      usedJSHeapAfter: heapAfter,
      perCycle: heapSamples,
      note: "Browsers expose no explicit GC; heap deltas are indicative, not authoritative."
    },
    longTasks: { count: longTasks.length, totalMs: Math.round(longTasks.reduce((a, b) => a + b, 0) * 100) / 100 }
  };
}
window.__bench = run;
export {
  run
};
//# sourceMappingURL=bench-browser.js.map