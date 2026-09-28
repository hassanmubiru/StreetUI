import { ReadonlySignal, Signal } from '@streetui/state';
import { ApplicationGraph, GraphNode } from '@streetui/graph';

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

/**
 * The render half of a component: fills the component's own container scope.
 * Returned by `setup` so that per-instance state created in `setup` is captured
 * by closure and the render body can read it.
 */
type ComponentRender = (content: ContainerDSL) => void;
/**
 * Lifecycle + composition surface handed to a component's `setup`. Local
 * reactive state is created with the EXISTING `signal`/`derived`/`effect`/
 * `batch` primitives (§8) — `ctx` only adds ownership: anything registered here
 * is torn down automatically when the component leaves the graph (§9).
 */
interface ComponentContext {
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
type ComponentSetup<P> = (props: P, ctx: ComponentContext) => ComponentRender;
/**
 * The opaque, reusable definition produced by `component(...)`. Carries the
 * `setup` and an inspectable `name`; the brand lets the builder method (and
 * DevTools) recognise a definition at runtime without a class.
 */
interface ComponentDefinition<P> {
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
declare function component<P = Record<string, never>>(setup: ComponentSetup<P>, options?: {
    name?: string;
}): ComponentDefinition<P>;
/** Runtime guard: is `value` a component definition? */
declare function isComponentDefinition(value: unknown): value is ComponentDefinition<unknown>;

/**
 * Transition configuration (§2, §4).
 *
 * A `TransitionConfig` is a pure, declarative description of a CSS class-based
 * enter/leave transition — the engine choice for this milestone. It contains NO
 * DOM references, NO timers and NO browser-only APIs, so it is safe to build on
 * the server (where it is simply ignored — see the renderer's SSR guard) and to
 * carry on a graph handler (`__transition__<nodeId>`) alongside the existing
 * `__overlay__`/`__component__` descriptors.
 *
 * The class model follows the widely-understood enter/leave convention:
 *
 *   enter:  [enterActive (+ enter) whole phase] · enterFrom (start) → enterTo (end)
 *   leave:  [leaveActive (+ leave) whole phase] · leaveFrom (start) → leaveTo (end)
 *
 * `name` is a shorthand that expands to `${name}-enter-from`,
 * `${name}-enter-active`, `${name}-enter-to` and the leave equivalents; explicit
 * class fields override the derived ones. Because the classes are just strings,
 * SSR output is deterministic (no class is applied on the server at all — the
 * controller is browser-only), satisfying §4/§21.
 */
interface TransitionConfig {
    /** Shorthand base: expands to `${name}-enter-from`, `${name}-enter-active`, … */
    readonly name?: string;
    /** Class(es) present for the whole enter phase (in addition to `enterActive`). */
    readonly enter?: string;
    /** Class(es) applied at the start of enter, removed on the next frame. */
    readonly enterFrom?: string;
    /** Class(es) present for the whole enter phase (where the CSS `transition` lives). */
    readonly enterActive?: string;
    /** Class(es) added on the next frame, removed when enter completes. */
    readonly enterTo?: string;
    /** Class(es) present for the whole leave phase (in addition to `leaveActive`). */
    readonly leave?: string;
    /** Class(es) applied at the start of leave, removed on the next frame. */
    readonly leaveFrom?: string;
    /** Class(es) present for the whole leave phase (where the CSS `transition` lives). */
    readonly leaveActive?: string;
    /** Class(es) added on the next frame, removed when leave completes. */
    readonly leaveTo?: string;
    /**
     * Also animate the very first appearance (initial mount). Hydration never
     * animates appear (the DOM is already present and correct); this only affects
     * fresh browser mounts. Defaults to false.
     */
    readonly appear?: boolean;
    /**
     * Fallback completion timeout in milliseconds. A transition normally completes
     * on the element's `transitionend`/`animationend`. This timeout is the safety
     * net for (a) transitions that fire no such event and (b) test DOMs like
     * happy-dom that dispatch no transition events at all — making tests
     * deterministic without a real browser (§24). Defaults to 1000. Use a small
     * value (or 0 → next macrotask) in tests.
     */
    readonly duration?: number;
}
/**
 * The resolved, ready-to-apply form of a {@link TransitionConfig}: each phase's
 * classes are pre-split into arrays so the controller applies/removes them with
 * no per-run string parsing. Produced once by {@link resolveTransition} at wire
 * time (browser only).
 */
interface ResolvedTransition {
    /** enter classes present for the whole phase (base `enter` + `enterActive`). */
    readonly enterActive: readonly string[];
    /** enter start classes (removed next frame). */
    readonly enterFrom: readonly string[];
    /** enter end classes (added next frame). */
    readonly enterTo: readonly string[];
    readonly leaveActive: readonly string[];
    readonly leaveFrom: readonly string[];
    readonly leaveTo: readonly string[];
    readonly appear: boolean;
    readonly duration: number;
}
/**
 * Resolve a {@link TransitionConfig} into applied class arrays. The `name`
 * shorthand supplies defaults; any explicit field overrides the derived class
 * for that phase-slot (still merged with `enter`/`leave` base classes).
 */
declare function resolveTransition(config: TransitionConfig): ResolvedTransition;
/** Runtime brand check for a transition descriptor value. */
declare function isTransitionConfig(value: unknown): value is TransitionConfig;

/**
 * StreetUI DSL type system.
 * All builder callbacks and option shapes live here.
 */

type Bindable<T> = T | ReadonlySignal<T> | Signal<T>;
type TextValue = string | number | boolean;
type BindableText = TextValue | ReadonlySignal<TextValue>;
/**
 * Accessibility options shared by every element builder.
 *
 * These map to standard HTML/ARIA attributes and flow straight through to the
 * DOM via the renderer's generic attribute pass — there is no separate ARIA
 * abstraction to keep in sync. Prefer semantic HTML (button/a/input/etc.) and
 * only reach for these when semantics alone are insufficient. `id` (already
 * present on each option type) combined with the deterministic `a11yIds()`
 * helper in `@streetui/core` is how label/description/title associations are
 * wired in an SSR/hydration-safe way.
 */
interface A11yOptions {
    /** ARIA role (e.g. 'dialog', 'alert', 'status', 'navigation'). */
    readonly role?: string;
    /** tabindex value. Use 0 to make an element focusable, -1 to remove from tab order. */
    readonly tabIndex?: number;
    /** aria-label — an accessible name when no visible label element exists. */
    readonly ariaLabel?: string;
    /** aria-labelledby — id(s) of the element(s) that label this one. */
    readonly ariaLabelledBy?: string;
    /** aria-describedby — id(s) of the element(s) that describe this one. */
    readonly ariaDescribedBy?: string;
    /** aria-expanded — for disclosure widgets (rendered as the string "true"/"false"). */
    readonly ariaExpanded?: boolean;
    /** aria-controls — id of the element this one controls. */
    readonly ariaControls?: string;
    /** aria-hidden — hide decorative content from assistive tech. */
    readonly ariaHidden?: boolean;
    /** aria-live — announce dynamic changes ('polite' | 'assertive' | 'off'). */
    readonly ariaLive?: 'off' | 'polite' | 'assertive';
    /** aria-current — mark the current item in a set (e.g. 'page' for active nav). */
    readonly ariaCurrent?: boolean | 'page' | 'step' | 'location' | 'date' | 'time';
    /** aria-invalid — mark a form field as failing validation. */
    readonly ariaInvalid?: boolean;
    /** aria-required — mark a form field as required. */
    readonly ariaRequired?: boolean;
    /** aria-modal — mark a dialog as modal (content outside is inert to AT). */
    readonly ariaModal?: boolean;
    /** aria-owns — id(s) of elements owned by this one when the DOM can't express it. */
    readonly ariaOwns?: string;
    /** aria-activedescendant — id of the active option in a composite widget (menu/listbox/combobox). */
    readonly ariaActiveDescendant?: string;
    /** aria-haspopup — the element opens a popup ('menu' | 'listbox' | 'dialog' | 'grid' | 'tree' | true). */
    readonly ariaHasPopup?: boolean | 'menu' | 'listbox' | 'tree' | 'grid' | 'dialog';
    /** aria-selected — selection state within a composite widget. */
    readonly ariaSelected?: boolean;
}
interface TextOptions extends A11yOptions {
    readonly class?: string;
    readonly id?: string;
}
interface HeadingOptions extends TextOptions {
    readonly level?: 1 | 2 | 3 | 4 | 5 | 6;
}
interface ButtonOptions extends A11yOptions {
    readonly class?: string;
    readonly id?: string;
    readonly disabled?: Bindable<boolean>;
    readonly onClick?: () => void;
}
interface InputOptionsBase extends A11yOptions {
    readonly class?: string;
    readonly id?: string;
    readonly type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'search';
    readonly placeholder?: string;
    readonly disabled?: Bindable<boolean>;
    readonly onChange?: (value: string) => void;
}
/**
 * Explicitly-controlled input: supply `value` and/or `onInput` yourself.
 * `bind` is disallowed here (typed as `never`) so a two-way `bind` can never be
 * combined with manual `value`/`onInput` wiring — the ambiguity is rejected by
 * the type checker rather than resolved silently at runtime.
 */
interface ControlledInputOptions extends InputOptionsBase {
    readonly value?: Bindable<string>;
    readonly onInput?: (value: string) => void;
    readonly bind?: never;
}
/**
 * Two-way bound input: `bind` expands to `value` (read) + an input handler that
 * writes the field value back into the signal. Manual `value`/`onInput` are
 * disallowed here to keep the binding unambiguous.
 */
interface BoundInputOptions extends InputOptionsBase {
    readonly bind: Signal<string>;
    readonly value?: never;
    readonly onInput?: never;
}
type InputOptions = ControlledInputOptions | BoundInputOptions;
interface LinkOptions extends A11yOptions {
    readonly class?: string;
    readonly id?: string;
    readonly href: string;
    readonly external?: boolean;
    readonly onClick?: () => void;
}
interface ImageOptions extends A11yOptions {
    readonly class?: string;
    readonly id?: string;
    readonly src: string;
    readonly alt: string;
    readonly width?: number;
    readonly height?: number;
}
interface ContainerOptions extends A11yOptions {
    readonly class?: string;
    readonly id?: string;
    readonly key?: string;
    /**
     * Enter/leave transition for this element (§2). CSS class-based and
     * browser-only: on the server it is ignored (deterministic SSR output). The
     * enter animation runs when the element is added by a reactive `when`/`listOf`
     * change (or on initial mount when `appear` is set); the leave animation runs
     * before the element is removed and disposed — the reconciler defers teardown
     * until the transition completes.
     */
    readonly transition?: TransitionConfig;
}
interface SectionOptions extends ContainerOptions {
}
interface FormOptions extends ContainerOptions {
    readonly onSubmit?: (e: Event) => void;
}
interface ListOptions extends ContainerOptions {
    /**
     * Enter/leave transition applied to each list item (§7). Preserves keyed
     * identity: reordering reuses items (no leave/enter), append/prepend enter,
     * remove leaves before disposal, and a removed key that reappears mid-leave is
     * reclaimed (leave→enter). `transition` (inherited) applies to the list
     * container itself; `itemTransition` applies to its rows.
     */
    readonly itemTransition?: TransitionConfig;
}
/** Options for `when()` (§2 conditional transitions). */
interface WhenOptions {
    /** Transition applied to the active branch as it mounts/unmounts. */
    readonly transition?: TransitionConfig;
    /** Also animate the branch present on the initial mount (appear). */
    readonly appear?: boolean;
}
/** Options for a plain portal (mount children into `document.body`). */
interface PortalOptions extends ContainerOptions {
}
/**
 * Options shared by every overlay (dialog/popover/tooltip/dropdown/toast).
 *
 * An overlay is a portal + a reactive `when(open, …)` panel + focus/keyboard
 * behavior. `open` drives visibility; the framework never mutates it — closing
 * is cooperative: `onClose` fires on Escape (when `closeOnEscape`) and the app
 * flips its own `open` signal there. Per-kind defaults (role, modality, focus,
 * escape, restore) apply unless overridden here.
 */
interface OverlayOptions extends ContainerOptions {
    /** Reactive open/visibility state. When it flips, the panel mounts/unmounts. */
    readonly open: Bindable<boolean>;
    /** Requested-close callback (fired on Escape when `closeOnEscape`). Flip `open` here. */
    readonly onClose?: () => void;
    /** Restore focus to the previously-focused element on close. Default: per-kind. */
    readonly restoreFocus?: boolean;
    /** id of the element to focus first when the overlay opens (else first focusable). */
    readonly initialFocusId?: string;
    /** Escape key invokes `onClose`. Default: per-kind. */
    readonly closeOnEscape?: boolean;
}
type SectionBuilder = (section: SectionDSL) => void;
type ContainerBuilder = (container: ContainerDSL) => void;
type PageBuilder = (page: PageDSL) => void;
type FormBuilder = (form: FormDSL) => void;
type ListBuilder = (list: ListDSL) => void;
/** A reactive source of error state (e.g. `resource.error`). `null`/`undefined` means "no error". */
type ErrorSource = ReadonlySignal<unknown>;
/** Fallback UI builder — receives the current error and a `retry` callback. */
type ErrorFallbackBuilder = (fallback: ContainerDSL, error: unknown, retry: () => void) => void;
interface ErrorBoundaryOptions {
    /** Renders when the boundary is in an error state. */
    readonly fallback: ErrorFallbackBuilder;
    /**
     * Reactive error source(s) to observe — typically a resource's `error` signal.
     * When any becomes non-null, the fallback replaces the body.
     */
    readonly source?: ErrorSource | ReadonlyArray<ErrorSource>;
    /** Invoked by the fallback's `retry()`, before the body is re-attempted (e.g. `resource.refetch`). */
    readonly onRetry?: () => void;
}
interface ContentDSL {
    heading(text: BindableText, options?: HeadingOptions): void;
    text(content: BindableText, options?: TextOptions): void;
    button(label: BindableText, options?: ButtonOptions): void;
    input(options?: InputOptions): void;
    image(options: ImageOptions): void;
    link(label: BindableText, options: LinkOptions): void;
}
interface ContainerDSL extends ContentDSL {
    section(key: string, builder: SectionBuilder, options?: SectionOptions): void;
    container(key: string, builder: ContainerBuilder, options?: ContainerOptions): void;
    list(key: string, builder: ListBuilder, options?: ListOptions): void;
    /**
     * Reactive list driven by a Signal<T[]>.
     * When the signal value changes, the list is reconciled against the new items.
     * The renderItem callback receives each item and a ContentDSL to build children.
     */
    listOf<T>(key: string, items: Signal<T[]> | ReadonlySignal<T[]>, renderItem: (item: T, index: number, content: ContentDSL) => void, options?: ListOptions): void;
    form(key: string, builder: FormBuilder, options?: FormOptions): void;
    /**
     * Conditionally render a subtree based on a boolean condition.
     * When `condition` is a signal, the subtree is mounted/unmounted reactively as
     * the value flips. When true the `builder` subtree is shown; when false it is
     * removed (and its handlers/subscriptions torn down). An optional `elseBuilder`
     * renders while the condition is false. Compiles into the same reactive
     * reconciliation machinery as `listOf` — there is no separate render path.
     */
    when(condition: Bindable<boolean>, builder: ContainerBuilder, elseBuilder?: ContainerBuilder, options?: WhenOptions): void;
    /**
     * Render `builder`, but swap to `options.fallback` when the boundary enters an
     * error state. A boundary enters that state when (a) any observed `source`
     * signal (e.g. a `resource.error`) becomes non-null, or (b) the body builder
     * throws synchronously while building. The fallback receives the current error
     * and a `retry()` callback (which clears the local error, runs `onRetry`, and
     * re-attempts the body). Reuses the same reactive `when()` machinery, so its
     * subtree — and all handlers/subscriptions within it — are torn down on
     * removal. It does NOT trap arbitrary global errors; errors remain observable.
     */
    errorBoundary(id: string, builder: ContainerBuilder, options: ErrorBoundaryOptions): void;
    /**
     * Render `builder`'s subtree into `document.body` instead of inline at this
     * position (a neutral inline anchor is left behind). On the server there is no
     * body, so the content renders inline; hydration relocates it to a body
     * container to match the browser. Use for content that must escape overflow/
     * stacking contexts (overlays, toasts). Cleanup removes the body container.
     */
    portal(key: string, builder: ContainerBuilder, options?: PortalOptions): void;
    /**
     * Modal dialog: portal + `when(open, …)` panel with `role="dialog"`,
     * `aria-modal="true"`, focus trap + containment, Escape-to-close, and focus
     * restore on close. `builder` fills the dialog panel.
     */
    dialog(key: string, options: OverlayOptions, builder: ContainerBuilder): void;
    /**
     * Non-modal popover: portal + `when(open, …)` panel with `role="dialog"`.
     * Moves focus into the panel on open and restores it on close, but does not
     * trap or contain focus. Escape closes by default.
     */
    popover(key: string, options: OverlayOptions, builder: ContainerBuilder): void;
    /**
     * Tooltip: portal + `when(open, …)` panel with `role="tooltip"`. Non-modal
     * and does not steal focus (tooltips describe another element); no Escape
     * handling by default.
     */
    tooltip(key: string, options: OverlayOptions, builder: ContainerBuilder): void;
    /**
     * Dropdown menu: portal + `when(open, …)` panel with `role="menu"`. Non-modal;
     * moves focus into the menu on open, Escape closes, focus restored on close.
     */
    dropdown(key: string, options: OverlayOptions, builder: ContainerBuilder): void;
    /**
     * Toast: portal + `when(open, …)` panel with `role="status"` and
     * `aria-live="polite"`. Non-modal and never steals focus; no Escape handling.
     */
    toast(key: string, options: OverlayOptions, builder: ContainerBuilder): void;
    /**
     * Instantiate a reusable `component()` at this position (§3–§9). Creates a
     * `'component'` node (rendered as a `<div>` wrapper), runs the definition's
     * `setup(props, ctx)` synchronously to obtain its render function, and fills
     * the component's own container scope with it. Any `ctx.effect`/`ctx.onCleanup`
     * registered by the setup is torn down automatically when the component leaves
     * the graph. `props` are strongly typed by the definition's generic; pass
     * `Signal` props for fine-grained updates that do NOT re-run `setup` (§13).
     * The optional `children` builder is rendered wherever the component calls
     * `ctx.renderChildren` (§6 native child composition).
     */
    component<P>(key: string, def: ComponentDefinition<P>, props: P, children?: ContainerBuilder): void;
}
interface SectionDSL extends ContainerDSL {
}
interface FormDSL extends ContainerDSL {
}
interface ListDSL extends ContentDSL {
    item(key: string, builder: ContainerBuilder, options?: ContainerOptions): void;
}
interface PageDSL extends ContainerDSL {
}
interface AppDSL {
    page(key: string, builder: PageBuilder): void;
}

/**
 * DSL builder implementations.
 *
 * Each builder wraps a GraphNode and provides the fluent API
 * for constructing the Semantic Application Graph via the DSL.
 *
 * Builders do NOT render anything — they only build the graph.
 */

/**
 * A single reactive-list reconciliation descriptor (spec §15).
 *
 * Emitted by the `__listplan__<nodeId>` handler on every list change. `key` is
 * the item's identity-only reconciliation key (cheap to compute); `item` is the
 * source value *reference* used for identity short-circuiting; `sig()` computes
 * the content signature on demand (only when the reference changed); `build()`
 * materialises the full item subtree on demand (only for new/changed rows).
 */
interface ListPlanEntry {
    readonly key: string;
    readonly item: unknown;
    readonly sig: () => string;
    readonly build: () => GraphNode;
}
/** Content signature used to detect in-place data changes of a stable item. */
declare function reactiveListItemSignature(item: unknown): string;
/** Stable, identity-only reconciliation key for a reactive-list item. */
declare function reactiveListItemKey(item: unknown, index: number): string;
declare class ContentBuilderBase implements ContentDSL {
    protected readonly _node: GraphNode;
    protected readonly _graph: ApplicationGraph;
    constructor(_node: GraphNode, _graph: ApplicationGraph);
    heading(text: BindableText, options?: HeadingOptions): void;
    text(content: BindableText, options?: TextOptions): void;
    button(label: BindableText, options?: ButtonOptions): void;
    input(options?: InputOptions): void;
    image(options: ImageOptions): void;
    link(label: BindableText, options: LinkOptions): void;
}
declare class ContainerBuilderBase extends ContentBuilderBase implements ContainerDSL {
    section(key: string, builder: SectionBuilder, options?: SectionOptions): void;
    container(key: string, builder: ContainerBuilder, options?: ContainerOptions): void;
    list(key: string, builder: ListBuilder, options?: ListOptions): void;
    listOf<T>(key: string, items: Signal<T[]> | ReadonlySignal<T[]>, renderItem: (item: T, index: number, content: ContentDSL) => void, options?: ListOptions): void;
    form(key: string, builder: FormBuilder, options?: FormOptions): void;
    when(condition: Bindable<boolean>, builder: ContainerBuilder, elseBuilder?: ContainerBuilder, options?: WhenOptions): void;
    errorBoundary(id: string, builder: ContainerBuilder, options: ErrorBoundaryOptions): void;
    portal(key: string, builder: ContainerBuilder, options?: PortalOptions): void;
    /**
     * Shared assembly for every overlay kind: a `portal` node whose single child
     * is a `when(open, panel)` conditional. The panel container carries the
     * kind's ARIA semantics; `builder` fills it. An `__overlay__<portalId>`
     * descriptor is registered so the renderer wires focus/keyboard behavior to
     * the same `open` signal that drives the panel. Reuses existing primitives
     * (portal + when + container) — no new render path.
     */
    private _overlay;
    dialog(key: string, options: OverlayOptions, builder: ContainerBuilder): void;
    popover(key: string, options: OverlayOptions, builder: ContainerBuilder): void;
    tooltip(key: string, options: OverlayOptions, builder: ContainerBuilder): void;
    dropdown(key: string, options: OverlayOptions, builder: ContainerBuilder): void;
    toast(key: string, options: OverlayOptions, builder: ContainerBuilder): void;
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
    component<P>(key: string, def: ComponentDefinition<P>, props: P, children?: ContainerBuilder): void;
}
declare class SectionBuilderImpl extends ContainerBuilderBase implements SectionDSL {
}
declare class ContainerBuilderImpl extends ContainerBuilderBase implements ContainerDSL {
}
declare class FormBuilderImpl extends ContainerBuilderBase implements FormDSL {
}
declare class ListBuilderImpl extends ContentBuilderBase implements ListDSL {
    item(key: string, builder: ContainerBuilder, options?: ContainerOptions): void;
}
declare class PageBuilderImpl extends ContainerBuilderBase implements PageDSL {
}
declare class AppBuilder implements AppDSL {
    private readonly _graph;
    constructor(_graph: ApplicationGraph);
    page(key: string, builder: PageBuilder): void;
}

/**
 * StreetUI DSL entry point.
 *
 * Usage:
 *   import { streetui } from '@streetui/dsl';
 *
 *   const app = streetui.app({ name: 'My App' });
 *   app.page('home', page => {
 *     page.section('hero', section => {
 *       section.heading('Welcome');
 *       section.button('Click me', { onClick: () => {} });
 *     });
 *   });
 *
 *   const graph = app.build();
 */

interface AppOptions {
    readonly name: string;
    readonly version?: string;
}
declare class StreetApp {
    private readonly _graph;
    private readonly _builder;
    constructor(options: AppOptions);
    page(key: string, builder: Parameters<AppBuilder['page']>[1]): this;
    /** Compile to ApplicationGraph — validates and returns the graph. */
    build(): ApplicationGraph;
    /** Access graph before building (useful for inspection). */
    get graph(): ApplicationGraph;
}
interface StreetUI {
    app(options: AppOptions): StreetApp;
}
declare const streetui: StreetUI;

export { type A11yOptions, AppBuilder, type AppDSL, type AppOptions, type Bindable, type BindableText, type BoundInputOptions, type ButtonOptions, type ContainerBuilder as ComponentChildren, type ComponentContext, type ComponentDefinition, type ComponentRender, type ComponentSetup, type ContainerBuilder, ContainerBuilderImpl, type ContainerDSL, type ContainerOptions, type ContentDSL, type ControlledInputOptions, type ErrorBoundaryOptions, type ErrorFallbackBuilder, type ErrorSource, type FormBuilder, FormBuilderImpl, type FormDSL, type FormOptions, type HeadingOptions, type ImageOptions, type InputOptions, type InputOptionsBase, type LinkOptions, type ListBuilder, ListBuilderImpl, type ListDSL, type ListOptions, type ListPlanEntry, type OverlayOptions, type PageBuilder, PageBuilderImpl, type PageDSL, type PortalOptions, type ResolvedTransition, type SectionBuilder, SectionBuilderImpl, type SectionDSL, type SectionOptions, StreetApp, type StreetUI, type TextOptions, type TextValue, type TransitionConfig, type WhenOptions, component, isComponentDefinition, isTransitionConfig, reactiveListItemKey, reactiveListItemSignature, resolveTransition, streetui };
