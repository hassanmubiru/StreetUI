// src/a11y-ids.ts
var UNSAFE = /[^A-Za-z0-9_-]+/g;
function toIdToken(base) {
  const token = base.trim().replace(UNSAFE, "-").replace(/^-+|-+$/g, "");
  return token.length > 0 ? token : "field";
}
function a11yIds(base) {
  const token = toIdToken(base);
  return {
    base: token,
    input: `${token}-input`,
    label: `${token}-label`,
    description: `${token}-description`,
    error: `${token}-error`,
    title: `${token}-title`,
    trigger: `${token}-trigger`,
    controls: `${token}-controls`,
    owns: `${token}-owns`,
    id: (suffix) => `${token}-${toIdToken(suffix)}`
  };
}

// src/identity.ts
var _counter = 0;
function nextId() {
  return ++_counter;
}
function resetIdCounter() {
  _counter = 0;
}
function createNodeId(value) {
  return value;
}
function generateNodeId(prefix = "node") {
  return createNodeId(`${prefix}:${nextId()}`);
}
function nodeIdPrefix(id) {
  const colon = id.indexOf(":");
  return colon === -1 ? id : id.slice(0, colon);
}
function generateApplicationId(name) {
  return `app:${name}:${nextId()}`;
}

// src/lifecycle.ts
var Lifecycle = class {
  _phase = "created";
  _hooks = /* @__PURE__ */ new Map();
  get phase() {
    return this._phase;
  }
  get isMounted() {
    return this._phase === "mounted" || this._phase === "active" || this._phase === "updating";
  }
  get isDestroyed() {
    return this._phase === "destroyed";
  }
  on(phase, hook) {
    const hooks = this._hooks.get(phase) ?? [];
    hooks.push(hook);
    this._hooks.set(phase, hooks);
    return () => {
      const current = this._hooks.get(phase);
      if (current !== void 0) {
        const idx = current.indexOf(hook);
        if (idx !== -1) current.splice(idx, 1);
      }
    };
  }
  async transition(to) {
    this._phase = to;
    const hooks = this._hooks.get(to) ?? [];
    for (const hook of hooks) {
      await hook();
    }
  }
  onMount(hook) {
    return this.on("mounted", hook);
  }
  onUnmount(hook) {
    return this.on("unmounting", hook);
  }
  onDestroy(hook) {
    return this.on("destroyed", hook);
  }
};
var CleanupRegistry = class {
  _fns = [];
  add(fn) {
    this._fns.push(fn);
  }
  run() {
    for (const fn of this._fns) {
      try {
        fn();
      } catch {
      }
    }
    this._fns.length = 0;
  }
};

// src/environment.ts
function detectEnvironment() {
  try {
    if (typeof process !== "undefined" && process !== null && typeof process === "object" && (process.env?.["NODE_ENV"] === "test" || process.env?.["VITEST"] === "true")) {
      return "test";
    }
  } catch {
  }
  if (typeof window !== "undefined" && typeof document !== "undefined") {
    return "browser";
  }
  if (typeof self !== "undefined" && typeof self["importScripts"] === "function") {
    return "worker";
  }
  try {
    if (typeof process !== "undefined" && typeof process === "object") {
      return "server";
    }
  } catch {
  }
  return "unknown";
}
function detectCapabilities() {
  return {
    hasDom: typeof document !== "undefined",
    hasWindow: typeof window !== "undefined",
    hasDocument: typeof document !== "undefined",
    isSecureContext: typeof window !== "undefined" ? window["isSecureContext"] === true : false
  };
}
var Environment = class {
  kind;
  capabilities;
  constructor(kind) {
    this.kind = kind ?? detectEnvironment();
    this.capabilities = detectCapabilities();
  }
  get isBrowser() {
    return this.kind === "browser";
  }
  get isServer() {
    return this.kind === "server";
  }
  get isTest() {
    return this.kind === "test";
  }
  get isWorker() {
    return this.kind === "worker";
  }
};
var environment = new Environment();

// src/diagnostics.ts
var DiagnosticError = class extends Error {
  diagnostics;
  constructor(diagnostics) {
    const summary = diagnostics.filter((d) => d.severity === "error").map((d) => `[${d.code}] ${d.message}`).join("\n");
    super(`StreetUI diagnostics:
${summary}`);
    this.name = "DiagnosticError";
    this.diagnostics = diagnostics;
  }
};
var DiagnosticCollector = class {
  _diagnostics = [];
  get diagnostics() {
    return this._diagnostics;
  }
  get hasErrors() {
    return this._diagnostics.some((d) => d.severity === "error");
  }
  get hasWarnings() {
    return this._diagnostics.some((d) => d.severity === "warning");
  }
  error(code, message, location, cause) {
    this._diagnostics.push({ severity: "error", code, message, location: location ?? void 0, cause: cause ?? void 0 });
  }
  warn(code, message, location) {
    this._diagnostics.push({ severity: "warning", code, message, location: location ?? void 0, cause: void 0 });
  }
  info(code, message, location) {
    this._diagnostics.push({ severity: "info", code, message, location: location ?? void 0, cause: void 0 });
  }
  merge(other) {
    for (const d of other.diagnostics) {
      this._diagnostics.push(d);
    }
  }
  throwIfErrors() {
    if (this.hasErrors) {
      throw new DiagnosticError(this._diagnostics);
    }
  }
  clear() {
    this._diagnostics.length = 0;
  }
};
function formatDiagnostic(d) {
  const loc = d.location !== void 0 ? ` (${[d.location.file, d.location.line, d.location.column].filter(Boolean).join(":")})` : "";
  return `[${d.severity.toUpperCase()}] ${d.code}: ${d.message}${loc}`;
}

// src/application.ts
var Application = class {
  id;
  name;
  version;
  lifecycle;
  cleanup;
  diagnostics;
  environment;
  constructor(options) {
    this.name = options.name;
    this.version = options.version ?? "0.0.1";
    this.id = generateApplicationId(options.name);
    this.lifecycle = new Lifecycle();
    this.cleanup = new CleanupRegistry();
    this.diagnostics = new DiagnosticCollector();
    this.environment = options.environment ?? environment;
  }
  async mount() {
    if (this.lifecycle.phase !== "created") {
      throw new Error(`Application "${this.name}" is already mounted (phase: ${this.lifecycle.phase})`);
    }
    await this.lifecycle.transition("mounted");
    await this.lifecycle.transition("active");
  }
  async unmount() {
    if (!this.lifecycle.isMounted) {
      return;
    }
    await this.lifecycle.transition("unmounting");
    this.cleanup.run();
    await this.lifecycle.transition("destroyed");
  }
  onMount(fn) {
    this.lifecycle.onMount(fn);
  }
  onUnmount(fn) {
    this.lifecycle.onUnmount(fn);
  }
};
function createApplication(options) {
  return new Application(options);
}

// src/node.ts
var BaseNode = class {
  id;
  type;
  metadata;
  constructor(type, id) {
    this.type = type;
    this.id = id ?? generateNodeId(type);
    this.metadata = { createdAt: Date.now() };
  }
};

// src/observability.ts
function formatDiagnosticContext(context) {
  if (context === void 0) return "";
  const parts = [];
  if (context.package !== void 0) parts.push(`package=${context.package}`);
  if (context.operation !== void 0) parts.push(`operation=${context.operation}`);
  if (context.component !== void 0) parts.push(`component=${context.component}`);
  if (context.phase !== void 0) parts.push(`phase=${context.phase}`);
  if (context.nodeId !== void 0) parts.push(`node=${context.nodeId}`);
  if (context.element !== void 0) parts.push(`element=${context.element}`);
  if (context.route !== void 0) parts.push(`route=${context.route}`);
  if (context.resource !== void 0) parts.push(`resource=${context.resource}`);
  if (context.signal !== void 0) parts.push(`signal=${context.signal}`);
  return parts.length > 0 ? ` [${parts.join(", ")}]` : "";
}
var StreetFrameworkError = class extends Error {
  context;
  constructor(message, context) {
    super(`${message}${formatDiagnosticContext(context)}`);
    this.name = "StreetFrameworkError";
    this.context = context ?? void 0;
  }
};
function frameworkError(message, context) {
  return new StreetFrameworkError(message, context);
}
function reportDiagnostic(sink, level, message, context) {
  if (sink === void 0) return;
  const fn = sink[level];
  if (typeof fn !== "function") return;
  try {
    fn.call(sink, message, context);
  } catch {
  }
}
function consoleDiagnosticSink(logger = console) {
  return {
    debug: (m, c) => logger.debug?.(`${m}${formatDiagnosticContext(c)}`),
    info: (m, c) => logger.info?.(`${m}${formatDiagnosticContext(c)}`),
    warn: (m, c) => logger.warn?.(`${m}${formatDiagnosticContext(c)}`),
    error: (m, c) => logger.error?.(`${m}${formatDiagnosticContext(c)}`)
  };
}
function describeErrorAt(error, context, options, depth) {
  const isError = error instanceof Error;
  const name = isError ? error.name : "Error";
  const message = isError ? error.message : safeStringify(error);
  const report = { name, message, isError };
  if (context !== void 0) report.context = context;
  if (options.includeStack === true && isError && typeof error.stack === "string") {
    report.stack = error.stack;
  }
  if (options.includeCause === true && isError && depth < 4) {
    const cause = error.cause;
    if (cause !== void 0 && cause !== null) {
      report.cause = describeErrorAt(cause, void 0, options, depth + 1);
    }
  }
  return report;
}
function safeStringify(value) {
  if (typeof value === "string") return value;
  if (value === null) return "null";
  if (value === void 0) return "undefined";
  const t = typeof value;
  if (t === "number" || t === "boolean" || t === "bigint" || t === "symbol") {
    return String(value);
  }
  const ctor = t === "object" && value !== null ? value.constructor?.name ?? "Object" : t;
  return `[non-Error ${ctor}]`;
}
function describeError(error, context, options = {}) {
  return describeErrorAt(error, context, options, 0);
}
function reportError(sink, error, context, options = {}) {
  const report = describeError(error, context, options);
  reportDiagnostic(sink, "error", report.message, report.context);
  return report;
}

// src/styling/canonical.ts
var LENGTH_PROPS = /* @__PURE__ */ new Set([
  "inset",
  "top",
  "right",
  "bottom",
  "left",
  "width",
  "minWidth",
  "maxWidth",
  "height",
  "minHeight",
  "maxHeight",
  "margin",
  "marginTop",
  "marginRight",
  "marginBottom",
  "marginLeft",
  "padding",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "gap",
  "rowGap",
  "columnGap",
  "flexBasis",
  "borderWidth",
  "borderRadius",
  "fontSize",
  "letterSpacing"
]);
function cssPropName(camel) {
  if (camel.startsWith("--")) return camel;
  return camel.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}
function cssValue(prop, value) {
  if (typeof value === "number") {
    if (value === 0) return "0";
    return LENGTH_PROPS.has(prop) ? `${value}px` : String(value);
  }
  return value;
}
function sortDeep(value) {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value !== null && typeof value === "object") {
    const out = {};
    for (const key of Object.keys(value).sort()) {
      const v = value[key];
      if (v === void 0) continue;
      out[key] = sortDeep(v);
    }
    return out;
  }
  return value;
}
function canonicalize(def) {
  return JSON.stringify(sortDeep(def));
}
function hashIdentity(canonical) {
  let h1 = 2166136261;
  let h2 = 16777619 ^ canonical.length;
  for (let i = 0; i < canonical.length; i++) {
    const c = canonical.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 16777619);
    h2 = Math.imul(h2 ^ c, 2246822507);
  }
  const a = (h1 >>> 0).toString(36);
  const b = (h2 >>> 0).toString(36);
  return `s-${a}${b}`;
}
function identityOf(def) {
  const canonical = canonicalize(def);
  return { canonical, id: hashIdentity(canonical) };
}

// src/styling/registry.ts
var BAND_ORDER = ["tokens", "base", "responsive", "state", "variant"];
var StyleRegistry = class {
  _entries = /* @__PURE__ */ new Map();
  _seq = 0;
  /** True once the registry has adopted a server-emitted stylesheet (§12). */
  _adopted = false;
  /**
   * Register (idempotently) the CSS for a style identity. Returns the identity so
   * callers can chain. Re-registering an existing id with the same css is a no-op;
   * with different css it keeps the first registration (identity is content-derived,
   * so this cannot happen for honest input and signals a hash collision if it does).
   */
  register(id, band, css) {
    const existing = this._entries.get(id);
    if (existing !== void 0) return id;
    this._entries.set(id, { id, band, css, seq: this._seq++ });
    return id;
  }
  /** Whether an identity is already present (server-adopted or locally registered). */
  has(id) {
    return this._entries.has(id);
  }
  /** Number of distinct rules held (bounded by source diversity, not instances). */
  get size() {
    return this._entries.size;
  }
  /**
   * Seed the registry from identities a server stylesheet already shipped (§12).
   * We only need the *keys* to avoid re-emitting duplicates; the rule text is
   * already in the adopted `<style>` element, so a placeholder css is stored.
   */
  adoptServerIdentities(ids) {
    for (const id of ids) {
      if (!this._entries.has(id)) {
        this._entries.set(id, { id, band: "base", css: "", seq: this._seq++ });
      }
    }
    this._adopted = true;
  }
  get adopted() {
    return this._adopted;
  }
  /** Serialize all rules to a single CSS string in deterministic band order. */
  serializeCSS() {
    if (this._entries.size === 0) return "";
    const byBand = {
      tokens: [],
      base: [],
      responsive: [],
      state: [],
      variant: []
    };
    for (const e of this._entries.values()) {
      if (e.css.length > 0) byBand[e.band].push(e);
    }
    let out = "";
    for (const band of BAND_ORDER) {
      const list = byBand[band].sort((a, b) => a.seq - b.seq);
      for (const e of list) out += e.css;
    }
    return out;
  }
  /** The ordered list of identities present (for the `data-streetui-css-keys` attr). */
  identities() {
    return [...this._entries.values()].sort((a, b) => a.seq - b.seq).map((e) => e.id);
  }
  /** Clear everything — test isolation and per-process reset only. */
  reset() {
    this._entries.clear();
    this._seq = 0;
    this._adopted = false;
  }
};
var styleRegistry = new StyleRegistry();

// src/styling/css.ts
var BREAKPOINTS = {
  sm: 480,
  md: 768,
  lg: 1024,
  xl: 1280
};
var PSEUDO_SELECTOR = {
  hover: ":hover",
  focus: ":focus",
  focusVisible: ":focus-visible",
  focusWithin: ":focus-within",
  active: ":active",
  disabled: ":disabled",
  checked: ":checked",
  firstChild: ":first-child",
  lastChild: ":last-child"
};
function stateAttr(state) {
  return `data-${state}`;
}
function isResponsiveObject(v) {
  return v !== null && typeof v === "object";
}
function splitResponsive(props) {
  const base = [];
  const media = { sm: [], md: [], lg: [], xl: [] };
  for (const key of Object.keys(props).sort()) {
    if (key === "vars") {
      const vars = props.vars;
      if (vars) for (const vk of Object.keys(vars).sort()) base.push([vk, vars[vk]]);
      continue;
    }
    const raw = props[key];
    if (raw === void 0) continue;
    if (isResponsiveObject(raw)) {
      const r = raw;
      if (r.base !== void 0) base.push([key, r.base]);
      for (const bp of ["sm", "md", "lg", "xl"]) {
        if (r[bp] !== void 0) media[bp].push([key, r[bp]]);
      }
    } else {
      base.push([key, raw]);
    }
  }
  return { base, media };
}
function declBody(pairs) {
  let out = "";
  for (const [prop, val] of pairs) out += `${cssPropName(prop)}:${cssValue(prop, val)};`;
  return out;
}
function flatBody(props) {
  const pairs = [];
  for (const key of Object.keys(props).sort()) {
    if (key === "vars") {
      const vars = props.vars;
      if (vars) for (const vk of Object.keys(vars).sort()) pairs.push([vk, vars[vk]]);
      continue;
    }
    const raw = props[key];
    if (raw === void 0) continue;
    if (isResponsiveObject(raw)) {
      const b = raw.base;
      if (b !== void 0) pairs.push([key, b]);
    } else {
      pairs.push([key, raw]);
    }
  }
  return declBody(pairs);
}
function generateCSS(id, def) {
  const sel = `.${id}`;
  const { base, media } = splitResponsive(def);
  let baseCss = "";
  const baseBody = declBody(base);
  if (baseBody.length > 0) baseCss += `${sel}{${baseBody}}`;
  let hasResponsive = false;
  for (const bp of ["sm", "md", "lg", "xl"]) {
    if (media[bp].length > 0) {
      hasResponsive = true;
      baseCss += `@media (min-width:${BREAKPOINTS[bp]}px){${sel}{${declBody(media[bp])}}}`;
    }
  }
  let stateCss = "";
  if (def.on) {
    for (const ps of Object.keys(def.on).sort()) {
      const block = def.on[ps];
      if (!block) continue;
      const body = flatBody(block);
      if (body.length > 0) stateCss += `${sel}${PSEUDO_SELECTOR[ps]}{${body}}`;
    }
  }
  if (def.when) {
    for (const st of Object.keys(def.when).sort()) {
      const block = def.when[st];
      if (!block) continue;
      const body = flatBody(block);
      if (body.length > 0) stateCss += `${sel}[${stateAttr(st)}]{${body}}`;
    }
  }
  return { base: baseCss, state: stateCss, hasResponsive };
}

// src/styling/tokens.ts
function kebab(seg) {
  return seg.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}
function isLeaf(v) {
  return typeof v === "string" || typeof v === "number";
}
function walkTokens(tree, path, visit) {
  for (const key of Object.keys(tree).sort()) {
    const v = tree[key];
    const next = [...path, kebab(key)];
    if (isLeaf(v)) visit(`--${next.join("-")}`, v);
    else walkTokens(v, next, visit);
  }
}
function buildRefs(tree, path) {
  const out = {};
  for (const key of Object.keys(tree)) {
    const v = tree[key];
    const next = [...path, kebab(key)];
    out[key] = isLeaf(v) ? `var(--${next.join("-")})` : buildRefs(v, next);
  }
  return out;
}
function tokenIdentity(def) {
  const json = JSON.stringify({ light: def.light, dark: def.dark ?? null });
  let h = 2166136261;
  for (let i = 0; i < json.length; i++) {
    h ^= json.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `t-${(h >>> 0).toString(36)}`;
}
function createThemeTokens(def) {
  const id = tokenIdentity(def);
  let root = "";
  walkTokens(def.light, [], (name, value) => {
    root += `${name}:${value};`;
  });
  let dark = "";
  if (def.dark) walkTokens(def.dark, [], (name, value) => {
    dark += `${name}:${value};`;
  });
  let css = root.length > 0 ? `:root{${root}}` : "";
  if (dark.length > 0) css += `[data-theme="dark"]{${dark}}`;
  styleRegistry.register(id, "tokens", css);
  return {
    ref: buildRefs(def.light, []),
    css,
    id
  };
}
var DEFAULT_TOKENS = {
  surface: { background: "#ffffff", raised: "#f7f7f8", sunken: "#eeeef1", overlay: "rgba(17,17,20,0.55)" },
  content: { primary: "#17171a", secondary: "#55555f", muted: "#8a8a95", inverse: "#ffffff" },
  border: { default: "#e3e3e8", strong: "#c9c9d1", subtle: "#f0f0f3" },
  accent: { primary: "#4f46e5", hover: "#4338ca", contrast: "#ffffff" },
  focus: { ring: "#6366f1" },
  danger: { surface: "#fef2f2", border: "#fecaca", content: "#b91c1c", solid: "#dc2626" },
  success: { content: "#15803d", solid: "#16a34a" },
  space: { "0": "0", "1": "4px", "2": "8px", "3": "12px", "4": "16px", "5": "24px", "6": "32px", "8": "48px", "10": "64px" },
  radius: { sm: "4px", md: "8px", lg: "12px", xl: "16px", full: "9999px" },
  font: {
    sans: "ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif",
    mono: "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace"
  },
  size: { xs: "12px", sm: "14px", md: "16px", lg: "18px", xl: "24px", "2xl": "32px", "3xl": "44px" },
  weight: { normal: "400", medium: "500", semibold: "600", bold: "700" },
  leading: { tight: "1.2", normal: "1.5", relaxed: "1.7" },
  shadow: {
    sm: "0 1px 2px rgba(17,17,20,0.08)",
    md: "0 4px 12px rgba(17,17,20,0.1)",
    lg: "0 12px 32px rgba(17,17,20,0.16)"
  },
  z: { base: "0", dropdown: "1000", overlay: "1100", toast: "1200" },
  duration: { fast: "120ms", base: "200ms", slow: "320ms" },
  easing: { standard: "cubic-bezier(0.2,0,0,1)", emphasized: "cubic-bezier(0.3,0,0,1)" }
};
var DARK_OVERRIDES = {
  surface: { background: "#0f0f12", raised: "#17171c", sunken: "#0a0a0d", overlay: "rgba(0,0,0,0.6)" },
  content: { primary: "#f4f4f6", secondary: "#b4b4bf", muted: "#7c7c88", inverse: "#17171a" },
  border: { default: "#2a2a31", strong: "#3a3a44", subtle: "#1e1e24" },
  accent: { primary: "#818cf8", hover: "#a5b4fc", contrast: "#0f0f12" },
  focus: { ring: "#a5b4fc" },
  danger: { surface: "#2a1416", border: "#5b1d1d", content: "#fca5a5", solid: "#ef4444" },
  success: { content: "#4ade80", solid: "#22c55e" }
};
var tokens = createThemeTokens({ light: DEFAULT_TOKENS, dark: DARK_OVERRIDES });

// src/styling/style.ts
function style(def) {
  const { id } = identityOf(def);
  if (!styleRegistry.has(id)) {
    const gen = generateCSS(id, def);
    styleRegistry.register(id, gen.hasResponsive ? "responsive" : "base", gen.base);
    if (gen.state.length > 0) {
      styleRegistry.register(`${id}~state`, "state", gen.state);
    }
  }
  return id;
}
function cx(...parts) {
  let out = "";
  for (const p of parts) {
    if (!p) continue;
    out = out.length === 0 ? p : `${out} ${p}`;
  }
  return out;
}
function styleVariants(cfg) {
  const baseClass = cfg.base ? style(cfg.base) : "";
  const groupClasses = {};
  for (const group of Object.keys(cfg.variants)) {
    const values = cfg.variants[group];
    const map = {};
    for (const value of Object.keys(values)) map[value] = style(values[value]);
    groupClasses[group] = map;
  }
  const defaults = cfg.defaultVariants ?? {};
  return (selection) => {
    const parts = [];
    if (baseClass) parts.push(baseClass);
    for (const group of Object.keys(groupClasses)) {
      const chosen = selection?.[group] ?? defaults[group];
      if (chosen === void 0) continue;
      const cls = groupClasses[group][chosen];
      if (cls) parts.push(cls);
    }
    return cx(...parts);
  };
}
export {
  Application,
  BREAKPOINTS,
  BaseNode,
  CleanupRegistry,
  DEFAULT_TOKENS,
  DiagnosticCollector,
  DiagnosticError,
  Environment,
  Lifecycle,
  StreetFrameworkError,
  StyleRegistry,
  a11yIds,
  canonicalize,
  consoleDiagnosticSink,
  createApplication,
  createNodeId,
  createThemeTokens,
  cssPropName,
  cssValue,
  cx,
  describeError,
  environment,
  formatDiagnostic,
  formatDiagnosticContext,
  frameworkError,
  generateApplicationId,
  generateCSS,
  generateNodeId,
  hashIdentity,
  identityOf,
  nextId,
  nodeIdPrefix,
  reportDiagnostic,
  reportError,
  resetIdCounter,
  stateAttr,
  style,
  styleRegistry,
  styleVariants,
  toIdToken,
  tokens
};
//# sourceMappingURL=index.js.map