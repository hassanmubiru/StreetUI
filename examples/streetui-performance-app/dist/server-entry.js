// src/server-entry.ts
import { renderToString, serializeState } from "streetui";

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

// src/index.ts
import { streetui, derived as derived3 } from "streetui";
import { compile } from "streetui";

// src/views.ts
import { derived as derived2 } from "streetui";
function buildOverview(page, deps) {
  const { i18n } = deps;
  page.section("overview", (s) => {
    s.heading(i18n.t("navHome"), { id: "overview-heading", level: 2 });
    s.text(derived2(() => i18n.translate("totalUsers", { count: deps.totalCount.get() })), { id: "overview-total" });
    s.text(derived2(() => i18n.translate("avgScore", { score: deps.avgScore.get() })), { id: "overview-avg" });
    s.link(i18n.t("navUsers"), { href: "/users", id: "overview-go-users" });
  }, { id: "route-overview" });
}
function buildDashboard(page, deps) {
  const { i18n, notifications } = deps;
  page.section("dashboard", (s) => {
    s.heading(i18n.t("navDashboard"), { id: "dashboard-heading", level: 2 });
    s.section("metrics", (m) => {
      m.text(derived2(() => i18n.translate("totalUsers", { count: deps.totalCount.get() })), { id: "metric-total" });
      m.text(derived2(() => i18n.translate("activeUsers", { count: deps.activeCount.get() })), { id: "metric-active" });
      m.text(derived2(() => i18n.translate("avgScore", { score: deps.avgScore.get() })), { id: "metric-avg" });
      m.text(derived2(() => `toggled:${deps.toggledCount.get()}`), { id: "metric-toggled" });
    }, { id: "dashboard-metrics" });
    s.button("notify", { id: "dashboard-notify", onClick: () => deps.notify("event") });
    s.text(derived2(() => `notifications:${notifications.get().length}`), { id: "notify-count" });
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
    s.heading(derived2(() => i18n.translate("usersHeading", { count: deps.totalCount.get() })), {
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
    s.text(derived2(() => `toggled:${deps.toggledCount.get()}`), { id: "controls-count" });
    s.section("controls-grid", (g) => {
      for (let i = 0; i < deps.controlsCount; i++) {
        const sig = deps.toggles[i];
        g.button(derived2(() => sig.get() ? "on" : "off"), {
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
        derived2(() => name.touched.get() && !name.valid.get()),
        (b) => b.text(derived2(() => name.error.get() ?? ""), { id: "displayName-error" })
      );
      f.input({ id: "contactEmail", bind: contact.value, type: "email", placeholder: "email" });
      f.when(
        derived2(() => contact.touched.get() && !contact.valid.get()),
        (b) => b.text(derived2(() => contact.error.get() ?? ""), { id: "contactEmail-error" })
      );
      f.button(i18n.t("save"), { id: "settings-save", disabled: derived2(() => !form.valid.get()), onClick: () => void form.submit() });
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

// src/index.ts
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
    h.text(derived3(() => `theme:${theme.name}`), { id: "theme-flag" });
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
    s.text(derived3(() => i18n.translate("totalUsers", { count: deps.totalCount.get() })), { id: "side-total" });
    s.text(derived3(() => i18n.translate("activeUsers", { count: deps.activeCount.get() })), { id: "side-active" });
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

// src/server-entry.ts
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
function renderDocument(options = {}) {
  const { html } = renderIsland(options);
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>StreetUI Console</title></head><body>' + html + '<script type="module" src="/browser-entry.js"></script></body></html>';
}
export {
  renderDocument,
  renderIsland
};
//# sourceMappingURL=server-entry.js.map