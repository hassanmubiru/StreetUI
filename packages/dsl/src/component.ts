/**
 * First-class StreetUI-native components (§3–§9).
 *
 * A component is a *reusable unit that owns its own local state and lifecycle*.
 * It is NOT a virtual-DOM element, a second reactive system, or a second
 * renderer. It compiles into the EXISTING pipeline: `container.component(...)`
 * creates a reserved `'component'` GraphNode (already a `SemanticNodeType`,
 * already mapped to `<div>`), runs the component's `setup` synchronously during
 * the same build-time descent every other builder uses, and routes any cleanups
 * the setup registers into the node's `NodeInstance` at mount (so they run,
 * children-first, when the component leaves the graph).
 *
 * Design (derived from the existing DSL architecture, not copied from React/Vue):
 *
 *   const UserCard = component<{ name: Signal<string> }>((props, ctx) => {
 *     // ── setup: runs ONCE per instance, at build time ──
 *     const open = signal(false);
 *     ctx.effect(() => { ... });            // auto-disposed on unmount
 *     ctx.onCleanup(() => { ... });         // explicit teardown hook
 *     // ── render: fills the component's own container scope ──
 *     return (content) => {
 *       content.text(props.name);           // fine-grained: signal prop, no re-setup
 *       content.when(open, (c) => c.text('expanded'));
 *       ctx.renderChildren(content);        // where slotted children go (§6)
 *     };
 *   }, { name: 'UserCard' });
 *
 *   page.component('card-1', UserCard, { name }, (slot) => slot.text('child'));
 *
 * Props are ordinary typed values (§5 — typing is a TypeScript concern, no
 * runtime schema). Passing a `Signal<T>` prop and binding it in the render body
 * gives fine-grained updates (§13) WITHOUT re-running `setup`: only the bound
 * node mutates when the signal changes. `setup` re-runs only when the component
 * is genuinely rebuilt (removed + re-created by a keyed list / conditional),
 * at which point the previous instance is disposed first — so cleanup stays
 * correct.
 */

import type { ContainerDSL, ContainerBuilder } from './dsl-types.js';

/**
 * The render half of a component: fills the component's own container scope.
 * Returned by `setup` so that per-instance state created in `setup` is captured
 * by closure and the render body can read it.
 */
export type ComponentRender = (content: ContainerDSL) => void;

/**
 * Lifecycle + composition surface handed to a component's `setup`. Local
 * reactive state is created with the EXISTING `signal`/`derived`/`effect`/
 * `batch` primitives (§8) — `ctx` only adds ownership: anything registered here
 * is torn down automatically when the component leaves the graph (§9).
 */
export interface ComponentContext {
  /** This instance's stable identity key (the `key` passed at the call site). */
  readonly key: string;
  /**
   * Register a teardown callback. Runs when the component unmounts (children
   * first, then this — mirroring `NodeInstance.dispose`). Use for resources,
   * `form.dispose`, subscriptions, timers, etc.
   */
  onCleanup(fn: () => void): void;
  /**
   * Run a reactive effect owned by this component. Wraps the framework's
   * `effect()`; the returned unsubscribe is auto-tracked and disposed on
   * unmount, so component effects never leak (the pain point the audit ranked
   * #1). The effect may itself return a cleanup, exactly like `effect()`.
   */
  effect(fn: () => void | (() => void)): void;
  /**
   * Render the caller-supplied children into `content` at this point (§6 native
   * child composition / slots). No-op when the call site passed no children.
   * Call it wherever the component wants its slotted content to appear.
   */
  renderChildren(content: ContainerDSL): void;
}

/**
 * A component's setup function: receives typed props and the lifecycle context,
 * creates any local state, and returns the render function. Runs synchronously
 * during the build-time descent (like `errorBoundary`'s callback), so it must be
 * SSR-safe — on the server it runs at render time and its cleanups run when the
 * SSR root is disposed.
 */
export type ComponentSetup<P> = (props: P, ctx: ComponentContext) => ComponentRender;

/**
 * The opaque, reusable definition produced by `component(...)`. Carries the
 * `setup` and an inspectable `name`; the brand lets the builder method (and
 * DevTools) recognise a definition at runtime without a class.
 */
export interface ComponentDefinition<P> {
  readonly __streetui_component: true;
  readonly name: string;
  readonly setup: ComponentSetup<P>;
}

/**
 * Define a reusable component. Returns a `ComponentDefinition` you render with
 * `container.component(key, def, props, children?)`. This is a pure factory — it
 * builds no graph and runs no `setup`; instantiation happens per call site.
 *
 * @param setup  Runs once per instance: create local state, return the render fn.
 * @param options.name  Human-readable name for DevTools/`data-streetui-component`.
 */
export function component<P = Record<string, never>>(
  setup: ComponentSetup<P>,
  options: { name?: string } = {},
): ComponentDefinition<P> {
  return {
    __streetui_component: true,
    name: options.name ?? setup.name ?? 'Component',
    setup,
  };
}

/** Runtime guard: is `value` a component definition? */
export function isComponentDefinition(value: unknown): value is ComponentDefinition<unknown> {
  return (
    value !== null &&
    typeof value === 'object' &&
    (value as { __streetui_component?: unknown }).__streetui_component === true
  );
}

export type { ContainerBuilder as ComponentChildren };
