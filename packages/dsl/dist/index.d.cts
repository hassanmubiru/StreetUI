import { ReadonlySignal, Signal } from '@streetui/state';
import { ApplicationGraph, GraphNode } from '@streetui/graph';

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
}
interface SectionOptions extends ContainerOptions {
}
interface FormOptions extends ContainerOptions {
    readonly onSubmit?: (e: Event) => void;
}
interface ListOptions extends ContainerOptions {
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
    when(condition: Bindable<boolean>, builder: ContainerBuilder, elseBuilder?: ContainerBuilder): void;
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
    when(condition: Bindable<boolean>, builder: ContainerBuilder, elseBuilder?: ContainerBuilder): void;
    errorBoundary(id: string, builder: ContainerBuilder, options: ErrorBoundaryOptions): void;
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

export { type A11yOptions, AppBuilder, type AppDSL, type AppOptions, type Bindable, type BindableText, type BoundInputOptions, type ButtonOptions, type ContainerBuilder, ContainerBuilderImpl, type ContainerDSL, type ContainerOptions, type ContentDSL, type ControlledInputOptions, type ErrorBoundaryOptions, type ErrorFallbackBuilder, type ErrorSource, type FormBuilder, FormBuilderImpl, type FormDSL, type FormOptions, type HeadingOptions, type ImageOptions, type InputOptions, type InputOptionsBase, type LinkOptions, type ListBuilder, ListBuilderImpl, type ListDSL, type ListOptions, type ListPlanEntry, type PageBuilder, PageBuilderImpl, type PageDSL, type SectionBuilder, SectionBuilderImpl, type SectionDSL, type SectionOptions, StreetApp, type StreetUI, type TextOptions, type TextValue, reactiveListItemKey, reactiveListItemSignature, streetui };
