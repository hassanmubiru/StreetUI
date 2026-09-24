// src/api-server.ts
import { createServer } from "node:http";
var DEFAULT_PLANS = [
  { id: "free", name: "Free" },
  { id: "pro", name: "Pro" },
  { id: "team", name: "Team" }
];
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => data += chunk);
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}
function createAccountApi(initial = DEFAULT_PLANS) {
  const plans = initial;
  const taken = /* @__PURE__ */ new Set();
  const created = [];
  let forceFail = false;
  let nextId = 1;
  const server = createServer((req, res) => {
    void (async () => {
      const url = new URL(req.url ?? "/", "http://localhost");
      const json = (status, payload) => {
        res.statusCode = status;
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify(payload));
      };
      if (forceFail) return json(500, { error: "Internal Server Error" });
      if (req.method === "GET" && url.pathname === "/api/plans") {
        return json(200, plans);
      }
      if (req.method === "POST" && url.pathname === "/api/accounts") {
        const body = await readBody(req);
        const parsed = JSON.parse(body || "{}");
        const email = (parsed.email ?? "").toLowerCase();
        if (taken.has(email)) return json(409, { error: "Email already registered" });
        taken.add(email);
        const record = { id: nextId++, email };
        created.push(record);
        return json(201, record);
      }
      json(404, { error: "Not found" });
    })().catch(() => {
      res.statusCode = 500;
      res.end('{"error":"server"}');
    });
  });
  return {
    server,
    listen() {
      return new Promise((resolve) => {
        server.listen(0, () => {
          const addr = server.address();
          const port = typeof addr === "object" && addr !== null ? addr.port : 0;
          resolve(`http://127.0.0.1:${port}`);
        });
      });
    },
    close() {
      return new Promise(
        (resolve, reject) => server.close((err) => err ? reject(err) : resolve())
      );
    },
    setFail(fail) {
      forceFail = fail;
    },
    register(email) {
      taken.add(email.toLowerCase());
    },
    accounts() {
      return created;
    }
  };
}

// src/account-app.ts
import { derived, resource } from "@streetui/state";
import { a11yIds } from "@streetui/core";
import {
  createForm,
  required,
  email as emailValidator,
  minLength
} from "@streetui/forms";
import { createI18n } from "@streetui/i18n";
import { createContext } from "@streetui/context";
import {
  createRouter,
  mountRouter,
  routerOutlet
} from "@streetui/router";
var messages = {
  en: {
    "app.title": "StreetUI Accounts",
    "nav.home": "Home",
    "nav.signup": "Create account",
    "locale.toggle": "Switch language",
    "home.tagline": "Everything in one app: routing, forms, i18n and accessibility.",
    "signup.title": "Create your account",
    "signup.name": "Full name",
    "signup.email": "Email address",
    "signup.password": "Password",
    "signup.submit": "Create account",
    "signup.submitting": "Creating account\u2026",
    "signup.plans": "Available plans",
    "plans.loading": "Loading plans\u2026",
    "plans.error": "Could not load plans.",
    "plans.retry": "Retry",
    "status.error": "That email is already registered.",
    "err.required": "This field is required",
    "err.email": "Enter a valid email address",
    "err.password": "Password must be at least 8 characters",
    "welcome.title": "Welcome aboard!",
    "welcome.body": "Your account has been created.",
    "notfound.title": "Not found",
    "notfound.body": "There is nothing here."
  },
  fr: {
    "app.title": "Comptes StreetUI",
    "nav.home": "Accueil",
    "nav.signup": "Cr\xE9er un compte",
    "locale.toggle": "Changer de langue",
    "home.tagline": "Tout dans une appli : routage, formulaires, i18n et accessibilit\xE9.",
    "signup.title": "Cr\xE9ez votre compte",
    "signup.name": "Nom complet",
    "signup.email": "Adresse e-mail",
    "signup.password": "Mot de passe",
    "signup.submit": "Cr\xE9er un compte",
    "signup.submitting": "Cr\xE9ation du compte\u2026",
    "signup.plans": "Offres disponibles",
    "plans.loading": "Chargement des offres\u2026",
    "plans.error": "Impossible de charger les offres.",
    "plans.retry": "R\xE9essayer",
    "status.error": "Cet e-mail est d\xE9j\xE0 enregistr\xE9.",
    "err.required": "Ce champ est obligatoire",
    "err.email": "Saisissez une adresse e-mail valide",
    "err.password": "Le mot de passe doit comporter au moins 8 caract\xE8res",
    "welcome.title": "Bienvenue !",
    "welcome.body": "Votre compte a \xE9t\xE9 cr\xE9\xE9.",
    "notfound.title": "Introuvable",
    "notfound.body": "Il n'y a rien ici."
  }
};
var FormContext = createContext(
  null,
  "streetui.account.form"
);
async function fetchPlans(baseUrl, signal2) {
  const response = await fetch(`${baseUrl}/api/plans`, { signal: signal2 });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return await response.json();
}
async function createAccount(baseUrl, values) {
  const response = await fetch(`${baseUrl}/api/accounts`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: values.email, name: values.name })
  });
  if (!response.ok) {
    throw new Error(response.status === 409 ? "conflict" : `HTTP ${response.status}`);
  }
}
function textField(scope, fieldName, labelKey, type) {
  const scoped = FormContext.consume();
  if (scoped === null) {
    throw new Error("textField must be built within a FormContext provider");
  }
  const { form, i18n } = scoped;
  const f = form.field(fieldName);
  const ids = a11yIds(fieldName);
  const showError = derived(() => f.touched.get() && f.error.get() !== void 0);
  scope.container(
    `${fieldName}-group`,
    (group) => {
      group.text(i18n.t(labelKey), { id: ids.label });
      group.input({
        bind: f.value,
        type,
        id: ids.input,
        ariaLabelledBy: ids.label,
        ariaDescribedBy: ids.error,
        ariaRequired: true
      });
      group.when(showError, (err) => {
        err.text(
          derived(() => f.error.get() ?? ""),
          { id: ids.error, role: "alert", ariaLive: "polite" }
        );
      });
    },
    { id: `${fieldName}-group` }
  );
}
function pageLayout(scope, opts, body) {
  scope.section(
    opts.id,
    (s) => {
      s.heading(opts.title, { level: 1, id: `${opts.id}-title` });
      s.container(`${opts.id}-body`, (content) => body(content), { id: `${opts.id}-body` });
    },
    { id: `page-${opts.id}` }
  );
}
function buildRoutes(opts, navigate) {
  const i18n = opts.i18n;
  const home = {
    path: "/",
    builder: (page) => pageLayout(page, { id: "home", title: i18n.t("app.title") }, (c) => {
      c.text(i18n.t("home.tagline"), { id: "home-tagline" });
      c.link("\u2192", { href: "/signup", id: "home-signup-link", ariaLabel: i18n.translate("nav.signup") });
    })
  };
  const signup = {
    path: "/signup",
    builder: (page, ctx) => {
      const form = createForm({
        initialValues: { name: "", email: "", password: "" },
        validators: {
          name: required(i18n.translate("err.required")),
          email: [
            required(i18n.translate("err.required")),
            emailValidator(i18n.translate("err.email"))
          ],
          password: [
            required(i18n.translate("err.required")),
            minLength(8, i18n.translate("err.password"))
          ]
        },
        onSubmit: async (values) => {
          await createAccount(opts.baseUrl, values);
          opts.onCreated?.(values);
          navigate("/welcome");
        }
      });
      ctx.onCleanup(() => form.dispose());
      opts.onForm?.(form);
      const plansRes = resource(({ signal: signal2 }) => fetchPlans(opts.baseUrl, signal2), {
        onCleanup: ctx.onCleanup
      });
      opts.onPlansResource?.(plansRes);
      const plans = derived(() => plansRes.data.get() ?? []);
      pageLayout(page, { id: "signup", title: i18n.t("signup.title") }, (c) => {
        c.form(
          "signup-form",
          (fb) => {
            FormContext.provide({ form, i18n }, () => {
              textField(fb, "name", "signup.name", "text");
              textField(fb, "email", "signup.email", "email");
              textField(fb, "password", "signup.password", "password");
            });
            fb.button(
              derived(
                () => form.submitting.get() ? i18n.translate("signup.submitting") : i18n.translate("signup.submit")
              ),
              { id: "signup-submit", disabled: form.submitting, onClick: () => void form.submit() }
            );
            fb.when(derived(() => form.status.get() === "error"), (st) => {
              st.text(i18n.t("status.error"), {
                id: "signup-status",
                role: "alert",
                ariaLive: "assertive"
              });
            });
          },
          { id: "signup-form", onSubmit: () => void form.submit() }
        );
        c.container(
          "signup-plans",
          (pl) => {
            pl.text(i18n.t("signup.plans"), { id: "plans-title" });
            pl.errorBoundary(
              "plans-boundary",
              (body) => {
                body.when(
                  derived(() => plansRes.loading.get() && plansRes.data.get() === void 0),
                  (l) => l.text(i18n.t("plans.loading"), { id: "plans-loading" })
                );
                body.listOf(
                  "plans-list",
                  plans,
                  (plan, _i, item) => item.text(plan.name, { id: `plan-${plan.id}` }),
                  { id: "plans-list" }
                );
              },
              {
                source: plansRes.error,
                onRetry: () => void plansRes.refetch(),
                fallback: (fbk) => {
                  fbk.text(i18n.t("plans.error"), { id: "plans-error" });
                  fbk.button(i18n.t("plans.retry"), {
                    id: "plans-retry",
                    onClick: () => void plansRes.refetch()
                  });
                }
              }
            );
          },
          { id: "signup-plans" }
        );
      });
    }
  };
  const welcome = {
    path: "/welcome",
    builder: (page) => pageLayout(page, { id: "welcome", title: i18n.t("welcome.title") }, (c) => {
      c.text(i18n.t("welcome.body"), { id: "welcome-body", role: "status", ariaLive: "polite" });
      c.link("\u21A9", { href: "/", id: "welcome-home", ariaLabel: i18n.translate("nav.home") });
    })
  };
  const notFound = {
    path: "*",
    builder: (page) => pageLayout(page, { id: "notfound", title: i18n.t("notfound.title") }, (c) => {
      c.text(i18n.t("notfound.body"), { id: "notfound-body" });
      c.link("\u21A9", { href: "/", id: "notfound-home", ariaLabel: i18n.translate("nav.home") });
    })
  };
  return [home, signup, welcome, notFound];
}
function accountShell(shell, i18n) {
  shell.section(
    "nav",
    (n) => {
      n.heading(i18n.t("app.title"), { level: 1, id: "brand" });
      n.link(i18n.t("nav.home"), { href: "/", id: "nav-home" });
      n.link(i18n.t("nav.signup"), { href: "/signup", id: "nav-signup" });
      n.button(derived(() => i18n.locale.get().toUpperCase()), {
        id: "locale-toggle",
        ariaLabel: i18n.translate("locale.toggle"),
        onClick: () => i18n.setLocale(i18n.locale.get() === "en" ? "fr" : "en")
      });
    },
    { id: "site-nav", role: "navigation" }
  );
  routerOutlet(shell);
}
function createAccountI18n(locale = "en") {
  return createI18n({ locale, messages, fallbackLocale: "en" });
}
function createAccountApp(opts) {
  let router;
  const navigate = (path) => router.navigate(path);
  const routes = buildRoutes(opts, navigate);
  const config = opts.history !== void 0 ? { routes, history: opts.history } : { routes };
  router = createRouter(config);
  return { router };
}
function mountAccountApp(container, opts) {
  const { router } = createAccountApp(opts);
  const mounted = mountRouter(router, {
    container,
    hydrate: opts.hydrate ?? false,
    shell: (shell) => accountShell(shell, opts.i18n)
  });
  return { router, unmount: () => mounted.unmount() };
}
export {
  createAccount,
  createAccountApi,
  createAccountApp,
  createAccountI18n,
  fetchPlans,
  mountAccountApp
};
//# sourceMappingURL=index.js.map