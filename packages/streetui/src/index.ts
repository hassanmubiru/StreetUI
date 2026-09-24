/**
 * # StreetUI
 *
 * The complete StreetUI framework, exposed as a single import surface.
 *
 * ```ts
 * import { signal, streetui, compile, createRuntime, createRenderer } from 'streetui';
 * ```
 *
 * StreetUI is internally modular — reactivity, the semantic DSL, the compiler,
 * the semantic application graph, the runtime, the DOM renderer, the router,
 * async resources, forms, context, i18n, devtools and the CLI each live in their
 * own internal module — but a framework user installs and imports only
 * `streetui`. Server-only helpers are also available from `streetui/server`, and
 * the testing utilities from `streetui/testing`.
 *
 * This entry re-exports the **already-implemented, stable public API** of each
 * subsystem. It does not introduce any new API: StreetUI's UI layer is a
 * semantic *builder* DSL (`streetui.app(...)`, `page.section(s => s.button(...))`),
 * not a set of free element functions.
 */

// ── Framework version (single authoritative source; see ./version.ts) ────────
export { VERSION } from './version.js';

// ── Reactivity: signals, derived state, effects, batching, stores, resources ─
// signal, derived, computed, effect, batch, resource, store, …
export * from '@streetui/state';

// ── Core: application identity, lifecycle, diagnostics, environment, a11yIds ──
export * from '@streetui/core';

// ── Semantic application graph ────────────────────────────────────────────────
export * from '@streetui/graph';

// ── Semantic UI DSL: streetui.app(...), builders, DSL types ───────────────────
export * from '@streetui/dsl';

// ── Compiler: compile(app) → compiled application ─────────────────────────────
export * from '@streetui/compiler';

// ── Runtime: createRuntime, mount, lifecycle wiring ───────────────────────────
export * from '@streetui/runtime';

// ── Events: event bus + DOM event bridge ──────────────────────────────────────
export * from '@streetui/events';

// ── Scheduler: batched microtask scheduler ────────────────────────────────────
export * from '@streetui/scheduler';

// ── DOM adapters: BrowserDOMAdapter, ServerDOMAdapter ─────────────────────────
export * from '@streetui/dom';

// ── Renderer: createRenderer, mount/patch/reconcile, SSR (renderToString,
//    serializeState, readState) and hydrate ──────────────────────────────────
export * from '@streetui/renderer';

// ── Router: createRouter, navigation, route lifecycle, active links ───────────
export * from '@streetui/router';

// ── Forms: createForm + validators (required, email, minLength, …) ────────────
export * from '@streetui/forms';

// ── Context: createContext, provide/consume (no prop drilling) ────────────────
export * from '@streetui/context';

// ── Internationalization: createI18n (reactive, typed) ────────────────────────
export * from '@streetui/i18n';

// ── DevTools foundations: createDevTools + reactive inspectors ────────────────
export * from '@streetui/devtools';

// ── Project configuration (used by streetui.config.ts) ────────────────────────
// Selective re-export from the CLI so `defineConfig` is importable from
// `streetui` without pulling the CLI's runtime surface into the main barrel.
export { defineConfig } from '@streetui/cli';
export type { StreetUIConfig, ResolvedConfig } from '@streetui/cli';
