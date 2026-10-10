// netlify/functions/ssr-source.mjs
import { createHash } from "node:crypto";

// dist/index.js
var _activeConsumer = null;
function withConsumer(consumer, fn) {
  const prev = _activeConsumer;
  _activeConsumer = consumer;
  try {
    return fn();
  } finally {
    _activeConsumer = prev;
  }
}
var _batchDepth = 0;
var _pendingFlushes = /* @__PURE__ */ new Map();
function _enqueueBatchFlush(sig, value) {
  _pendingFlushes.set(sig, { signal: sig, value });
}
var Signal = class {
  _value;
  _subscribers = /* @__PURE__ */ new Set();
  _consumers = /* @__PURE__ */ new Set();
  constructor(initial) {
    this._value = initial;
  }
  get() {
    if (_activeConsumer !== null) {
      this._consumers.add(_activeConsumer);
      _activeConsumer._addSource(this);
    }
    return this._value;
  }
  peek() {
    return this._value;
  }
  set(value) {
    if (Object.is(this._value, value)) return;
    this._value = value;
    if (_batchDepth > 0) {
      _enqueueBatchFlush(this, value);
    } else {
      this._flush(value);
    }
  }
  update(fn) {
    this.set(fn(this._value));
  }
  subscribe(fn) {
    this._subscribers.add(fn);
    return () => {
      this._subscribers.delete(fn);
    };
  }
  _removeConsumer(consumer) {
    this._consumers.delete(consumer);
  }
  /**
   * Called by the batch machinery after the batch has completed.
   * Notifies subscribers with the final coalesced value.
   */
  _flushBatch(value) {
    this._flush(value);
  }
  _flush(value) {
    for (const sub of [...this._subscribers]) sub(value);
    for (const consumer of [...this._consumers]) consumer._invalidate();
  }
  /**
   * @internal DevTools inspection only. The number of live observers
   * (direct subscribers plus derived/effect consumers). Read-only; never
   * mutates reactive state.
   */
  _observerCount() {
    return this._subscribers.size + this._consumers.size;
  }
};
var DerivedSignal = class {
  _value = void 0;
  _dirty = true;
  _disposed = false;
  _fn;
  _subscribers = /* @__PURE__ */ new Set();
  /** All upstream sources this derived currently reads from. */
  _sources = /* @__PURE__ */ new Set();
  /** Downstream consumers that depend on this derived. */
  _consumers = /* @__PURE__ */ new Set();
  constructor(fn) {
    this._fn = fn;
  }
  get() {
    if (_activeConsumer !== null) {
      this._consumers.add(_activeConsumer);
      _activeConsumer._addSource(this);
    }
    if (this._dirty) this._recompute();
    return this._value;
  }
  peek() {
    if (this._dirty) this._recompute();
    return this._value;
  }
  subscribe(fn) {
    if (this._dirty) this._recompute();
    this._subscribers.add(fn);
    return () => {
      this._subscribers.delete(fn);
    };
  }
  _addSource(src) {
    this._sources.add(src);
  }
  _removeConsumer(consumer) {
    this._consumers.delete(consumer);
  }
  _invalidate() {
    if (this._disposed) return;
    this._dirty = true;
    const newVal = this.peek();
    for (const sub of [...this._subscribers]) sub(newVal);
    for (const consumer of [...this._consumers]) consumer._invalidate();
  }
  _recompute() {
    for (const src of this._sources) src._removeConsumer(this);
    this._sources.clear();
    this._value = withConsumer(this, this._fn);
    this._dirty = false;
  }
  dispose() {
    this._disposed = true;
    for (const src of this._sources) src._removeConsumer(this);
    this._sources.clear();
    this._subscribers.clear();
    this._consumers.clear();
  }
  /**
   * @internal DevTools inspection only. Live observers (subscribers plus
   * downstream consumers). Read-only.
   */
  _observerCount() {
    return this._subscribers.size + this._consumers.size;
  }
};
var Effect = class {
  _fn;
  _cleanup = void 0;
  _disposed = false;
  _sources = /* @__PURE__ */ new Set();
  constructor(fn) {
    this._fn = fn;
    this._run();
  }
  _addSource(src) {
    this._sources.add(src);
  }
  _invalidate() {
    if (this._disposed) return;
    this._run();
  }
  _run() {
    for (const src of this._sources) src._removeConsumer(this);
    this._sources.clear();
    if (typeof this._cleanup === "function") this._cleanup();
    const result = withConsumer(this, this._fn);
    this._cleanup = typeof result === "function" ? result : void 0;
  }
  dispose() {
    this._disposed = true;
    for (const src of this._sources) src._removeConsumer(this);
    this._sources.clear();
    if (typeof this._cleanup === "function") this._cleanup();
    this._cleanup = void 0;
  }
};
function signal(initial) {
  return new Signal(initial);
}
function derived(fn) {
  return new DerivedSignal(fn);
}
function effect(fn) {
  const e = new Effect(fn);
  return () => e.dispose();
}
var _counter = 0;
function nextId() {
  return ++_counter;
}
function createNodeId(value) {
  return value;
}
function generateNodeId(prefix = "node") {
  return createNodeId(`${prefix}:${nextId()}`);
}
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
  error(code22, message, location, cause) {
    this._diagnostics.push({ severity: "error", code: code22, message, location: location ?? void 0, cause: cause ?? void 0 });
  }
  warn(code22, message, location) {
    this._diagnostics.push({ severity: "warning", code: code22, message, location: location ?? void 0, cause: void 0 });
  }
  info(code22, message, location) {
    this._diagnostics.push({ severity: "info", code: code22, message, location: location ?? void 0, cause: void 0 });
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
      const list22 = byBand[band].sort((a, b) => a.seq - b.seq);
      for (const e of list22) out += e.css;
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
      const body2 = flatBody(block);
      if (body2.length > 0) stateCss += `${sel}${PSEUDO_SELECTOR[ps]}{${body2}}`;
    }
  }
  if (def.when) {
    for (const st of Object.keys(def.when).sort()) {
      const block = def.when[st];
      if (!block) continue;
      const body2 = flatBody(block);
      if (body2.length > 0) stateCss += `${sel}[${stateAttr(st)}]{${body2}}`;
    }
  }
  return { base: baseCss, state: stateCss, hasResponsive };
}
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
  let h2 = 2166136261;
  for (let i = 0; i < json.length; i++) {
    h2 ^= json.charCodeAt(i);
    h2 = Math.imul(h2, 16777619);
  }
  return `t-${(h2 >>> 0).toString(36)}`;
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
  content: { primary: "#17171a", secondary: "#55555f", muted: "#666672", inverse: "#ffffff" },
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
  for (const p3 of parts) {
    if (!p3) continue;
    out = out.length === 0 ? p3 : `${out} ${p3}`;
  }
  return out;
}
var space = (k) => tokens.ref.space[k];
function container(opts = {}) {
  const def = {
    width: "100%",
    maxWidth: opts.max ?? 1120,
    paddingLeft: space(opts.padX ?? "4"),
    paddingRight: space(opts.padX ?? "4"),
    ...opts.center === false ? {} : { marginLeft: "auto", marginRight: "auto" }
  };
  return style(def);
}
var ALIGN = {
  start: "flex-start",
  center: "center",
  end: "flex-end",
  stretch: "stretch"
};
var JUSTIFY = {
  start: "flex-start",
  center: "center",
  end: "flex-end",
  between: "space-between",
  around: "space-around"
};
function stack(opts = {}) {
  return style({
    display: "flex",
    flexDirection: "column",
    gap: space(opts.gap ?? "4"),
    ...opts.align ? { alignItems: ALIGN[opts.align] } : {},
    ...opts.justify ? { justifyContent: JUSTIFY[opts.justify] } : {}
  });
}
function row(opts = {}) {
  return style({
    display: "flex",
    flexDirection: "row",
    gap: space(opts.gap ?? "4"),
    alignItems: opts.align ? ALIGN[opts.align] : "center",
    ...opts.justify ? { justifyContent: JUSTIFY[opts.justify] } : {},
    ...opts.wrap ? { flexWrap: "wrap" } : {}
  });
}
function grid(opts = {}) {
  const columns = opts.columns ?? "auto";
  const min = typeof opts.min === "number" ? `${opts.min}px` : opts.min ?? "220px";
  const template = columns === "auto" ? `repeat(auto-fill, minmax(${min}, 1fr))` : `repeat(${columns}, minmax(0, 1fr))`;
  return style({ display: "grid", gridTemplateColumns: template, gap: space(opts.gap ?? "4") });
}
function center(opts = {}) {
  return style({
    display: opts.inline ? "inline-flex" : "flex",
    alignItems: "center",
    justifyContent: "center",
    ...opts.minHeight !== void 0 ? { minHeight: opts.minHeight } : {}
  });
}
function spacer(opts = {}) {
  return opts.size !== void 0 ? style({ flex: "0 0 auto", width: opts.size, height: opts.size }) : style({ flex: "1 1 0%" });
}
var layout = { container, stack, row, grid, center, spacer };
var t = tokens.ref;
var HEADING_SIZE = {
  1: t.size["3xl"],
  2: t.size["2xl"],
  3: t.size.xl,
  4: t.size.lg,
  5: t.size.md,
  6: t.size.sm
};
function heading(opts = {}) {
  const level = opts.level ?? 2;
  return style({
    fontFamily: t.font.sans,
    fontSize: HEADING_SIZE[level],
    fontWeight: level <= 2 ? t.weight.bold : t.weight.semibold,
    lineHeight: t.leading.tight,
    color: t.content.primary,
    letterSpacing: level <= 2 ? "-0.02em" : "-0.01em"
  });
}
function body(opts = {}) {
  const def = {
    fontFamily: t.font.sans,
    fontSize: t.size.md,
    fontWeight: t.weight.normal,
    lineHeight: t.leading.normal,
    color: opts.muted ? t.content.secondary : t.content.primary
  };
  return style(opts.measure !== void 0 ? { ...def, maxWidth: opts.measure } : def);
}
function label() {
  return style({
    fontFamily: t.font.sans,
    fontSize: t.size.sm,
    fontWeight: t.weight.medium,
    lineHeight: t.leading.normal,
    color: t.content.primary
  });
}
function caption() {
  return style({
    fontFamily: t.font.sans,
    fontSize: t.size.xs,
    fontWeight: t.weight.normal,
    lineHeight: t.leading.normal,
    color: t.content.muted
  });
}
function link() {
  return style({
    color: t.accent.primary,
    textDecoration: "underline",
    cursor: "pointer",
    borderRadius: t.radius.sm,
    on: {
      hover: { color: t.accent.hover },
      focusVisible: { outline: `2px solid ${t.focus.ring}` }
    }
  });
}
function code() {
  return style({
    fontFamily: t.font.mono,
    fontSize: "0.9em",
    background: t.surface.sunken,
    color: t.content.primary,
    borderRadius: t.radius.sm,
    paddingLeft: t.space["1"],
    paddingRight: t.space["1"],
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: t.border.subtle
  });
}
function pre() {
  return style({
    fontFamily: t.font.mono,
    fontSize: t.size.sm,
    lineHeight: t.leading.relaxed,
    background: t.surface.sunken,
    color: t.content.primary,
    borderRadius: t.radius.md,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: t.border.subtle,
    padding: t.space["4"],
    overflowX: "auto",
    whiteSpace: "pre"
  });
}
function blockquote() {
  return style({
    fontFamily: t.font.sans,
    fontSize: t.size.lg,
    lineHeight: t.leading.relaxed,
    color: t.content.secondary,
    borderStyle: "solid",
    borderColor: t.accent.primary,
    paddingLeft: t.space["4"],
    marginLeft: 0
  });
}
function list() {
  return style({
    fontFamily: t.font.sans,
    fontSize: t.size.md,
    lineHeight: t.leading.normal,
    color: t.content.primary,
    display: "flex",
    flexDirection: "column",
    gap: t.space["2"]
  });
}
var text = { heading, body, label, caption, link, code, pre, blockquote, list };
var t2 = tokens.ref;
function focusRing(opts = {}) {
  const color = opts.color ?? t2.focus.ring;
  const width = opts.width ?? 2;
  const offset = opts.offset ?? 2;
  return style({
    outline: "2px solid transparent",
    // reserve space; real ring shown on focus
    on: {
      focusVisible: {
        outline: `${width}px solid ${color}`,
        outlineOffset: offset
      }
    }
  });
}
function visuallyHidden() {
  return style({
    position: "absolute",
    width: 1,
    height: 1,
    padding: 0,
    margin: -1,
    overflow: "hidden",
    whiteSpace: "nowrap",
    border: 0,
    // clip to a zero-area rect so the node occupies no visual space
    clipPath: "inset(50%)"
  });
}
function skipLink() {
  return style({
    position: "absolute",
    left: t2.space["2"],
    top: -40,
    background: t2.surface.raised,
    color: t2.content.primary,
    padding: t2.space["2"],
    borderRadius: t2.radius.md,
    boxShadow: t2.shadow.md,
    transition: `top ${t2.duration.fast} ${t2.easing.standard}`,
    on: {
      focusVisible: { top: t2.space["2"], outline: `2px solid ${t2.focus.ring}`, outlineOffset: 2 }
    }
  });
}
var a11y = { focusRing, visuallyHidden, skipLink };
var t3 = tokens.ref;
var CONTROL_BASE = {
  fontFamily: t3.font.sans,
  fontSize: t3.size.md,
  lineHeight: t3.leading.normal,
  color: t3.content.primary,
  background: t3.surface.background,
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: t3.border.strong,
  borderRadius: t3.radius.md,
  paddingTop: t3.space["2"],
  paddingBottom: t3.space["2"],
  paddingLeft: t3.space["3"],
  paddingRight: t3.space["3"],
  width: "100%",
  appearance: "none",
  transition: `border-color ${t3.duration.fast} ${t3.easing.standard}, box-shadow ${t3.duration.fast} ${t3.easing.standard}`,
  on: {
    focusVisible: { outline: "none", borderColor: t3.accent.primary, boxShadow: `0 0 0 3px ${t3.focus.ring}` },
    disabled: { opacity: 0.55, cursor: "not-allowed", background: t3.surface.sunken }
  },
  when: {
    invalid: { borderColor: t3.danger.border, boxShadow: `0 0 0 3px ${t3.danger.surface}` }
  }
};
function input() {
  return style(CONTROL_BASE);
}
function field() {
  return style({ display: "flex", flexDirection: "column", gap: t3.space["2"] });
}
function fieldLabel() {
  return style({
    fontFamily: t3.font.sans,
    fontSize: t3.size.sm,
    fontWeight: t3.weight.medium,
    color: t3.content.primary
  });
}
function fieldHelp() {
  return style({ fontFamily: t3.font.sans, fontSize: t3.size.xs, color: t3.content.muted });
}
function fieldError() {
  return style({
    fontFamily: t3.font.sans,
    fontSize: t3.size.xs,
    fontWeight: t3.weight.medium,
    color: t3.danger.content
  });
}
function button() {
  return style({
    fontFamily: t3.font.sans,
    fontSize: t3.size.md,
    fontWeight: t3.weight.semibold,
    lineHeight: t3.leading.normal,
    color: t3.accent.contrast,
    background: t3.accent.primary,
    borderWidth: 0,
    borderStyle: "solid",
    borderRadius: t3.radius.md,
    paddingTop: t3.space["2"],
    paddingBottom: t3.space["2"],
    paddingLeft: t3.space["4"],
    paddingRight: t3.space["4"],
    cursor: "pointer",
    appearance: "none",
    transition: `background ${t3.duration.fast} ${t3.easing.standard}`,
    on: {
      hover: { background: t3.accent.hover },
      focusVisible: { outline: "none", boxShadow: `0 0 0 3px ${t3.focus.ring}` },
      disabled: { opacity: 0.55, cursor: "not-allowed" }
    }
  });
}
var form = { field, input, label: fieldLabel, help: fieldHelp, error: fieldError, button };
var t4 = tokens.ref;
var MENU_BASE = {
  position: "absolute",
  background: t4.surface.background,
  color: t4.content.primary,
  borderRadius: t4.radius.md,
  boxShadow: t4.shadow.md,
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: t4.border.default,
  paddingTop: t4.space["1"],
  paddingBottom: t4.space["1"],
  minWidth: 180,
  zIndex: t4.z.dropdown
};
var t5 = tokens.ref;
var GraphNode = class _GraphNode {
  id;
  type;
  key;
  props;
  events;
  stateRefs;
  children;
  parent;
  constructor(type, options = {}) {
    this.type = type;
    this.id = options.id ?? generateNodeId(type);
    this.key = options.key;
    this.props = options.props ?? {};
    this.events = options.events ?? [];
    this.stateRefs = options.stateRefs ?? [];
    this.children = [];
    this.parent = null;
  }
  // ── Child management ────────────────────────────────────────────────────────
  appendChild(child) {
    if (child.parent !== null) {
      child.parent.removeChild(child);
    }
    child.parent = this;
    this.children.push(child);
  }
  insertBefore(child, reference) {
    const idx = this.children.indexOf(reference);
    if (idx === -1) {
      this.appendChild(child);
      return;
    }
    if (child.parent !== null) {
      child.parent.removeChild(child);
    }
    child.parent = this;
    this.children.splice(idx, 0, child);
  }
  removeChild(child) {
    const idx = this.children.indexOf(child);
    if (idx === -1) return;
    this.children.splice(idx, 1);
    child.parent = null;
  }
  replaceChild(newChild, oldChild) {
    const idx = this.children.indexOf(oldChild);
    if (idx === -1) {
      throw new Error(`GraphNode.replaceChild: oldChild is not a child of this node`);
    }
    if (newChild.parent !== null) {
      newChild.parent.removeChild(newChild);
    }
    oldChild.parent = null;
    newChild.parent = this;
    this.children.splice(idx, 1, newChild);
  }
  // ── Prop helpers ────────────────────────────────────────────────────────────
  setProp(key, value) {
    this.props = { ...this.props, [key]: value };
  }
  getProp(key) {
    return this.props[key];
  }
  // ── Event helpers ───────────────────────────────────────────────────────────
  addEvent(descriptor) {
    this.events.push(descriptor);
  }
  removeEvent(type) {
    this.events = this.events.filter((e) => e.type !== type);
  }
  // ── Queries ─────────────────────────────────────────────────────────────────
  get isLeaf() {
    return this.children.length === 0;
  }
  get depth() {
    let d = 0;
    let node = this.parent;
    while (node !== null) {
      d++;
      node = node.parent;
    }
    return d;
  }
  get root() {
    let node = this;
    while (node.parent !== null) {
      node = node.parent;
    }
    return node;
  }
  /** Shallow clone — does not clone children. */
  shallowClone() {
    const opts = {
      props: { ...this.props },
      events: [...this.events],
      stateRefs: [...this.stateRefs]
    };
    if (this.key !== void 0) opts.key = this.key;
    return new _GraphNode(this.type, opts);
  }
};
var ApplicationGraph = class {
  root;
  name;
  version;
  _nodeIndex = /* @__PURE__ */ new Map();
  /** Handler registry — maps handlerKey → actual function */
  handlers = /* @__PURE__ */ new Map();
  constructor(options) {
    this.name = options.name;
    this.version = options.version ?? "0.0.1";
    this.root = new GraphNode("application", { props: { name: options.name } });
    this._nodeIndex.set(this.root.id, this.root);
  }
  // ── Node creation & attachment ────────────────────────────────────────────
  createNode(type, options = {}) {
    const nodeOpts = {};
    if (options.key !== void 0) nodeOpts.key = options.key;
    if (options.props !== void 0) nodeOpts.props = options.props;
    const node = new GraphNode(type, nodeOpts);
    this._nodeIndex.set(node.id, node);
    if (options.parent !== void 0) {
      options.parent.appendChild(node);
    }
    return node;
  }
  attachNode(node, parent) {
    this._nodeIndex.set(node.id, node);
    parent.appendChild(node);
  }
  detachNode(node) {
    if (node.parent !== null) {
      node.parent.removeChild(node);
    }
    this._removeFromIndex(node);
  }
  _removeFromIndex(node) {
    this._nodeIndex.delete(node.id);
    this._unregisterNodeHandlers(node);
    for (const child of node.children) {
      this._removeFromIndex(child);
    }
  }
  /**
   * Remove every handler-registry entry owned by a single node. A node owns:
   *  - one entry per event descriptor (its `handlerKey`),
   *  - one `__signal__<signalId>` entry per state ref (signalIds are namespaced
   *    by node id, so they are never shared between nodes), and
   *  - a `__listbuild__<id>` entry if it is a reactive-list.
   * Called for every node in a detached subtree so removing list items (or
   * discarding freshly-built-but-unadopted item subtrees) leaves no stale
   * registrations behind.
   */
  _unregisterNodeHandlers(node) {
    for (const event of node.events) {
      this.handlers.delete(event.handlerKey);
    }
    for (const ref of node.stateRefs) {
      this.handlers.delete(`__signal__${ref.signalId}`);
    }
    this.handlers.delete(`__listbuild__${node.id}`);
    this.handlers.delete(`__listplan__${node.id}`);
    this.handlers.delete(`__overlay__${node.id}`);
    this.handlers.delete(`__component__${node.id}`);
    this.handlers.delete(`__transition__${node.id}`);
    this.handlers.delete(`__head__${node.id}`);
  }
  // ── Handler registry ──────────────────────────────────────────────────────
  registerHandler(key, fn) {
    this.handlers.set(key, fn);
  }
  getHandler(key) {
    return this.handlers.get(key);
  }
  /** True if a handler is currently registered under `key`. Inspection helper. */
  hasHandler(key) {
    return this.handlers.has(key);
  }
  /** Number of currently-registered handlers. Inspection helper. */
  get handlerCount() {
    return this.handlers.size;
  }
  // ── Lookup ────────────────────────────────────────────────────────────────
  findById(id) {
    return this._nodeIndex.get(id);
  }
  findAll(predicate) {
    const results = [];
    this._walk(this.root, (node) => {
      if (predicate(node)) results.push(node);
    });
    return results;
  }
  findByType(type) {
    return this.findAll((n) => n.type === type);
  }
  // ── Traversal ─────────────────────────────────────────────────────────────
  walk(visitor) {
    this._walk(this.root, visitor, 0);
  }
  _walk(node, visitor, depth = 0) {
    visitor(node, depth);
    for (const child of node.children) {
      this._walk(child, visitor, depth + 1);
    }
  }
  get nodeCount() {
    return this._nodeIndex.size;
  }
  // ── Validation ────────────────────────────────────────────────────────────
  validate() {
    const dc = new DiagnosticCollector();
    this.walk((node) => {
      for (const event of node.events) {
        if (!this.handlers.has(event.handlerKey)) {
          dc.warn(
            "GRAPH_MISSING_HANDLER",
            `Node "${node.id}" references handler "${event.handlerKey}" which is not registered`,
            { nodeId: node.id }
          );
        }
      }
      if (node.type === "page" && node.parent?.type !== "application") {
        dc.error(
          "GRAPH_PAGE_DEPTH",
          `Page node "${node.id}" must be a direct child of the application root`,
          { nodeId: node.id }
        );
      }
    });
    return dc;
  }
  // ── Serialization ─────────────────────────────────────────────────────────
  serialize() {
    return {
      name: this.name,
      version: this.version,
      root: this._serializeNode(this.root)
    };
  }
  _serializeNode(node) {
    const result = {
      id: node.id,
      type: node.type,
      key: node.key,
      props: node.props,
      events: node.events,
      stateRefs: node.stateRefs,
      children: node.children.map((c) => this._serializeNode(c))
    };
    return result;
  }
};
function classes(value) {
  if (value === void 0) return [];
  const out = [];
  for (const token of value.split(/\s+/)) {
    if (token.length > 0 && !out.includes(token)) out.push(token);
  }
  return out;
}
function merge(a, b) {
  const out = [...a];
  for (const token of b) if (!out.includes(token)) out.push(token);
  return out;
}
function resolveTransition(config2) {
  const n = config2.name;
  const enterActive = merge(
    classes(config2.enter),
    classes(config2.enterActive ?? (n !== void 0 ? `${n}-enter-active` : void 0))
  );
  const leaveActive = merge(
    classes(config2.leave),
    classes(config2.leaveActive ?? (n !== void 0 ? `${n}-leave-active` : void 0))
  );
  return {
    enterActive,
    enterFrom: classes(config2.enterFrom ?? (n !== void 0 ? `${n}-enter-from` : void 0)),
    enterTo: classes(config2.enterTo ?? (n !== void 0 ? `${n}-enter-to` : void 0)),
    leaveActive,
    leaveFrom: classes(config2.leaveFrom ?? (n !== void 0 ? `${n}-leave-from` : void 0)),
    leaveTo: classes(config2.leaveTo ?? (n !== void 0 ? `${n}-leave-to` : void 0)),
    appear: config2.appear ?? false,
    duration: config2.duration ?? 1e3
  };
}
function metaDedupKey(m) {
  if (m.charset !== void 0) return "meta:charset";
  if (m.name !== void 0) return `meta:name=${m.name}`;
  if (m.property !== void 0) return `meta:property=${m.property}`;
  if (m.httpEquiv !== void 0) return `meta:http-equiv=${m.httpEquiv}`;
  return void 0;
}
function metaAttrs(m) {
  const attrs = {};
  if (m.charset !== void 0) attrs["charset"] = m.charset;
  if (m.name !== void 0) attrs["name"] = m.name;
  if (m.property !== void 0) attrs["property"] = m.property;
  if (m.httpEquiv !== void 0) attrs["http-equiv"] = m.httpEquiv;
  if (m.content !== void 0) attrs["content"] = m.content;
  return attrs;
}
function linkAttrs(l) {
  const attrs = { rel: l.rel, href: l.href };
  if (l.sizes !== void 0) attrs["sizes"] = l.sizes;
  if (l.type !== void 0) attrs["type"] = l.type;
  if (l.media !== void 0) attrs["media"] = l.media;
  if (l.as !== void 0) attrs["as"] = l.as;
  if (l.crossorigin !== void 0) attrs["crossorigin"] = l.crossorigin;
  if (l.hreflang !== void 0) attrs["hreflang"] = l.hreflang;
  return attrs;
}
function resolveHead(config2) {
  const entries = [];
  if (config2.charset !== void 0) {
    entries.push({ tag: "meta", dedupKey: "meta:charset", attrs: { charset: config2.charset } });
  }
  if (config2.base !== void 0) {
    entries.push({ tag: "base", dedupKey: "base", attrs: { href: config2.base } });
  }
  if (config2.title !== void 0) {
    entries.push({ tag: "title", dedupKey: "title", attrs: {}, text: config2.title });
  }
  if (config2.description !== void 0) {
    entries.push({
      tag: "meta",
      dedupKey: "meta:name=description",
      attrs: { name: "description", content: config2.description }
    });
  }
  if (config2.canonical !== void 0) {
    entries.push({
      tag: "link",
      dedupKey: "link:rel=canonical",
      attrs: { rel: "canonical", href: config2.canonical }
    });
  }
  if (config2.robots !== void 0) {
    entries.push({
      tag: "meta",
      dedupKey: "meta:name=robots",
      attrs: { name: "robots", content: config2.robots }
    });
  }
  if (config2.themeColor !== void 0) {
    entries.push({
      tag: "meta",
      dedupKey: "meta:name=theme-color",
      attrs: { name: "theme-color", content: config2.themeColor }
    });
  }
  if (config2.viewport !== void 0) {
    entries.push({
      tag: "meta",
      dedupKey: "meta:name=viewport",
      attrs: { name: "viewport", content: config2.viewport }
    });
  }
  if (config2.favicon !== void 0) {
    const l = typeof config2.favicon === "string" ? { rel: "icon", href: config2.favicon } : config2.favicon;
    entries.push({ tag: "link", dedupKey: `link:rel=${l.rel}`, attrs: linkAttrs(l) });
  }
  if (config2.openGraph !== void 0) {
    for (const key of Object.keys(config2.openGraph)) {
      const property = `og:${key}`;
      entries.push({
        tag: "meta",
        dedupKey: `meta:property=${property}`,
        attrs: { property, content: config2.openGraph[key] }
      });
    }
  }
  if (config2.twitter !== void 0) {
    for (const key of Object.keys(config2.twitter)) {
      const name = `twitter:${key}`;
      entries.push({
        tag: "meta",
        dedupKey: `meta:name=${name}`,
        attrs: { name, content: config2.twitter[key] }
      });
    }
  }
  if (config2.meta !== void 0) {
    for (const m of config2.meta) {
      const key = metaDedupKey(m);
      if (key === void 0) continue;
      entries.push({ tag: "meta", dedupKey: key, attrs: metaAttrs(m) });
    }
  }
  if (config2.link !== void 0) {
    for (const l of config2.link) {
      entries.push({ tag: "link", dedupKey: `link:rel=${l.rel}:href=${l.href}`, attrs: linkAttrs(l) });
    }
  }
  return { entries };
}
function isSignal(v) {
  return v !== null && typeof v === "object" && typeof v["get"] === "function" && typeof v["subscribe"] === "function";
}
function bindValue(graph, node, propKey, value) {
  if (isSignal(value)) {
    const signalId = `${node.id}:${propKey}`;
    node.stateRefs.push({ signalId, propKey });
    graph.registerHandler(`__signal__${signalId}`, value);
    return value.peek();
  }
  return value;
}
function applyA11yProps(props, options) {
  if (options.role !== void 0) props["role"] = options.role;
  if (options.tabIndex !== void 0) props["tabindex"] = String(options.tabIndex);
  if (options.ariaLabel !== void 0) props["aria-label"] = options.ariaLabel;
  if (options.ariaLabelledBy !== void 0) props["aria-labelledby"] = options.ariaLabelledBy;
  if (options.ariaDescribedBy !== void 0) props["aria-describedby"] = options.ariaDescribedBy;
  if (options.ariaExpanded !== void 0) props["aria-expanded"] = String(options.ariaExpanded);
  if (options.ariaControls !== void 0) props["aria-controls"] = options.ariaControls;
  if (options.ariaHidden !== void 0) props["aria-hidden"] = String(options.ariaHidden);
  if (options.ariaLive !== void 0) props["aria-live"] = options.ariaLive;
  if (options.ariaCurrent !== void 0) props["aria-current"] = String(options.ariaCurrent);
  if (options.ariaInvalid !== void 0) props["aria-invalid"] = String(options.ariaInvalid);
  if (options.ariaRequired !== void 0) props["aria-required"] = String(options.ariaRequired);
  if (options.ariaModal !== void 0) props["aria-modal"] = String(options.ariaModal);
  if (options.ariaOwns !== void 0) props["aria-owns"] = options.ariaOwns;
  if (options.ariaActiveDescendant !== void 0) props["aria-activedescendant"] = options.ariaActiveDescendant;
  if (options.ariaHasPopup !== void 0) props["aria-haspopup"] = String(options.ariaHasPopup);
  if (options.ariaSelected !== void 0) props["aria-selected"] = String(options.ariaSelected);
}
function registerTransition(graph, node, config2) {
  if (config2 === void 0) return;
  const resolved = resolveTransition(config2);
  graph.registerHandler(
    `__transition__${node.id}`,
    () => resolved
  );
}
function containerProps(options) {
  const props = {};
  if (options.class !== void 0) props["class"] = options.class;
  if (options.id !== void 0) props["id"] = options.id;
  if (options.key !== void 0) props["key"] = options.key;
  applyA11yProps(props, options);
  return props;
}
function itemIdentity(item, index) {
  if (item !== null && typeof item === "object") {
    const obj = item;
    if ("id" in obj) return `id:${String(obj["id"])}`;
    if ("key" in obj) return `key:${String(obj["key"])}`;
    return `idx:${index}`;
  }
  return `val:${String(item)}`;
}
function itemValueSignature(item) {
  try {
    return JSON.stringify(item) ?? String(item);
  } catch {
    return String(item);
  }
}
function reactiveListItemSignature(item) {
  return itemValueSignature(item);
}
function reactiveListItemKey(item, index) {
  return itemIdentity(item, index);
}
var OVERLAY_KINDS = {
  dialog: {
    role: "dialog",
    modal: true,
    takesFocus: true,
    ariaModal: true,
    defaultCloseOnEscape: true,
    defaultRestoreFocus: true
  },
  popover: {
    role: "dialog",
    modal: false,
    takesFocus: true,
    ariaModal: false,
    defaultCloseOnEscape: true,
    defaultRestoreFocus: true
  },
  tooltip: {
    role: "tooltip",
    modal: false,
    takesFocus: false,
    ariaModal: false,
    defaultCloseOnEscape: false,
    defaultRestoreFocus: false
  },
  dropdown: {
    role: "menu",
    modal: false,
    takesFocus: true,
    menu: true,
    ariaModal: false,
    defaultCloseOnEscape: true,
    defaultRestoreFocus: true
  },
  toast: {
    role: "status",
    modal: false,
    takesFocus: false,
    ariaModal: false,
    ariaLive: "polite",
    defaultCloseOnEscape: false,
    defaultRestoreFocus: false
  }
};
var ContentBuilderBase = class {
  constructor(_node, _graph) {
    this._node = _node;
    this._graph = _graph;
  }
  heading(text2, options = {}) {
    const props = { level: options.level ?? 1 };
    if (options.class !== void 0) props["class"] = options.class;
    if (options.id !== void 0) props["id"] = options.id;
    applyA11yProps(props, options);
    const node = this._graph.createNode("heading", { parent: this._node, props });
    const resolved = bindValue(this._graph, node, "text", text2);
    node.setProp("text", resolved);
  }
  text(content, options = {}) {
    const props = {};
    if (options.class !== void 0) props["class"] = options.class;
    if (options.id !== void 0) props["id"] = options.id;
    applyA11yProps(props, options);
    const node = this._graph.createNode("text", { parent: this._node, props });
    const resolved = bindValue(this._graph, node, "text", content);
    node.setProp("text", resolved);
  }
  button(label2, options = {}) {
    const props = {};
    if (options.class !== void 0) props["class"] = options.class;
    if (options.id !== void 0) props["id"] = options.id;
    applyA11yProps(props, options);
    const node = this._graph.createNode("button", { parent: this._node, props });
    const resolved = bindValue(this._graph, node, "label", label2);
    node.setProp("label", resolved);
    if (options.disabled !== void 0) {
      const resolvedDisabled = bindValue(this._graph, node, "disabled", options.disabled);
      node.setProp("disabled", resolvedDisabled);
    }
    if (options.onClick !== void 0) {
      const handlerKey = `click:${node.id}`;
      this._graph.registerHandler(handlerKey, options.onClick);
      node.addEvent({ type: "click", handlerKey });
    }
  }
  input(options = {}) {
    const props = {};
    props["inputType"] = options.type ?? "text";
    if (options.placeholder !== void 0) props["placeholder"] = options.placeholder;
    if (options.class !== void 0) props["class"] = options.class;
    if (options.id !== void 0) props["id"] = options.id;
    applyA11yProps(props, options);
    const nodeOpts = {
      props,
      parent: this._node
    };
    if (options.id !== void 0) nodeOpts.key = options.id;
    const node = this._graph.createNode("input", nodeOpts);
    const bindSignal = options.bind;
    const valueBindable = bindSignal !== void 0 ? bindSignal : options.value;
    const inputHandler = bindSignal !== void 0 ? (v) => bindSignal.set(v) : options.onInput;
    if (valueBindable !== void 0) {
      const resolved = bindValue(this._graph, node, "value", valueBindable);
      node.setProp("value", resolved);
    }
    if (options.disabled !== void 0) {
      const resolved = bindValue(this._graph, node, "disabled", options.disabled);
      node.setProp("disabled", resolved);
    }
    if (inputHandler !== void 0) {
      const handlerKey = `input:${node.id}`;
      this._graph.registerHandler(handlerKey, inputHandler);
      node.addEvent({ type: "input", handlerKey });
    }
    if (options.onChange !== void 0) {
      const handlerKey = `change:${node.id}`;
      this._graph.registerHandler(handlerKey, options.onChange);
      node.addEvent({ type: "change", handlerKey });
    }
  }
  image(options) {
    const props = {
      src: options.src,
      alt: options.alt
    };
    if (options.width !== void 0) props["width"] = options.width;
    if (options.height !== void 0) props["height"] = options.height;
    if (options.class !== void 0) props["class"] = options.class;
    if (options.id !== void 0) props["id"] = options.id;
    applyA11yProps(props, options);
    const nodeOpts = {
      props,
      parent: this._node
    };
    if (options.id !== void 0) nodeOpts.key = options.id;
    this._graph.createNode("image", nodeOpts);
  }
  link(label2, options) {
    const props = {
      href: options.href,
      external: options.external ?? false
    };
    if (options.class !== void 0) props["class"] = options.class;
    if (options.id !== void 0) props["id"] = options.id;
    applyA11yProps(props, options);
    const node = this._graph.createNode("link", { parent: this._node, props });
    const resolved = bindValue(this._graph, node, "label", label2);
    node.setProp("label", resolved);
    if (options.onClick !== void 0) {
      const handlerKey = `click:${node.id}`;
      this._graph.registerHandler(handlerKey, options.onClick);
      node.addEvent({ type: "click", handlerKey });
    }
  }
  code(source, options = {}) {
    const props = {};
    if (options.language !== void 0) props["data-language"] = options.language;
    if (options.class !== void 0) props["class"] = options.class;
    if (options.id !== void 0) props["id"] = options.id;
    applyA11yProps(props, options);
    const node = this._graph.createNode("code", { parent: this._node, props });
    const resolved = bindValue(this._graph, node, "text", source);
    node.setProp("text", resolved);
  }
};
var ContainerBuilderBase = class extends ContentBuilderBase {
  section(key, builder, options = {}) {
    const node = this._graph.createNode("section", {
      key,
      parent: this._node,
      props: containerProps(options)
    });
    registerTransition(this._graph, node, options.transition);
    builder(new SectionBuilderImpl(node, this._graph));
  }
  container(key, builder, options = {}) {
    const node = this._graph.createNode("container", {
      key,
      parent: this._node,
      props: containerProps(options)
    });
    registerTransition(this._graph, node, options.transition);
    builder(new ContainerBuilderImpl(node, this._graph));
  }
  list(key, builder, options = {}) {
    const node = this._graph.createNode("list", {
      key,
      parent: this._node,
      props: containerProps(options)
    });
    registerTransition(this._graph, node, options.transition);
    builder(new ListBuilderImpl(node, this._graph));
  }
  listOf(key, items, renderItem, options = {}) {
    const graph = this._graph;
    const node = graph.createNode("reactive-list", {
      key,
      parent: this._node,
      props: containerProps(options)
    });
    registerTransition(graph, node, options.transition);
    const signalId = `${node.id}:items`;
    node.stateRefs.push({ signalId, propKey: "items" });
    graph.registerHandler(`__signal__${signalId}`, items);
    const buildItem = (item, index) => {
      const itemKey = reactiveListItemKey(item, index);
      const itemNode = graph.createNode("list-item", {
        key: itemKey,
        // `_item` records the source item *reference* so the reconciler can
        // short-circuit unchanged rows by identity (no signature hashing); `_sig`
        // is the content signature used to detect an in-place data change when the
        // reference differs. Both are internal metadata (leading `_`) and never
        // reach the DOM.
        props: {
          key: itemKey,
          _sig: reactiveListItemSignature(item),
          // The item reference is stored as opaque internal metadata (never
          // rendered); cast through `unknown` since `T` is not a `PropValue`.
          _item: item
        }
      });
      renderItem(item, index, new ContainerBuilderImpl(itemNode, graph));
      registerTransition(graph, itemNode, options.itemTransition);
      return itemNode;
    };
    const buildPlan = (raw) => {
      const arr = Array.isArray(raw) ? raw : [];
      const plan = new Array(arr.length);
      for (let i = 0; i < arr.length; i++) {
        const item = arr[i];
        const index = i;
        plan[i] = {
          key: reactiveListItemKey(item, index),
          item,
          sig: () => reactiveListItemSignature(item),
          build: () => buildItem(item, index)
        };
      }
      return plan;
    };
    graph.registerHandler(`__listplan__${node.id}`, buildPlan);
    const current = isSignal(items) ? items.peek() : items;
    const initial = Array.isArray(current) ? current : [];
    initial.forEach((item, i) => {
      node.appendChild(buildItem(item, i));
    });
  }
  form(key, builder, options = {}) {
    const props = containerProps(options);
    const node = this._graph.createNode("form", {
      key,
      parent: this._node,
      props
    });
    registerTransition(this._graph, node, options.transition);
    if (options.onSubmit !== void 0) {
      const handlerKey = `submit:${node.id}`;
      this._graph.registerHandler(handlerKey, options.onSubmit);
      node.addEvent({ type: "submit", handlerKey });
    }
    builder(new FormBuilderImpl(node, this._graph));
  }
  when(condition, builder, elseBuilder, options = {}) {
    const graph = this._graph;
    const node = graph.createNode("conditional", {
      parent: this._node,
      props: containerProps({})
    });
    const branchTransition = options.transition !== void 0 && options.appear === true ? { ...options.transition, appear: true } : options.transition;
    const buildBranch = (build, tag) => {
      const branchKey = `when-${tag}:${node.id}`;
      const branch = graph.createNode("container", {
        key: branchKey,
        props: { key: branchKey }
      });
      registerTransition(graph, branch, branchTransition);
      build(new ContainerBuilderImpl(branch, graph));
      return branch;
    };
    const buildAll = (raw) => {
      if (raw) return [buildBranch(builder, "then")];
      return elseBuilder !== void 0 ? [buildBranch(elseBuilder, "else")] : [];
    };
    if (isSignal(condition)) {
      const signalId = `${node.id}:items`;
      node.stateRefs.push({ signalId, propKey: "items" });
      graph.registerHandler(`__signal__${signalId}`, condition);
      graph.registerHandler(`__listbuild__${node.id}`, buildAll);
      const current = condition.peek();
      for (const child of buildAll(current)) node.appendChild(child);
    } else {
      for (const child of buildAll(condition)) node.appendChild(child);
    }
  }
  errorBoundary(id, builder, options) {
    const sources = options.source === void 0 ? [] : Array.isArray(options.source) ? [...options.source] : [options.source];
    const localError = signal(void 0);
    const retryNonce = signal(0);
    const readError = () => {
      const local = localError.peek();
      if (local !== void 0 && local !== null) return local;
      for (const s of sources) {
        const e = s.peek();
        if (e !== void 0 && e !== null) return e;
      }
      return void 0;
    };
    const hasError = derived(() => {
      retryNonce.get();
      localError.get();
      for (const s of sources) s.get();
      return readError() !== void 0;
    });
    const retry = () => {
      localError.set(void 0);
      options.onRetry?.();
      retryNonce.update((n) => n + 1);
    };
    this.container(id, (c) => {
      c.when(
        hasError,
        // Error state → fallback. The fallback branch mounts exactly when the
        // boundary enters its error state, so this is also where the optional
        // `onError` reporting hook fires (observe-only; §6/§7).
        (fb) => {
          const currentError = readError();
          options.onError?.(currentError);
          options.fallback(fb, currentError, retry);
        },
        // Healthy state → body, guarded against synchronous build throws.
        (body2) => {
          try {
            builder(body2);
          } catch (err) {
            queueMicrotask(() => localError.set(err));
          }
        }
      );
    }, { id });
  }
  asyncBoundary(key, res, branches) {
    const isError = derived(() => res.status.get() === "error");
    const showSuccess = derived(
      () => res.status.get() !== "error" && res.data.get() !== void 0
    );
    const showLoading = derived(
      () => res.status.get() !== "error" && res.data.get() === void 0
    );
    const dataSignal = derived(() => res.data.get());
    const retry = () => {
      void res.refetch();
    };
    this.container(key, (c) => {
      c.when(isError, (fb) => branches.error?.(fb, res.error.peek(), retry));
      c.when(showSuccess, (sb) => branches.success(sb, dataSignal));
      c.when(showLoading, (lb) => branches.loading?.(lb));
    }, { key });
  }
  // ── Portals & overlays ──────────────────────────────────────────────────────
  portal(key, builder, options = {}) {
    const node = this._graph.createNode("portal", {
      key,
      parent: this._node,
      props: containerProps(options)
    });
    builder(new ContainerBuilderImpl(node, this._graph));
  }
  /**
   * Declare document metadata (2.0 §1–§3). Creates a `'head'` node — a neutral,
   * empty inline anchor at this position (one node / one element, so positional
   * hydration is preserved) — and registers a `__head__<id>` descriptor holding
   * this call's normalized, dedup-keyed {@link resolveHead} contribution. The
   * renderer applies it to `document.head` on the browser (adopting server tags
   * on hydration, cleaning up on unmount / route change) and emits the active
   * graph's merged metadata as a string on the server (`renderHead`).
   *
   * Multiple `head()` nodes may be live at once (app default + route + component)
   * — the renderer merges them and, per dedup key, the last in document order
   * wins (see head.ts). No new render path: this reuses the same graph-node +
   * handler-registry convention as overlays/transitions/components.
   */
  head(metadata) {
    const node = this._graph.createNode("head", {
      parent: this._node,
      props: { "data-streetui-head-anchor": "" }
    });
    const contribution = resolveHead(metadata);
    this._graph.registerHandler(
      `__head__${node.id}`,
      () => contribution
    );
  }
  /**
   * Shared assembly for every overlay kind: a `portal` node whose single child
   * is a `when(open, panel)` conditional. The panel container carries the
   * kind's ARIA semantics; `builder` fills it. An `__overlay__<portalId>`
   * descriptor is registered so the renderer wires focus/keyboard behavior to
   * the same `open` signal that drives the panel. Reuses existing primitives
   * (portal + when + container) — no new render path.
   */
  _overlay(kind, key, options, builder) {
    const graph = this._graph;
    const portalNode = graph.createNode("portal", {
      key,
      parent: this._node,
      props: { key }
    });
    const openBindable = options.open;
    const openSignal = isSignal(openBindable) ? openBindable : signal(openBindable);
    const panelOptions = {
      role: options.role ?? kind.role,
      ...kind.ariaModal ? { ariaModal: true } : {},
      ...kind.ariaLive !== void 0 ? { ariaLive: kind.ariaLive } : {},
      ...options.class !== void 0 ? { class: options.class } : {},
      ...options.ariaLabel !== void 0 ? { ariaLabel: options.ariaLabel } : {},
      ...options.ariaLabelledBy !== void 0 ? { ariaLabelledBy: options.ariaLabelledBy } : {},
      ...options.ariaDescribedBy !== void 0 ? { ariaDescribedBy: options.ariaDescribedBy } : {}
    };
    const portalBuilder = new ContainerBuilderImpl(portalNode, graph);
    portalBuilder.when(
      openSignal,
      (panelHost) => {
        panelHost.container(`${key}__panel`, builder, panelOptions);
      },
      void 0,
      // Overlay open/close rides the panel's `when`; a transition animates the
      // panel in on open and — via the reconciler's deferred-leave — plays the
      // leave before the panel is removed (§10). Focus is restored at close-
      // request time (see wireOverlayBehavior), so it never stays trapped inside
      // a panel that is animating away.
      options.transition !== void 0 ? { transition: options.transition } : {}
    );
    const descriptor = {
      open: openSignal,
      modal: kind.modal,
      takesFocus: kind.takesFocus,
      menu: kind.menu ?? false,
      closeOnEscape: options.closeOnEscape ?? kind.defaultCloseOnEscape,
      restoreFocus: options.restoreFocus ?? kind.defaultRestoreFocus,
      ...options.initialFocusId !== void 0 ? { initialFocusId: options.initialFocusId } : {},
      ...options.onClose !== void 0 ? { onClose: options.onClose } : {}
    };
    graph.registerHandler(
      `__overlay__${portalNode.id}`,
      () => descriptor
    );
  }
  dialog(key, options, builder) {
    this._overlay(OVERLAY_KINDS.dialog, key, options, builder);
  }
  popover(key, options, builder) {
    this._overlay(OVERLAY_KINDS.popover, key, options, builder);
  }
  tooltip(key, options, builder) {
    this._overlay(OVERLAY_KINDS.tooltip, key, options, builder);
  }
  dropdown(key, options, builder) {
    this._overlay(OVERLAY_KINDS.dropdown, key, options, builder);
  }
  toast(key, options, builder) {
    this._overlay(OVERLAY_KINDS.toast, key, options, builder);
  }
  // ── Components ────────────────────────────────────────────────────────────
  /**
   * Instantiate a reusable component (§3–§9). Creates a `'component'` node
   * (rendered as a `<div>` wrapper — preserves the one-node/one-element
   * positional-hydration invariant), then runs `def.setup(props, ctx)`
   * synchronously to obtain the render function and fills the component's own
   * container scope with it — structurally identical to `container`/
   * `errorBoundary`. Cleanups the setup registers via `ctx.effect`/
   * `ctx.onCleanup` are collected into a closure and exposed to the renderer
   * through a `__component__<id>` handler (mirroring `__overlay__`); the mount/
   * hydrate paths read it and route each into `NodeInstance.trackCleanup`, so
   * teardown runs (children-first) when the component leaves the graph.
   *
   * `setup` runs once per instance here at build time. When this component sits
   * inside a keyed list / conditional, a rebuild disposes the old instance
   * (running its cleanups + pruning its `__component__` entry) and re-runs this
   * method for the new node — so re-invocation is safe and leak-free.
   */
  component(key, def, props, children) {
    const graph = this._graph;
    const node = graph.createNode("component", {
      key,
      parent: this._node,
      // `data-streetui-component` is a non-underscore prop, so it reaches the
      // DOM as an attribute and is visible to DevTools (§21) — unlike the
      // internal `_`-prefixed metadata the renderer hides.
      props: { key, "data-streetui-component": def.name }
    });
    const cleanups = [];
    const ctx = {
      key,
      onCleanup(fn) {
        cleanups.push(fn);
      },
      effect(fn) {
        cleanups.push(effect(fn));
      },
      renderChildren(content) {
        if (children !== void 0) children(content);
      }
    };
    let render;
    try {
      render = def.setup(props, ctx);
      render(new ContainerBuilderImpl(node, graph));
    } catch (err) {
      queueMicrotask(() => {
        throw err;
      });
    }
    if (cleanups.length > 0) {
      graph.registerHandler(
        `__component__${node.id}`,
        () => cleanups
      );
    }
  }
};
var SectionBuilderImpl = class extends ContainerBuilderBase {
};
var ContainerBuilderImpl = class extends ContainerBuilderBase {
};
var FormBuilderImpl = class extends ContainerBuilderBase {
};
var ListBuilderImpl = class extends ContentBuilderBase {
  item(key, builder, options = {}) {
    const node = this._graph.createNode("list-item", {
      key,
      parent: this._node,
      props: containerProps(options)
    });
    registerTransition(this._graph, node, options.transition);
    builder(new ContainerBuilderImpl(node, this._graph));
  }
};
var PageBuilderImpl = class extends ContainerBuilderBase {
};
var AppBuilder = class {
  constructor(_graph) {
    this._graph = _graph;
  }
  page(key, builder) {
    const node = this._graph.createNode("page", {
      key,
      parent: this._graph.root,
      props: { key }
    });
    builder(new PageBuilderImpl(node, this._graph));
  }
};
var StreetApp = class {
  _graph;
  _builder;
  constructor(options) {
    const graphOpts = { name: options.name };
    if (options.version !== void 0) graphOpts.version = options.version;
    this._graph = new ApplicationGraph(graphOpts);
    this._builder = new AppBuilder(this._graph);
  }
  page(key, builder) {
    this._builder.page(key, builder);
    return this;
  }
  /** Compile to ApplicationGraph — validates and returns the graph. */
  build() {
    const dc = this._graph.validate();
    dc.throwIfErrors();
    return this._graph;
  }
  /** Access graph before building (useful for inspection). */
  get graph() {
    return this._graph;
  }
};
var streetui = {
  app(options) {
    return new StreetApp(options);
  }
};
function validateGraph(graph) {
  const dc = new DiagnosticCollector();
  dc.merge(graph.validate());
  const pages = graph.findByType("page");
  if (pages.length === 0) {
    dc.warn(
      "COMPILER_NO_PAGES",
      "Application has no pages defined. At least one page is recommended."
    );
  }
  graph.walk((node) => {
    validateNode(node, dc);
  });
  return dc;
}
function validateNode(node, dc) {
  switch (node.type) {
    case "heading": {
      const text2 = node.getProp("text");
      if (text2 === void 0 || text2 === "") {
        dc.warn("COMPILER_EMPTY_HEADING", `Heading node "${node.id}" has no text content`, {
          nodeId: node.id
        });
      }
      break;
    }
    case "image": {
      const src = node.getProp("src");
      const alt = node.getProp("alt");
      if (!src) {
        dc.error("COMPILER_IMAGE_NO_SRC", `Image node "${node.id}" is missing src`, {
          nodeId: node.id
        });
      }
      if (!alt) {
        dc.warn("COMPILER_IMAGE_NO_ALT", `Image node "${node.id}" is missing alt text`, {
          nodeId: node.id
        });
      }
      break;
    }
    case "link": {
      const href = node.getProp("href");
      if (!href) {
        dc.error("COMPILER_LINK_NO_HREF", `Link node "${node.id}" is missing href`, {
          nodeId: node.id
        });
      }
      break;
    }
    default:
      break;
  }
}
function transformGraph(graph) {
  graph.walk((node, depth) => {
    applyDefaults(node);
    ensureRenderKey(node, depth);
  });
}
function applyDefaults(node) {
  switch (node.type) {
    case "heading": {
      if (node.getProp("level") === void 0) {
        node.setProp("level", 1);
      }
      break;
    }
    case "input": {
      if (node.getProp("inputType") === void 0) {
        node.setProp("inputType", "text");
      }
      break;
    }
    case "link": {
      if (node.getProp("external") === void 0) {
        node.setProp("external", false);
      }
      break;
    }
    default:
      break;
  }
}
function ensureRenderKey(node, depth) {
  if (node.getProp("_renderKey") === void 0) {
    const key = node.key ?? `${node.type}:${node.id}:${depth}`;
    node.setProp("_renderKey", key);
  }
}
function compile(app, options = {}) {
  const strict = options.strict ?? true;
  const strictWarnings = options.strictWarnings ?? false;
  const dc = new DiagnosticCollector();
  const graph = app.graph;
  const validationDc = validateGraph(graph);
  dc.merge(validationDc);
  if (strict && dc.hasErrors) {
    dc.throwIfErrors();
  }
  if (strictWarnings && dc.hasWarnings) {
    throw new Error(
      `[StreetUI Compiler] Compilation failed: warnings treated as errors.
` + dc.diagnostics.filter((d) => d.severity === "warning").map((d) => `  [${d.code}] ${d.message}`).join("\n")
    );
  }
  transformGraph(graph);
  return {
    graph,
    diagnostics: dc,
    name: graph.name,
    version: graph.version,
    compiledAt: Date.now()
  };
}
var PRIORITY_ORDER = {
  immediate: 0,
  normal: 1,
  idle: 2
};
var Scheduler = class {
  _queue = /* @__PURE__ */ new Map();
  _flushScheduled = false;
  _flushing = false;
  _diagnostics = void 0;
  /**
   * Install an optional diagnostic sink for swallowed job errors. Pass
   * `undefined` to restore the default `console.error` reporting. Additive and
   * opt-in — the scheduler never sends anything anywhere on its own.
   */
  setDiagnostics(sink) {
    this._diagnostics = sink;
  }
  /** Total jobs currently queued. */
  get size() {
    return this._queue.size;
  }
  /** True if a flush has been scheduled but not yet executed. */
  get isPending() {
    return this._flushScheduled;
  }
  /**
   * Enqueue a job. If a job with the same key exists, the new one replaces it
   * (allowing callers to coalesce repeated updates for the same node).
   */
  schedule(job) {
    this._queue.set(job.key, job);
    if (!this._flushScheduled && !this._flushing) {
      this._flushScheduled = true;
      this._scheduleMicrotask();
    }
  }
  /** Schedule multiple jobs atomically. */
  scheduleAll(jobs) {
    for (const job of jobs) {
      this._queue.set(job.key, job);
    }
    if (!this._flushScheduled && !this._flushing && this._queue.size > 0) {
      this._flushScheduled = true;
      this._scheduleMicrotask();
    }
  }
  /**
   * Cancel a queued job by key. No-op if not queued.
   */
  cancel(key) {
    this._queue.delete(key);
  }
  /**
   * Synchronously flush all queued jobs (sorted by priority).
   * Useful in tests and for immediate rendering.
   */
  flush() {
    if (this._flushing) return;
    this._flushScheduled = false;
    this._flushing = true;
    const jobs = Array.from(this._queue.values()).sort(
      (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
    );
    this._queue.clear();
    try {
      for (const job of jobs) {
        try {
          job.fn();
        } catch (err) {
          if (this._diagnostics?.error) {
            this._diagnostics.error(`Scheduler job "${job.key}" threw`, err);
          } else {
            console.error(`[Scheduler] Job "${job.key}" threw:`, err);
          }
        }
      }
    } finally {
      this._flushing = false;
    }
  }
  /** Clear all pending jobs without executing them. */
  clear() {
    this._queue.clear();
    this._flushScheduled = false;
  }
  _scheduleMicrotask() {
    Promise.resolve().then(() => {
      if (this._flushScheduled) {
        this.flush();
      }
    });
  }
};
var scheduler = new Scheduler();
var EventBus = class {
  _handlers = /* @__PURE__ */ new Map();
  on(type, handler) {
    let set = this._handlers.get(type);
    if (set === void 0) {
      set = /* @__PURE__ */ new Set();
      this._handlers.set(type, set);
    }
    set.add(handler);
    return () => this.off(type, handler);
  }
  off(type, handler) {
    this._handlers.get(type)?.delete(handler);
  }
  once(type, handler) {
    const wrapped = (event) => {
      handler(event);
      this.off(type, wrapped);
    };
    return this.on(type, wrapped);
  }
  emit(event) {
    const handlers = this._handlers.get(event.type);
    if (handlers === void 0) return;
    for (const h2 of handlers) {
      h2(event);
    }
  }
  clear(type) {
    if (type !== void 0) {
      this._handlers.delete(type);
    } else {
      this._handlers.clear();
    }
  }
  listenerCount(type) {
    return this._handlers.get(type)?.size ?? 0;
  }
};
var globalEventBus = new EventBus();
var ServerStyle = class {
  declarations = /* @__PURE__ */ new Map();
  setProperty(name, value) {
    this.declarations.set(name, value);
  }
  get isEmpty() {
    return this.declarations.size === 0;
  }
  toCss() {
    return [...this.declarations.entries()].map(([k, v]) => `${k}: ${v}`).join("; ");
  }
};
var ServerText = class {
  kind = "text";
  parent = null;
  data;
  constructor(data) {
    this.data = data;
  }
};
var ServerComment = class {
  kind = "comment";
  parent = null;
  data;
  constructor(data) {
    this.data = data;
  }
};
var ServerFragment = class {
  kind = "fragment";
  parent = null;
  children = [];
};
var ServerRawHTML = class {
  kind = "raw";
  parent = null;
  html;
  constructor(html) {
    this.html = html;
  }
};
var ServerElement = class {
  kind = "element";
  parent = null;
  tagName;
  attributes = /* @__PURE__ */ new Map();
  children = [];
  // Lazily-allocated stores. On the 10k-row SSR corpus ~0% of elements carry JS
  // properties or inline styles (measured, §5: 1 of 80,029 elements uses
  // `properties`, 0 use `style`), so eagerly allocating a `properties` Map plus
  // a `ServerStyle` (which itself holds a Map) per element wasted ~240k
  // allocations per /users render — all in the dominant mount phase. These are
  // created on first WRITE via the `properties`/`style` getters; the serializer
  // reads the raw `_properties`/`_style` fields so a READ never forces an
  // allocation. Output is byte-identical: an unset store previously serialized
  // to nothing (empty `properties.has(...)` / `style.isEmpty`), and a null store
  // is skipped the same way.
  _properties = null;
  _style = null;
  constructor(tagName) {
    this.tagName = tagName.toLowerCase();
  }
  /** JS properties set via `setProperty` (e.g. input `value`, `checked`). Allocated on first access. */
  get properties() {
    return this._properties ??= /* @__PURE__ */ new Map();
  }
  /** Inline-style holder mirroring `element.style`. Allocated on first access. */
  get style() {
    return this._style ??= new ServerStyle();
  }
};
var VOID_ELEMENTS = /* @__PURE__ */ new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr"
]);
var SERIALIZED_PROPERTIES = {
  value: "attr",
  checked: "boolean",
  selected: "boolean"
};
var SERIALIZED_PROPERTY_ENTRIES = Object.entries(SERIALIZED_PROPERTIES);
var TEXT_SPECIAL = /[&<>]/;
var ATTR_SPECIAL = /[&<>"]/;
function escapeHtmlText(value) {
  if (!TEXT_SPECIAL.test(value)) return value;
  let out = "";
  let last = 0;
  for (let i = 0; i < value.length; i++) {
    let esc;
    switch (value.charCodeAt(i)) {
      case 38:
        esc = "&amp;";
        break;
      // &
      case 60:
        esc = "&lt;";
        break;
      // <
      case 62:
        esc = "&gt;";
        break;
      // >
      default:
        continue;
    }
    out += value.slice(last, i) + esc;
    last = i + 1;
  }
  return out + value.slice(last);
}
function escapeHtmlAttr(value) {
  if (!ATTR_SPECIAL.test(value)) return value;
  let out = "";
  let last = 0;
  for (let i = 0; i < value.length; i++) {
    let esc;
    switch (value.charCodeAt(i)) {
      case 38:
        esc = "&amp;";
        break;
      // &
      case 60:
        esc = "&lt;";
        break;
      // <
      case 62:
        esc = "&gt;";
        break;
      // >
      case 34:
        esc = "&quot;";
        break;
      // "
      default:
        continue;
    }
    out += value.slice(last, i) + esc;
    last = i + 1;
  }
  return out + value.slice(last);
}
function serializeAttributes(el) {
  const parts = [];
  for (const [name, value] of el.attributes) {
    if (value === "") {
      parts.push(` ${name}`);
    } else {
      parts.push(` ${name}="${escapeHtmlAttr(value)}"`);
    }
  }
  const props = el._properties;
  if (props !== null) {
    for (const [name, kind] of SERIALIZED_PROPERTY_ENTRIES) {
      if (!props.has(name)) continue;
      if (el.attributes.has(name)) continue;
      const raw = props.get(name);
      if (kind === "boolean") {
        if (raw === true) parts.push(` ${name}`);
      } else {
        if (raw !== void 0 && raw !== null) {
          parts.push(` ${name}="${escapeHtmlAttr(String(raw))}"`);
        }
      }
    }
  }
  const style2 = el._style;
  if (style2 !== null && !style2.isEmpty && !el.attributes.has("style")) {
    parts.push(` style="${escapeHtmlAttr(style2.toCss())}"`);
  }
  return parts.join("");
}
function serializeServerNode(node) {
  switch (node.kind) {
    case "text":
      return escapeHtmlText(node.data);
    case "comment":
      return `<!--${node.data}-->`;
    case "fragment":
      return serializeChildren(node);
    case "raw":
      return node.html;
    case "element": {
      const el = node;
      const tag = el.tagName;
      const attrs = serializeAttributes(el);
      if (VOID_ELEMENTS.has(tag)) {
        return `<${tag}${attrs}>`;
      }
      return `<${tag}${attrs}>${serializeChildren(el)}</${tag}>`;
    }
  }
}
function serializeChildren(node) {
  let out = "";
  for (const child of node.children) {
    out += serializeServerNode(child);
  }
  return out;
}
function asServer(node) {
  return node;
}
function asParent(node) {
  return node;
}
var ServerDOMAdapter = class {
  createElement(tag, _ns) {
    return new ServerElement(tag);
  }
  createTextNode(data) {
    return new ServerText(data);
  }
  createComment(data) {
    return new ServerComment(data);
  }
  createFragment() {
    return new ServerFragment();
  }
  /**
   * Create a verbatim pre-serialized HTML node (v1.7 static SSR plan, §6).
   * Server-only: the browser adapter does not implement this, and the renderer
   * fast path only invokes it when a static SSR plan is present (SSR). The
   * stored HTML was produced by this same serializer, so it is emitted as-is.
   */
  createRawHTML(html) {
    return new ServerRawHTML(html);
  }
  appendChild(parent, child) {
    const p3 = asParent(parent);
    const c = asServer(child);
    this._detach(c);
    c.parent = p3;
    p3.children.push(c);
  }
  insertBefore(parent, child, reference) {
    const p3 = asParent(parent);
    const c = asServer(child);
    this._detach(c);
    c.parent = p3;
    if (reference === null) {
      p3.children.push(c);
      return;
    }
    const ref = asServer(reference);
    const idx = p3.children.indexOf(ref);
    if (idx === -1) p3.children.push(c);
    else p3.children.splice(idx, 0, c);
  }
  removeChild(parent, child) {
    const p3 = asParent(parent);
    const c = asServer(child);
    const idx = p3.children.indexOf(c);
    if (idx !== -1) {
      p3.children.splice(idx, 1);
      c.parent = null;
    }
  }
  replaceChild(parent, newChild, oldChild) {
    const p3 = asParent(parent);
    const nc = asServer(newChild);
    const oc = asServer(oldChild);
    const idx = p3.children.indexOf(oc);
    if (idx === -1) return;
    this._detach(nc);
    nc.parent = p3;
    p3.children.splice(idx, 1, nc);
    oc.parent = null;
  }
  _detach(node) {
    if (node.parent !== null) {
      const siblings = node.parent.children;
      const idx = siblings.indexOf(node);
      if (idx !== -1) siblings.splice(idx, 1);
      node.parent = null;
    }
  }
  setAttribute(element, name, value) {
    element.attributes.set(name, value);
  }
  removeAttribute(element, name) {
    element.attributes.delete(name);
  }
  getAttribute(element, name) {
    return element.attributes.get(name) ?? null;
  }
  setProperty(element, name, value) {
    element.properties.set(name, value);
  }
  setTextContent(node, text2) {
    const n = asServer(node);
    if (n.kind === "element" || n.kind === "fragment") {
      const el = n;
      el.children.length = 0;
      const t62 = new ServerText(text2);
      t62.parent = el;
      el.children.push(t62);
    } else if (n.kind === "text") {
      n.data = text2;
    }
  }
  getTextContent(node) {
    const n = asServer(node);
    if (n.kind === "text") return n.data;
    if (n.kind === "element" || n.kind === "fragment") {
      let out = "";
      for (const c of n.children) {
        out += this.getTextContent(c) ?? "";
      }
      return out;
    }
    return null;
  }
  // Server nodes never dispatch events — listeners are a no-op on the server.
  addEventListener() {
  }
  removeEventListener() {
  }
  querySelector() {
    return null;
  }
  querySelectorAll() {
    return [];
  }
  getElementById() {
    return null;
  }
  focus() {
  }
  body() {
    return null;
  }
  head() {
    return null;
  }
  activeElement() {
    return null;
  }
  contains(_ancestor, _node) {
    return false;
  }
  matches(_element, _selector) {
    return false;
  }
  isElement(node) {
    return asServer(node).kind === "element";
  }
  isTextNode(node) {
    return asServer(node).kind === "text";
  }
  tagName(element) {
    return element.tagName;
  }
  parentNode(node) {
    return asServer(node).parent ?? null;
  }
  nextSibling(node) {
    const n = asServer(node);
    const parent = n.parent;
    if (parent === null) return null;
    const idx = parent.children.indexOf(n);
    if (idx === -1 || idx + 1 >= parent.children.length) return null;
    return parent.children[idx + 1];
  }
  firstChild(node) {
    const n = asServer(node);
    if (n.kind === "element" || n.kind === "fragment") {
      const el = n;
      return el.children[0] ?? null;
    }
    return null;
  }
  childNodes(node) {
    const n = asServer(node);
    if (n.kind === "element" || n.kind === "fragment") {
      return n.children;
    }
    return [];
  }
  // ── Server-only ────────────────────────────────────────────────────────────
  /** Serialize a node's children ("inner HTML") to an HTML string. */
  serializeInner(node) {
    const n = asServer(node);
    if (n.kind === "element" || n.kind === "fragment") {
      return serializeChildren(n);
    }
    return "";
  }
  /** Serialize a node (including itself) to an HTML string. */
  serializeOuter(node) {
    return serializeServerNode(asServer(node));
  }
};
var FOCUSABLE_SELECTOR = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
function focusById(dom, root, id) {
  const el = dom.querySelector(root, `[id="${id}"]`);
  if (el === null) return false;
  dom.focus(el);
  return true;
}
function focusFirst(dom, container2, selector = FOCUSABLE_SELECTOR) {
  const el = dom.querySelector(container2, selector);
  if (el === null) return false;
  dom.focus(el);
  return true;
}
function getFocusable(dom, container2, selector = FOCUSABLE_SELECTOR) {
  return Array.from(dom.querySelectorAll(container2, selector)).filter(
    (el) => dom.matches(el, selector)
  );
}
function saveFocus(dom) {
  return dom.activeElement();
}
function restoreFocus(dom, saved) {
  if (saved !== null) dom.focus(saved);
}
function focusInitial(dom, container2, initialFocusId) {
  if (initialFocusId !== void 0 && focusById(dom, container2, initialFocusId)) return;
  focusFirst(dom, container2);
}
function trapFocus(dom, container2) {
  const onKeydown = (event) => {
    if (event.key !== "Tab") return;
    const items = getFocusable(dom, container2);
    if (items.length === 0) {
      event.preventDefault();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const active = dom.activeElement();
    if (active === null || !dom.contains(container2, active)) {
      event.preventDefault();
      dom.focus(first);
    } else if (event.shiftKey && active === first) {
      event.preventDefault();
      dom.focus(last);
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      dom.focus(first);
    }
  };
  dom.addEventListener(container2, "keydown", onKeydown);
  return () => dom.removeEventListener(container2, "keydown", onKeydown);
}
var containmentStack = [];
function containFocus(dom, container2) {
  const body2 = dom.body();
  if (body2 === null) return () => {
  };
  containmentStack.push(container2);
  const onFocusIn = (event) => {
    if (containmentStack[containmentStack.length - 1] !== container2) return;
    const target = event.target;
    if (target !== null && !dom.contains(container2, target)) {
      focusFirst(dom, container2);
    }
  };
  dom.addEventListener(body2, "focusin", onFocusIn);
  return () => {
    dom.removeEventListener(body2, "focusin", onFocusIn);
    const index = containmentStack.lastIndexOf(container2);
    if (index !== -1) containmentStack.splice(index, 1);
  };
}
function onEscape(dom, target, handler) {
  const onKeydown = (event) => {
    if (event.key === "Escape") handler();
  };
  dom.addEventListener(target, "keydown", onKeydown);
  return () => dom.removeEventListener(target, "keydown", onKeydown);
}
function rovingMenu(dom, container2, selector = FOCUSABLE_SELECTOR) {
  const onKeydown = (event) => {
    const key = event.key;
    const isActivate = key === "Enter" || key === " " || key === "Spacebar";
    const isMove = key === "ArrowDown" || key === "ArrowUp" || key === "Home" || key === "End";
    if (!isActivate && !isMove) return;
    const items = getFocusable(dom, container2, selector);
    if (items.length === 0) return;
    const active = dom.activeElement();
    const index = active === null ? -1 : items.indexOf(active);
    if (isActivate) {
      if (index < 0) return;
      event.preventDefault();
      items[index].click?.();
      return;
    }
    event.preventDefault();
    let next;
    if (key === "Home") next = 0;
    else if (key === "End") next = items.length - 1;
    else if (key === "ArrowDown") next = index < 0 ? 0 : (index + 1) % items.length;
    else next = index <= 0 ? items.length - 1 : index - 1;
    dom.focus(items[next]);
  };
  dom.addEventListener(container2, "keydown", onKeydown);
  return () => dom.removeEventListener(container2, "keydown", onKeydown);
}
function createRenderContext(dom, graph, container2, hydrationDiagnostics, staticHTML) {
  return {
    dom,
    graph,
    instances: /* @__PURE__ */ new Map(),
    container: container2,
    ...hydrationDiagnostics !== void 0 ? { hydrationDiagnostics } : {},
    ...staticHTML !== void 0 ? { staticHTML } : {}
  };
}
var NodeInstance = class {
  graphNode;
  /** The primary DOM node for this instance (element or text node). */
  domNode;
  children = [];
  cleanup = new CleanupRegistry();
  constructor(graphNode, domNode) {
    this.graphNode = graphNode;
    this.domNode = domNode;
  }
  addChild(child) {
    this.children.push(child);
  }
  /** Subscribe to a signal; auto-cleanup on unmount. */
  trackSignal(sig, handler) {
    const unsub = sig.subscribe(handler);
    this.cleanup.add(unsub);
  }
  /** Register a raw cleanup fn (DOM event removal, etc.). */
  trackCleanup(fn) {
    this.cleanup.add(fn);
  }
  dispose() {
    for (const child of this.children) {
      child.dispose();
    }
    this.cleanup.run();
  }
};
var DOM_PROPERTIES = /* @__PURE__ */ new Set([
  "value",
  "checked",
  "selected",
  "indeterminate",
  "innerHTML",
  "textContent",
  "innerText",
  "scrollTop",
  "scrollLeft"
]);
var BOOLEAN_ATTRS = /* @__PURE__ */ new Set([
  "disabled",
  "readonly",
  "required",
  "checked",
  "selected",
  "multiple",
  "autofocus",
  "autoplay",
  "controls",
  "default",
  "defer",
  "formnovalidate",
  "hidden",
  "ismap",
  "loop",
  "novalidate",
  "open",
  "reversed",
  "scoped",
  "seamless"
]);
function applyProp(dom, element, name, value) {
  if (name.startsWith("_")) return;
  if (name.startsWith("on")) return;
  if (DOM_PROPERTIES.has(name)) {
    dom.setProperty(element, name, value);
    return;
  }
  if (BOOLEAN_ATTRS.has(name)) {
    if (value === true || value === "" || value === name) {
      dom.setAttribute(element, name, "");
    } else {
      dom.removeAttribute(element, name);
    }
    return;
  }
  if (name === "class" || name === "className") {
    dom.setAttribute(element, "class", String(value ?? ""));
    return;
  }
  if (name === "style" && typeof value === "object" && value !== null) {
    const el = element;
    const styles = value;
    for (const [k, v] of Object.entries(styles)) {
      el.style.setProperty(k, v);
    }
    return;
  }
  if (name.startsWith("style.")) {
    const el = element;
    const prop = name.slice("style.".length);
    if (value === null || value === void 0) el.style.removeProperty(prop);
    else el.style.setProperty(prop, String(value));
    return;
  }
  if (value === null || value === void 0 || value === false) {
    dom.removeAttribute(element, name);
    return;
  }
  dom.setAttribute(element, name, String(value));
}
function patchProp(dom, element, name, oldValue, newValue) {
  if (Object.is(oldValue, newValue)) return;
  applyProp(dom, element, name, newValue);
}
function wireEvents(dom, graph, node, element, instance) {
  if (node.events.length === 0) return;
  for (const eventDesc of node.events) {
    const handler = graph.getHandler(eventDesc.handlerKey);
    if (handler === void 0) continue;
    const domListener = (domEvent) => {
      if (eventDesc.type === "input" || eventDesc.type === "change") {
        const input2 = domEvent.target;
        handler(input2.value);
      } else if (eventDesc.type === "submit") {
        domEvent.preventDefault();
        handler(domEvent);
      } else {
        handler();
      }
    };
    dom.addEventListener(element, eventDesc.type, domListener);
    instance.trackCleanup(() => {
      dom.removeEventListener(element, eventDesc.type, domListener);
    });
  }
}
var TAG_MAP = {
  application: "div",
  page: "div",
  section: "section",
  container: "div",
  heading: "h1",
  text: "span",
  button: "button",
  input: "input",
  form: "form",
  list: "ul",
  "list-item": "li",
  image: "img",
  link: "a",
  // A `code()` node renders as a semantic `<pre>` outer element; the mount/
  // hydrate branches add a single inner `<code>` holding the escaped source
  // (mirrors how `text` renders `<span>` + an inner text node). One graph
  // node → one outer element preserves positional hydration.
  code: "pre",
  component: "div",
  slot: "div",
  fragment: "div",
  "reactive-list": "ul",
  // A portal renders as a neutral inline anchor <div> at its declaration site;
  // its children are relocated to a document.body container on the browser
  // (see the portal branch in mount.ts). On the server (no body) it renders
  // inline, so the anchor tag is what SSR/hydration positionally match on.
  portal: "div",
  // A `head()` node renders as a neutral, empty inline anchor <div> at its
  // declaration site (like a portal anchor). Its actual contribution — title/
  // meta/link/etc. — is applied to `document.head` by `wireHeadBehavior` on the
  // browser, and emitted separately by `renderHead()` on the server. Keeping a
  // one-node/one-element anchor preserves positional hydration.
  head: "div"
};
function resolveTag(type) {
  return TAG_MAP[type] ?? "div";
}
function patchNode(ctx, graphNode, propKey, newValue) {
  const instance = ctx.instances.get(graphNode.id);
  if (instance === void 0) return;
  const domNode = instance.domNode;
  if (!ctx.dom.isElement(domNode)) return;
  const oldValue = graphNode.getProp(propKey);
  switch (propKey) {
    case "text":
      if (!Object.is(oldValue, newValue)) {
        ctx.dom.setTextContent(domNode, String(newValue ?? ""));
        graphNode.setProp("text", String(newValue ?? ""));
      }
      break;
    case "label":
      if (!Object.is(oldValue, newValue)) {
        ctx.dom.setTextContent(domNode, String(newValue ?? ""));
        graphNode.setProp("label", String(newValue ?? ""));
      }
      break;
    case "disabled":
      if (newValue === true) {
        ctx.dom.setAttribute(domNode, "disabled", "");
      } else {
        ctx.dom.removeAttribute(domNode, "disabled");
      }
      graphNode.setProp("disabled", Boolean(newValue));
      break;
    case "value":
      if (!Object.is(oldValue, newValue)) {
        ctx.dom.setProperty(domNode, "value", String(newValue ?? ""));
        graphNode.setProp("value", String(newValue ?? ""));
      }
      break;
    default:
      patchProp(ctx.dom, domNode, propKey, oldValue, newValue);
      graphNode.setProp(propKey, newValue);
      break;
  }
}
function reconcileChildren(ctx, parentDom, oldInstances, newNodes, mountFn, hooks) {
  const oldByKey = /* @__PURE__ */ new Map();
  for (const inst of oldInstances) {
    const key = inst.graphNode.key ?? inst.graphNode.id;
    oldByKey.set(key, inst);
  }
  const newInstances = [];
  const usedKeys = /* @__PURE__ */ new Set();
  for (const newNode of newNodes) {
    const key = newNode.key ?? newNode.id;
    const existing = oldByKey.get(key);
    if (existing !== void 0) {
      usedKeys.add(key);
      const oldSig = existing.graphNode.getProp("_sig");
      const newSig = newNode.getProp("_sig");
      patchExistingInstance(ctx, existing, newNode);
      if (!Object.is(oldSig, newSig)) {
        reconcileItemChildren(ctx, existing, newNode, mountFn);
      }
      newInstances.push(existing);
    } else {
      const reclaimed = hooks?.takeLeaving(key);
      if (reclaimed !== void 0) {
        patchExistingInstance(ctx, reclaimed, newNode);
        reconcileItemChildren(ctx, reclaimed, newNode, mountFn);
        hooks?.onEnter(reclaimed);
        newInstances.push(reclaimed);
      } else {
        const inst = mountFn(newNode, parentDom);
        hooks?.onEnter(inst);
        newInstances.push(inst);
      }
    }
  }
  const removed = [];
  for (const inst of oldInstances) {
    const key = inst.graphNode.key ?? inst.graphNode.id;
    if (usedKeys.has(key)) continue;
    if (hooks !== void 0 && hooks.beginLeave(inst)) continue;
    const parent = ctx.dom.parentNode(inst.domNode);
    if (parent !== null) ctx.dom.removeChild(parent, inst.domNode);
    inst.dispose();
    removed.push(inst);
  }
  reorderDom(ctx, parentDom, newInstances);
  return { instances: newInstances, removed };
}
function reconcileChildrenByPlan(ctx, parentDom, oldInstances, plan, mountFn, hooks) {
  const oldByKey = /* @__PURE__ */ new Map();
  for (const inst of oldInstances) {
    oldByKey.set(inst.graphNode.key ?? inst.graphNode.id, inst);
  }
  const newInstances = [];
  const usedKeys = /* @__PURE__ */ new Set();
  const built = [];
  for (const entry of plan) {
    const existing = oldByKey.get(entry.key);
    if (existing !== void 0) {
      usedKeys.add(entry.key);
      const oldItem = existing.graphNode.getProp("_item");
      if (!Object.is(oldItem, entry.item)) {
        const newSig = entry.sig();
        const oldSig = existing.graphNode.getProp("_sig");
        if (!Object.is(oldSig, newSig)) {
          const freshNode = entry.build();
          built.push(freshNode);
          patchExistingInstance(ctx, existing, freshNode);
          reconcileItemChildren(ctx, existing, freshNode, mountFn);
          existing.graphNode.setProp("_sig", newSig);
        }
        existing.graphNode.setProp("_item", entry.item);
      }
      newInstances.push(existing);
    } else {
      const reclaimed = hooks?.takeLeaving(entry.key);
      if (reclaimed !== void 0) {
        const freshNode = entry.build();
        built.push(freshNode);
        patchExistingInstance(ctx, reclaimed, freshNode);
        reconcileItemChildren(ctx, reclaimed, freshNode, mountFn);
        reclaimed.graphNode.setProp("_sig", freshNode.getProp("_sig"));
        reclaimed.graphNode.setProp("_item", entry.item);
        hooks?.onEnter(reclaimed);
        newInstances.push(reclaimed);
      } else {
        const freshNode = entry.build();
        built.push(freshNode);
        const inst = mountFn(freshNode, parentDom);
        hooks?.onEnter(inst);
        newInstances.push(inst);
      }
    }
  }
  const removed = [];
  for (const inst of oldInstances) {
    const key = inst.graphNode.key ?? inst.graphNode.id;
    if (usedKeys.has(key)) continue;
    if (hooks !== void 0 && hooks.beginLeave(inst)) continue;
    const parent = ctx.dom.parentNode(inst.domNode);
    if (parent !== null) ctx.dom.removeChild(parent, inst.domNode);
    inst.dispose();
    removed.push(inst);
  }
  reorderDomMinimal(ctx, parentDom, oldInstances, newInstances);
  return { instances: newInstances, removed, built };
}
function reorderDomMinimal(ctx, parentDom, oldInstances, newInstances) {
  const n = newInstances.length;
  if (n === 0) return;
  const oldIndexOf = /* @__PURE__ */ new Map();
  for (let i = 0; i < oldInstances.length; i++) oldIndexOf.set(oldInstances[i], i);
  const source = new Array(n);
  let moved = false;
  let lastSeen = -1;
  for (let i = 0; i < n; i++) {
    const oi = oldIndexOf.get(newInstances[i]);
    if (oi === void 0) {
      source[i] = -1;
      moved = true;
    } else {
      source[i] = oi;
      if (oi < lastSeen) moved = true;
      else lastSeen = oi;
    }
  }
  if (!moved) return;
  const keep = longestIncreasingSubsequence(source);
  let refNode = null;
  for (let i = n - 1; i >= 0; i--) {
    const domNode = newInstances[i].domNode;
    if (source[i] === -1 || !keep.has(i)) {
      if (ctx.dom.nextSibling(domNode) !== refNode) {
        ctx.dom.insertBefore(parentDom, domNode, refNode);
      }
    }
    refNode = domNode;
  }
}
function longestIncreasingSubsequence(source) {
  const keep = /* @__PURE__ */ new Set();
  const n = source.length;
  const tails = [];
  const prev = new Array(n).fill(-1);
  for (let i = 0; i < n; i++) {
    const v = source[i];
    if (v < 0) continue;
    let lo = 0;
    let hi = tails.length;
    while (lo < hi) {
      const mid = lo + hi >> 1;
      if (source[tails[mid]] < v) lo = mid + 1;
      else hi = mid;
    }
    if (lo > 0) prev[i] = tails[lo - 1];
    tails[lo] = i;
  }
  let idx = tails.length > 0 ? tails[tails.length - 1] : -1;
  while (idx >= 0) {
    keep.add(idx);
    idx = prev[idx];
  }
  return keep;
}
function reconcileItemChildren(ctx, itemInstance, newItemNode, mountFn) {
  const el = itemInstance.domNode;
  if (!ctx.dom.isElement(el)) return;
  const oldChildren = [...itemInstance.children];
  const newChildNodes = [...newItemNode.children];
  const nextChildren = [];
  const kept = /* @__PURE__ */ new Set();
  for (let i = 0; i < newChildNodes.length; i++) {
    const newChild = newChildNodes[i];
    const oldChild = oldChildren[i];
    if (oldChild !== void 0 && oldChild.graphNode.type === newChild.type) {
      patchExistingInstance(ctx, oldChild, newChild);
      reconcileItemChildren(ctx, oldChild, newChild, mountFn);
      nextChildren.push(oldChild);
      kept.add(oldChild);
    } else {
      itemInstance.graphNode.appendChild(newChild);
      const inst = mountFn(newChild, el);
      nextChildren.push(inst);
    }
  }
  for (const old of oldChildren) {
    if (kept.has(old)) continue;
    const parent = ctx.dom.parentNode(old.domNode);
    if (parent !== null) ctx.dom.removeChild(parent, old.domNode);
    old.dispose();
    forgetInstanceTree(ctx, old);
    ctx.graph.detachNode(old.graphNode);
  }
  reorderDom(ctx, el, nextChildren);
  itemInstance.children.length = 0;
  for (const c of nextChildren) itemInstance.children.push(c);
  for (const c of [...itemInstance.graphNode.children]) {
    itemInstance.graphNode.removeChild(c);
  }
  for (const c of nextChildren) itemInstance.graphNode.appendChild(c.graphNode);
}
function reorderDom(ctx, parentDom, instances) {
  let referenceNode = null;
  for (let i = instances.length - 1; i >= 0; i--) {
    const inst = instances[i];
    if (inst === void 0) continue;
    const domNode = inst.domNode;
    const currentNext = ctx.dom.nextSibling(domNode);
    if (currentNext !== referenceNode) {
      ctx.dom.insertBefore(parentDom, domNode, referenceNode);
    }
    referenceNode = domNode;
  }
}
function forgetInstanceTree(ctx, instance) {
  ctx.instances.delete(instance.graphNode.id);
  for (const child of instance.children) forgetInstanceTree(ctx, child);
}
function patchExistingInstance(ctx, instance, newNode) {
  const oldNode = instance.graphNode;
  for (const [key, newVal] of Object.entries(newNode.props)) {
    const oldVal = oldNode.getProp(key);
    if (!Object.is(oldVal, newVal)) {
      patchNode(ctx, instance.graphNode, key, newVal);
    }
  }
}
function getResolvedTransition(graph, nodeId) {
  const fn = graph.getHandler(`__transition__${nodeId}`);
  return fn === void 0 ? void 0 : fn();
}
function host() {
  return globalThis;
}
function nextFrame(cb) {
  const h2 = host();
  const raf = h2.requestAnimationFrame;
  if (typeof raf === "function") {
    raf(() => raf(cb));
  } else {
    h2.setTimeout(cb, 0);
  }
}
function splitClass(value) {
  if (value === null) return [];
  const out = [];
  for (const t62 of value.split(/\s+/)) if (t62.length > 0) out.push(t62);
  return out;
}
function addClasses(dom, el, classes2) {
  if (classes2.length === 0) return;
  const current = splitClass(dom.getAttribute(el, "class"));
  let changed = false;
  for (const c of classes2) {
    if (!current.includes(c)) {
      current.push(c);
      changed = true;
    }
  }
  if (changed) dom.setAttribute(el, "class", current.join(" "));
}
function removeClasses(dom, el, classes2) {
  if (classes2.length === 0) return;
  const current = splitClass(dom.getAttribute(el, "class"));
  const next = current.filter((c) => !classes2.includes(c));
  if (next.length !== current.length) {
    if (next.length === 0) dom.removeAttribute(el, "class");
    else dom.setAttribute(el, "class", next.join(" "));
  }
}
function startRun(dom, el, active, from, to, duration, onDone) {
  const h2 = host();
  let finished = false;
  let timer = null;
  const onEvent = (e) => {
    if (e.target !== el) return;
    finish();
  };
  const detach = () => {
    dom.removeEventListener(el, "transitionend", onEvent);
    dom.removeEventListener(el, "animationend", onEvent);
    if (timer !== null) {
      h2.clearTimeout(timer);
      timer = null;
    }
  };
  const finish = () => {
    if (finished) return;
    finished = true;
    detach();
    removeClasses(dom, el, active);
    removeClasses(dom, el, to);
    removeClasses(dom, el, from);
    onDone();
  };
  addClasses(dom, el, from);
  addClasses(dom, el, active);
  dom.addEventListener(el, "transitionend", onEvent);
  dom.addEventListener(el, "animationend", onEvent);
  timer = h2.setTimeout(finish, duration);
  nextFrame(() => {
    if (finished) return;
    removeClasses(dom, el, from);
    addClasses(dom, el, to);
  });
  return {
    cancel: () => {
      if (finished) return;
      finished = true;
      detach();
      removeClasses(dom, el, active);
      removeClasses(dom, el, to);
      removeClasses(dom, el, from);
    }
  };
}
var TransitionController = class {
  constructor(dom, graph, finalize) {
    this.dom = dom;
    this.graph = graph;
    this.finalize = finalize;
  }
  leaving = /* @__PURE__ */ new Map();
  /** True only in a real DOM environment (browser). */
  get browser() {
    return this.dom.body() !== null;
  }
  keyOf(inst) {
    return inst.graphNode.key ?? inst.graphNode.id;
  }
  resolved(node) {
    return getResolvedTransition(this.graph, node.id);
  }
  /** Run the enter animation for `inst` if it carries a transition (browser only). */
  enter(inst) {
    if (!this.browser) return;
    const rt = this.resolved(inst.graphNode);
    if (rt === void 0) return;
    const el = inst.domNode;
    if (!this.dom.isElement(el)) return;
    startRun(this.dom, el, rt.enterActive, rt.enterFrom, rt.enterTo, rt.duration, () => {
    });
  }
  /**
   * Play `appear` for any initial child that opted into it (fresh browser mount
   * only — hydration must never animate appear, §22, and this is called only on
   * the mount path).
   */
  appear(children) {
    if (!this.browser) return;
    for (const child of children) {
      const rt = this.resolved(child.graphNode);
      if (rt !== void 0 && rt.appear) this.enter(child);
    }
  }
  hooks() {
    return {
      takeLeaving: (key) => {
        const entry = this.leaving.get(key);
        if (entry === void 0) return void 0;
        entry.run.cancel();
        this.leaving.delete(key);
        return entry.inst;
      },
      beginLeave: (inst) => {
        if (!this.browser) return false;
        const rt = this.resolved(inst.graphNode);
        if (rt === void 0) return false;
        const el = inst.domNode;
        if (!this.dom.isElement(el)) return false;
        const key = this.keyOf(inst);
        const prior = this.leaving.get(key);
        if (prior !== void 0) prior.run.cancel();
        const run = startRun(
          this.dom,
          el,
          rt.leaveActive,
          rt.leaveFrom,
          rt.leaveTo,
          rt.duration,
          () => {
            const current = this.leaving.get(key);
            if (current !== void 0 && current.run === run) {
              this.leaving.delete(key);
              this.finalize(inst);
            }
          }
        );
        this.leaving.set(key, { inst, run });
        return true;
      },
      onEnter: (inst) => this.enter(inst)
    };
  }
};
var HEAD_MARKER = "data-streetui-head";
var HEAD_KEY = "data-streetui-head-key";
function isSignalLike(v) {
  return v !== null && typeof v === "object" && typeof v["subscribe"] === "function" && typeof v["peek"] === "function";
}
function readValue(v) {
  if (isSignalLike(v)) return String(v.peek() ?? "");
  return String(v ?? "");
}
function resolveEntry(entry) {
  const attrs = {};
  for (const key of Object.keys(entry.attrs)) {
    attrs[key] = readValue(entry.attrs[key]);
  }
  const resolved = { tag: entry.tag, attrs };
  if (entry.tag === "title") {
    return { ...resolved, text: readValue(entry.text) };
  }
  return resolved;
}
var HeadManager = class {
  _dom;
  _head;
  _contributions = /* @__PURE__ */ new Map();
  _applied = /* @__PURE__ */ new Map();
  _order = 0;
  _adopted = false;
  constructor(dom, head) {
    this._dom = dom;
    this._head = head;
  }
  /** Register (or replace) a node's contribution and re-apply the merged result. */
  register(nodeId, entries) {
    this._contributions.set(nodeId, { order: this._order++, entries });
    this.apply();
  }
  /** Withdraw a node's contribution (unmount / route change) and re-apply. */
  unregister(nodeId) {
    if (this._contributions.delete(nodeId)) this.apply();
  }
  /** Recompute the merged head and patch `document.head` to match. */
  apply() {
    if (!this._adopted) {
      this._adoptServerTags();
      this._adopted = true;
    }
    const ordered = [...this._contributions.values()].sort((a, b) => a.order - b.order);
    const merged = /* @__PURE__ */ new Map();
    for (const contribution of ordered) {
      for (const entry of contribution.entries) {
        merged.set(entry.dedupKey, resolveEntry(entry));
      }
    }
    for (const [key, desired] of merged) {
      const existing = this._applied.get(key);
      if (existing !== void 0 && existing.tag === desired.tag) {
        this._reconcileAttrs(existing, desired);
      } else {
        if (existing !== void 0) {
          this._dom.removeChild(this._head, existing.el);
          this._applied.delete(key);
        }
        const el = this._createTag(key, desired);
        this._dom.appendChild(this._head, el);
        this._applied.set(key, { el, attrKeys: new Set(Object.keys(desired.attrs)), tag: desired.tag });
      }
    }
    for (const [key, record] of [...this._applied]) {
      if (!merged.has(key)) {
        this._dom.removeChild(this._head, record.el);
        this._applied.delete(key);
      }
    }
  }
  _createTag(key, desired) {
    const el = this._dom.createElement(desired.tag);
    this._dom.setAttribute(el, HEAD_MARKER, "");
    this._dom.setAttribute(el, HEAD_KEY, key);
    for (const attr of Object.keys(desired.attrs)) {
      this._dom.setAttribute(el, attr, desired.attrs[attr]);
    }
    if (desired.tag === "title") this._dom.setTextContent(el, desired.text ?? "");
    return el;
  }
  _reconcileAttrs(record, desired) {
    const nextKeys = new Set(Object.keys(desired.attrs));
    for (const attr of record.attrKeys) {
      if (!nextKeys.has(attr)) this._dom.removeAttribute(record.el, attr);
    }
    for (const attr of nextKeys) {
      this._dom.setAttribute(record.el, attr, desired.attrs[attr]);
    }
    if (desired.tag === "title") this._dom.setTextContent(record.el, desired.text ?? "");
    record.attrKeys = nextKeys;
  }
  /**
   * Seed `_applied` from server-emitted `[data-streetui-head-key]` tags already
   * in `document.head`. The subsequent diff reuses these elements when the
   * client desires the same key (no duplicate), rewrites them if the value
   * changed, or removes them if the client graph no longer wants them.
   */
  _adoptServerTags() {
    for (const child of this._dom.childNodes(this._head)) {
      if (!this._dom.isElement(child)) continue;
      const el = child;
      const key = this._dom.getAttribute(el, HEAD_KEY);
      if (key === null) continue;
      this._applied.set(key, {
        el,
        attrKeys: new Set(this._attrNames(el)),
        tag: this._dom.tagName(el)
      });
    }
  }
  /** The framework-managed attribute names currently on a server tag. */
  _attrNames(el) {
    const names = [];
    if (this._dom.getAttribute(el, HEAD_MARKER) !== null) names.push(HEAD_MARKER);
    if (this._dom.getAttribute(el, HEAD_KEY) !== null) names.push(HEAD_KEY);
    return names;
  }
};
function getHeadManager(ctx) {
  const head = ctx.dom.head();
  if (head === null) return null;
  const mutable = ctx;
  if (mutable.head === void 0) mutable.head = new HeadManager(ctx.dom, head);
  return mutable.head;
}
function wireHeadBehavior(ctx, graphNode, instance) {
  const manager = getHeadManager(ctx);
  if (manager === null) return;
  const descFn = ctx.graph.getHandler(`__head__${graphNode.id}`);
  if (descFn === void 0) return;
  const contribution = descFn();
  const nodeId = graphNode.id;
  manager.register(nodeId, contribution.entries);
  for (const entry of contribution.entries) {
    for (const attrKey of Object.keys(entry.attrs)) {
      const v = entry.attrs[attrKey];
      if (isSignalLike(v)) {
        instance.trackCleanup(v.subscribe(() => manager.apply()));
      }
    }
    if (isSignalLike(entry.text)) {
      instance.trackCleanup(entry.text.subscribe(() => manager.apply()));
    }
  }
  instance.trackCleanup(() => manager.unregister(nodeId));
}
function renderHead(compiled) {
  const graph = compiled.graph;
  const merged = /* @__PURE__ */ new Map();
  graph.walk((node) => {
    if (node.type !== "head") return;
    const descFn = graph.getHandler(`__head__${node.id}`);
    if (descFn === void 0) return;
    for (const entry of descFn().entries) {
      merged.set(entry.dedupKey, resolveEntry(entry));
    }
  });
  if (merged.size === 0) return "";
  const dom = new ServerDOMAdapter();
  let out = "";
  for (const [key, desired] of merged) {
    const el = dom.createElement(desired.tag);
    dom.setAttribute(el, HEAD_MARKER, "");
    dom.setAttribute(el, HEAD_KEY, key);
    for (const attr of Object.keys(desired.attrs)) {
      dom.setAttribute(el, attr, desired.attrs[attr]);
    }
    if (desired.tag === "title") dom.setTextContent(el, desired.text ?? "");
    out += dom.serializeOuter(el);
  }
  return out;
}
var SKIP_PROP_KEYS = /* @__PURE__ */ new Set([
  "text",
  "label",
  "level",
  "inputType",
  "src",
  "alt",
  "href",
  "external",
  "value",
  "placeholder",
  "disabled",
  "_renderKey",
  "key",
  "name"
]);
function mountGraph(ctx) {
  return mountNode(ctx, ctx.graph.root, ctx.container);
}
function mountNode(ctx, graphNode, parentDom) {
  const { dom, graph } = ctx;
  const staticHTML = ctx.staticHTML;
  if (staticHTML !== void 0 && dom.createRawHTML !== void 0) {
    const precomputed = staticHTML.get(graphNode.id);
    if (precomputed !== void 0) {
      const raw = dom.createRawHTML(precomputed);
      dom.appendChild(parentDom, raw);
      const instance2 = new NodeInstance(graphNode, raw);
      ctx.instances.set(graphNode.id, instance2);
      return instance2;
    }
  }
  if (graphNode.type === "application") {
    const instance2 = new NodeInstance(graphNode, parentDom);
    ctx.instances.set(graphNode.id, instance2);
    for (const child of graphNode.children) {
      const childInstance = mountNode(ctx, child, parentDom);
      instance2.addChild(childInstance);
    }
    return instance2;
  }
  if (graphNode.type === "text") {
    const text2 = String(graphNode.getProp("text") ?? "");
    const el2 = dom.createElement("span");
    const textNode = dom.createTextNode(text2);
    dom.appendChild(el2, textNode);
    applyNodeProps(ctx, graphNode, el2);
    const instance2 = new NodeInstance(graphNode, el2);
    ctx.instances.set(graphNode.id, instance2);
    wireEvents(dom, graph, graphNode, el2, instance2);
    if (graphNode.stateRefs.length !== 0) {
      wireSignalBindings(ctx, graphNode, instance2, textUpdate(dom, el2, textNode));
    }
    dom.appendChild(parentDom, el2);
    return instance2;
  }
  if (graphNode.type === "heading") {
    const level = graphNode.getProp("level") ?? 1;
    const tag2 = `h${level}`;
    const el2 = dom.createElement(tag2);
    const text2 = String(graphNode.getProp("text") ?? "");
    dom.setTextContent(el2, text2);
    applyNodeProps(ctx, graphNode, el2);
    const instance2 = new NodeInstance(graphNode, el2);
    ctx.instances.set(graphNode.id, instance2);
    wireEvents(dom, graph, graphNode, el2, instance2);
    if (graphNode.stateRefs.length !== 0) {
      wireSignalBindings(ctx, graphNode, instance2, headingUpdate(dom, el2));
    }
    dom.appendChild(parentDom, el2);
    return instance2;
  }
  if (graphNode.type === "input") {
    const el2 = dom.createElement("input");
    const inputType = String(graphNode.getProp("inputType") ?? "text");
    dom.setAttribute(el2, "type", inputType);
    const placeholder = graphNode.getProp("placeholder");
    if (placeholder !== void 0) dom.setAttribute(el2, "placeholder", String(placeholder));
    const value = graphNode.getProp("value");
    if (value !== void 0) dom.setProperty(el2, "value", String(value));
    applyNodeProps(ctx, graphNode, el2);
    const instance2 = new NodeInstance(graphNode, el2);
    ctx.instances.set(graphNode.id, instance2);
    wireEvents(dom, graph, graphNode, el2, instance2);
    if (graphNode.stateRefs.length !== 0) {
      wireSignalBindings(ctx, graphNode, instance2, inputUpdate(dom, el2));
    }
    dom.appendChild(parentDom, el2);
    return instance2;
  }
  if (graphNode.type === "image") {
    const el2 = dom.createElement("img");
    const src = graphNode.getProp("src");
    const alt = graphNode.getProp("alt");
    if (src !== void 0) dom.setAttribute(el2, "src", String(src));
    if (alt !== void 0) dom.setAttribute(el2, "alt", String(alt));
    const width = graphNode.getProp("width");
    const height = graphNode.getProp("height");
    if (width !== void 0) dom.setAttribute(el2, "width", String(width));
    if (height !== void 0) dom.setAttribute(el2, "height", String(height));
    applyNodeProps(ctx, graphNode, el2);
    const instance2 = new NodeInstance(graphNode, el2);
    ctx.instances.set(graphNode.id, instance2);
    dom.appendChild(parentDom, el2);
    return instance2;
  }
  if (graphNode.type === "code") {
    const source = String(graphNode.getProp("text") ?? "");
    const pre2 = dom.createElement("pre");
    const codeEl = dom.createElement("code");
    const textNode = dom.createTextNode(source);
    dom.appendChild(codeEl, textNode);
    dom.appendChild(pre2, codeEl);
    applyNodeProps(ctx, graphNode, pre2);
    const instance2 = new NodeInstance(graphNode, pre2);
    ctx.instances.set(graphNode.id, instance2);
    wireEvents(dom, graph, graphNode, pre2, instance2);
    if (graphNode.stateRefs.length !== 0) {
      wireSignalBindings(ctx, graphNode, instance2, textUpdate(dom, pre2, textNode));
    }
    dom.appendChild(parentDom, pre2);
    return instance2;
  }
  if (graphNode.type === "link") {
    const el2 = dom.createElement("a");
    const href = graphNode.getProp("href");
    const label2 = graphNode.getProp("label");
    const external = graphNode.getProp("external");
    if (href !== void 0) dom.setAttribute(el2, "href", String(href));
    if (label2 !== void 0) dom.setTextContent(el2, String(label2));
    if (external === true) {
      dom.setAttribute(el2, "target", "_blank");
      dom.setAttribute(el2, "rel", "noopener noreferrer");
    }
    applyNodeProps(ctx, graphNode, el2);
    const instance2 = new NodeInstance(graphNode, el2);
    ctx.instances.set(graphNode.id, instance2);
    wireEvents(dom, graph, graphNode, el2, instance2);
    if (graphNode.stateRefs.length !== 0) {
      wireSignalBindings(ctx, graphNode, instance2, linkUpdate(dom, el2));
    }
    dom.appendChild(parentDom, el2);
    return instance2;
  }
  if (graphNode.type === "button") {
    const el2 = dom.createElement("button");
    const label2 = graphNode.getProp("label");
    if (label2 !== void 0) dom.setTextContent(el2, String(label2));
    const disabled = graphNode.getProp("disabled");
    if (disabled === true) dom.setAttribute(el2, "disabled", "");
    applyNodeProps(ctx, graphNode, el2);
    const instance2 = new NodeInstance(graphNode, el2);
    ctx.instances.set(graphNode.id, instance2);
    wireEvents(dom, graph, graphNode, el2, instance2);
    if (graphNode.stateRefs.length !== 0) {
      wireSignalBindings(ctx, graphNode, instance2, buttonUpdate(dom, el2));
    }
    dom.appendChild(parentDom, el2);
    return instance2;
  }
  if (graphNode.type === "reactive-list" || graphNode.type === "conditional") {
    const tag2 = resolveTag(graphNode.type);
    const el2 = dom.createElement(tag2);
    applyNodeProps(ctx, graphNode, el2);
    const instance2 = new NodeInstance(graphNode, el2);
    ctx.instances.set(graphNode.id, instance2);
    for (const child of graphNode.children) {
      const childInstance = mountNode(ctx, child, el2);
      instance2.addChild(childInstance);
    }
    dom.appendChild(parentDom, el2);
    wireReactiveList(ctx, graphNode, instance2, el2, true);
    return instance2;
  }
  if (graphNode.type === "portal") {
    const anchor = dom.createElement(resolveTag("portal"));
    dom.setAttribute(anchor, "data-streetui-portal", "");
    applyNodeProps(ctx, graphNode, anchor);
    const instance2 = new NodeInstance(graphNode, anchor);
    ctx.instances.set(graphNode.id, instance2);
    const body2 = dom.body();
    let target = anchor;
    if (body2 !== null) {
      const portalContainer = dom.createElement("div");
      dom.setAttribute(portalContainer, "data-streetui-portal-container", "");
      dom.appendChild(body2, portalContainer);
      instance2.trackCleanup(() => dom.removeChild(body2, portalContainer));
      target = portalContainer;
    }
    for (const child of graphNode.children) {
      instance2.addChild(mountNode(ctx, child, target));
    }
    dom.appendChild(parentDom, anchor);
    wireOverlayBehavior(ctx, graphNode, instance2, target);
    return instance2;
  }
  if (graphNode.type === "head") {
    const anchor = dom.createElement(resolveTag("head"));
    dom.setAttribute(anchor, "data-streetui-head-anchor", "");
    applyNodeProps(ctx, graphNode, anchor);
    const instance2 = new NodeInstance(graphNode, anchor);
    ctx.instances.set(graphNode.id, instance2);
    dom.appendChild(parentDom, anchor);
    wireHeadBehavior(ctx, graphNode, instance2);
    return instance2;
  }
  const tag = resolveTag(graphNode.type);
  const el = dom.createElement(tag);
  applyNodeProps(ctx, graphNode, el);
  if (graphNode.type === "list-item") {
    const itemKey = graphNode.getProp("key");
    if (itemKey !== void 0) {
      dom.setAttribute(el, "data-streetui-key", String(itemKey));
    }
  }
  const instance = new NodeInstance(graphNode, el);
  ctx.instances.set(graphNode.id, instance);
  if (graphNode.type === "form") {
    wireEvents(dom, graph, graphNode, el, instance);
  }
  for (const child of graphNode.children) {
    const childInstance = mountNode(ctx, child, el);
    instance.addChild(childInstance);
  }
  dom.appendChild(parentDom, el);
  if (graphNode.type === "component") wireComponentBehavior(ctx, graphNode, instance);
  return instance;
}
function textUpdate(dom, el, textNode) {
  return (propKey, value) => {
    if (propKey === "text") {
      dom.setTextContent(textNode, String(value ?? ""));
    } else {
      applyProp(dom, el, propKey, value);
    }
  };
}
function headingUpdate(dom, el) {
  return (propKey, value) => {
    if (propKey === "text") {
      dom.setTextContent(el, String(value ?? ""));
    } else {
      applyProp(dom, el, propKey, value);
    }
  };
}
function inputUpdate(dom, el) {
  return (propKey, value) => {
    if (propKey === "value") {
      dom.setProperty(el, "value", String(value ?? ""));
    } else {
      applyProp(dom, el, propKey, value);
    }
  };
}
function buttonUpdate(dom, el) {
  return (propKey, value) => {
    if (propKey === "label") {
      dom.setTextContent(el, String(value ?? ""));
    } else if (propKey === "disabled") {
      if (value === true) {
        dom.setAttribute(el, "disabled", "");
      } else {
        dom.removeAttribute(el, "disabled");
      }
    } else {
      applyProp(dom, el, propKey, value);
    }
  };
}
function linkUpdate(dom, el) {
  return (propKey, value) => {
    if (propKey === "label") {
      dom.setTextContent(el, String(value ?? ""));
    } else if (propKey === "href") {
      dom.setAttribute(el, "href", String(value ?? ""));
    } else {
      applyProp(dom, el, propKey, value);
    }
  };
}
function applyNodeProps(ctx, graphNode, el) {
  const props = graphNode.props;
  for (const key in props) {
    if (!Object.hasOwn(props, key)) continue;
    if (SKIP_PROP_KEYS.has(key)) continue;
    applyProp(ctx.dom, el, key, props[key]);
  }
}
function wireSignalBindings(ctx, graphNode, instance, onUpdate) {
  if (graphNode.stateRefs.length === 0) return;
  for (const stateRef of graphNode.stateRefs) {
    const signalKey = `__signal__${stateRef.signalId}`;
    const maybeSig = ctx.graph.getHandler(signalKey);
    if (maybeSig === void 0 || typeof maybeSig.subscribe !== "function") continue;
    const unsub = maybeSig.subscribe((value) => {
      onUpdate(stateRef.propKey, value);
    });
    instance.trackCleanup(unsub);
  }
}
function wireReactiveList(ctx, graphNode, instance, el, runAppear = false) {
  const plan = ctx.graph.getHandler(`__listplan__${graphNode.id}`);
  const build = ctx.graph.getHandler(`__listbuild__${graphNode.id}`);
  if (plan === void 0 && build === void 0) return;
  const controller = new TransitionController(ctx.dom, ctx.graph, (leaving) => {
    const parent = ctx.dom.parentNode(leaving.domNode);
    if (parent !== null) ctx.dom.removeChild(parent, leaving.domNode);
    leaving.dispose();
    forgetInstance(ctx, leaving);
    ctx.graph.detachNode(leaving.graphNode);
  });
  const hooks = controller.hooks();
  if (runAppear) controller.appear(instance.children);
  for (const stateRef of graphNode.stateRefs) {
    if (stateRef.propKey !== "items") continue;
    const sig = ctx.graph.getHandler(`__signal__${stateRef.signalId}`);
    if (sig === void 0 || typeof sig.subscribe !== "function") continue;
    const unsub = sig.subscribe((value) => {
      if (plan !== void 0) {
        reconcileReactiveListByPlan(ctx, graphNode, instance, el, plan(value), hooks);
      } else {
        reconcileReactiveList(ctx, graphNode, instance, el, build(value), hooks);
      }
    });
    instance.trackCleanup(unsub);
  }
}
function reconcileReactiveListByPlan(ctx, listNode, listInstance, listEl, plan, hooks) {
  const oldInstances = [...listInstance.children];
  const result = reconcileChildrenByPlan(
    ctx,
    listEl,
    oldInstances,
    plan,
    (node, parent) => mountNode(ctx, node, parent),
    hooks
  );
  listInstance.children.length = 0;
  for (const inst of result.instances) listInstance.children.push(inst);
  for (const removed of result.removed) {
    forgetInstance(ctx, removed);
    ctx.graph.detachNode(removed.graphNode);
  }
  const adopted = new Set(result.instances.map((i) => i.graphNode));
  for (const node of result.built ?? []) {
    if (!adopted.has(node)) ctx.graph.detachNode(node);
  }
  for (const child of [...listNode.children]) listNode.removeChild(child);
  for (const inst of result.instances) listNode.appendChild(inst.graphNode);
}
function reconcileReactiveList(ctx, listNode, listInstance, listEl, newNodes, hooks) {
  const oldInstances = [...listInstance.children];
  const result = reconcileChildren(
    ctx,
    listEl,
    oldInstances,
    newNodes,
    (node, parent) => mountNode(ctx, node, parent),
    hooks
  );
  listInstance.children.length = 0;
  for (const inst of result.instances) listInstance.children.push(inst);
  for (const removed of result.removed) {
    forgetInstance(ctx, removed);
    ctx.graph.detachNode(removed.graphNode);
  }
  const adopted = new Set(result.instances.map((i) => i.graphNode));
  for (const built of newNodes) {
    if (!adopted.has(built)) ctx.graph.detachNode(built);
  }
  for (const child of [...listNode.children]) listNode.removeChild(child);
  for (const inst of result.instances) listNode.appendChild(inst.graphNode);
}
function forgetInstance(ctx, instance) {
  ctx.instances.delete(instance.graphNode.id);
  for (const child of instance.children) forgetInstance(ctx, child);
}
function wireOverlayBehavior(ctx, graphNode, instance, target) {
  const { dom, graph } = ctx;
  if (dom.body() === null) return;
  const descFn = graph.getHandler(`__overlay__${graphNode.id}`);
  if (descFn === void 0) return;
  const desc = descFn();
  const openSig = desc.open;
  if (openSig === void 0 || typeof openSig.subscribe !== "function") return;
  let active = [];
  let saved = null;
  const teardown = () => {
    for (const fn of active) fn();
    active = [];
  };
  const onOpenChange = (isOpen) => {
    if (isOpen) {
      if (desc.restoreFocus) saved = saveFocus(dom);
      if (desc.modal) {
        active.push(trapFocus(dom, target));
        active.push(containFocus(dom, target));
      }
      if (desc.menu) {
        active.push(rovingMenu(dom, target));
      }
      if (desc.takesFocus) focusInitial(dom, target, desc.initialFocusId);
      if (desc.closeOnEscape && desc.onClose !== void 0) {
        active.push(onEscape(dom, target, desc.onClose));
      }
    } else {
      teardown();
      if (desc.restoreFocus && saved !== null) {
        restoreFocus(dom, saved);
        saved = null;
      }
    }
  };
  const unsub = openSig.subscribe(onOpenChange);
  instance.trackCleanup(unsub);
  instance.trackCleanup(teardown);
  if (openSig.peek() === true) onOpenChange(true);
}
function wireComponentBehavior(ctx, graphNode, instance) {
  const fn = ctx.graph.getHandler(`__component__${graphNode.id}`);
  if (fn === void 0) return;
  for (const cleanup of fn()) instance.trackCleanup(cleanup);
}
var CSS_MARKER = "data-streetui-css";
var CSS_KEYS = "data-streetui-css-keys";
function renderStyles(options = {}) {
  const registry = options.registry ?? styleRegistry;
  const css = registry.serializeCSS();
  if (css.length === 0) return "";
  const keys = registry.identities().join(" ");
  return `<style ${CSS_MARKER} ${CSS_KEYS}="${keys}">${css}</style>`;
}
var STATE_MARKER_ATTR = "data-streetui-state";
function escapeForScript(json) {
  let out = "";
  for (const ch of json) {
    const code22 = ch.charCodeAt(0);
    if (ch === "<") out += "\\u003c";
    else if (ch === ">") out += "\\u003e";
    else if (ch === "&") out += "\\u0026";
    else if (code22 === 8232) out += "\\u2028";
    else if (code22 === 8233) out += "\\u2029";
    else out += ch;
  }
  return out;
}
function serializeState(state) {
  if (Object.keys(state).length === 0) return "";
  const json = escapeForScript(JSON.stringify(state));
  return `<script type="application/json" ${STATE_MARKER_ATTR}>${json}</script>`;
}
var TEXT_PROP_KEYS = /* @__PURE__ */ new Set(["text", "label", "value"]);
function analyzeGraph(graph) {
  const nodes = /* @__PURE__ */ new Map();
  const summary = {
    totalNodes: 0,
    staticNodes: 0,
    staticSubtrees: 0,
    dynamicTextNodes: 0,
    dynamicAttrNodes: 0,
    eventNodes: 0,
    lists: 0,
    conditionals: 0
  };
  const visit = (node) => {
    let allChildrenStatic = true;
    for (const child of node.children) {
      const childSubtreeStatic = visit(child);
      if (!childSubtreeStatic) allChildrenStatic = false;
    }
    let hasDynamicText = false;
    let hasDynamicAttr = false;
    for (const ref of node.stateRefs) {
      if (TEXT_PROP_KEYS.has(ref.propKey)) hasDynamicText = true;
      else hasDynamicAttr = true;
    }
    const hasEvents = node.events.length > 0;
    const isList = node.type === "reactive-list";
    const isConditional = node.type === "conditional";
    const isPortal = node.type === "portal";
    const isComponent = node.type === "component";
    const isHead = node.type === "head";
    const isStatic = node.stateRefs.length === 0 && !hasEvents && !isList && !isConditional && !isPortal && !isComponent && !isHead;
    const isStaticSubtree = isStatic && allChildrenStatic;
    nodes.set(node.id, {
      isStatic,
      isStaticSubtree,
      hasDynamicText,
      hasDynamicAttr,
      hasEvents,
      isList,
      isConditional
    });
    summary.totalNodes += 1;
    if (isStatic) summary.staticNodes += 1;
    if (isStaticSubtree) summary.staticSubtrees += 1;
    if (hasDynamicText) summary.dynamicTextNodes += 1;
    if (hasDynamicAttr) summary.dynamicAttrNodes += 1;
    if (hasEvents) summary.eventNodes += 1;
    if (isList) summary.lists += 1;
    if (isConditional) summary.conditionals += 1;
    return isStaticSubtree;
  };
  visit(graph.root);
  return { nodes, summary };
}
function collectMaximalStaticRoots(graph) {
  const analysis = analyzeGraph(graph);
  const roots = [];
  const walk = (node) => {
    if (node.type !== "application") {
      const a = analysis.nodes.get(node.id);
      if (a !== void 0 && a.isStaticSubtree) {
        roots.push(node);
        return;
      }
    }
    for (const child of node.children) walk(child);
  };
  walk(graph.root);
  return roots;
}
function serializeStaticSubtree(dom, graph, root) {
  const container2 = dom.createElement("div");
  const ctx = createRenderContext(dom, graph, container2);
  const instance = mountNode(ctx, root, container2);
  const html = dom.serializeInner(container2);
  instance.dispose();
  ctx.instances.clear();
  return html;
}
function buildStaticSSRPlan(compiled) {
  const graph = compiled.graph;
  const roots = collectMaximalStaticRoots(graph);
  const plan = /* @__PURE__ */ new Map();
  if (roots.length === 0) return plan;
  const dom = new ServerDOMAdapter();
  for (const root of roots) {
    plan.set(root.id, serializeStaticSubtree(dom, graph, root));
  }
  return plan;
}
var PLAN_CACHE = /* @__PURE__ */ new WeakMap();
function getStaticSSRPlan(compiled) {
  let plan = PLAN_CACHE.get(compiled);
  if (plan === void 0) {
    plan = buildStaticSSRPlan(compiled);
    PLAN_CACHE.set(compiled, plan);
  }
  return plan;
}
function renderToString(compiled, options = {}) {
  const dom = options.domAdapter ?? new ServerDOMAdapter();
  const plan = options.staticPlan === null ? void 0 : options.staticPlan ?? getStaticSSRPlan(compiled);
  const staticHTML = plan !== void 0 && plan.size > 0 ? plan : void 0;
  const container2 = dom.createElement("div");
  const ctx = createRenderContext(dom, compiled.graph, container2, void 0, staticHTML);
  const rootInstance = mountGraph(ctx);
  const html = dom.serializeInner(container2);
  rootInstance.dispose();
  ctx.instances.clear();
  return html;
}
function segments(path) {
  return path.split("/").filter((s) => s.length > 0);
}
function normalizePath(path) {
  let p3 = path.trim();
  if (p3 === "") return "/";
  if (!p3.startsWith("/")) p3 = `/${p3}`;
  if (p3.length > 1 && p3.endsWith("/")) p3 = p3.slice(0, -1);
  return p3;
}
function matchPattern(pattern2, pathname) {
  if (pattern2 === "*") {
    return { "*": normalizePath(pathname).slice(1) };
  }
  const patSegs = segments(pattern2);
  const pathSegs = segments(normalizePath(pathname));
  const params = {};
  for (let i = 0; i < patSegs.length; i++) {
    const patSeg = patSegs[i];
    if (patSeg === "*") {
      params["*"] = pathSegs.slice(i).map((s) => decodeURIComponent(s)).join("/");
      return params;
    }
    const pathSeg = pathSegs[i];
    if (pathSeg === void 0) return null;
    if (patSeg.startsWith(":")) {
      const name = patSeg.slice(1);
      if (name === "") return null;
      params[name] = decodeURIComponent(pathSeg);
      continue;
    }
    if (patSeg !== pathSeg) return null;
  }
  if (pathSegs.length !== patSegs.length) return null;
  return params;
}
function matchRoutes(routes, pathname) {
  for (const route of routes) {
    const params = matchPattern(route.path, pathname);
    if (params !== null) return { route, params };
  }
  return null;
}
function splitTarget(to) {
  const hashIndex = to.indexOf("#");
  const withoutHash = hashIndex >= 0 ? to.slice(0, hashIndex) : to;
  const qIndex = withoutHash.indexOf("?");
  if (qIndex < 0) return { pathname: normalizePath(withoutHash), search: "" };
  return {
    pathname: normalizePath(withoutHash.slice(0, qIndex)),
    search: withoutHash.slice(qIndex + 1)
  };
}
function buildLocation(pathname, search) {
  return { pathname, search };
}
function toUrl(pathname, search) {
  return search.length > 0 ? `${pathname}?${search}` : pathname;
}
function createBrowserHistory() {
  const listeners = /* @__PURE__ */ new Set();
  const notify = () => {
    for (const cb of listeners) cb();
  };
  const onPopState = () => notify();
  window.addEventListener("popstate", onPopState);
  const current = () => {
    const loc = window.location;
    return buildLocation(loc.pathname, loc.search.replace(/^\?/, ""));
  };
  return {
    location: current,
    push(pathname, search) {
      window.history.pushState({}, "", toUrl(pathname, search));
      notify();
    },
    replace(pathname, search) {
      window.history.replaceState({}, "", toUrl(pathname, search));
      notify();
    },
    back() {
      window.history.back();
    },
    forward() {
      window.history.forward();
    },
    listen(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    dispose() {
      window.removeEventListener("popstate", onPopState);
      listeners.clear();
    }
  };
}
function createMemoryHistory(initial = "/") {
  const listeners = /* @__PURE__ */ new Set();
  const notify = () => {
    for (const cb of listeners) cb();
  };
  const parse = (entry) => {
    const qIndex = entry.indexOf("?");
    if (qIndex < 0) return buildLocation(entry, "");
    return buildLocation(entry.slice(0, qIndex), entry.slice(qIndex + 1));
  };
  const stack2 = [initial];
  let index = 0;
  return {
    location() {
      return parse(stack2[index]);
    },
    push(pathname, search) {
      stack2.splice(index + 1);
      stack2.push(toUrl(pathname, search));
      index = stack2.length - 1;
      notify();
    },
    replace(pathname, search) {
      stack2[index] = toUrl(pathname, search);
      notify();
    },
    back() {
      if (index > 0) {
        index--;
        notify();
      }
    },
    forward() {
      if (index < stack2.length - 1) {
        index++;
        notify();
      }
    },
    listen(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    dispose() {
      listeners.clear();
    }
  };
}
var DEFAULT_NOT_FOUND = {
  path: "*",
  builder: (page) => {
    page.section("not-found", (s) => {
      s.heading("404 \u2014 Page not found", { level: 1, id: "not-found-title" });
      s.text("The page you were looking for does not exist.", { id: "not-found-text" });
      s.link("Go home", { href: "/", id: "not-found-home" });
    }, { id: "not-found" });
  }
};
function createRouter(options) {
  const routes = options.routes;
  const history = options.history ?? createBrowserHistory();
  const fallback = options.notFound ?? DEFAULT_NOT_FOUND;
  const resolve = () => {
    const loc = history.location();
    const pathname = normalizePath(loc.pathname);
    const query = new URLSearchParams(loc.search);
    const matched = matchRoutes(routes, pathname);
    if (matched !== null) {
      return {
        path: pathname,
        pattern: matched.route.path,
        params: matched.params,
        query,
        route: matched.route,
        // A catch-all `*` match is the 404 route whether user-supplied or built-in.
        isFallback: matched.route.path === "*"
      };
    }
    const fallbackParams = matchRoutes([fallback], pathname)?.params ?? {};
    return {
      path: pathname,
      pattern: fallback.path,
      params: fallbackParams,
      query,
      route: fallback,
      isFallback: true
    };
  };
  const current = signal(resolve());
  const stopListening = history.listen(() => {
    current.set(resolve());
  });
  const navigate = (to, opts = {}) => {
    const { pathname, search } = splitTarget(to);
    if (opts.replace === true) history.replace(pathname, search);
    else history.push(pathname, search);
  };
  const isActive = (path, opts = {}) => {
    const target = normalizePath(path);
    const exact = opts.exact === true;
    return derived(() => {
      const activePath = current.get().path;
      if (activePath === target) return true;
      if (exact || target === "/") return false;
      return activePath.startsWith(`${target}/`);
    });
  };
  return {
    currentRoute: current,
    navigate,
    back: () => history.back(),
    forward: () => history.forward(),
    isActive,
    destroy: () => {
      stopListening();
      history.dispose();
    }
  };
}
var ROUTER_OUTLET_ID = "streetui-router-outlet";
var ROUTER_OUTLET_KEY = "router-outlet";
function routerOutlet(scope, id = ROUTER_OUTLET_ID) {
  scope.container(ROUTER_OUTLET_KEY, () => {
  }, { id });
}
var DEVTOOLS_CSS = [
  ".st-devtools{font:13px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;margin:0;color:#e6e6e6;background:#1e1e28}",
  ".st-header{padding:12px 16px;border-bottom:1px solid #333;background:#15151c}",
  ".st-header h1{font-size:14px;margin:0}",
  "main{padding:8px 16px}",
  ".st-panel{margin:12px 0;border:1px solid #2c2c38;border-radius:6px;overflow:hidden}",
  ".st-panel h2{font-size:12px;text-transform:uppercase;letter-spacing:.04em;margin:0;padding:6px 10px;background:#23232e}",
  ".st-panel ul{list-style:none;margin:0;padding:6px 10px}",
  ".st-panel li{padding:1px 0}",
  ".st-panel p{margin:6px 10px}",
  ".st-count{background:#3a3a4a;border-radius:10px;padding:0 7px;font-size:11px;float:right}",
  ".st-dim{color:#8a8a9a}.st-key{color:#7db4ff}.st-err{color:#ff8a8a}.st-empty{color:#6a6a7a}",
  ".st-tree{margin:6px 10px;white-space:pre;overflow:auto;color:#c8c8d4}",
  ".st-depth{display:inline-block}.st-depth{width:calc(var(--d,0)*12px)}",
  "code{color:#d7d7e0}"
].join("");
var EMBED_ESCAPE = new RegExp("[<\\u2028\\u2029]", "g");
var CONTROLLER_JS = [
  "(function(){",
  '"use strict";',
  "var INITIAL_TAB=__INITIAL_TAB__;",
  "function esc(v){",
  " if(v===null||v===undefined)return String(v);",
  " var s=typeof v==='string'?v:(typeof v==='object'?sj(v):String(v));",
  ` return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');`,
  "}",
  'function sj(v){try{return JSON.stringify(v);}catch(e){return "[object]";}}',
  'function read(){var el=document.getElementById("st-data");if(!el)return {};try{return JSON.parse(el.textContent||"{}");}catch(e){return {};}}',
  "var state={data:read(),tab:INITIAL_TAB,selected:null};",
  "function findNode(n,id){if(!n)return null;if(n.id===id)return n;var c=n.children||[];for(var i=0;i<c.length;i++){var f=findNode(c[i],id);if(f)return f;}return null;}",
  'function empty(m){return "<p class=\\"st-empty\\">"+esc(m||"(none)")+"</p>";}',
  'function kv(k,v){return "<div class=\\"st-kv\\"><span class=\\"st-k\\">"+esc(k)+"</span><span class=\\"st-v\\">"+esc(v)+"</span></div>";}',
  "function rComponents(){",
  " var cs=state.data.components||[];",
  ' if(!cs.length)return empty("No component() instances");',
  ' var h="<ul class=\\"st-list\\">";',
  " for(var i=0;i<cs.length;i++){var c=cs[i];",
  '  h+="<li class=\\"st-row st-click\\" data-node=\\""+esc(c.id||"")+"\\">"',
  '   +"<span class=\\"st-ind\\" style=\\"--d:"+(c.depth||0)+"\\"></span>"',
  '   +"<code>"+esc(c.name)+"</code>"',
  '   +(c.key!=null?" <span class=\\"st-key\\">#"+esc(c.key)+"</span>":"")',
  '   +" <span class=\\"st-dim\\">"+(c.childCount||0)+" child</span></li>";}',
  ' return h+"</ul><p class=\\"st-dim\\">Click a component to inspect it.</p>";',
  "}",
  "function rInspector(){",
  ' if(!state.selected)return empty("Select a node in Component Tree, Events or Overlays");',
  " var n=findNode(state.data.graph,state.selected);",
  ' if(!n)return empty("Node "+state.selected+" not found in current snapshot");',
  ' var h="<h3><code>&lt;"+esc(n.type)+"&gt;</code>"+(n.key!=null?" <span class=\\"st-key\\">#"+esc(n.key)+"</span>":"")+"</h3>";',
  ' h+=kv("id",n.id)+kv("depth",n.depth)+kv("children",(n.children||[]).length);',
  " var pk=Object.keys(n.props||{});",
  ' h+="<h4>Props</h4>"+(pk.length?pk.map(function(k){return kv(k,n.props[k]);}).join(""):empty("none"));',
  ' h+="<h4>Event types</h4>"+((n.eventTypes||[]).length?"<code>"+esc((n.eventTypes||[]).join(", "))+"</code>":empty("none"));',
  ' h+="<h4>State bindings</h4>"+((n.stateBindings||[]).length?"<ul class=\\"st-list\\">"+n.stateBindings.map(function(b){return "<li><code>"+esc(b)+"</code></li>";}).join("")+"</ul>":empty("none"));',
  " return h;",
  "}",
  "function rState(){",
  " var s=state.data.signals||{};var live=s.live||{};var ids=s.boundSignalIds||[];",
  ' var h="<p class=\\"st-dim\\">"+ids.length+" signal id(s) bound in graph. Effects are shown as observer counts (no global effect registry).</p>";',
  " var labels=Object.keys(live);",
  ' if(!labels.length)return h+empty("No live signals registered with DevTools");',
  ' h+="<ul class=\\"st-list\\">";',
  " for(var i=0;i<labels.length;i++){var l=labels[i];var sg=live[l];",
  '  h+="<li><code>"+esc(l)+"</code> <span class=\\"st-key\\">["+esc(sg.kind)+"]</span> = <code>"+esc(sg.value)+"</code> <span class=\\"st-dim\\">observers "+esc(sg.observerCount==null?"?":sg.observerCount)+"</span></li>";}',
  ' return h+"</ul>";',
  "}",
  "function rSignalGraph(){",
  " var g=state.data.signalGraph||{signals:[],edges:[]};",
  ' if(!(g.signals||[]).length)return empty("No signal bindings in graph");',
  ' var h="<p class=\\"st-dim\\">"+g.signals.length+" signal(s), "+(g.edges||[]).length+" binding edge(s)</p><ul class=\\"st-list\\">";',
  " for(var i=0;i<g.signals.length;i++){var sn=g.signals[i];",
  '  h+="<li><code>"+esc(sn.signalId)+"</code> <span class=\\"st-dim\\">&rarr; "+(sn.boundNodeIds||[]).length+" node(s), "+sn.bindingCount+" edge(s)</span>"',
  '   +(sn.kind?" <span class=\\"st-key\\">["+esc(sn.kind)+"]</span>":"")',
  '   +(sn.observerCount!=null?" <span class=\\"st-dim\\">obs "+esc(sn.observerCount)+"</span>":"")+"</li>";}',
  ' return h+"</ul>";',
  "}",
  "function rRouter(){",
  ' var r=state.data.router;if(!r)return empty("No router registered");',
  ' return kv("path",r.path)+kv("pattern",r.pattern)+kv("fallback",r.isFallback?"yes":"no")',
  '  +"<h4>Params</h4>"+(Object.keys(r.params||{}).length?Object.keys(r.params).map(function(k){return kv(k,r.params[k]);}).join(""):empty("none"))',
  '  +"<h4>Query</h4>"+(Object.keys(r.query||{}).length?Object.keys(r.query).map(function(k){return kv(k,r.query[k]);}).join(""):empty("none"));',
  "}",
  "function rResources(){",
  ' var rs=state.data.resources;if(!rs||!Object.keys(rs).length)return empty("No resources registered");',
  ' var ks=Object.keys(rs);var h="<ul class=\\"st-list\\">";',
  " for(var i=0;i<ks.length;i++){var r=rs[ks[i]];",
  '  h+="<li><code>"+esc(ks[i])+"</code>: <span class=\\"st-key\\">"+esc(r.status)+"</span>"',
  '   +(r.loading?" <span class=\\"st-dim\\">(loading)</span>":"")',
  '   +(r.isRefetching?" <span class=\\"st-dim\\">(refetching)</span>":"")',
  '   +(r.hasError?" <span class=\\"st-err\\">!"+esc(r.errorName)+"</span>":"")+"</li>";}',
  ' return h+"</ul>";',
  "}",
  "function rMutations(){",
  ' var ms=state.data.mutations;if(!ms||!Object.keys(ms).length)return empty("No mutations registered");',
  ' var ks=Object.keys(ms);var h="<ul class=\\"st-list\\">";',
  " for(var i=0;i<ks.length;i++){var m=ms[ks[i]];",
  '  h+="<li><code>"+esc(ks[i])+"</code>: <span class=\\"st-key\\">"+esc(m.status)+"</span>"',
  '   +(m.pending?" <span class=\\"st-dim\\">(pending)</span>":"")',
  '   +(m.hasError?" <span class=\\"st-err\\">!"+esc(m.errorName)+"</span>":"")+"</li>";}',
  ' return h+"</ul>";',
  "}",
  "function rEvents(){",
  " var e=state.data.events||{nodes:[],totalHandlers:0,byType:{}};",
  " var bt=e.byType||{};var bk=Object.keys(bt);",
  ' var h="<p class=\\"st-dim\\">"+(e.nodes||[]).length+" node(s), "+e.totalHandlers+" handler(s)</p>";',
  ' h+=bk.length?"<p>"+bk.map(function(t){return "<span class=\\"st-badge\\">"+esc(t)+" &times;"+bt[t]+"</span>";}).join(" ")+"</p>":"";',
  ' if(!(e.nodes||[]).length)return h+empty("No event handlers wired");',
  ' h+="<ul class=\\"st-list\\">";',
  " for(var i=0;i<e.nodes.length;i++){var n=e.nodes[i];",
  '  h+="<li class=\\"st-row st-click\\" data-node=\\""+esc(n.id)+"\\"><code>&lt;"+esc(n.nodeType)+"&gt;</code>"',
  '   +(n.key!=null?" <span class=\\"st-key\\">#"+esc(n.key)+"</span>":"")',
  '   +" <span class=\\"st-dim\\">"+esc((n.eventTypes||[]).join(", "))+"</span></li>";}',
  ' return h+"</ul>";',
  "}",
  "function rOverlays(){",
  ' var os=state.data.overlays||[];if(!os.length)return empty("No overlays wired");',
  ' var h="<ul class=\\"st-list\\">";',
  " for(var i=0;i<os.length;i++){var o=os[i];",
  '  var kind=o.modal?"modal":(o.menu?"menu":(o.takesFocus?"focusable":"non-modal"));',
  '  h+="<li class=\\"st-row st-click\\" data-node=\\""+esc(o.id)+"\\"><code>"+esc(o.key||o.id)+"</code> <span class=\\"st-key\\">["+kind+"]</span> <span class=\\"st-dim\\">"+(o.open?"open":"closed")+(o.closeOnEscape?" \\u00b7 esc":"")+(o.restoreFocus?" \\u00b7 restore":"")+"</span></li>";}',
  ' return h+"</ul>";',
  "}",
  "function rPerformance(){",
  " var p=state.data.performance||{snapshot:{},diagnostics:[]};var snap=p.snapshot||{};",
  ' var h="<p class=\\"st-warn\\">Structural counts, not wall-clock timings. A real render/interaction timeline needs a browser (gate BLOCKED); no timings are fabricated here.</p>";',
  " var sk=Object.keys(snap);",
  ' h+="<h4>Graph metrics</h4>"+(sk.length?sk.map(function(k){return kv(k,snap[k]);}).join(""):empty("none"));',
  " var d=p.diagnostics||[];",
  ' h+="<h4>Diagnostics ("+d.length+")</h4>"+(d.length?"<ul class=\\"st-list\\">"+d.map(function(x){return "<li><code>"+esc(x.code)+"</code>: "+esc(x.message)+"</li>";}).join("")+"</ul>":empty("none"));',
  " return h;",
  "}",
  "function rDiagnostics(){",
  " var d=state.data.diagnostics||{errors:0,warnings:0,messages:[]};",
  ' var h="<p class=\\"st-dim\\">"+d.errors+" error(s) \\u00b7 "+d.warnings+" warning(s) (compiler findings)</p>";',
  " var m=d.messages||[];",
  ' return h+(m.length?"<ul class=\\"st-list\\">"+m.map(function(x){return "<li>"+esc(x)+"</li>";}).join("")+"</ul>":empty("No diagnostics"));',
  "}",
  "function rHydration(){",
  ' var h2=state.data.hydration;if(!h2)return empty("No hydration inspection");',
  " var pct=(h2.staticRatio*100).toFixed(1);",
  ' var h="<p class=\\"st-warn\\">Structural static-vs-dynamic split only \\u2014 NOT wall-clock SSR/hydration timing (browser gate BLOCKED).</p>";',
  ' h+=kv("total nodes",h2.totalNodes)+kv("static nodes",h2.staticNodes+" ("+pct+"%)")+kv("dynamic nodes",h2.dynamicNodes)',
  '  +kv("static subtrees",h2.staticSubtrees)+kv("dynamic text",h2.dynamicTextNodes)+kv("dynamic attrs",h2.dynamicAttrNodes)',
  '  +kv("event nodes",h2.eventNodes)+kv("lists",h2.lists)+kv("conditionals",h2.conditionals)+kv("portals",h2.portals)+kv("head anchors",h2.headAnchors);',
  " return h;",
  "}",
  "var RENDERERS={components:rComponents,inspector:rInspector,state:rState,signalGraph:rSignalGraph,router:rRouter,resources:rResources,mutations:rMutations,events:rEvents,overlays:rOverlays,performance:rPerformance,diagnostics:rDiagnostics,hydration:rHydration};",
  'function renderTab(){var el=document.getElementById("st-panel");if(!el)return;var fn=RENDERERS[state.tab]||function(){return empty("Unknown panel");};',
  " el.innerHTML=fn();",
  ' var rows=el.querySelectorAll(".st-click");',
  ' for(var i=0;i<rows.length;i++){(function(row){row.addEventListener("click",function(){var id=row.getAttribute("data-node");if(id){state.selected=id;selectTab("inspector");}});})(rows[i]);}',
  "}",
  'function selectTab(id){state.tab=id;var tabs=document.querySelectorAll(".st-tab");for(var i=0;i<tabs.length;i++){var t=tabs[i];t.setAttribute("aria-selected",t.getAttribute("data-tab")===id?"true":"false");}renderTab();}',
  'function selectComponent(id){state.selected=id;selectTab("inspector");}',
  'function refresh(){var hook=window.__STREETUI_DEVTOOLS_REFRESH__;if(typeof hook!=="function")return false;var next=hook();if(next&&typeof next==="object"){state.data=next;renderTab();return true;}return false;}',
  "function bind(){",
  ' var tabs=document.querySelectorAll(".st-tab");',
  ' for(var i=0;i<tabs.length;i++){(function(t){t.addEventListener("click",function(){selectTab(t.getAttribute("data-tab"));});})(tabs[i]);}',
  ' var rb=document.getElementById("st-refresh");if(rb)rb.addEventListener("click",refresh);',
  "}",
  "window.__StreetUIDevTools={get data(){return state.data;},get tab(){return state.tab;},get selected(){return state.selected;},selectTab:selectTab,selectComponent:selectComponent,refresh:refresh,render:renderTab};",
  "bind();renderTab();",
  "})();"
].join("\n");
var INTERACTIVE_CSS = [
  "*{box-sizing:border-box}",
  ".st-dt{font:13px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;margin:0;color:#e6e6e6;background:#1e1e28;display:flex;flex-direction:column;min-height:100vh}",
  ".st-top{display:flex;align-items:center;justify-content:space-between;padding:10px 16px;border-bottom:1px solid #333;background:#15151c}",
  ".st-top h1{font-size:14px;margin:0}",
  ".st-refresh{font:inherit;color:#e6e6e6;background:#2c2c3a;border:1px solid #3a3a4a;border-radius:5px;padding:4px 10px;cursor:pointer}",
  ".st-refresh:hover{background:#37374a}",
  ".st-tabs{display:flex;flex-wrap:wrap;gap:2px;padding:6px 10px;border-bottom:1px solid #2c2c38;background:#191922}",
  ".st-tab{font:inherit;color:#b8b8c8;background:transparent;border:0;border-radius:5px;padding:5px 10px;cursor:pointer}",
  ".st-tab:hover{background:#26263200}",
  '.st-tab[aria-selected="true"]{background:#2f2f40;color:#fff}',
  ".st-body{flex:1;padding:12px 16px;overflow:auto}",
  ".st-body h3{font-size:13px;margin:2px 0 8px}.st-body h4{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#9a9aae;margin:14px 0 4px}",
  ".st-list{list-style:none;margin:0;padding:0}.st-list li{padding:2px 0}",
  ".st-row{display:flex;align-items:center;gap:6px}.st-click{cursor:pointer;border-radius:4px;padding:2px 4px}.st-click:hover{background:#26263a}",
  ".st-ind{display:inline-block;width:calc(var(--d,0)*12px)}",
  ".st-kv{display:flex;gap:10px;padding:1px 0}.st-k{color:#9a9aae;min-width:120px}.st-v{color:#d7d7e0;word-break:break-all}",
  ".st-badge{display:inline-block;background:#2c2c3a;border-radius:10px;padding:1px 8px;font-size:11px}",
  ".st-foot{padding:6px 16px;border-top:1px solid #2c2c38;background:#15151c}",
  ".st-dim{color:#8a8a9a}.st-key{color:#7db4ff}.st-err{color:#ff8a8a}.st-empty{color:#6a6a7a}.st-warn{color:#ffce8a;margin:0 0 10px}",
  "code{color:#d7d7e0}"
].join("");
var PROBE_PATHS = ["/health/live", "/health/ready", "/api/jobs/metrics"];
function normalizeBaseUrl(input2) {
  const raw = input2.trim();
  if (raw === "") return { ok: false, reason: "Enter the base URL of a running StreetJS app." };
  let u;
  try {
    u = new URL(raw);
  } catch {
    return { ok: false, reason: "That is not a valid URL. Example: http://localhost:3000" };
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    return { ok: false, reason: "Only http: and https: URLs can be probed." };
  }
  return { ok: true, url: `${u.origin}${u.pathname.replace(/\/+$/, "")}` };
}
var idleResults = () => PROBE_PATHS.map((path) => ({ path, state: "idle", detail: "Not probed yet." }));
function createBackendPanel(fetchImpl, timeoutMs = 5e3) {
  const baseUrl2 = signal("");
  const results = signal(idleResults());
  const running = signal(false);
  const urlError = derived(() => {
    const v = baseUrl2.get();
    if (v.trim() === "") return "";
    const r = normalizeBaseUrl(v);
    return r.ok ? "" : r.reason;
  });
  const summary = derived(() => {
    if (running.get()) return "Probing\u2026";
    const rs = results.get();
    if (rs.every((r) => r.state === "idle")) return "No backend configured. Enter a URL to probe a running StreetJS app.";
    const ok = rs.filter((r) => r.state === "ok").length;
    return `${ok} of ${rs.length} routes answered.`;
  });
  const doFetch = () => fetchImpl ?? (typeof fetch === "function" ? fetch : void 0);
  async function probe(base, path, f) {
    const ctl = typeof AbortController === "function" ? new AbortController() : void 0;
    const timer = ctl !== void 0 ? setTimeout(() => ctl.abort(), timeoutMs) : void 0;
    try {
      const res = await f(`${base}${path}`, ctl !== void 0 ? { signal: ctl.signal } : void 0);
      if (res.ok) {
        const body2 = (await res.text()).slice(0, 200).replace(/\s+/g, " ").trim();
        return { path, state: "ok", detail: `HTTP ${res.status}${body2 !== "" ? ` \u2014 ${body2}` : ""}` };
      }
      if (res.status === 404) {
        return { path, state: "unavailable", detail: "HTTP 404 \u2014 the app has not registered this route." };
      }
      return { path, state: "error", detail: `HTTP ${res.status}` };
    } catch (err) {
      const aborted = err instanceof Error && err.name === "AbortError";
      return {
        path,
        state: "error",
        detail: aborted ? `No answer within ${timeoutMs / 1e3}s.` : "Request failed \u2014 the server is unreachable, or the browser blocked it (CORS must allow this site\u2019s origin)."
      };
    } finally {
      if (timer !== void 0) clearTimeout(timer);
    }
  }
  async function run() {
    if (running.peek()) return;
    const parsed = normalizeBaseUrl(baseUrl2.peek());
    if (!parsed.ok) {
      results.set(idleResults());
      return;
    }
    const f = doFetch();
    if (f === void 0) {
      results.set(PROBE_PATHS.map((path) => ({ path, state: "error", detail: "fetch is not available here." })));
      return;
    }
    running.set(true);
    results.set(PROBE_PATHS.map((path) => ({ path, state: "loading", detail: "Waiting for an answer\u2026" })));
    try {
      results.set(await Promise.all(PROBE_PATHS.map((p3) => probe(parsed.url, p3, f))));
    } finally {
      running.set(false);
    }
  }
  return { baseUrl: baseUrl2, results, running, summary, urlError, run };
}
var COLUMN_TYPES = ["text", "int", "bigint", "boolean", "timestamp", "jsonb"];
function decodeColumn(type, raw) {
  switch (type) {
    case "text":
      return { ok: true, result: JSON.stringify(raw) };
    case "int": {
      if (!/^-?\d+$/.test(raw)) return { ok: false, result: "not an integer string" };
      const n = Number(raw);
      if (!Number.isSafeInteger(n)) return { ok: false, result: "outside the safe integer range \u2014 use bigint" };
      return { ok: true, result: String(n) };
    }
    case "bigint": {
      if (!/^-?\d+$/.test(raw)) return { ok: false, result: "not an integer string" };
      return { ok: true, result: `${BigInt(raw).toString()}n` };
    }
    case "boolean":
      if (raw === "t") return { ok: true, result: "true" };
      if (raw === "f") return { ok: true, result: "false" };
      return { ok: false, result: `expected 't' or 'f', got ${JSON.stringify(raw)}` };
    case "timestamp": {
      const m = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}(?:\.\d+)?)(Z|[+-]\d{2}(?::?\d{2})?)?$/.exec(raw);
      if (m === null) return { ok: false, result: "not a Postgres timestamp string" };
      let zone = m[3] ?? "Z";
      if (/^[+-]\d{2}$/.test(zone)) zone = `${zone}:00`;
      else if (/^[+-]\d{4}$/.test(zone)) zone = `${zone.slice(0, 3)}:${zone.slice(3)}`;
      const d = /* @__PURE__ */ new Date(`${m[1]}T${m[2]}${zone}`);
      return Number.isNaN(d.getTime()) ? { ok: false, result: "could not be parsed as a date" } : { ok: true, result: d.toISOString() };
    }
    case "jsonb":
      try {
        return { ok: true, result: JSON.stringify(JSON.parse(raw)) };
      } catch {
        return { ok: false, result: "not valid JSON text" };
      }
    default:
      return { ok: false, result: `unknown type "${type}" (use ${COLUMN_TYPES.join(", ")})` };
  }
}
function decodeRows(input2) {
  const out = [];
  for (const line of input2.split(/[\n;]/)) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) continue;
    const parts = trimmed.split("|");
    if (parts.length < 3) {
      out.push({ column: trimmed, type: "?", raw: "", ok: false, result: 'expected "column | type | value"' });
      continue;
    }
    const column = (parts[0] ?? "").trim();
    const type = (parts[1] ?? "").trim();
    const raw = parts.slice(2).join("|").trim();
    out.push({ column, type, raw, ...decodeColumn(type, raw) });
  }
  return out;
}
var DECODER_SAMPLE = [
  "id | bigint | 9007199254740993",
  "active | boolean | t",
  "created_at | timestamp | 2026-01-02 03:04:05.123456+00",
  "attempts | int | 3",
  'meta | jsonb | {"plan":"pro"}'
].join("; ");
var MIGRATION_NAME = /^[a-zA-Z0-9][a-zA-Z0-9_\-.]*\.sql$/;
function checkMigrations(input2) {
  const names = input2.split(/[\n,]/).map((l) => l.trim()).filter((l) => l !== "" && !l.startsWith("#"));
  const problems = [];
  const forward = [];
  const seen = /* @__PURE__ */ new Set();
  for (const name of names) {
    if (name.endsWith(".rollback.sql")) continue;
    if (!MIGRATION_NAME.test(name)) {
      problems.push(`${name}: not a valid migration file name`);
      continue;
    }
    if (seen.has(name)) {
      problems.push(`${name}: listed more than once`);
      continue;
    }
    seen.add(name);
    forward.push(name);
  }
  const widths = /* @__PURE__ */ new Set();
  const prefixes = /* @__PURE__ */ new Map();
  for (const name of forward) {
    const m = /^(\d+)/.exec(name);
    if (m === null) {
      problems.push(`${name}: no numeric prefix, so its position is arbitrary`);
      continue;
    }
    const digits = m[1] ?? "";
    widths.add(digits.length);
    const earlier = prefixes.get(digits);
    if (earlier !== void 0) problems.push(`${name}: same prefix as ${earlier}`);
    else prefixes.set(digits, name);
  }
  if (widths.size > 1) {
    problems.push("numeric prefixes have different widths \u2014 lexicographic order will not match numeric order");
  }
  const order = [...forward].sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
  return { order, problems };
}
var MIGRATION_SAMPLE = [
  "001_create_users.sql",
  "002_create_orders.sql",
  "010_add_indexes.sql",
  "002_create_orders.rollback.sql"
].join(", ");
function checkSecretFormats(value) {
  const jwtOk = value.length >= 32;
  const sessionOk = /^[0-9a-fA-F]{64}$/.test(value);
  return [
    {
      label: "JwtService secret",
      ok: jwtOk,
      detail: jwtOk ? `${value.length} characters (minimum 32)` : `${value.length} characters \u2014 needs at least 32`
    },
    {
      label: "SessionManager key",
      ok: sessionOk,
      detail: sessionOk ? "64 hex characters" : `${value.length} characters \u2014 needs exactly 64 hex characters`
    }
  ];
}
function createPlayground() {
  const decoderInput = signal(DECODER_SAMPLE);
  const migrationInput = signal(MIGRATION_SAMPLE);
  const secretInput = signal("");
  const decoded = derived(() => decodeRows(decoderInput.get()));
  const migrations = derived(() => checkMigrations(migrationInput.get()));
  const secrets = derived(() => checkSecretFormats(secretInput.get()));
  const decoderSummary = derived(() => {
    const rows = decoded.get();
    const bad = rows.filter((r) => !r.ok).length;
    return `${rows.length} column${rows.length === 1 ? "" : "s"}, ${bad} problem${bad === 1 ? "" : "s"}`;
  });
  const migrationSummary = derived(() => {
    const r = migrations.get();
    return `${r.order.length} forward migration${r.order.length === 1 ? "" : "s"}, ${r.problems.length} problem${r.problems.length === 1 ? "" : "s"}`;
  });
  return { decoderInput, decoded, migrationInput, migrations, secretInput, secrets, decoderSummary, migrationSummary };
}
var PLACEHOLDER_BASE_URL = "https://streetjs.example";
var SITE = {
  name: "StreetJS",
  defaultTitle: "StreetJS \u2014 production-grade TypeScript backend framework",
  defaultDescription: "StreetJS is a TypeScript backend framework with a native PostgreSQL wire driver, JWT, WebSockets, clustering, runtime input validation and field-level encryption. No Express. No pg. No Prisma.",
  themeColor: "#0f1419",
  twitterCard: "summary",
  /** The only upstream documentation URL recorded for StreetJS. */
  docsUrl: "https://hassanmubiru.github.io/StreetJS/",
  /** The only StreetJS version these pages were verified against. */
  version: "1.2.8"
};
var baseUrl = PLACEHOLDER_BASE_URL;
function configureSite(options) {
  baseUrl = options.baseUrl.replace(/\/+$/, "");
}
function siteDefaults() {
  return {
    charset: "utf-8",
    viewport: "width=device-width, initial-scale=1",
    robots: "index,follow",
    themeColor: SITE.themeColor,
    favicon: "/favicon.svg"
  };
}
function metaDescription(text2, max = 160) {
  const flat = text2.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max - 1);
  const space2 = cut.lastIndexOf(" ");
  return (space2 > 80 ? cut.slice(0, space2) : cut).replace(/[.,;:\s]+$/, "") + "\u2026";
}
function pageHead(opts) {
  const url = baseUrl + (opts.path === "/" ? "/" : opts.path);
  const isHome = opts.path === "/";
  const title = isHome ? SITE.defaultTitle : `${opts.title} \xB7 ${SITE.name}`;
  const description = metaDescription(opts.description ?? SITE.defaultDescription);
  return {
    ...siteDefaults(),
    ...opts.robots !== void 0 ? { robots: opts.robots } : {},
    title,
    description,
    canonical: url,
    openGraph: {
      site_name: SITE.name,
      type: "website",
      title,
      description,
      url
    },
    twitter: {
      card: SITE.twitterCard,
      title,
      description
    }
  };
}
var t6 = tokens.ref;
var appRoot = cx(
  layout.stack({ gap: "0" }),
  style({
    minHeight: "100vh",
    background: t6.surface.background,
    color: t6.content.primary,
    fontFamily: t6.font.sans,
    fontSize: t6.size.md,
    lineHeight: t6.leading.normal
  })
);
var pageContainer = layout.container({ max: 1120, padX: "5" });
var pageSection = cx(
  pageContainer,
  layout.stack({ gap: "5" }),
  style({ paddingTop: t6.space["8"], paddingBottom: t6.space["8"] })
);
var pageBody = layout.stack({ gap: "5" });
var pageTitle = text.heading({ level: 1 });
var pageLead = cx(text.body({ muted: true, measure: "65ch" }), style({ fontSize: t6.size.lg }));
var sectionHeading = text.heading({ level: 2 });
var subHeading = text.heading({ level: 3 });
var bodyText = text.body({ measure: "70ch" });
var metaText = text.caption();
var inlineLink = text.link();
var heroTitle = style({
  fontFamily: t6.font.sans,
  fontSize: t6.size["3xl"],
  fontWeight: t6.weight.bold,
  lineHeight: t6.leading.tight,
  letterSpacing: "-0.02em",
  color: t6.content.primary,
  maxWidth: "22ch"
});
var navBar = style({
  position: "sticky",
  top: 0,
  zIndex: t6.z.dropdown,
  background: t6.surface.raised,
  boxShadow: t6.shadow.sm
});
var navInner = cx(
  pageContainer,
  layout.row({ gap: "4", align: "center", justify: "between", wrap: true }),
  style({ paddingTop: t6.space["3"], paddingBottom: t6.space["3"] })
);
var brand = style({
  fontFamily: t6.font.sans,
  fontSize: t6.size.lg,
  fontWeight: t6.weight.bold,
  letterSpacing: "-0.01em",
  color: t6.content.primary,
  textDecoration: "none"
});
var brandLink = style({
  fontFamily: t6.font.sans,
  fontSize: t6.size.lg,
  fontWeight: t6.weight.bold,
  letterSpacing: "-0.01em",
  color: t6.content.primary,
  textDecoration: "none",
  borderRadius: t6.radius.sm,
  on: { focusVisible: { outline: `2px solid ${t6.focus.ring}`, outlineOffset: 2 } }
});
var navLinks = style({
  display: { base: "none", md: "flex" },
  flexDirection: "row",
  flexWrap: "wrap",
  alignItems: "center",
  gap: t6.space["4"]
});
var navLinkItem = style({
  fontSize: t6.size.sm,
  fontWeight: t6.weight.medium,
  color: t6.content.secondary,
  textDecoration: "none",
  borderRadius: t6.radius.sm,
  paddingTop: t6.space["1"],
  paddingBottom: t6.space["1"],
  paddingLeft: t6.space["2"],
  paddingRight: t6.space["2"],
  transition: `color ${t6.duration.fast} ${t6.easing.standard}, background ${t6.duration.fast} ${t6.easing.standard}`,
  on: {
    hover: { color: t6.accent.primary, background: t6.surface.sunken },
    focusVisible: { outline: `2px solid ${t6.focus.ring}`, outlineOffset: 2 }
  }
});
var navActiveMark = a11y.visuallyHidden();
var navControls = layout.row({ gap: "3", align: "center", wrap: true });
var compactButton = {
  fontFamily: t6.font.sans,
  fontSize: t6.size.sm,
  fontWeight: t6.weight.medium,
  color: t6.content.primary,
  background: t6.surface.background,
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: t6.border.strong,
  borderRadius: t6.radius.md,
  paddingTop: t6.space["1"],
  paddingBottom: t6.space["1"],
  paddingLeft: t6.space["3"],
  paddingRight: t6.space["3"],
  cursor: "pointer",
  appearance: "none",
  transition: `background ${t6.duration.fast} ${t6.easing.standard}`
};
var themeToggle = style({
  ...compactButton,
  on: {
    hover: { background: t6.surface.sunken },
    focusVisible: { outline: "none", boxShadow: `0 0 0 3px ${t6.focus.ring}` }
  }
});
var menuToggle = style({
  ...compactButton,
  display: { base: "inline-flex", md: "none" },
  alignItems: "center",
  on: {
    hover: { background: t6.surface.sunken },
    focusVisible: { outline: "none", boxShadow: `0 0 0 3px ${t6.focus.ring}` }
  }
});
var mobileMenu = style({
  display: { base: "flex", md: "none" },
  flexDirection: "column",
  gap: t6.space["1"],
  background: t6.surface.raised,
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: t6.border.default,
  paddingTop: t6.space["3"],
  paddingBottom: t6.space["3"],
  paddingLeft: t6.space["5"],
  paddingRight: t6.space["5"]
});
var mobileMenuLink = style({
  fontSize: t6.size.md,
  fontWeight: t6.weight.medium,
  color: t6.content.primary,
  textDecoration: "none",
  borderRadius: t6.radius.sm,
  paddingTop: t6.space["2"],
  paddingBottom: t6.space["2"],
  on: {
    hover: { color: t6.accent.primary },
    focusVisible: { outline: `2px solid ${t6.focus.ring}`, outlineOffset: 2 }
  }
});
var searchTrigger = style({
  ...compactButton,
  display: "inline-flex",
  alignItems: "center",
  gap: t6.space["2"],
  color: t6.content.secondary,
  minWidth: 120,
  on: {
    hover: { background: t6.surface.sunken },
    focusVisible: { outline: "none", boxShadow: `0 0 0 3px ${t6.focus.ring}` }
  }
});
var kbd = style({
  fontFamily: t6.font.mono,
  fontSize: t6.size.xs,
  color: t6.content.secondary,
  background: t6.surface.sunken,
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: t6.border.default,
  borderRadius: t6.radius.sm,
  paddingLeft: t6.space["1"],
  paddingRight: t6.space["1"]
});
var searchPanel = style({
  position: "fixed",
  top: "10vh",
  left: "50%",
  transform: "translateX(-50%)",
  width: "min(640px, 92vw)",
  maxHeight: "78vh",
  overflowY: "auto",
  zIndex: t6.z.overlay,
  display: "flex",
  flexDirection: "column",
  gap: t6.space["3"],
  background: t6.surface.raised,
  color: t6.content.primary,
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: t6.border.strong,
  borderRadius: t6.radius.lg,
  padding: t6.space["4"],
  boxShadow: `${t6.shadow.lg}, 0 0 0 100vmax ${t6.surface.overlay}`
});
var searchPanelHeader = layout.row({ gap: "3", align: "center", justify: "between" });
var searchPanelTitle = style({ fontSize: t6.size.md, fontWeight: t6.weight.semibold });
var searchDialogInput = cx(
  form.input(),
  style({ fontSize: t6.size.md, width: "100%" })
);
var searchHint = text.caption();
var searchResultsList = layout.stack({ gap: "1" });
var searchResultLink = style({
  display: "flex",
  flexDirection: "column",
  gap: 2,
  color: t6.content.primary,
  textDecoration: "none",
  borderRadius: t6.radius.md,
  padding: t6.space["2"],
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "transparent",
  on: {
    hover: { background: t6.surface.sunken },
    focus: { background: t6.surface.sunken, borderColor: t6.accent.primary },
    focusVisible: { outline: `2px solid ${t6.focus.ring}`, outlineOffset: -2 }
  }
});
var searchResultTitle = style({ fontSize: t6.size.sm, fontWeight: t6.weight.semibold });
var searchResultMeta = text.caption();
var searchEmpty = cx(text.body({ muted: true }), style({ padding: t6.space["2"] }));
var footer = style({
  borderStyle: "solid",
  borderColor: t6.border.default,
  borderWidth: 1,
  background: t6.surface.raised,
  marginTop: t6.space["10"]
});
var footerInner = cx(
  pageContainer,
  layout.stack({ gap: "3" }),
  style({ paddingTop: t6.space["5"], paddingBottom: t6.space["5"] })
);
var footerLinks = layout.row({ gap: "4", align: "center", wrap: true });
var footerText = text.caption();
var skipLink2 = a11y.skipLink();
var card = cx(
  layout.stack({ gap: "3" }),
  style({
    background: t6.surface.raised,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: t6.border.default,
    borderRadius: t6.radius.lg,
    padding: t6.space["5"],
    transition: `box-shadow ${t6.duration.fast} ${t6.easing.standard}, border-color ${t6.duration.fast} ${t6.easing.standard}`,
    on: { hover: { boxShadow: t6.shadow.md, borderColor: t6.border.strong } }
  })
);
var cardGrid = layout.grid({ columns: "auto", min: 260, gap: "5" });
var featureGrid = style({
  display: "grid",
  gap: t6.space["5"],
  gridTemplateColumns: { base: "1fr", md: "repeat(2, minmax(0, 1fr))" }
});
var codeBlock = layout.stack({ gap: "2" });
var codeLabel = cx(text.label(), style({ color: t6.content.secondary }));
var codeSurface = text.pre();
var inlineCode = text.code();
var breadcrumbTrail = cx(layout.row({ gap: "2", align: "center", wrap: true }), text.caption());
var breadcrumbLink = cx(text.link(), style({ fontSize: t6.size.xs, textDecoration: "none" }));
var breadcrumbCurrent = cx(text.caption(), style({ color: t6.content.secondary }));
var buttonPrimary = form.button();
var buttonSecondary = style({
  fontFamily: t6.font.sans,
  fontSize: t6.size.md,
  fontWeight: t6.weight.semibold,
  color: t6.content.primary,
  background: t6.surface.background,
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: t6.border.strong,
  borderRadius: t6.radius.md,
  paddingTop: t6.space["2"],
  paddingBottom: t6.space["2"],
  paddingLeft: t6.space["4"],
  paddingRight: t6.space["4"],
  cursor: "pointer",
  appearance: "none",
  textDecoration: "none",
  transition: `background ${t6.duration.fast} ${t6.easing.standard}`,
  on: {
    hover: { background: t6.surface.sunken },
    focusVisible: { outline: "none", boxShadow: `0 0 0 3px ${t6.focus.ring}` }
  }
});
var ctaRow = layout.row({ gap: "3", align: "center", wrap: true });
var pill = {
  display: "inline-flex",
  alignItems: "center",
  fontSize: t6.size.xs,
  fontWeight: t6.weight.medium,
  borderRadius: t6.radius.full,
  paddingLeft: t6.space["2"],
  paddingRight: t6.space["2"],
  paddingTop: 2,
  paddingBottom: 2,
  borderWidth: 1,
  borderStyle: "solid"
};
var badge = style({
  ...pill,
  color: t6.accent.primary,
  background: t6.surface.sunken,
  borderColor: t6.border.subtle
});
var statusOk = style({
  ...pill,
  color: t6.success.content,
  background: t6.surface.sunken,
  borderColor: t6.success.solid
});
var statusError = style({
  ...pill,
  color: t6.danger.content,
  background: t6.danger.surface,
  borderColor: t6.danger.border
});
var statusNeutral = style({
  ...pill,
  color: t6.content.secondary,
  background: t6.surface.sunken,
  borderColor: t6.border.default
});
var badgeRow = layout.row({ gap: "2", align: "center", wrap: true });
var alert = cx(
  layout.stack({ gap: "2" }),
  style({
    background: t6.surface.sunken,
    borderStyle: "solid",
    borderColor: t6.border.default,
    borderWidth: 1,
    borderRadius: t6.radius.md,
    padding: t6.space["4"]
  })
);
var notice = cx(
  layout.stack({ gap: "1" }),
  style({
    background: t6.surface.sunken,
    borderStyle: "solid",
    borderColor: t6.accent.primary,
    borderWidth: 1,
    borderRadius: t6.radius.md,
    padding: t6.space["3"],
    fontSize: t6.size.sm,
    color: t6.content.secondary
  })
);
var errorBox = cx(
  layout.stack({ gap: "2" }),
  style({
    background: t6.danger.surface,
    borderStyle: "solid",
    borderColor: t6.danger.border,
    borderWidth: 1,
    borderRadius: t6.radius.md,
    padding: t6.space["3"],
    color: t6.danger.content,
    fontSize: t6.size.sm
  })
);
var table = style({ width: "100%", fontSize: t6.size.sm, color: t6.content.primary });
var docsLayout = style({
  display: "grid",
  gap: t6.space["6"],
  gridTemplateColumns: { base: "1fr", md: "230px minmax(0, 1fr)" },
  alignItems: "start"
});
var docsSidebar = cx(
  layout.stack({ gap: "2" }),
  style({ position: { base: "static", md: "sticky" }, top: t6.space["10"] })
);
var docsSidebarGroup = text.label();
var docsSidebarLink = style({
  fontSize: t6.size.sm,
  color: t6.content.secondary,
  textDecoration: "none",
  borderRadius: t6.radius.sm,
  paddingTop: t6.space["1"],
  paddingBottom: t6.space["1"],
  paddingLeft: t6.space["2"],
  paddingRight: t6.space["2"],
  on: {
    hover: { color: t6.accent.primary, background: t6.surface.sunken },
    focusVisible: { outline: `2px solid ${t6.focus.ring}`, outlineOffset: 2 }
  }
});
var docsContent = cx(layout.stack({ gap: "5" }), style({ minWidth: 0 }));
var linkList = layout.stack({ gap: "2" });
var pagerRow = layout.row({ gap: "4", align: "center", justify: "between", wrap: true });
var fieldGroup = layout.stack({ gap: "2" });
var fieldLabel2 = text.label();
var textarea = cx(
  form.input(),
  style({ fontFamily: t6.font.mono, fontSize: t6.size.sm, minHeight: 120, width: "100%" })
);
var textInput = cx(form.input(), style({ width: "100%" }));
var outputBox = cx(
  layout.stack({ gap: "1" }),
  style({
    fontFamily: t6.font.mono,
    fontSize: t6.size.sm,
    background: t6.surface.sunken,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: t6.border.default,
    borderRadius: t6.radius.md,
    padding: t6.space["3"],
    overflowX: "auto"
  })
);
var outputRow = style({
  display: "grid",
  gridTemplateColumns: { base: "1fr", md: "160px 1fr 1fr" },
  gap: t6.space["2"],
  alignItems: "start"
});
var toolPanel = cx(
  layout.stack({ gap: "4" }),
  style({
    background: t6.surface.raised,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: t6.border.default,
    borderRadius: t6.radius.lg,
    padding: t6.space["5"]
  })
);
var ds = {
  appRoot,
  pageContainer,
  pageSection,
  pageBody,
  pageTitle,
  pageLead,
  sectionHeading,
  subHeading,
  bodyText,
  metaText,
  inlineLink,
  heroTitle,
  navBar,
  navInner,
  brand,
  brandLink,
  navLinks,
  navLinkItem,
  navActiveMark,
  navControls,
  themeToggle,
  menuToggle,
  mobileMenu,
  mobileMenuLink,
  searchTrigger,
  kbd,
  searchPanel,
  searchPanelHeader,
  searchPanelTitle,
  searchDialogInput,
  searchHint,
  searchResultsList,
  searchResultLink,
  searchResultTitle,
  searchResultMeta,
  searchEmpty,
  footer,
  footerInner,
  footerLinks,
  footerText,
  skipLink: skipLink2,
  card,
  cardGrid,
  featureGrid,
  codeBlock,
  codeLabel,
  codeSurface,
  inlineCode,
  breadcrumbTrail,
  breadcrumbLink,
  breadcrumbCurrent,
  buttonPrimary,
  buttonSecondary,
  ctaRow,
  badge,
  statusOk,
  statusError,
  statusNeutral,
  badgeRow,
  alert,
  notice,
  errorBox,
  table,
  docsLayout,
  docsSidebar,
  docsSidebarGroup,
  docsSidebarLink,
  docsContent,
  linkList,
  pagerRow,
  fieldGroup,
  fieldLabel: fieldLabel2,
  textarea,
  textInput,
  outputBox,
  outputRow,
  toolPanel
};
function pageLayout(page, opts, body2) {
  if (opts.path !== void 0) {
    page.head(
      pageHead({
        title: opts.title,
        description: opts.description ?? opts.lead,
        path: opts.path,
        robots: opts.robots
      })
    );
  }
  page.section(opts.id, (s) => {
    s.heading(opts.title, { level: 1, id: `${opts.id}-title`, class: ds.pageTitle });
    if (opts.lead !== void 0) {
      s.text(opts.lead, { id: `${opts.id}-lead`, class: ds.pageLead });
    }
    s.container(`${opts.id}-body`, (content) => body2(content), { id: `${opts.id}-body`, class: ds.pageBody });
  }, { id: `page-${opts.id}`, class: ds.pageSection });
}
function navLink(scope, router, item, cls = ds.navLinkItem) {
  scope.link(item.label, { href: item.href, id: item.id, class: cls });
  scope.when(router.isActive(item.href, { exact: item.exact ?? false }), (c) => {
    c.text(" (active)", { id: `${item.id}-active`, class: ds.navActiveMark });
  });
}
function codeExample(scope, sample, idBase) {
  scope.container(idBase, (c) => {
    c.text(sample.label, { id: `${idBase}-label`, class: ds.codeLabel });
    const codeOpts = { id: `${idBase}-src`, class: ds.codeSurface };
    if (sample.language !== void 0) codeOpts.language = sample.language;
    c.code(sample.code, codeOpts);
  }, { id: idBase, class: ds.codeBlock });
}
function breadcrumb(scope, trail, idBase) {
  scope.container(idBase, (c) => {
    trail.forEach((crumb, i) => {
      if (crumb.href !== void 0) {
        c.link(crumb.label, { href: crumb.href, id: `${idBase}-${i}`, class: ds.breadcrumbLink });
      } else {
        c.text(crumb.label, { id: `${idBase}-${i}`, class: ds.breadcrumbCurrent });
      }
    });
  }, { id: idBase, class: ds.breadcrumbTrail });
}
var PROVENANCE_TEXT = "Recorded from the StreetJS v1.2.8 type declarations. Verify against your installed version before relying on it.";
function provenanceNotice(scope, idBase) {
  scope.container(idBase, (c) => {
    c.text(PROVENANCE_TEXT, { id: `${idBase}-text` });
  }, { id: idBase, class: ds.notice, role: "note" });
}
function tagRow(scope, tags, idBase) {
  scope.container(idBase, (c) => {
    tags.forEach((tag, i) => c.text(tag, { id: `${idBase}-${i}`, class: ds.badge }));
  }, { id: idBase, class: ds.badgeRow });
}
var p = (text2) => ({ kind: "p", text: text2 });
var h = (text2) => ({ kind: "h", text: text2 });
var list2 = (...items) => ({ kind: "list", items });
var warn = (text2) => ({ kind: "warn", text: text2 });
var code2 = (label2, body2, language = "ts") => ({
  kind: "code",
  sample: { label: label2, language, code: body2 }
});
var DOC_GROUPS = ["Start", "Core", "Data", "Security", "Operations"];
var DOCS = [
  {
    slug: "overview",
    group: "Start",
    title: "Overview",
    summary: "What StreetJS is, what it bundles, and the shape of its package.",
    blocks: [
      p("StreetJS is a production-grade TypeScript backend framework. Its tagline lists a native PostgreSQL wire driver, JWT, WebSockets, clustering, runtime input validation and field-level encryption \u2014 with no Express, no pg and no Prisma."),
      h("Package facts"),
      list2(
        "npm package name: streetjs (the companion CLI package is @streetjs/cli).",
        "Requires Node >= 22 and npm >= 10. The package is ESM.",
        "It bundles zod, reflect-metadata and ws, so you do not add Zod yourself. TypeScript >= 5 is a peer dependency.",
        "The root entry exports well over 250 symbols; subpath entries such as streetjs/http, streetjs/database and streetjs/security expose focused slices.",
        "Twenty-one scoped @streetjs/* packages exist (router, postgres, pool, repository, migrations, session, security and others)."
      ),
      h("Not inspected"),
      p("GraphQL, tenancy, microservices, the enterprise and cloud modules, SDK generation, the query builder, Prometheus/OpenTelemetry integrations and several subpaths (sse, websocket, webhook, vault, multipart, resilience, telemetry, cluster, redis-cluster, pg-ha) were not read in detail. This site states only that those subpaths exist."),
      warn("The only StreetJS version these pages were checked against is 1.2.8. Official documentation lives at https://hassanmubiru.github.io/StreetJS/.")
    ]
  },
  {
    slug: "installation",
    group: "Start",
    title: "Installation",
    summary: "Install the package and enable the TypeScript settings decorators need.",
    blocks: [
      p("Install the framework and TypeScript. There is no verified scaffolding command, so start from a plain project."),
      code2("Install", "npm install streetjs\nnpm install --save-dev typescript @types/node", "bash"),
      p("Decorators such as @Controller and @Get rely on reflect-metadata, experimentalDecorators and emitDecoratorMetadata. Import reflect-metadata once, at the entry point."),
      code2("tsconfig.json (relevant options)", '{\n  "compilerOptions": {\n    "module": "NodeNext",\n    "moduleResolution": "NodeNext",\n    "target": "ES2022",\n    "strict": true,\n    "experimentalDecorators": true,\n    "emitDecoratorMetadata": true\n  }\n}', "json"),
      code2("src/main.ts", "import 'reflect-metadata'; // once, before any decorated class\nimport { streetApp } from 'streetjs/http';\n\nconst app = streetApp({ port: 3000 });\nawait app.listen();", "ts")
    ]
  },
  {
    slug: "http",
    group: "Core",
    title: "HTTP app and controllers",
    summary: "Create an app with streetApp() and register decorated controllers.",
    blocks: [
      p("streetApp(options) comes from streetjs/http. Its options are port, host, globalMiddlewares, requestTimeoutMs, maxBodyBytes and uploadsDir. The returned StreetHttpApp offers listen, close, registerController, use, openApiSpec, loadPlugin and unloadPlugin, and exposes the underlying Node http.Server as .server (attach WebSockets before calling listen)."),
      p("Routes are declared with decorators: @Controller(prefix, ...middleware) on the class and @Get, @Post, @Put, @Delete or @Patch (path, ...middleware) on methods."),
      code2("A controller", "import 'reflect-metadata';\nimport { Controller, Get } from 'streetjs';\nimport { streetApp } from 'streetjs/http';\n\n@Controller('/api/hello')\nclass HelloController {\n  @Get('/')\n  hello(ctx: { json(data: unknown, status?: number): void }) {\n    ctx.json({ message: 'hello' });\n  }\n}\n\nconst app = streetApp({ port: 3000 });\napp.registerController(HelloController);\nawait app.listen();"),
      warn("registerController resolves the class through a process-wide container exactly once. If the controller needs constructor arguments, call container.register(Ctor, new Ctor(...)) first. A @Command class must have no constructor parameters."),
      warn("StreetHttpApp is imported from streetjs/http. The root barrel exports only StreetApp and StreetAppOptions.")
    ]
  },
  {
    slug: "context",
    group: "Core",
    title: "The request context",
    summary: "What StreetContext exposes \u2014 and what it does not.",
    blocks: [
      p("Every handler and middleware receives a StreetContext. Recorded members: req, res, path, method, headers, params, query, body, state, user, files, rawBody (optional), startTime (a bigint), and the response helpers json(data, status?), text, html and send(status). Cookies use cookie(name) and setCookie(name, value, options); setHeader sets headers; sent reports whether a response went out."),
      h("Not present"),
      p("There is no ctx.db, no ctx.request.* and no ctx.status(). Create your own PgPool and pass it where needed."),
      h("Cookies"),
      list2(
        "setCookie appends to Set-Cookie, so repeated calls set several cookies.",
        "CookieOptions has maxAge but no expires.",
        "Defaults: httpOnly true, SameSite Lax, and secure only when NODE_ENV is production. Pass secure explicitly."
      ),
      p("AuthenticatedUser is { id, email, roles }. A middleware has the type (ctx, next) => Promise<void>.")
    ]
  },
  {
    slug: "validation",
    group: "Core",
    title: "Validation",
    summary: "Two validators: the small @Validate rules and the Zod-based validate().",
    blocks: [
      p("@Validate(schema) accepts a deliberately small rule set. Each field is a FieldRule with a type of string, number, boolean, email or uuid, plus required, min, max and pattern. It covers body, query and params. It does not support nested objects, arrays, enums or refinements."),
      p('For richer input, use the Zod-based validate({ body, query, params, headers, cookies }) or validated(ctx, schemas), exported from the security validation module and the root barrel. A failure raises ValidationError, which renders as HTTP 400 with { error: "ValidationError", issues: [{ path, message }] }.'),
      warn("ValidationError has no message field and is exported only from the root barrel.")
    ]
  },
  {
    slug: "database",
    group: "Data",
    title: "PostgreSQL: PgPool",
    summary: "The native driver, its pool, and why every column comes back as a string.",
    blocks: [
      p("PgPool takes host, port, user, password and database \u2014 all five are required. There is no connection-string or DATABASE_URL form. Optional tuning: connectTimeoutMs, minConnections, maxConnections, idleTimeoutMs, acquireTimeoutMs."),
      p("The constructor does not connect; the first use initialises the pool, so a service can answer a liveness probe while Postgres is still starting. Methods: initialize, ensureInitialized, acquire, release, query(sql, params?), stream, transaction(fn) and close. Getters: size, idle, waiting and avgAcquireMs."),
      code2("Query and transaction", "import { PgPool } from 'streetjs';\n\nconst pool = new PgPool({\n  host: process.env.PGHOST ?? 'localhost',\n  port: Number(process.env.PGPORT ?? 5432),\n  user: process.env.PGUSER ?? 'app',\n  password: process.env.PGPASSWORD ?? '',\n  database: process.env.PGDATABASE ?? 'app',\n});\n\nconst res = await pool.query('SELECT id, email FROM users WHERE id = $1', ['42']);\n\nawait pool.transaction(async (conn) => {\n  // BEGIN has run; COMMIT on return, ROLLBACK if this throws.\n});"),
      h("Every column is a string"),
      p('The driver reads the text format and does no type decoding. DbResult is { rows: Record<string, string | null>[], rowCount, command }. A boolean arrives as "t" or "f" (Boolean("f") is true), an integer as "5" (so "10" < "9"), numeric as "1299.00", a bigint as a string that may exceed Number.MAX_SAFE_INTEGER, a timestamptz as "2026-08-19 10:30:00+00" (not ISO 8601), and jsonb as a string you must JSON.parse. NULL is null.'),
      h("Parameters"),
      p('null and undefined bind as NULL, booleans as "t"/"f", numbers as String(n), Dates as toISOString(), and everything else as String(param) \u2014 so an object binds as "[object Object]". Use JSON.stringify with $1::jsonb for objects.'),
      warn('SQLSTATE codes are discarded: errors are plain Error objects whose message is "PostgreSQL: message \u2014 detail", and e.code is undefined. Do not catch constraint violations. Report conflicts in SQL instead, for example ON CONFLICT ... DO NOTHING RETURNING and check rowCount.'),
      warn("There is no TLS on the Postgres or Redis clients. Authentication is SCRAM, but the session itself is plaintext.")
    ]
  },
  {
    slug: "repositories",
    group: "Data",
    title: "Repositories",
    summary: "StreetPostgresRepository and the ledger transaction service.",
    blocks: [
      p("StreetPostgresRepository<T> is constructed with a PgPool and offers findById, findAll(limit?, offset?), create, update, delete, count and streamAll(sql, params?). LedgerTransactionService(pool) and a FieldEncryptor interface are exported alongside it."),
      warn("Rows come from the same string-typed driver, so map them to your own types before returning them from an endpoint; otherwise snake_case keys and string values reach the browser.")
    ]
  },
  {
    slug: "migrations",
    group: "Data",
    title: "Migrations",
    summary: "StreetMigrationRunner: naming, ordering, transactions and rollback.",
    blocks: [
      p("new StreetMigrationRunner(pool).run(dir) applies pending .sql files; .rollback(dir, steps = 1) reverts. Applied migrations are tracked by filename in the street_migrations table, so never rename one after it has run."),
      list2(
        "Accepted filenames match /^[a-zA-Z0-9][a-zA-Z0-9_\\-.]*\\.sql$/; files ending in .rollback.sql are excluded from the forward run.",
        "Files run in lexicographic order, so use zero-padded prefixes such as 001_ and 002_.",
        "Each file runs in its own transaction; multi-statement $$ bodies are safe.",
        'Rollback goes newest-first by applied_at and needs a sibling <name>.rollback.sql, otherwise it throws "Rollback file not found".'
      ),
      code2("Run migrations", "import { PgPool, StreetMigrationRunner } from 'streetjs';\n\nconst pool = new PgPool({ /* host, port, user, password, database */ } as never);\nawait new StreetMigrationRunner(pool).run('./migrations');"),
      p("The package itself ships two example migration files: 001_create_users.sql and its rollback."),
      warn("Do not use MigrationDiffer on hand-written schemas: it emits DROP TABLE for live tables that have no entity class.")
    ]
  },
  {
    slug: "seeding",
    group: "Data",
    title: "Seeding",
    summary: "StreetSeeder tracks seeds by content hash, not by name.",
    blocks: [
      p("StreetSeeder.run(pool, seedFile) returns { skipped, hash, name }. It takes a single file, so ordering several seeds is your job."),
      p("Seeds are recorded in street_seed_runs by a hash of the file contents. A seed that has not changed is skipped; a seed you edit runs again in full."),
      warn('"Idempotent" here means "will not run twice", not "safe to run twice". Write every statement with ON CONFLICT ... DO UPDATE, because an edited seed re-executes completely. The hash also cannot notice rows you deleted by hand.')
    ]
  },
  {
    slug: "jwt-sessions",
    group: "Security",
    title: "JWT and sessions",
    summary: "JwtService, SessionManager and the secrets they require.",
    blocks: [
      p("JwtService takes a secret of at least 32 characters and offers sign, verify and decode. SessionManager takes a key of exactly 64 hex characters (and checks its entropy) and offers encrypt and decrypt, authenticated encryption."),
      code2("Generate secrets", "# JWT secret (>= 32 chars)\nopenssl rand -base64 48\n\n# SessionManager key (exactly 64 hex chars)\nopenssl rand -hex 32", "bash"),
      warn("StreetSessionStore stores the raw session id, so a database leak allows session hijacking. Its revoke() deletes the row, isRevoked() treats an absent row as revoked, and user_id is TEXT with no foreign key.")
    ]
  },
  {
    slug: "rbac",
    group: "Security",
    title: "Roles and permissions",
    summary: "RbacService, rbacGuard \u2014 and where not to put the guard.",
    blocks: [
      p("RbacService is built from a role hierarchy and a role \u2192 permissions map. rbacGuard(service, options) produces a middleware. Decorators @Roles(...) and @Permissions(...) declare requirements."),
      warn("Placing rbacGuard in globalMiddlewares silently authorises every request: dispatch is the last pipeline step, so the required roles and permissions are not yet on ctx.state when a global middleware runs. Attach the guard at @Controller(prefix, guard) or @Get(path, guard) level."),
      warn("RbacService.hasRole ignores the hierarchy (exact string match). Only hasPermission inherits through the hierarchy, so authorise on permissions, not roles."),
      warn('The audit "ip" comes from ctx.state.ip or the x-forwarded-for header, which a client can spoof. Set ctx.state.ip from ctx.req.socket.remoteAddress in a global middleware.')
    ]
  },
  {
    slug: "passwords",
    group: "Security",
    title: "Password hashing",
    summary: "StreetJS ships no password hasher; use node:crypto scrypt with maxmem.",
    blocks: [
      p("No password hashing ships in the package. Node's built-in scrypt works; the parameters matter."),
      code2("scrypt with explicit maxmem", "import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto';\n\nconst N = 2 ** 15, r = 8, p = 3;\nconst maxmem = 128 * N * r * 2; // scrypt needs 128*N*r; the default limit is 32 MiB\n\nexport function hashPassword(password: string): Promise<string> {\n  return new Promise((resolve, reject) => {\n    try {\n      const salt = randomBytes(16);\n      scrypt(password, salt, 64, { N, r, p, maxmem }, (err, key) => {\n        if (err) return reject(err);\n        resolve(`${salt.toString('hex')}:${key.toString('hex')}`);\n      });\n    } catch (e) {\n      reject(e); // scrypt can throw synchronously on bad parameters\n    }\n  });\n}"),
      p("Measured on a two-core sandbox with Node 22: N=2^14, r=8, p=1 took about 29 ms; N=2^15, p=1 about 62 ms; N=2^15, p=3 about 165 ms; N=2^16, p=1 about 124 ms; N=2^17, p=1 about 256 ms. Memory does not depend on p. Treat these as one machine's numbers, not a benchmark of yours."),
      warn('scrypt throws RangeError ERR_CRYPTO_INVALID_SCRYPT_PARAMS ("memory limit exceeded") synchronously when maxmem is too low, so wrap the call and always pass maxmem. Compare hashes with timingSafeEqual.')
    ]
  },
  {
    slug: "http-hardening",
    group: "Security",
    title: "HTTP hardening",
    summary: "CORS, CSRF and security-header middleware, with their sharp edges.",
    blocks: [
      p("The root exports authMiddleware, requireRoles, securityHeaders, corsMiddleware, csrfMiddleware, buildCsp, computeSecurityHeaders, securityHeadersMiddleware and DEFAULT_CSP. Rate limiting lives in the ratelimit subpath."),
      warn("csrfMiddleware registered globally makes login impossible: the first POST to /auth/login, register or password-reset has no token yet and gets 403. Write a small middleware that checks CSRF only when ctx.user is present."),
      warn("corsMiddleware(origins) throws on an empty array, answers OPTIONS with ctx.send(204) without calling next(), and never sets Access-Control-Allow-Credentials or Expose-Headers. If you need those, register your own middleware before it."),
      warn("securityHeadersMiddleware sends HSTS even over plain HTTP unless you set hstsMaxAge to 0 in development.")
    ]
  },
  {
    slug: "jobs",
    group: "Operations",
    title: "Jobs, cron and workflows",
    summary: "JobQueue, CronScheduler, WorkflowEngine and SagaOrchestrator.",
    blocks: [
      p("JobQueue(pool, options) is a Postgres-backed queue. Options: concurrency, pollIntervalMs, workerId, heartbeatIntervalMs, reaperIntervalMs, staleJobThresholdMs. Methods: enqueue({ type, payload?, runAt? }), register(type, handler), registerClass, setRetryPolicy(type, { maxAttempts, initialDelayMs, backoffMultiplier, maxDelayMs }), metrics(), start and stop. metrics() returns { pending, inFlight, failed, succeeded, byType }."),
      code2("Enqueue and handle", "import { JobQueue } from 'streetjs';\n\nconst queue = new JobQueue(pool, { concurrency: 2 });\nqueue.register('email.welcome', async (payload, { jobId, attempt }) => {\n  // do the work; throw to retry\n});\nawait queue.enqueue({ type: 'email.welcome', payload: { userId: '42' } });\nqueue.start();"),
      p("Workers self-heal through a heartbeat and a reaper; the default stale threshold is two minutes. CronScheduler().register(cron, name, fn) validates the expression eagerly and throws CronParseError. WorkflowEngine(pool).define(name, steps) / start(name, input) / resume(id) runs steps with optional compensate, timeoutMs and condition; a step timeout surfaces as WorkflowStepTimeoutError. SagaOrchestrator().execute(steps) is in-memory with reverse compensation."),
      p("The exported *_MIGRATION_SQL constants (jobs, dead-letter queue, job history, workflows) are all CREATE TABLE IF NOT EXISTS; run them at bootstrap instead of copying their DDL.")
    ]
  },
  {
    slug: "health",
    group: "Operations",
    title: "Health checks",
    summary: "registerHealthRoutes serves /health/live and /health/ready.",
    blocks: [
      p("HealthCheckRegistry plus registerHealthRoutes expose GET /health/live and GET /health/ready. Because PgPool connects lazily, liveness can pass while the database is still starting."),
      warn("Health checks must reject with constant messages. createDbReadinessCheck is unreachable and leaks detail, so write your own readiness check."),
      p("registerJobMetricsRoute(app, queue) additionally serves GET /api/jobs/metrics. This site's Playground page can probe these real routes against a base URL you supply.")
    ]
  },
  {
    slug: "config",
    group: "Operations",
    title: "Configuration",
    summary: "validateEnv, @Config and defineConfig \u2014 and how they fail.",
    blocks: [
      list2(
        "validateEnv(zodSchema) calls process.exit(1) on failure.",
        "@Config(envKey, { encrypted, required }) with loadConfig(instance, kek?) throws on the first missing variable and does no type coercion.",
        "defineConfig(schema) returns a lossy type.",
        "The shipped AppConfig reads PG_HOST, PG_PORT, PG_DATABASE, PG_USER and PG_PASSWORD, while the driver examples above use PGHOST-style names. Pick one and be consistent."
      ),
      p("bare --flag arguments parse as true in CliKernel / parseArgv.")
    ]
  },
  {
    slug: "errors-logging",
    group: "Operations",
    title: "Errors and logging",
    summary: "Exception statuses, what leaks, and Logger metadata rules.",
    blocks: [
      p("Exception classes map to statuses: BadRequest 400, Unauthorized 401, Forbidden 403, NotFound 404, Conflict 409, Unprocessable 422, Internal 500, ServiceUnavailable 503, DatabaseConnectionError 503, FeatureUnavailableInEdgeRuntimeError 501 and RateLimitException 429 (with Retry-After). StreetException.toJSON() nests details."),
      warn("Framework 5xx exceptions can expose infrastructure detail \u2014 DatabaseConnectionError includes the PGHOST and PGPORT variable names. Add a global sanitising middleware keyed on HTTP status and register it early in globalMiddlewares."),
      warn("Logger spreads metadata last, so message, timestamp, level and service are reserved: a meta key named message overwrites the log message. Nest errors under err. In NODE_ENV=development each line is written twice."),
      p("correlationMiddleware(logger) reuses or generates an X-Correlation-ID header."),
      warn("Request bodies are parsed before global middleware runs, so an oversized body produces an opaque 500 rather than a clean 413.")
    ]
  },
  {
    slug: "known-traps",
    group: "Operations",
    title: "Known traps (checklist)",
    summary: "Every sharp edge recorded for v1.2.8 in one place.",
    blocks: [
      list2(
        "Every Postgres column arrives as a string; map rows before sending them to clients.",
        "SQLSTATE codes are discarded; never catch constraint violations \u2014 report outcomes in SQL.",
        "rbacGuard in globalMiddlewares authorises everything; attach it per controller or route.",
        "hasRole ignores hierarchy; authorise on permissions.",
        "No password hashing ships; use scrypt with explicit maxmem.",
        "csrfMiddleware globally breaks login; scope it to authenticated requests.",
        "corsMiddleware throws on an empty origin list and omits credentials headers.",
        "Seeds are tracked by content hash; edited seeds re-run entirely.",
        "Framework 5xx errors leak infrastructure names; sanitise them.",
        "Logger metadata keys can overwrite message, level, timestamp and service.",
        "StreetSessionStore keeps raw session ids.",
        "No TLS on the Postgres or Redis clients."
      ),
      p("Each item is explained, with its context, on the page for the relevant area.")
    ]
  }
];
var GUIDES = [
  {
    slug: "reading-postgres-rows",
    title: "Reading rows from the Postgres driver",
    summary: "Turn string-typed rows into real booleans, numbers, bigints and dates.",
    level: "Beginner",
    blocks: [
      p("Because the driver does no type decoding, convert at the boundary \u2014 once, in one function per entity."),
      code2("Mapping a row", "type Row = Record<string, string | null | undefined>;\n\ninterface Product { id: string; name: string; inStock: boolean; priceCents: bigint; createdOn: string; }\n\nfunction toProduct(row: Row): Product {\n  return {\n    id: String(row['id']),\n    name: String(row['name']),\n    inStock: row['in_stock'] === 't',          // 't' / 'f', not truthiness\n    priceCents: BigInt(row['price_cents'] ?? '0'), // bigint-safe\n    createdOn: (row['created_at'] ?? '').slice(0, 10), // '2026-08-19 10:30:00+00' -> '2026-08-19'\n  };\n}"),
      p('Keep money in integer cents (or parse numeric strings with a decimal library) because "1299.00" as a float is unsafe. The Playground has a row decoder you can try.')
    ]
  },
  {
    slug: "protect-routes-with-rbac",
    title: "Protecting routes with RBAC",
    summary: "Attach the guard where it can actually see the requirement.",
    level: "Intermediate",
    blocks: [
      p("Build an RbacService with a hierarchy and a role-to-permissions map, create a guard from it, and pass the guard as route-level middleware."),
      code2("Guard at route level", "import { Controller, Get } from 'streetjs';\n// rbacGuard(service, options): construct service once, pass guard per route.\n\n@Controller('/api/admin')\nclass AdminController {\n  // @Get(path, ...middleware): the guard goes here, NOT in globalMiddlewares.\n  @Get('/reports' /*, reportsGuard */)\n  reports(ctx: { json(d: unknown): void }) {\n    ctx.json({ ok: true });\n  }\n}"),
      warn("Authorise on permissions. hasRole matches the exact role string and ignores the hierarchy.")
    ]
  },
  {
    slug: "hash-passwords",
    title: "Hashing passwords with scrypt",
    summary: "A safe pattern when the framework gives you no hasher.",
    level: "Beginner",
    blocks: [
      p("Use node:crypto scrypt with a random per-password salt, an explicit maxmem, and timingSafeEqual for comparison. Wrap the call in try/catch inside the promise body, because invalid parameters throw synchronously."),
      p("The Passwords page lists parameters and timings measured on one machine. Re-measure on your own hardware and pick the largest cost your login path can afford.")
    ]
  },
  {
    slug: "migrations-and-seeds",
    title: "Running migrations and seeds",
    summary: "Order files, write rollbacks, and make seeds safe to re-run.",
    level: "Intermediate",
    blocks: [
      p("Name files with zero-padded prefixes (001_create_users.sql). Give every migration a sibling .rollback.sql so rollback never throws. Run them at startup with StreetMigrationRunner."),
      code2("Seed file written for re-execution", "-- seeds/001_roles.sql\nINSERT INTO roles (name, description)\nVALUES ('admin', 'Administrators'), ('member', 'Members')\nON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description;", "sql"),
      warn("Seeds are tracked by content hash. If you edit a seed file, the whole file runs again.")
    ]
  },
  {
    slug: "background-jobs-and-health",
    title: "Background jobs and health routes",
    summary: "Queue work in Postgres and expose real health endpoints.",
    level: "Intermediate",
    blocks: [
      p("Create the job tables at bootstrap with the exported migration SQL constants, register handlers, then call start(). Expose registerHealthRoutes for /health/live and /health/ready, and registerJobMetricsRoute for /api/jobs/metrics."),
      p("Point this site's Playground at those routes to see live status without inventing any endpoint.")
    ]
  },
  {
    slug: "harden-an-api",
    title: "Hardening an API",
    summary: "A checklist built from the recorded middleware traps.",
    level: "Intermediate",
    blocks: [
      list2(
        "Register a sanitising error middleware early so infrastructure names never reach clients.",
        "Set ctx.state.ip from the socket address instead of trusting x-forwarded-for.",
        "Scope CSRF checks to authenticated requests so login still works.",
        "Pass an explicit, non-empty origin list to corsMiddleware and add credentials headers yourself if needed.",
        "Set hstsMaxAge to 0 in development.",
        "Use rate limiting from the ratelimit subpath; the in-memory store is per process, the Redis store uses the ratelimit: key prefix."
      )
    ]
  }
];
var p2 = (text2) => ({ kind: "p", text: text2 });
var list3 = (...items) => ({ kind: "list", items });
var API_GROUPS = [
  {
    id: "http",
    importPath: "streetjs/http",
    title: "HTTP application",
    summary: "Create and run the server.",
    entries: [
      { name: "streetApp", signature: "streetApp(options?: { port, host, globalMiddlewares, requestTimeoutMs, maxBodyBytes, uploadsDir }): StreetHttpApp", note: "Factory for the HTTP application." },
      { name: "StreetHttpApp", signature: "listen(port?, host?) \xB7 close() \xB7 registerController(ctor) \xB7 use(mw) \xB7 openApiSpec() \xB7 loadPlugin() \xB7 unloadPlugin() \xB7 .server", note: "Imported from streetjs/http, not the root barrel. .server is a Node http.Server." }
    ]
  },
  {
    id: "decorators",
    importPath: "streetjs",
    title: "Decorators",
    summary: "Routing, validation and metadata decorators.",
    entries: [
      { name: "@Controller", signature: "@Controller(prefix, ...middleware)", note: "Marks a class as a controller." },
      { name: "@Get / @Post / @Put / @Delete / @Patch", signature: "@Get(path, ...middleware)", note: "Route methods." },
      { name: "@Validate", signature: "@Validate(schema)", note: "FieldRule types: string, number, boolean, email, uuid; required, min, max, pattern." },
      { name: "@ApiOperation", signature: "@ApiOperation({ summary, description, tags, responses })", note: "OpenAPI metadata for openApiSpec()." },
      { name: "@Config", signature: "@Config(envKey, { encrypted, required })", note: "Binds a property to an environment variable." },
      { name: "@Command", signature: "@Command(name, description?)", note: "CLI command; the class needs a no-argument constructor." },
      { name: "@Roles / @Permissions", signature: "@Roles(...roles) \xB7 @Permissions(...perms)", note: "Declare authorisation requirements." },
      { name: "@Job", signature: "@Job(type)", note: "Declares a job handler class." }
    ]
  },
  {
    id: "context",
    importPath: "streetjs",
    title: "Context and middleware",
    summary: "The per-request object.",
    entries: [
      { name: "StreetContext", signature: "req, res, path, method, headers, params, query, body, state, user, files, rawBody?, startTime: bigint", note: "No ctx.db, ctx.request or ctx.status()." },
      { name: "ctx.json / text / html / send", signature: "json(data, status?) \xB7 text \xB7 html \xB7 send(status)", note: "Response helpers; ctx.sent reports completion." },
      { name: "cookie / setCookie", signature: "cookie(name): string | undefined \xB7 setCookie(name, value, options)", note: "Options: maxAge (no expires); secure defaults on only in production." },
      { name: "MiddlewareFn", signature: "(ctx, next) => Promise<void>", note: "" },
      { name: "AuthenticatedUser", signature: "{ id, email, roles }", note: "" }
    ]
  },
  {
    id: "container",
    importPath: "streetjs",
    title: "Container",
    summary: "Process-wide dependency container.",
    entries: [
      { name: "container", signature: "register(ctor, instance) \xB7 resolve(ctor) \xB7 has(ctor) \xB7 reset()", note: "registerController resolves the controller once through it." }
    ]
  },
  {
    id: "validation",
    importPath: "streetjs",
    title: "Validation",
    summary: "Zod-based request validation.",
    entries: [
      { name: "validate", signature: "validate({ body, query, params, headers, cookies })", note: "Builds a middleware from Zod schemas." },
      { name: "validated", signature: "validated(ctx, schemas)", note: "Validates inside a handler." },
      { name: "ValidationError", signature: '{ error: "ValidationError", issues: [{ path, message }] } \xB7 HTTP 400', note: "Root barrel only; no message field." },
      { name: "validateEnv / validateArgv", signature: "validateEnv(zodSchema)", note: "validateEnv exits the process on failure." }
    ]
  },
  {
    id: "database",
    importPath: "streetjs/database",
    title: "Database",
    summary: "Native PostgreSQL driver, pool and repository.",
    entries: [
      { name: "PgPool", signature: "new PgPool({ host, port, user, password, database, connectTimeoutMs?, minConnections?, maxConnections?, idleTimeoutMs?, acquireTimeoutMs? })", note: "All five connection fields required; connects lazily." },
      { name: "PgPool methods", signature: "initialize \xB7 ensureInitialized \xB7 acquire \xB7 release(conn) \xB7 query(sql, params?) \xB7 stream(sql) \xB7 transaction(fn) \xB7 close", note: "Getters: size, idle, waiting, avgAcquireMs." },
      { name: "DbResult", signature: "{ rows: Record<string, string | null>[]; rowCount; command }", note: "Every column is a string." },
      { name: "StreetPostgresRepository<T>", signature: "findById \xB7 findAll(limit?, offset?) \xB7 create \xB7 update \xB7 delete \xB7 count \xB7 streamAll(sql, params?)", note: "Constructed with a PgPool." },
      { name: "LedgerTransactionService", signature: "new LedgerTransactionService(pool)", note: "Exported alongside the repository." },
      { name: "PgHaClient", signature: 'routing: "primary" | "prefer-replica" | "any"', note: "No TLS." }
    ]
  },
  {
    id: "migrations",
    importPath: "streetjs/migrations",
    title: "Migrations and seeding",
    summary: "Versioned SQL and idempotent-by-hash seeds.",
    entries: [
      { name: "StreetMigrationRunner", signature: "new StreetMigrationRunner(pool) \xB7 run(dir) \xB7 rollback(dir, steps = 1)", note: "Tracks filenames in street_migrations." },
      { name: "StreetSeeder", signature: "StreetSeeder.run(pool, seedFile): { skipped, hash, name }", note: "Tracks content hash in street_seed_runs." },
      { name: "MigrationDiffer", signature: "", note: "Emits DROP TABLE for tables with no entity class; avoid on hand-written schemas." }
    ]
  },
  {
    id: "security",
    importPath: "streetjs/security",
    title: "Security",
    summary: "Tokens, sessions, authorisation and hardening.",
    entries: [
      { name: "JwtService", signature: "new JwtService(secret \u2265 32 chars) \xB7 sign \xB7 verify \xB7 decode", note: "" },
      { name: "SessionManager", signature: "new SessionManager(hexKey: 64 hex chars) \xB7 encrypt \xB7 decrypt", note: "Authenticated encryption." },
      { name: "RbacService / rbacGuard", signature: "new RbacService(hierarchy, rolePermissions) \xB7 rbacGuard(service, options)", note: "hasRole ignores hierarchy; do not use rbacGuard globally." },
      { name: "KeyRing / FieldCipher / generateEncryptionKey", signature: "", note: "Field-level encryption helpers." },
      { name: "timingSafeStringEqual / constantTimeEqual", signature: "constantTimeEqual(a, b)", note: "Constant-time comparison." },
      { name: "Middleware", signature: "authMiddleware \xB7 requireRoles \xB7 securityHeaders \xB7 corsMiddleware \xB7 csrfMiddleware \xB7 securityHeadersMiddleware \xB7 sessionRevocationMiddleware \xB7 apiKeyMiddleware", note: "See the HTTP hardening page for edge cases." },
      { name: "Other", signature: "StreetSessionStore \xB7 AuditWriter \xB7 RefreshTokenService \xB7 TokenReplayError \xB7 MfaService \xB7 verifyTotp \xB7 mfaGuard \xB7 verifyMfaStepUp \xB7 ApiKeyService \xB7 buildCsp \xB7 computeSecurityHeaders \xB7 DEFAULT_CSP", note: "Names recorded; signatures not inspected." }
    ]
  },
  {
    id: "jobs",
    importPath: "streetjs",
    title: "Jobs, cron and workflows",
    summary: "Background processing on Postgres.",
    entries: [
      { name: "JobQueue", signature: "new JobQueue(pool, opts) \xB7 enqueue({ type, payload?, runAt? }) \xB7 register(type, handler) \xB7 registerClass \xB7 setRetryPolicy \xB7 metrics() \xB7 start \xB7 stop", note: "metrics(): { pending, inFlight, failed, succeeded, byType }." },
      { name: "registerJobMetricsRoute", signature: "registerJobMetricsRoute(app, queue)", note: "Serves GET /api/jobs/metrics." },
      { name: "CronScheduler", signature: "register(cron, name, fn) \xB7 start \xB7 stop", note: "Throws CronParseError eagerly." },
      { name: "WorkflowEngine", signature: "new WorkflowEngine(pool) \xB7 define(name, steps) \xB7 start(name, input) \xB7 resume(id)", note: "Step: { name, run, compensate?, timeoutMs?, condition? }." },
      { name: "SagaOrchestrator", signature: "execute(steps)", note: "In-memory; reverse compensation." }
    ]
  },
  {
    id: "health",
    importPath: "streetjs",
    title: "Health and observability",
    summary: "Probes, logging and correlation.",
    entries: [
      { name: "registerHealthRoutes", signature: "GET /health/live \xB7 GET /health/ready", note: "Backed by HealthCheckRegistry." },
      { name: "Logger / correlationMiddleware", signature: "correlationMiddleware(logger)", note: "Metadata spreads last; message/level/timestamp/service are reserved." }
    ]
  },
  {
    id: "infra",
    importPath: "streetjs/ratelimit \xB7 streetjs/cache",
    title: "Rate limiting, Redis and cache",
    summary: "Supporting infrastructure.",
    entries: [
      { name: "RateLimiter / RateLimitException", signature: "", note: "Exception is HTTP 429 with Retry-After." },
      { name: "RedisRateLimitStore / InMemoryRateLimitStore", signature: "", note: 'Redis prefix "ratelimit:"; in-memory is per process.' },
      { name: "RedisClient", signature: "connect \xB7 command \xB7 get \xB7 set(k, v, ttl?) \xB7 del \xB7 publish \xB7 subscribe \xB7 close", note: "Minimal RESP2; no TLS, reconnect or timeout." },
      { name: "cache", signature: "", note: "An LRU only." }
    ]
  },
  {
    id: "subpaths",
    importPath: "package exports",
    title: "Subpath exports",
    summary: "Every subpath listed in package.json exports.",
    entries: [
      { name: "Subpaths", signature: ". \xB7 /http \xB7 /router \xB7 /database \xB7 /pool \xB7 /repository \xB7 /migrations \xB7 /security \xB7 /session \xB7 /vault \xB7 /ratelimit \xB7 /xss \xB7 /websocket \xB7 /sse \xB7 /cache \xB7 /telemetry \xB7 /cluster \xB7 /cli \xB7 /multipart \xB7 /webhook \xB7 /exceptions \xB7 /browser \xB7 /resilience \xB7 /redis-cluster \xB7 /pg-ha", note: "Only http, database, pool, repository, migrations, security, session, ratelimit and cache were read; the rest are listed for existence only." }
    ]
  }
];
var EXAMPLES = [
  {
    slug: "hello-controller",
    title: "A minimal controller",
    summary: "streetApp, @Controller and @Get.",
    sample: { label: "src/main.ts", language: "ts", code: "import 'reflect-metadata';\nimport { Controller, Get } from 'streetjs';\nimport { streetApp } from 'streetjs/http';\n\n@Controller('/api/hello')\nclass HelloController {\n  @Get('/')\n  hello(ctx: { json(data: unknown, status?: number): void }) {\n    ctx.json({ message: 'hello' });\n  }\n}\n\nconst app = streetApp({ port: 3000 });\napp.registerController(HelloController);\nawait app.listen();" }
  },
  {
    slug: "validated-body",
    title: "Validating a request body",
    summary: "@Validate with FieldRule types.",
    sample: { label: "Controller method", language: "ts", code: "@Post('/')\n@Validate({ body: {\n  email: { type: 'email', required: true },\n  name:  { type: 'string', required: true, min: 1, max: 80 },\n} })\ncreate(ctx: { body: unknown; json(d: unknown, s?: number): void }) {\n  ctx.json({ created: true }, 201);\n}" }
  },
  {
    slug: "pool-transaction",
    title: "A Postgres transaction",
    summary: "PgPool.transaction with a guard checked via rowCount.",
    sample: { label: "Transfer with a WHERE guard", language: "ts", code: "await pool.transaction(async (conn) => {\n  const debit = await conn.query(\n    'UPDATE accounts SET balance = balance - $1 WHERE id = $2 AND balance >= $1',\n    ['500', 'a1'],\n  );\n  if (debit.rowCount !== 1) throw new Error('insufficient funds');\n  await conn.query('UPDATE accounts SET balance = balance + $1 WHERE id = $2', ['500', 'b2']);\n});" }
  },
  {
    slug: "run-migrations",
    title: "Running migrations at startup",
    summary: "StreetMigrationRunner with a migrations directory.",
    sample: { label: "bootstrap.ts", language: "ts", code: "import { StreetMigrationRunner } from 'streetjs';\n\nawait new StreetMigrationRunner(pool).run('./migrations');\n// ./migrations/001_create_users.sql\n// ./migrations/001_create_users.rollback.sql" }
  },
  {
    slug: "job-queue",
    title: "A background job",
    summary: "JobQueue.register, enqueue and a retry policy.",
    sample: { label: "jobs.ts", language: "ts", code: "const queue = new JobQueue(pool, { concurrency: 2 });\nqueue.setRetryPolicy('email.welcome', {\n  maxAttempts: 5, initialDelayMs: 1000, backoffMultiplier: 2, maxDelayMs: 60000,\n});\nqueue.register('email.welcome', async (payload, { attempt }) => { /* ... */ });\nawait queue.enqueue({ type: 'email.welcome', payload: { userId: '42' } });\nqueue.start();" }
  },
  {
    slug: "health-routes",
    title: "Health and job metrics routes",
    summary: "registerHealthRoutes and registerJobMetricsRoute.",
    sample: { label: "routes", language: "ts", code: "// registerHealthRoutes(app, registry)  -> GET /health/live, GET /health/ready\n// registerJobMetricsRoute(app, queue)    -> GET /api/jobs/metrics\n// Argument shapes beyond (app, ...) were not inspected; check your .d.ts." }
  }
];
var PLUGINS = [
  {
    id: "loadPlugin",
    title: "StreetHttpApp.loadPlugin / unloadPlugin",
    summary: "The application object exposes loadPlugin() and unloadPlugin(). Their parameter types were not inspected.",
    status: "Present in v1.2.8"
  },
  {
    id: "scoped-packages",
    title: "Scoped @streetjs/* packages",
    summary: "Twenty-one scoped packages (router, postgres, pool, repository, migrations, session, security, context, container, cache, cluster, exceptions, multipart, ratelimit, telemetry, webhook-dispatcher, websocket, xss, store, diagnostics, schema-inspector) are the framework's own modules, not third-party plugins.",
    status: "First-party packages"
  }
];
var PLUGINS_NOTE = "No official third-party plugin registry, marketplace or plugin list was found in the v1.2.8 package, so none is shown. This page will not list community plugins that cannot be verified.";
var CHANGELOG = [
  {
    version: "1.2.8",
    summary: "The version this website was checked against.",
    items: [
      "This is the only StreetJS version recorded here.",
      "No release notes or git history were available, so earlier versions and per-release changes are not listed.",
      "The package ships README.md and two example migrations (001_create_users.sql and its rollback).",
      "For release history, see the official documentation at https://hassanmubiru.github.io/StreetJS/."
    ]
  }
];
var BLOG_POSTS = [
  {
    slug: "every-column-is-a-string",
    title: "Every Postgres column is a string",
    summary: "The native driver does no type decoding. What that does to booleans, integers and dates.",
    tag: "Database",
    blocks: [
      p2("StreetJS ships its own PostgreSQL wire driver. It requests the text format and returns every column as a string or null. That is simple and fast to implement, and it has consequences you meet quickly."),
      list3(
        'A boolean is "t" or "f", so Boolean("f") is true.',
        'An integer is "5", and "10" < "9" is true when you sort strings.',
        'numeric stays "1299.00", unsafe as a float for money.',
        "A bigint can exceed Number.MAX_SAFE_INTEGER.",
        'A timestamptz looks like "2026-08-19 10:30:00+00", which is not ISO 8601.'
      ),
      p2("Convert once, at the boundary, and never return res.rows directly from an endpoint: it leaks snake_case column names and string values to clients.")
    ]
  },
  {
    slug: "global-rbac-guard",
    title: "The global rbacGuard that allows everything",
    summary: "Why an authorisation guard in globalMiddlewares quietly lets every request through.",
    tag: "Security",
    blocks: [
      p2("Dispatch is the last step in the middleware pipeline. The required roles and permissions are written to ctx.state when the matching route is dispatched, so a guard placed in globalMiddlewares runs before they exist and finds nothing to enforce."),
      p2("Attach the guard at @Controller(prefix, guard) or @Get(path, guard). Prefer a guard that takes its permissions explicitly at the call site, and check permissions rather than roles, because hasRole ignores the hierarchy.")
    ]
  },
  {
    slug: "csrf-and-login",
    title: "Why global CSRF protection breaks login",
    summary: "The first POST has no token yet.",
    tag: "Security",
    blocks: [
      p2("csrfMiddleware registered globally rejects any state-changing request without a token. Login, registration and password reset are exactly the requests a visitor makes before they have one, so each returns 403."),
      p2("A short custom middleware that only enforces CSRF when ctx.user is set solves it in about a dozen lines.")
    ]
  },
  {
    slug: "seeds-by-hash",
    title: "Seeds are tracked by content hash",
    summary: "Edit a seed and the whole file runs again.",
    tag: "Database",
    blocks: [
      p2("StreetSeeder records a hash of each seed file. Unchanged files are skipped; edited files execute in full again. Idempotent here means it will not run twice \u2014 not that running it twice is harmless."),
      p2("Write every statement with ON CONFLICT ... DO UPDATE. Keep a way to force a re-run, since the hash cannot tell that rows were deleted by hand.")
    ]
  },
  {
    slug: "scrypt-maxmem",
    title: "scrypt throws when maxmem is too low",
    summary: "No password hasher ships; here is what to watch for when you use node:crypto.",
    tag: "Security",
    blocks: [
      p2("Node's scrypt defaults to a 32 MiB memory limit, while it needs about 128 \xD7 N \xD7 r bytes. With N = 2^15 and r = 8 that already exceeds the limit, and Node throws RangeError ERR_CRYPTO_INVALID_SCRYPT_PARAMS synchronously \u2014 outside any callback."),
      p2("Wrap the call in try/catch inside the promise body and always pass maxmem. Memory use does not grow with p, so raising p is a cheap way to add cost.")
    ]
  },
  {
    slug: "errors-leak-infrastructure",
    title: "Framework 5xx errors can leak infrastructure names",
    summary: "DatabaseConnectionError exposes PG variable names.",
    tag: "Operations",
    blocks: [
      p2("When the database is unreachable, DatabaseConnectionError carries the PGHOST and PGPORT variable names in its details. Without a sanitising middleware those reach the client."),
      p2("Register a global middleware that trusts the HTTP status and replaces the body for 5xx responses. Place it early in globalMiddlewares.")
    ]
  },
  {
    slug: "logger-metadata-clobber",
    title: "Logger metadata can overwrite the message",
    summary: "message, level, timestamp and service are reserved.",
    tag: "Operations",
    blocks: [
      p2("Logger spreads your metadata object last. If it contains a key called message, level, timestamp or service, it replaces the real value in the output line. Nest error objects under err, and expect each line twice when NODE_ENV is development.")
    ]
  }
];
var ABOUT_FACTS = [
  { label: "npm package", value: "streetjs" },
  { label: "CLI package", value: "@streetjs/cli" },
  { label: "Version covered", value: "1.2.8" },
  { label: "Runtime", value: "Node >= 22, npm >= 10, ESM" },
  { label: "Bundled", value: "zod, reflect-metadata, ws" },
  { label: "Peer dependency", value: "typescript >= 5" },
  { label: "Official docs", value: "https://hassanmubiru.github.io/StreetJS/" }
];
var ABOUT_UNVERIFIED = [
  "Licence terms",
  "Repository URL, contributor list and release cadence",
  "Production users and adoption numbers",
  "Benchmark figures",
  "A scaffolding command (npx streetjs create)"
];
var PRIMARY_NAV = [
  { label: "Getting started", href: "/getting-started", id: "nav-getting-started" },
  { label: "Docs", href: "/docs", id: "nav-docs" },
  { label: "Guides", href: "/guides", id: "nav-guides" },
  { label: "API", href: "/api", id: "nav-api" },
  { label: "Examples", href: "/examples", id: "nav-examples" },
  { label: "Playground", href: "/playground", id: "nav-playground" },
  { label: "Plugins", href: "/plugins", id: "nav-plugins" },
  { label: "Changelog", href: "/changelog", id: "nav-changelog" },
  { label: "Blog", href: "/blog", id: "nav-blog" },
  { label: "About", href: "/about", id: "nav-about" }
];
var docBySlug = (slug) => DOCS.find((d) => d.slug === slug);
var guideBySlug = (slug) => GUIDES.find((g) => g.slug === slug);
var postBySlug = (slug) => BLOG_POSTS.find((b) => b.slug === slug);
function docNeighbours(slug) {
  const i = DOCS.findIndex((d) => d.slug === slug);
  const out = {};
  const prev = DOCS[i - 1];
  const next = DOCS[i + 1];
  if (i > 0 && prev !== void 0) out.prev = prev;
  if (i >= 0 && next !== void 0) out.next = next;
  return out;
}
var PAGES = [
  { title: "Getting started", kind: "Page", href: "/getting-started", summary: "Install StreetJS and run a first server.", keywords: "install npm begin tutorial quickstart" },
  { title: "Playground", kind: "Page", href: "/playground", summary: "Interactive tools built on StreetUI.", keywords: "try decoder migration secret health probe" },
  { title: "About", kind: "Page", href: "/about", summary: "What StreetJS is and what this site can and cannot claim.", keywords: "about project facts" }
];
var SEARCH_INDEX = [
  ...PAGES,
  ...DOCS.map((d) => ({
    title: d.title,
    kind: "Docs",
    href: `/docs/${d.slug}`,
    summary: d.summary,
    keywords: `${d.group} ${d.blocks.map((b) => "text" in b ? b.text : "items" in b ? b.items.join(" ") : b.sample.code).join(" ")}`
  })),
  ...GUIDES.map((g) => ({
    title: g.title,
    kind: "Guide",
    href: `/guides/${g.slug}`,
    summary: g.summary,
    keywords: `${g.level} ${g.blocks.map((b) => "text" in b ? b.text : "items" in b ? b.items.join(" ") : b.sample.code).join(" ")}`
  })),
  ...API_GROUPS.map((a) => ({
    title: a.title,
    kind: "API",
    href: "/api",
    summary: `${a.importPath} \u2014 ${a.summary}`,
    keywords: a.entries.map((e) => `${e.name} ${e.signature} ${e.note}`).join(" ")
  })),
  ...EXAMPLES.map((e) => ({
    title: e.title,
    kind: "Example",
    href: "/examples",
    summary: e.summary,
    keywords: e.sample.code
  })),
  ...PLUGINS.map((x) => ({
    title: x.title,
    kind: "Plugin",
    href: "/plugins",
    summary: x.summary,
    keywords: x.status
  })),
  ...CHANGELOG.map((c) => ({
    title: `Version ${c.version}`,
    kind: "Changelog",
    href: "/changelog",
    summary: c.summary,
    keywords: c.items.join(" ")
  })),
  ...BLOG_POSTS.map((b) => ({
    title: b.title,
    kind: "Blog",
    href: `/blog/${b.slug}`,
    summary: b.summary,
    keywords: `${b.tag} ${b.blocks.map((x) => "text" in x ? x.text : "items" in x ? x.items.join(" ") : x.sample.code).join(" ")}`
  }))
];
function searchContent(query, index = SEARCH_INDEX, limit = 12) {
  const terms = query.toLowerCase().split(/\s+/).filter((t7) => t7.length > 0);
  if (terms.length === 0) return [];
  const scored = [];
  index.forEach((doc, order) => {
    const title = doc.title.toLowerCase();
    const summary = doc.summary.toLowerCase();
    const keywords = doc.keywords.toLowerCase();
    let score = 0;
    for (const term of terms) {
      if (title.includes(term)) score += 3;
      else if (summary.includes(term)) score += 2;
      else if (keywords.includes(term)) score += 1;
      else return;
    }
    scored.push({ doc, score, order });
  });
  scored.sort((a, b) => b.score - a.score || a.order - b.order);
  return scored.slice(0, limit).map((s) => s.doc);
}
function createSearchState(initialQuery = "") {
  const query = signal(initialQuery);
  const open = signal(false);
  const results = derived(() => searchContent(query.get()));
  const isIdle = derived(() => query.get().trim() === "");
  const isEmpty = derived(() => !isIdle.get() && results.get().length === 0);
  const status = derived(() => {
    if (isIdle.get()) return "Type to search the docs, guides, API, examples, plugins, blog and changelog.";
    const n = results.get().length;
    return n === 0 ? "No results" : `${n} result${n === 1 ? "" : "s"}`;
  });
  return {
    query,
    open,
    results,
    isEmpty,
    isIdle,
    status,
    openSearch() {
      open.set(true);
    },
    closeSearch() {
      open.set(false);
      query.set("");
    }
  };
}
function resultId(doc) {
  const slug = `${doc.kind}-${doc.title}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return `search-result-${slug}`;
}
var SEARCH_INPUT_ID = "search-input";
var DOCS_SITE_URL = "https://hassanmubiru.github.io/StreetJS/";
function websiteShell(shell, ctx) {
  const { router, theme, search, menuOpen } = ctx;
  shell.section("skip", (s) => {
    s.link("Skip to content", { href: "#page-outlet", id: "skip-link", class: ds.skipLink });
  }, { id: "site-skip" });
  shell.section("nav", (n) => {
    n.container("nav-inner", (inner) => {
      inner.link("StreetJS", { href: "/", id: "brand", class: ds.brandLink });
      inner.container("nav-links", (links) => {
        for (const item of PRIMARY_NAV) navLink(links, router, item);
      }, { id: "nav-links", class: ds.navLinks });
      inner.container("nav-controls", (right) => {
        right.button("Search", {
          id: "search-trigger",
          ariaLabel: "Search (Ctrl+K)",
          onClick: () => search.openSearch(),
          class: ds.searchTrigger
        });
        right.button(theme.label, { id: "theme-toggle", onClick: () => theme.cycle(), class: ds.themeToggle });
        right.button(derived(() => menuOpen.get() ? "Close menu" : "Menu"), {
          id: "menu-toggle",
          ariaControls: "mobile-menu",
          onClick: () => menuOpen.set(!menuOpen.peek()),
          class: ds.menuToggle
        });
      }, { id: "nav-controls", class: ds.navControls });
    }, { id: "nav-inner", class: ds.navInner });
    n.when(menuOpen, (m) => {
      m.container("mobile-menu", (links) => {
        for (const item of PRIMARY_NAV) {
          navLink(links, router, { ...item, id: `m-${item.id}` }, ds.mobileMenuLink);
        }
      }, { id: "mobile-menu", class: ds.mobileMenu });
    });
  }, { id: "site-nav", class: ds.navBar });
  shell.dialog("search-dialog", {
    open: search.open,
    onClose: () => search.closeSearch(),
    initialFocusId: SEARCH_INPUT_ID,
    ariaLabel: "Search the StreetJS site",
    class: ds.searchPanel
  }, (d) => {
    d.container("search-header", (h2) => {
      h2.text("Search", { id: "search-title", class: ds.searchPanelTitle });
      h2.button("Close", { id: "search-close", onClick: () => search.closeSearch(), class: ds.buttonSecondary });
    }, { id: "search-header", class: ds.searchPanelHeader });
    d.input({
      id: SEARCH_INPUT_ID,
      type: "search",
      placeholder: "Search docs, guides, API, examples\u2026",
      ariaLabel: "Search query",
      bind: search.query,
      class: ds.searchDialogInput
    });
    d.text(search.status, { id: "search-status", class: ds.searchHint, ariaLive: "polite" });
    d.listOf("search-results", search.results, (item, _i, row2) => {
      const rid = resultId(item);
      row2.link(`${item.title} (${item.kind})`, { href: item.href, id: rid, class: ds.searchResultLink });
      row2.text(item.summary, { id: `${rid}-summary`, class: ds.searchResultMeta });
    }, { id: "search-results", class: ds.searchResultsList });
    d.when(search.isEmpty, (empty) => {
      empty.text('No matches. Try a shorter term such as "migration", "jwt" or "pool".', {
        id: "search-empty",
        class: ds.searchEmpty
      });
    });
  });
  if (ctx.renderOutlet !== void 0) {
    const fill = ctx.renderOutlet;
    shell.container(ROUTER_OUTLET_KEY, (c) => fill(c), { id: "page-outlet" });
  } else {
    routerOutlet(shell, "page-outlet");
  }
  shell.section("footer", (f) => {
    f.container("footer-inner", (fi) => {
      fi.text(
        "StreetJS is a TypeScript backend framework. This site is built entirely with StreetUI and records facts from the StreetJS v1.2.8 type declarations.",
        { id: "footer-text", class: ds.footerText }
      );
      fi.container("footer-links", (links) => {
        links.link("Official docs", { href: DOCS_SITE_URL, external: true, id: "footer-docs", class: ds.inlineLink });
        links.link("About this site", { href: "/about", id: "footer-about", class: ds.inlineLink });
        links.link("Changelog", { href: "/changelog", id: "footer-changelog", class: ds.inlineLink });
      }, { id: "footer-links", class: ds.footerLinks });
    }, { id: "footer-inner", class: ds.footerInner });
  }, { id: "site-footer", class: ds.footer });
}
function isKnownPath(path) {
  const clean = path.split("?")[0].split("#")[0].replace(/\/+$/, "") || "/";
  const fixed = [
    "/",
    "/getting-started",
    "/docs",
    "/guides",
    "/api",
    "/examples",
    "/playground",
    "/plugins",
    "/changelog",
    "/blog",
    "/about"
  ];
  if (fixed.includes(clean)) return true;
  const m = /^\/(docs|guides|blog)\/([^/]+)$/.exec(clean);
  if (m === null) return false;
  const slug = decodeURIComponent(m[2]);
  return m[1] === "docs" ? docBySlug(slug) !== void 0 : m[1] === "guides" ? guideBySlug(slug) !== void 0 : postBySlug(slug) !== void 0;
}
function allPaths() {
  return [
    "/",
    "/getting-started",
    "/docs",
    "/guides",
    "/api",
    "/examples",
    "/playground",
    "/plugins",
    "/changelog",
    "/blog",
    "/about",
    ...DOCS.map((d) => `/docs/${d.slug}`),
    ...GUIDES.map((g) => `/guides/${g.slug}`),
    ...BLOG_POSTS.map((b) => `/blog/${b.slug}`)
  ];
}
function renderBlocks(scope, blocks, idBase) {
  blocks.forEach((b, i) => {
    const id = `${idBase}-${i}`;
    switch (b.kind) {
      case "p":
        scope.text(b.text, { id, class: ds.bodyText });
        break;
      case "h":
        scope.heading(b.text, { level: 2, id, class: ds.sectionHeading });
        break;
      case "list":
        scope.container(id, (l) => {
          b.items.forEach((item, j) => l.text(item, { id: `${id}-${j}`, class: ds.bodyText, role: "listitem" }));
        }, { id, class: ds.linkList, role: "list" });
        break;
      case "code":
        codeExample(scope, b.sample, id);
        break;
      case "warn":
        scope.container(id, (w) => {
          w.text(b.text, { id: `${id}-text` });
        }, { id, class: ds.alert, role: "note" });
        break;
    }
  });
}
function linkCard(scope, idBase, title, href, summary, badge2) {
  scope.container(idBase, (c) => {
    c.link(title, { href, id: `${idBase}-link`, class: ds.inlineLink });
    if (badge2 !== void 0) c.text(badge2, { id: `${idBase}-badge`, class: ds.badge });
    c.text(summary, { id: `${idBase}-summary`, class: ds.metaText });
  }, { id: idBase, class: ds.card });
}
function notFoundBody(c, what) {
  c.text(`${what} Use search (Ctrl+K), or start from one of these pages.`, { id: "nf-text", class: ds.bodyText });
  c.container("nf-links", (l) => {
    l.link("Home", { href: "/", id: "nf-home", class: ds.inlineLink });
    l.link("Documentation", { href: "/docs", id: "nf-docs", class: ds.inlineLink });
    l.link("API reference", { href: "/api", id: "nf-api", class: ds.inlineLink });
  }, { id: "nf-links", class: ds.linkList });
}
var FEATURES = [
  { title: "HTTP with decorators", href: "/docs/http", text: "streetApp() plus @Controller, @Get, @Post and friends, with a StreetContext per request." },
  { title: "Native PostgreSQL", href: "/docs/database", text: "A built-in wire-protocol driver (PgPool). No pg package. Every column arrives as a string." },
  { title: "Migrations and seeds", href: "/docs/migrations", text: "StreetMigrationRunner tracks files by name; StreetSeeder tracks seeds by content hash." },
  { title: "JWT, sessions, RBAC", href: "/docs/jwt-sessions", text: "JwtService, SessionManager and RbacService, with the traps documented." },
  { title: "Jobs and workflows", href: "/docs/jobs", text: "JobQueue, CronScheduler, WorkflowEngine and SagaOrchestrator." },
  { title: "Health routes", href: "/docs/health", text: "HealthCheckRegistry and registerHealthRoutes serve /health/live and /health/ready." }
];
function buildRoutes(deps) {
  const { getRouter, playground, backend } = deps;
  return [
    {
      path: "/",
      builder: (page) => {
        pageLayout(page, {
          id: "home",
          title: "StreetJS",
          lead: "Production-grade TypeScript backend framework. Native PostgreSQL wire driver, JWT, WebSockets, clustering, runtime input validation, field-level encryption. No Express. No pg. No Prisma.",
          path: "/"
        }, (c) => {
          c.container("home-cta", (r) => {
            r.link("Get started", { href: "/getting-started", id: "cta-start", class: ds.buttonPrimary });
            r.link("Read the docs", { href: "/docs", id: "cta-docs", class: ds.buttonSecondary });
            r.link("Try the playground", { href: "/playground", id: "cta-playground", class: ds.buttonSecondary });
          }, { id: "home-cta", class: ds.ctaRow });
          provenanceNotice(c, "home-provenance");
          c.heading("What is documented here", { level: 2, id: "home-features-title", class: ds.sectionHeading });
          c.container("home-features", (g) => {
            FEATURES.forEach((f, i) => linkCard(g, `feature-${i}`, f.title, f.href, f.text));
          }, { id: "home-features", class: ds.cardGrid });
          c.heading("Read the sharp edges first", { level: 2, id: "home-traps-title", class: ds.sectionHeading });
          c.text("StreetJS has behaviours that surprise people: global rbacGuard authorises everything, no password hashing ships, and framework 5xx errors can expose database settings. They are written up plainly.", { id: "home-traps-text", class: ds.bodyText });
          c.container("home-trap-links", (l) => {
            l.link("Known traps", { href: "/docs/known-traps", id: "home-trap-doc", class: ds.inlineLink });
            l.link("Blog", { href: "/blog", id: "home-trap-blog", class: ds.inlineLink });
          }, { id: "home-trap-links", class: ds.linkList });
        });
      }
    },
    {
      path: "/getting-started",
      builder: (page) => {
        pageLayout(page, {
          id: "start",
          title: "Getting started",
          lead: "Install StreetJS and run a first server. There is no verified scaffolding command, so you start from a plain project.",
          path: "/getting-started"
        }, (c) => {
          provenanceNotice(c, "start-provenance");
          const install = docBySlug("installation");
          if (install !== void 0) renderBlocks(c, install.blocks, "start-install");
          const hello = EXAMPLES.find((e) => e.slug === "hello-controller");
          if (hello !== void 0) {
            c.heading("A first controller", { level: 2, id: "start-hello-title", class: ds.sectionHeading });
            c.text(hello.summary, { id: "start-hello-summary", class: ds.bodyText });
            codeExample(c, hello.sample, "start-hello");
          }
          c.heading("Next", { level: 2, id: "start-next-title", class: ds.sectionHeading });
          c.container("start-next", (l) => {
            l.link("HTTP app and controllers", { href: "/docs/http", id: "start-next-http", class: ds.inlineLink });
            l.link("Connect to PostgreSQL", { href: "/docs/database", id: "start-next-db", class: ds.inlineLink });
            l.link("Known traps", { href: "/docs/known-traps", id: "start-next-traps", class: ds.inlineLink });
          }, { id: "start-next", class: ds.linkList });
        });
      }
    },
    {
      path: "/docs",
      builder: (page) => {
        pageLayout(page, {
          id: "docs",
          title: "Documentation",
          lead: `${DOCS.length} pages across ${DOC_GROUPS.length} groups, recorded from the StreetJS v1.2.8 type declarations.`,
          path: "/docs"
        }, (c) => {
          provenanceNotice(c, "docs-provenance");
          DOC_GROUPS.forEach((group, gi) => {
            c.heading(group, { level: 2, id: `docs-group-${gi}`, class: ds.sectionHeading });
            c.container(`docs-cards-${gi}`, (g) => {
              DOCS.filter((d) => d.group === group).forEach((d) => {
                linkCard(g, `doc-card-${d.slug}`, d.title, `/docs/${d.slug}`, d.summary);
              });
            }, { id: `docs-cards-${gi}`, class: ds.cardGrid });
          });
          c.text(`Official documentation: ${DOCS_SITE_URL}`, { id: "docs-official", class: ds.metaText });
        });
      }
    },
    {
      path: "/docs/:section",
      builder: (page, ctx) => {
        const slug = ctx.params.section ?? "";
        const doc = docBySlug(slug);
        if (doc === void 0) {
          pageLayout(
            page,
            { id: "notfound", title: "Documentation page not found", lead: "There is no documentation page at this address.", path: ctx.path, robots: "noindex" },
            (c) => notFoundBody(c, `No page called "${slug}" exists.`)
          );
          return;
        }
        const { prev, next } = docNeighbours(doc.slug);
        pageLayout(page, { id: "doc", title: doc.title, lead: doc.summary, path: `/docs/${doc.slug}` }, (c) => {
          breadcrumb(c, [{ label: "Docs", href: "/docs" }, { label: doc.group }, { label: doc.title }], "doc-crumbs");
          c.container("doc-layout", (layout2) => {
            layout2.container("doc-sidebar", (s) => {
              DOC_GROUPS.forEach((group, gi) => {
                s.text(group, { id: `side-group-${gi}`, class: ds.docsSidebarGroup });
                DOCS.filter((d) => d.group === group).forEach((d) => {
                  navLink(s, getRouter(), { label: d.title, href: `/docs/${d.slug}`, id: `side-doc-${d.slug}`, exact: true }, ds.docsSidebarLink);
                });
              });
            }, { id: "doc-sidebar", class: ds.docsSidebar, role: "navigation", ariaLabel: "Documentation sections" });
            layout2.container("doc-content", (body2) => {
              provenanceNotice(body2, "doc-provenance");
              renderBlocks(body2, doc.blocks, "doc-block");
              body2.container("doc-pager", (p3) => {
                if (prev !== void 0) p3.link(`Previous: ${prev.title}`, { href: `/docs/${prev.slug}`, id: "doc-prev", class: ds.inlineLink });
                if (next !== void 0) p3.link(`Next: ${next.title}`, { href: `/docs/${next.slug}`, id: "doc-next", class: ds.inlineLink });
              }, { id: "doc-pager", class: ds.pagerRow });
            }, { id: "doc-content", class: ds.docsContent });
          }, { id: "doc-layout", class: ds.docsLayout });
        });
      }
    },
    {
      path: "/guides",
      builder: (page) => {
        pageLayout(page, {
          id: "guides",
          title: "Guides",
          lead: `${GUIDES.length} task-focused walkthroughs. Each links back to the reference pages it depends on.`,
          path: "/guides"
        }, (c) => {
          provenanceNotice(c, "guides-provenance");
          c.container("guides-cards", (g) => {
            GUIDES.forEach((x) => linkCard(g, `guide-card-${x.slug}`, x.title, `/guides/${x.slug}`, x.summary, x.level));
          }, { id: "guides-cards", class: ds.cardGrid });
        });
      }
    },
    {
      path: "/guides/:slug",
      builder: (page, ctx) => {
        const slug = ctx.params.slug ?? "";
        const guide = guideBySlug(slug);
        if (guide === void 0) {
          pageLayout(
            page,
            { id: "notfound", title: "Guide not found", lead: "There is no guide at this address.", path: ctx.path, robots: "noindex" },
            (c) => notFoundBody(c, `No guide called "${slug}" exists.`)
          );
          return;
        }
        pageLayout(page, { id: "guide", title: guide.title, lead: guide.summary, path: `/guides/${guide.slug}` }, (c) => {
          breadcrumb(c, [{ label: "Guides", href: "/guides" }, { label: guide.title }], "guide-crumbs");
          tagRow(c, [guide.level], "guide-tags");
          provenanceNotice(c, "guide-provenance");
          renderBlocks(c, guide.blocks, "guide-block");
        });
      }
    },
    {
      path: "/api",
      builder: (page) => {
        pageLayout(page, {
          id: "api",
          title: "API reference",
          lead: `${API_GROUPS.length} groups of the surface recorded from the v1.2.8 type declarations. Signatures are abbreviated; the .d.ts files are authoritative.`,
          path: "/api"
        }, (c) => {
          provenanceNotice(c, "api-provenance");
          API_GROUPS.forEach((g) => {
            c.container(`api-${g.id}`, (grp) => {
              grp.heading(g.title, { level: 2, id: `api-${g.id}-title`, class: ds.sectionHeading });
              grp.text(g.importPath, { id: `api-${g.id}-import`, class: ds.inlineCode });
              grp.text(g.summary, { id: `api-${g.id}-summary`, class: ds.bodyText });
              g.entries.forEach((e, i) => {
                grp.container(`api-${g.id}-e${i}`, (en) => {
                  en.text(e.name, { id: `api-${g.id}-e${i}-name`, class: ds.subHeading });
                  en.code(e.signature, { id: `api-${g.id}-e${i}-sig`, language: "ts", class: ds.codeSurface });
                  en.text(e.note, { id: `api-${g.id}-e${i}-note`, class: ds.metaText });
                }, { id: `api-${g.id}-e${i}`, class: ds.card });
              });
            }, { id: `api-${g.id}`, class: ds.pageBody });
          });
        });
      }
    },
    {
      path: "/examples",
      builder: (page) => {
        pageLayout(page, {
          id: "examples",
          title: "Examples",
          lead: `${EXAMPLES.length} examples using the StreetJS v1.2.8 API as recorded. They have not been executed against a live install by this site; run them against yours.`,
          path: "/examples"
        }, (c) => {
          provenanceNotice(c, "examples-provenance");
          EXAMPLES.forEach((e) => {
            c.container(`example-${e.slug}`, (x) => {
              x.heading(e.title, { level: 2, id: `example-${e.slug}-title`, class: ds.sectionHeading });
              x.text(e.summary, { id: `example-${e.slug}-summary`, class: ds.bodyText });
              codeExample(x, e.sample, `example-${e.slug}-code`);
            }, { id: `example-${e.slug}`, class: ds.pageBody });
          });
          c.text("Want to try behaviour interactively? The playground decodes pg rows, checks migration order and validates secret formats in your browser.", { id: "examples-playground", class: ds.bodyText });
          c.link("Open the playground", { href: "/playground", id: "examples-playground-link", class: ds.inlineLink });
        });
      }
    },
    {
      path: "/playground",
      builder: (page) => {
        pageLayout(page, {
          id: "playground",
          title: "Playground",
          lead: "Interactive tools built with StreetUI signals. They run in your browser and are teaching aids for documented StreetJS behaviour \u2014 they are not StreetJS APIs.",
          path: "/playground"
        }, (c) => {
          const pg = playground;
          c.container("tool-decoder", (t7) => {
            t7.heading("Decode pg rows", { level: 2, id: "tool-decoder-title", class: ds.sectionHeading });
            t7.text(`StreetJS\u2019s PostgreSQL driver returns every column as a string: booleans are 't'/'f', bigints stay strings, timestamps are not ISO 8601. Enter entries as "column | type | value", separated by semicolons.`, { id: "tool-decoder-help", class: ds.bodyText });
            t7.container("decoder-field", (f) => {
              f.text("Columns", { id: "decoder-label", class: ds.fieldLabel });
              f.input({ id: "decoder-input", type: "text", ariaLabel: "Columns to decode", bind: pg.decoderInput, class: ds.textInput });
            }, { id: "decoder-field", class: ds.fieldGroup });
            t7.container("decoder-presets", (r) => {
              r.button("Boolean", { id: "decoder-preset-bool", onClick: () => pg.decoderInput.set("active | boolean | t"), class: ds.buttonSecondary });
              r.button("Bigint", { id: "decoder-preset-bigint", onClick: () => pg.decoderInput.set("id | bigint | 9007199254740993"), class: ds.buttonSecondary });
              r.button("Timestamp", { id: "decoder-preset-ts", onClick: () => pg.decoderInput.set("created_at | timestamp | 2026-01-02 03:04:05.123456+00"), class: ds.buttonSecondary });
              r.button("Sample row", { id: "decoder-preset-sample", onClick: () => pg.decoderInput.set(DECODER_SAMPLE), class: ds.buttonSecondary });
            }, { id: "decoder-presets", class: ds.ctaRow });
            t7.text(pg.decoderSummary, { id: "decoder-summary", class: ds.metaText, ariaLive: "polite" });
            const rows = derived(() => pg.decoded.get().map((r, i) => ({
              id: `decoder-row-${i}`,
              line: `${r.ok ? "ok" : "problem"} \u2014 ${r.column} (${r.type}): ${r.result}`
            })));
            t7.listOf("decoder-rows", rows, (r, _i, row2) => {
              row2.text(r.line, { id: r.id, class: ds.outputRow });
            }, { id: "decoder-rows", class: ds.outputBox });
          }, { id: "tool-decoder", class: ds.toolPanel });
          c.container("tool-migrations", (t7) => {
            t7.heading("Check migration order", { level: 2, id: "tool-migrations-title", class: ds.sectionHeading });
            t7.text("StreetMigrationRunner tracks migrations by file name and runs them in lexicographic order, so numeric prefixes must be zero-padded to the same width. Enter file names separated by commas; .rollback.sql files are ignored.", { id: "tool-migrations-help", class: ds.bodyText });
            t7.container("migrations-field", (f) => {
              f.text("File names", { id: "migrations-label", class: ds.fieldLabel });
              f.input({ id: "migrations-input", type: "text", ariaLabel: "Migration file names", bind: pg.migrationInput, class: ds.textInput });
            }, { id: "migrations-field", class: ds.fieldGroup });
            t7.text(pg.migrationSummary, { id: "migrations-summary", class: ds.metaText, ariaLive: "polite" });
            const order = derived(() => pg.migrations.get().order.map((name, i) => ({ id: `migration-order-${i}`, line: `${i + 1}. ${name}` })));
            const problems = derived(() => pg.migrations.get().problems.map((p3, i) => ({ id: `migration-problem-${i}`, line: `problem \u2014 ${p3}` })));
            t7.listOf("migrations-order", order, (r, _i, row2) => {
              row2.text(r.line, { id: r.id, class: ds.outputRow });
            }, { id: "migrations-order", class: ds.outputBox });
            t7.listOf("migrations-problems", problems, (r, _i, row2) => {
              row2.text(r.line, { id: r.id, class: ds.outputRow });
            }, { id: "migrations-problems", class: ds.outputBox });
          }, { id: "tool-migrations", class: ds.toolPanel });
          c.container("tool-secrets", (t7) => {
            t7.heading("Check secret formats", { level: 2, id: "tool-secrets-title", class: ds.sectionHeading });
            t7.text("JwtService needs a secret of at least 32 characters; SessionManager needs exactly 64 hex characters. This checks format only. Nothing leaves your browser, but do not paste a real production secret into any web page.", { id: "tool-secrets-help", class: ds.bodyText });
            t7.container("secrets-field", (f) => {
              f.text("Candidate secret", { id: "secrets-label", class: ds.fieldLabel });
              f.input({ id: "secrets-input", type: "password", ariaLabel: "Candidate secret", bind: pg.secretInput, class: ds.textInput });
            }, { id: "secrets-field", class: ds.fieldGroup });
            const checks = derived(() => pg.secrets.get().map((s, i) => ({ id: `secret-check-${i}`, line: `${s.ok ? "ok" : "problem"} \u2014 ${s.label}: ${s.detail}` })));
            t7.listOf("secrets-results", checks, (r, _i, row2) => {
              row2.text(r.line, { id: r.id, class: ds.outputRow });
            }, { id: "secrets-results", class: ds.outputBox });
          }, { id: "tool-secrets", class: ds.toolPanel });
          c.container("tool-backend", (t7) => {
            t7.heading("Probe a running StreetJS app", { level: 2, id: "tool-backend-title", class: ds.sectionHeading });
            t7.text("This site has no backend of its own. Point it at a running StreetJS app and it requests the three routes the framework provides when registered: /health/live, /health/ready (registerHealthRoutes) and /api/jobs/metrics (registerJobMetricsRoute). Your app must allow this site\u2019s origin through CORS.", { id: "tool-backend-help", class: ds.bodyText });
            t7.container("backend-field", (f) => {
              f.text("Base URL", { id: "backend-label", class: ds.fieldLabel });
              f.input({ id: "backend-input", type: "text", placeholder: "http://localhost:3000", ariaLabel: "StreetJS app base URL", bind: backend.baseUrl, class: ds.textInput });
            }, { id: "backend-field", class: ds.fieldGroup });
            t7.when(derived(() => backend.urlError.get() !== ""), (e) => {
              e.text(backend.urlError, { id: "backend-url-error", class: ds.errorBox, role: "alert" });
            });
            t7.button("Probe", { id: "backend-run", onClick: () => {
              void backend.run();
            }, class: ds.buttonPrimary });
            t7.text(backend.summary, { id: "backend-summary", class: ds.metaText, ariaLive: "polite" });
            const probes = derived(() => backend.results.get().map((r, i) => ({ id: `probe-${i}`, line: `${r.state} \u2014 ${r.path}: ${r.detail}` })));
            t7.listOf("backend-results", probes, (r, _i, row2) => {
              row2.text(r.line, { id: r.id, class: ds.outputRow });
            }, { id: "backend-results", class: ds.outputBox });
          }, { id: "tool-backend", class: ds.toolPanel });
        });
      }
    },
    {
      path: "/plugins",
      builder: (page) => {
        pageLayout(page, {
          id: "plugins",
          title: "Plugins",
          lead: "What the v1.2.8 package actually provides for extension \u2014 and what it does not.",
          path: "/plugins"
        }, (c) => {
          c.container("plugins-note", (n) => {
            n.text(PLUGINS_NOTE, { id: "plugins-note-text" });
          }, { id: "plugins-note", class: ds.notice, role: "note" });
          c.container("plugins-cards", (g) => {
            PLUGINS.forEach((p3) => {
              g.container(`plugin-${p3.id}`, (x) => {
                x.heading(p3.title, { level: 3, id: `plugin-${p3.id}-title`, class: ds.subHeading });
                x.text(p3.status, { id: `plugin-${p3.id}-status`, class: ds.badge });
                x.text(p3.summary, { id: `plugin-${p3.id}-summary`, class: ds.bodyText });
              }, { id: `plugin-${p3.id}`, class: ds.card });
            });
          }, { id: "plugins-cards", class: ds.cardGrid });
          c.link("API reference for loadPlugin", { href: "/api", id: "plugins-api", class: ds.inlineLink });
        });
      }
    },
    {
      path: "/changelog",
      builder: (page) => {
        pageLayout(page, {
          id: "changelog",
          title: "Changelog",
          lead: "Only what is known. No release notes were available to this site, so there is no invented history.",
          path: "/changelog"
        }, (c) => {
          CHANGELOG.forEach((entry) => {
            c.container(`release-${entry.version}`, (r) => {
              r.heading(`Version ${entry.version}`, { level: 2, id: `release-${entry.version}-title`, class: ds.sectionHeading });
              r.text(entry.summary, { id: `release-${entry.version}-summary`, class: ds.bodyText });
              r.container(`release-${entry.version}-items`, (l) => {
                entry.items.forEach((item, i) => l.text(item, { id: `release-${entry.version}-item-${i}`, class: ds.bodyText, role: "listitem" }));
              }, { id: `release-${entry.version}-items`, class: ds.linkList, role: "list" });
            }, { id: `release-${entry.version}`, class: ds.card });
          });
          c.link("Official documentation", { href: DOCS_SITE_URL, external: true, id: "changelog-official", class: ds.inlineLink });
        });
      }
    },
    {
      path: "/blog",
      builder: (page) => {
        pageLayout(page, {
          id: "blog",
          title: "Blog",
          lead: "Short notes on StreetJS behaviours that are easy to get wrong. Each one is something the v1.2.8 type declarations or measurements back up.",
          path: "/blog"
        }, (c) => {
          c.container("blog-cards", (g) => {
            BLOG_POSTS.forEach((b) => linkCard(g, `post-card-${b.slug}`, b.title, `/blog/${b.slug}`, b.summary, b.tag));
          }, { id: "blog-cards", class: ds.cardGrid });
        });
      }
    },
    {
      path: "/blog/:slug",
      builder: (page, ctx) => {
        const slug = ctx.params.slug ?? "";
        const post = postBySlug(slug);
        if (post === void 0) {
          pageLayout(
            page,
            { id: "notfound", title: "Post not found", lead: "There is no post at this address.", path: ctx.path, robots: "noindex" },
            (c) => notFoundBody(c, `No post called "${slug}" exists.`)
          );
          return;
        }
        pageLayout(page, { id: "post", title: post.title, lead: post.summary, path: `/blog/${post.slug}` }, (c) => {
          breadcrumb(c, [{ label: "Blog", href: "/blog" }, { label: post.title }], "post-crumbs");
          tagRow(c, [post.tag], "post-tags");
          provenanceNotice(c, "post-provenance");
          renderBlocks(c, post.blocks, "post-block");
        });
      }
    },
    {
      path: "/about",
      builder: (page) => {
        pageLayout(page, {
          id: "about",
          title: "About",
          lead: "What StreetJS is, what this site records about it, and what it cannot tell you.",
          path: "/about"
        }, (c) => {
          c.heading("Verified facts", { level: 2, id: "about-facts-title", class: ds.sectionHeading });
          c.container("about-facts", (f) => {
            ABOUT_FACTS.forEach((fact, i) => {
              f.container(`about-fact-${i}`, (r) => {
                r.text(fact.label, { id: `about-fact-${i}-label`, class: ds.fieldLabel });
                r.text(fact.value, { id: `about-fact-${i}-value`, class: ds.inlineCode });
              }, { id: `about-fact-${i}`, class: ds.card });
            });
          }, { id: "about-facts", class: ds.cardGrid });
          provenanceNotice(c, "about-provenance");
          c.heading("Not verified, so not claimed", { level: 2, id: "about-unverified-title", class: ds.sectionHeading });
          c.container("about-unverified", (l) => {
            ABOUT_UNVERIFIED.forEach((u, i) => l.text(u, { id: `about-unverified-${i}`, class: ds.bodyText, role: "listitem" }));
          }, { id: "about-unverified", class: ds.linkList, role: "list" });
          c.heading("About this site", { level: 2, id: "about-site-title", class: ds.sectionHeading });
          c.text("This is one site: documentation, guides, API reference, examples, playground, plugins, changelog and blog share one shell, router, theme, design system and search. It is written entirely with StreetUI.", { id: "about-site-text", class: ds.bodyText });
          c.link("Official StreetJS documentation", { href: DOCS_SITE_URL, external: true, id: "about-official", class: ds.inlineLink });
        });
      }
    },
    {
      path: "*",
      builder: (page, ctx) => {
        pageLayout(
          page,
          { id: "notfound", title: "Page not found", lead: "That page does not exist.", path: ctx.path, robots: "noindex" },
          (c) => notFoundBody(c, "Nothing lives at this address.")
        );
      }
    }
  ];
}
var THEME_STORAGE_KEY = "streetjs-theme";
var CHOICES = ["light", "dark", "system"];
function defaultThemeStorage() {
  try {
    if (typeof localStorage !== "undefined") {
      return {
        read() {
          const v = localStorage.getItem(THEME_STORAGE_KEY);
          return v === "light" || v === "dark" || v === "system" ? v : null;
        },
        write(choice) {
          try {
            localStorage.setItem(THEME_STORAGE_KEY, choice);
          } catch {
          }
        }
      };
    }
  } catch {
  }
  let mem = null;
  return { read: () => mem, write: (c) => {
    mem = c;
  } };
}
function systemPrefersDark() {
  try {
    return typeof matchMedia !== "undefined" && matchMedia("(prefers-color-scheme: dark)").matches;
  } catch {
    return false;
  }
}
function createTheme(options = {}) {
  const storage = options.storage ?? defaultThemeStorage();
  const choice = signal(storage.read() ?? options.initial ?? "system");
  const resolved = derived(() => {
    const c = choice.get();
    if (c === "system") return systemPrefersDark() ? "dark" : "light";
    return c;
  });
  const label2 = derived(() => {
    const c = choice.get();
    return c === "light" ? "Theme: Light" : c === "dark" ? "Theme: Dark" : "Theme: System";
  });
  const root = options.root ?? (typeof document !== "undefined" ? document.documentElement : null);
  const stop = root !== null ? effect(() => {
    root.setAttribute("data-theme", resolved.get());
  }) : () => {
  };
  return {
    choice,
    resolved,
    label: label2,
    set(next) {
      choice.set(next);
      storage.write(next);
    },
    cycle() {
      const i = CHOICES.indexOf(choice.get());
      const next = CHOICES[(i + 1) % CHOICES.length];
      choice.set(next);
      storage.write(next);
    },
    dispose() {
      stop();
    }
  };
}
var STATE_KEY = "streetjs-website";
function renderWebsite(path, options = {}) {
  if (options.siteUrl !== void 0) configureSite({ baseUrl: options.siteUrl });
  const playground = createPlayground();
  const backend = createBackendPanel();
  const search = createSearchState();
  const theme = createTheme({ storage: { read: () => null, write: () => {
  } } });
  const menuOpen = signal(false);
  let routerRef;
  const routes = buildRoutes({
    getRouter: () => {
      if (routerRef === void 0) throw new Error("router accessed before it was created");
      return routerRef;
    },
    playground,
    backend
  });
  const router = createRouter({ routes, history: createMemoryHistory(path) });
  routerRef = router;
  const match = router.currentRoute.get();
  const ctx = {
    path: match.path,
    pattern: match.pattern,
    params: match.params,
    query: match.query,
    onCleanup: () => {
    }
  };
  const app = streetui.app({ name: "streetjs-website", version: "1.0.0" });
  app.page("website", (page) => {
    websiteShell(page, {
      router,
      theme,
      search,
      menuOpen,
      renderOutlet: (content) => {
        match.route.builder(content, ctx);
      }
    });
  });
  const compiled = compile(app);
  const html = renderToString(compiled);
  const head = renderHead(compiled);
  const themeChoice = theme.choice.get();
  theme.dispose();
  router.destroy();
  return {
    html,
    head,
    stateScript: serializeState({ [STATE_KEY]: { path, themeChoice } }),
    styles: renderStyles({ registry: styleRegistry }),
    status: isKnownPath(match.path) ? 200 : 404
  };
}

// netlify/functions/ssr-source.mjs
var THEME_SCRIPT = "try{var c=localStorage.getItem('streetjs-theme');var d=c==='dark'||((c===null||c==='system')&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.setAttribute('data-theme',d?'dark':'light')}catch(e){}";
var themeHash = `'sha256-${createHash("sha256").update(THEME_SCRIPT).digest("base64")}'`;
var SECURITY_HEADERS = {
  "content-type": "text/html; charset=utf-8",
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "x-frame-options": "DENY",
  "content-security-policy": `default-src 'self'; script-src 'self' ${themeHash}; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src http: https:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`
};
function documentHtml(r) {
  return `<!doctype html>
<html lang="en">
<head>
${r.head}
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
${r.styles}
<script>${THEME_SCRIPT}</script>
</head>
<body>
<div id="app" data-ssr>${r.html}</div>
${r.stateScript}
<script type="module" src="/browser-entry.js"></script>
</body>
</html>`;
}
var ssr_source_default = async (req) => {
  try {
    const url = new URL(req.url);
    const siteUrl = url.origin;
    const pathname = decodeURIComponent(url.pathname);
    if (pathname === "/robots.txt") {
      return new Response(`User-agent: *
Allow: /
Sitemap: ${siteUrl}/sitemap.xml
`, {
        headers: { "content-type": "text/plain; charset=utf-8" }
      });
    }
    if (pathname === "/sitemap.xml") {
      const body2 = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allPaths().map((p3) => `<url><loc>${siteUrl}${p3}</loc></url>`).join("\n")}
</urlset>
`;
      return new Response(body2, { headers: { "content-type": "application/xml; charset=utf-8" } });
    }
    const rendered = renderWebsite(pathname + url.search, { siteUrl });
    return new Response(documentHtml(rendered), {
      status: rendered.status,
      headers: SECURITY_HEADERS
    });
  } catch (err) {
    console.error(err);
    return new Response("Internal server error", { status: 500 });
  }
};
var config = { path: "/*" };
export {
  config,
  ssr_source_default as default
};
