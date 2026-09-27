/**
 * StreetUI DSL type system.
 * All builder callbacks and option shapes live here.
 */

import type { Signal, ReadonlySignal } from '@streetui/state';

// A bound value can be a literal or a reactive signal
export type Bindable<T> = T | ReadonlySignal<T> | Signal<T>;

// Text-like sinks (heading/text/button label/link label) render their value by
// stringifying it at the presentation boundary, so they accept any primitive
// that has a meaningful string form — and reactive sources of those. A mutable
// `Signal<number>` is accepted because it is assignable to `ReadonlySignal<TextValue>`.
export type TextValue = string | number | boolean;
export type BindableText = TextValue | ReadonlySignal<TextValue>;

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
export interface A11yOptions {
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
}

export interface TextOptions extends A11yOptions {
  readonly class?: string;
  readonly id?: string;
}

export interface HeadingOptions extends TextOptions {
  readonly level?: 1 | 2 | 3 | 4 | 5 | 6;
}

export interface ButtonOptions extends A11yOptions {
  readonly class?: string;
  readonly id?: string;
  readonly disabled?: Bindable<boolean>;
  readonly onClick?: () => void;
}

export interface InputOptionsBase extends A11yOptions {
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
export interface ControlledInputOptions extends InputOptionsBase {
  readonly value?: Bindable<string>;
  readonly onInput?: (value: string) => void;
  readonly bind?: never;
}

/**
 * Two-way bound input: `bind` expands to `value` (read) + an input handler that
 * writes the field value back into the signal. Manual `value`/`onInput` are
 * disallowed here to keep the binding unambiguous.
 */
export interface BoundInputOptions extends InputOptionsBase {
  readonly bind: Signal<string>;
  readonly value?: never;
  readonly onInput?: never;
}

export type InputOptions = ControlledInputOptions | BoundInputOptions;

export interface LinkOptions extends A11yOptions {
  readonly class?: string;
  readonly id?: string;
  readonly href: string;
  readonly external?: boolean;
  readonly onClick?: () => void;
}

export interface ImageOptions extends A11yOptions {
  readonly class?: string;
  readonly id?: string;
  readonly src: string;
  readonly alt: string;
  readonly width?: number;
  readonly height?: number;
}

export interface ContainerOptions extends A11yOptions {
  readonly class?: string;
  readonly id?: string;
  readonly key?: string;
}

export interface SectionOptions extends ContainerOptions {}
export interface FormOptions extends ContainerOptions {
  readonly onSubmit?: (e: Event) => void;
}
export interface ListOptions extends ContainerOptions {}

/** Options for a plain portal (mount children into `document.body`). */
export interface PortalOptions extends ContainerOptions {}

/**
 * Options shared by every overlay (dialog/popover/tooltip/dropdown/toast).
 *
 * An overlay is a portal + a reactive `when(open, …)` panel + focus/keyboard
 * behavior. `open` drives visibility; the framework never mutates it — closing
 * is cooperative: `onClose` fires on Escape (when `closeOnEscape`) and the app
 * flips its own `open` signal there. Per-kind defaults (role, modality, focus,
 * escape, restore) apply unless overridden here.
 */
export interface OverlayOptions extends ContainerOptions {
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

// Builder callback types
export type SectionBuilder = (section: SectionDSL) => void;
export type ContainerBuilder = (container: ContainerDSL) => void;
export type PageBuilder = (page: PageDSL) => void;
export type FormBuilder = (form: FormDSL) => void;
export type ListBuilder = (list: ListDSL) => void;

/** A reactive source of error state (e.g. `resource.error`). `null`/`undefined` means "no error". */
export type ErrorSource = ReadonlySignal<unknown>;

/** Fallback UI builder — receives the current error and a `retry` callback. */
export type ErrorFallbackBuilder = (
  fallback: ContainerDSL,
  error: unknown,
  retry: () => void,
) => void;

export interface ErrorBoundaryOptions {
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

// ── Interfaces for each DSL scope ─────────────────────────────────────────────

export interface ContentDSL {
  heading(text: BindableText, options?: HeadingOptions): void;
  text(content: BindableText, options?: TextOptions): void;
  button(label: BindableText, options?: ButtonOptions): void;
  input(options?: InputOptions): void;
  image(options: ImageOptions): void;
  link(label: BindableText, options: LinkOptions): void;
}

export interface ContainerDSL extends ContentDSL {
  section(key: string, builder: SectionBuilder, options?: SectionOptions): void;
  container(key: string, builder: ContainerBuilder, options?: ContainerOptions): void;
  list(key: string, builder: ListBuilder, options?: ListOptions): void;
  /**
   * Reactive list driven by a Signal<T[]>.
   * When the signal value changes, the list is reconciled against the new items.
   * The renderItem callback receives each item and a ContentDSL to build children.
   */
  listOf<T>(
    key: string,
    items: Signal<T[]> | ReadonlySignal<T[]>,
    renderItem: (item: T, index: number, content: ContentDSL) => void,
    options?: ListOptions,
  ): void;
  form(key: string, builder: FormBuilder, options?: FormOptions): void;
  /**
   * Conditionally render a subtree based on a boolean condition.
   * When `condition` is a signal, the subtree is mounted/unmounted reactively as
   * the value flips. When true the `builder` subtree is shown; when false it is
   * removed (and its handlers/subscriptions torn down). An optional `elseBuilder`
   * renders while the condition is false. Compiles into the same reactive
   * reconciliation machinery as `listOf` — there is no separate render path.
   */
  when(
    condition: Bindable<boolean>,
    builder: ContainerBuilder,
    elseBuilder?: ContainerBuilder,
  ): void;
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
  errorBoundary(
    id: string,
    builder: ContainerBuilder,
    options: ErrorBoundaryOptions,
  ): void;
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
}

export interface SectionDSL extends ContainerDSL {}
export interface FormDSL extends ContainerDSL {}

export interface ListDSL extends ContentDSL {
  item(key: string, builder: ContainerBuilder, options?: ContainerOptions): void;
}

export interface PageDSL extends ContainerDSL {}

export interface AppDSL {
  page(key: string, builder: PageBuilder): void;
}
