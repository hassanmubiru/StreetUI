// src/browser-entry.ts
import { createRenderer, readState } from "@streetui/renderer";
import { BrowserDOMAdapter } from "@streetui/dom";

// src/index.ts
import { streetui } from "@streetui/dsl";
import { compile } from "@streetui/compiler";

// src/app.ts
import { derived } from "@streetui/state";

// src/deps.ts
import { signal, resource } from "@streetui/state";
import { createI18n } from "@streetui/i18n";
import { createForm, required, minLength, email } from "@streetui/forms";
import { createContext } from "@streetui/context";
var ThemeContext = createContext({ name: "light" }, "theme");
var MESSAGES = {
  en: {
    title: "StreetUI Full App",
    greeting: "Hello, {name}!",
    count: "Count: {count}",
    signup: "Sign up",
    loaded: "Loaded user: {name}"
  },
  fr: {
    title: "Application compl\xE8te StreetUI",
    greeting: "Bonjour, {name} !",
    count: "Compte : {count}",
    signup: "S'inscrire",
    loaded: "Utilisateur charg\xE9 : {name}"
  }
};
function createDeps(options = {}) {
  const { seed, loadUser } = options;
  const count = signal(seed?.count ?? 0);
  const i18n = createI18n({
    locale: seed?.locale ?? "en",
    messages: MESSAGES,
    fallbackLocale: "en"
  });
  const form = createForm({
    initialValues: { name: "", email: "" },
    validators: {
      name: [required(), minLength(2)],
      email: [required(), email()]
    }
  });
  const user = resource(
    async () => {
      if (loadUser) return loadUser();
      return { id: 0, name: "anonymous" };
    },
    seed?.user !== void 0 ? { initialData: seed.user, immediate: false } : { immediate: loadUser !== void 0 }
  );
  return { count, i18n, form, user };
}
var STATE_KEY = "full-app";

// src/app.ts
function buildApp(page, deps) {
  const { count, i18n, form, user } = deps;
  const theme = ThemeContext.consume();
  const countLabel = derived(() => {
    i18n.locale.get();
    return i18n.translate("count", { count: count.get() });
  });
  const greeting = i18n.t("greeting", { name: "world" });
  const loadedLabel = derived(() => {
    i18n.locale.get();
    const u = user.data.get();
    return u ? i18n.translate("loaded", { name: u.name }) : "";
  });
  page.heading(i18n.t("title"), { id: "title" });
  page.text(`theme:${theme.name}`, { id: "theme" });
  page.section("counter", (s) => {
    s.text(countLabel, { id: "count" });
    s.button("+", { id: "inc", onClick: () => count.set(count.peek() + 1) });
    s.button("lang", { id: "lang", onClick: () => i18n.setLocale(i18n.locale.peek() === "en" ? "fr" : "en") });
  });
  page.section("greeter", (s) => {
    s.text(greeting, { id: "greeting" });
  });
  page.section("signup", (s) => {
    const name = form.field("name");
    const emailField = form.field("email");
    s.input({ id: "name-input", bind: name.value, placeholder: "name" });
    s.when(
      derived(() => name.touched.get() && !name.valid.get()),
      (b) => b.text(derived(() => name.error.get() ?? ""), { id: "name-error" })
    );
    s.input({ id: "email-input", bind: emailField.value, placeholder: "email" });
    s.button(i18n.t("signup"), { id: "submit", onClick: () => void form.submit() });
  });
  page.section("user", (s) => {
    s.when(
      derived(() => user.data.get() !== void 0),
      (b) => b.text(loadedLabel, { id: "user-loaded" })
    );
  });
}

// src/index.ts
function compileApp(deps, theme = { name: "light" }) {
  return ThemeContext.provide(theme, () => {
    const app = streetui.app({ name: "full-app" });
    app.page("home", (page) => buildApp(page, deps));
    return compile(app);
  });
}

// src/browser-entry.ts
function hydrateApp(container, stateRoot, theme) {
  const dom = new BrowserDOMAdapter();
  const transferred = readState(dom, stateRoot ?? container);
  const seed = transferred[STATE_KEY];
  const deps = createDeps(seed !== void 0 ? { seed } : {});
  const compiled = compileApp(deps, theme);
  const renderer = createRenderer({ domAdapter: dom });
  const handle = renderer.hydrate(compiled, container);
  return { deps, unmount: () => handle.unmount() };
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