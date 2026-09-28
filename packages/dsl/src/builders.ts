/**
 * DSL builder implementations.
 *
 * Each builder wraps a GraphNode and provides the fluent API
 * for constructing the Semantic Application Graph via the DSL.
 *
 * Builders do NOT render anything — they only build the graph.
 */

import { ApplicationGraph, GraphNode, type Props } from '@streetui/graph';
import type {
  ContentDSL,
  ContainerDSL,
  SectionDSL,
  PageDSL,
  FormDSL,
  ListDSL,
  AppDSL,
  HeadingOptions,
  TextOptions,
  ButtonOptions,
  InputOptions,
  LinkOptions,
  ImageOptions,
  ContainerOptions,
  SectionOptions,
  FormOptions,
  ListOptions,
  PortalOptions,
  OverlayOptions,
  A11yOptions,
  Bindable,
  BindableText,
  TextValue,
  ErrorBoundaryOptions,
  ErrorSource,
  AsyncBoundaryBranches,
  PageBuilder,
  SectionBuilder,
  ContainerBuilder as ContainerBuilderFn,
  FormBuilder,
  ListBuilder,
} from './dsl-types.js';
import type {
  ComponentContext,
  ComponentDefinition,
  ComponentRender,
} from './component.js';
import type { TransitionConfig } from './transition.js';
import { resolveTransition } from './transition.js';
import type { HeadMetadata } from './head.js';
import { resolveHead } from './head.js';
import type { WhenOptions } from './dsl-types.js';
import { signal, derived, effect, type Signal, type ReadonlySignal, type Resource } from '@streetui/state';

/**
 * A single reactive-list reconciliation descriptor (spec §15).
 *
 * Emitted by the `__listplan__<nodeId>` handler on every list change. `key` is
 * the item's identity-only reconciliation key (cheap to compute); `item` is the
 * source value *reference* used for identity short-circuiting; `sig()` computes
 * the content signature on demand (only when the reference changed); `build()`
 * materialises the full item subtree on demand (only for new/changed rows).
 */
export interface ListPlanEntry {
  readonly key: string;
  readonly item: unknown;
  readonly sig: () => string;
  readonly build: () => GraphNode;
}

// ── Signal helpers ────────────────────────────────────────────────────────────

function isSignal(v: unknown): v is Signal<unknown> | ReadonlySignal<unknown> {
  return (
    v !== null &&
    typeof v === 'object' &&
    typeof (v as Record<string, unknown>)['get'] === 'function' &&
    typeof (v as Record<string, unknown>)['subscribe'] === 'function'
  );
}

/** Register a signal binding on the node and return the current static value. */
function bindValue<T>(
  graph: ApplicationGraph,
  node: GraphNode,
  propKey: string,
  value: Bindable<T>,
): T {
  if (isSignal(value)) {
    const signalId = `${node.id}:${propKey}`;
    node.stateRefs.push({ signalId, propKey });
    graph.registerHandler(`__signal__${signalId}`, value as unknown as () => unknown);
    return (value as ReadonlySignal<T>).peek();
  }
  return value as T;
}

// ── Helper to build Props from ContainerOptions ───────────────────────────────

/**
 * Copy accessibility options onto a props bag as their corresponding HTML/ARIA
 * attribute names. Values are written as strings (booleans become "true"/"false"
 * rather than being dropped) so ARIA state attributes render literally. These
 * flow to the DOM via the renderer's generic attribute pass — no ARIA-specific
 * renderer code is involved.
 */
function applyA11yProps(props: Props, options: A11yOptions): void {
  if (options.role !== undefined) props['role'] = options.role;
  if (options.tabIndex !== undefined) props['tabindex'] = String(options.tabIndex);
  if (options.ariaLabel !== undefined) props['aria-label'] = options.ariaLabel;
  if (options.ariaLabelledBy !== undefined) props['aria-labelledby'] = options.ariaLabelledBy;
  if (options.ariaDescribedBy !== undefined) props['aria-describedby'] = options.ariaDescribedBy;
  if (options.ariaExpanded !== undefined) props['aria-expanded'] = String(options.ariaExpanded);
  if (options.ariaControls !== undefined) props['aria-controls'] = options.ariaControls;
  if (options.ariaHidden !== undefined) props['aria-hidden'] = String(options.ariaHidden);
  if (options.ariaLive !== undefined) props['aria-live'] = options.ariaLive;
  if (options.ariaCurrent !== undefined) props['aria-current'] = String(options.ariaCurrent);
  if (options.ariaInvalid !== undefined) props['aria-invalid'] = String(options.ariaInvalid);
  if (options.ariaRequired !== undefined) props['aria-required'] = String(options.ariaRequired);
  if (options.ariaModal !== undefined) props['aria-modal'] = String(options.ariaModal);
  if (options.ariaOwns !== undefined) props['aria-owns'] = options.ariaOwns;
  if (options.ariaActiveDescendant !== undefined) props['aria-activedescendant'] = options.ariaActiveDescendant;
  if (options.ariaHasPopup !== undefined) props['aria-haspopup'] = String(options.ariaHasPopup);
  if (options.ariaSelected !== undefined) props['aria-selected'] = String(options.ariaSelected);
}

/**
 * Register a `__transition__<nodeId>` descriptor for an element that opts into a
 * CSS class-based enter/leave transition (§2). Mirrors the `__overlay__` /
 * `__component__` handler pattern: the renderer reads it (browser only) to run
 * enter on mount and to defer removal/dispose until leave completes. Pure config
 * — no DOM, no timers — so it is inert on the server and pruned by
 * `graph._unregisterNodeHandlers` (§23). A no-op when no transition is supplied.
 */
function registerTransition(
  graph: ApplicationGraph,
  node: GraphNode,
  config: TransitionConfig | undefined,
): void {
  if (config === undefined) return;
  // Resolve to the pre-split class arrays at wire time so the renderer's
  // controller consumes a plain `ResolvedTransition` and never re-parses class
  // strings per run — and so the renderer needs no compile-time dependency on
  // this DSL package (it reads the descriptor structurally, exactly like
  // `__overlay__`/`__component__`).
  const resolved = resolveTransition(config);
  graph.registerHandler(
    `__transition__${node.id}`,
    (() => resolved) as unknown as () => unknown,
  );
}

function containerProps(options: ContainerOptions): Props {
  const props: Props = {};
  if (options.class !== undefined) props['class'] = options.class;
  if (options.id !== undefined) props['id'] = options.id;
  if (options.key !== undefined) props['key'] = options.key;
  applyA11yProps(props, options);
  return props;
}

// ── Reactive-list item keying ──────────────────────────────────────────────────
//
// The `listOf` DSL signature does not take an explicit key extractor, so we
// derive a stable reconciliation key from each item. The key combines an
// *identity* part (so reordering the same items reuses their DOM nodes) with a
// *value signature* (so an item whose data changed is treated as a fresh node
// and re-rendered rather than silently kept stale by the shallow reconciler).

function itemIdentity(item: unknown, index: number): string {
  if (item !== null && typeof item === 'object') {
    const obj = item as Record<string, unknown>;
    if ('id' in obj) return `id:${String(obj['id'])}`;
    if ('key' in obj) return `key:${String(obj['key'])}`;
    return `idx:${index}`;
  }
  return `val:${String(item)}`;
}

function itemValueSignature(item: unknown): string {
  try {
    return JSON.stringify(item) ?? String(item);
  } catch {
    return String(item);
  }
}

/** Content signature used to detect in-place data changes of a stable item. */
export function reactiveListItemSignature(item: unknown): string {
  return itemValueSignature(item);
}

/** Stable, identity-only reconciliation key for a reactive-list item. */
export function reactiveListItemKey(item: unknown, index: number): string {
  return itemIdentity(item, index);
}

// ── Overlay kind configuration ──────────────────────────────────────────────────
//
// Each overlay builder (dialog/popover/tooltip/dropdown/toast) is the same
// portal + `when(open, …)` panel + focus/keyboard behavior, differing only in
// ARIA role, modality, whether it takes focus, and its escape/restore defaults.
// This table captures those differences; `_overlay` does the shared assembly.

interface OverlayKindConfig {
  /** Default ARIA role for the panel. */
  readonly role: string;
  /** Trap + contain focus (modal semantics). */
  readonly modal: boolean;
  /** Move focus into the panel when it opens. */
  readonly takesFocus: boolean;
  /** Wire arrow/Home/End/Enter/Space roving-focus navigation (role="menu"). */
  readonly menu?: boolean;
  /** Emit `aria-modal="true"` on the panel. */
  readonly ariaModal: boolean;
  /** Emit an `aria-live` region on the panel (announcements). */
  readonly ariaLive?: 'polite' | 'assertive';
  /** Default for `closeOnEscape` when the caller does not specify it. */
  readonly defaultCloseOnEscape: boolean;
  /** Default for `restoreFocus` when the caller does not specify it. */
  readonly defaultRestoreFocus: boolean;
}

const OVERLAY_KINDS = {
  dialog: {
    role: 'dialog', modal: true, takesFocus: true, ariaModal: true,
    defaultCloseOnEscape: true, defaultRestoreFocus: true,
  },
  popover: {
    role: 'dialog', modal: false, takesFocus: true, ariaModal: false,
    defaultCloseOnEscape: true, defaultRestoreFocus: true,
  },
  tooltip: {
    role: 'tooltip', modal: false, takesFocus: false, ariaModal: false,
    defaultCloseOnEscape: false, defaultRestoreFocus: false,
  },
  dropdown: {
    role: 'menu', modal: false, takesFocus: true, menu: true, ariaModal: false,
    defaultCloseOnEscape: true, defaultRestoreFocus: true,
  },
  toast: {
    role: 'status', modal: false, takesFocus: false, ariaModal: false,
    ariaLive: 'polite', defaultCloseOnEscape: false, defaultRestoreFocus: false,
  },
} as const satisfies Record<string, OverlayKindConfig>;

/** The opaque descriptor the renderer reads from `__overlay__<portalId>`. */
interface OverlayBehaviorDescriptor {
  readonly open: ReadonlySignal<boolean>;
  readonly modal: boolean;
  readonly takesFocus: boolean;
  readonly menu: boolean;
  readonly closeOnEscape: boolean;
  readonly restoreFocus: boolean;
  readonly initialFocusId?: string;
  readonly onClose?: () => void;
}

// ── Base content builder ──────────────────────────────────────────────────────

class ContentBuilderBase implements ContentDSL {
  constructor(
    protected readonly _node: GraphNode,
    protected readonly _graph: ApplicationGraph,
  ) {}

  heading(text: BindableText, options: HeadingOptions = {}): void {
    const props: Props = { level: options.level ?? 1 };
    if (options.class !== undefined) props['class'] = options.class;
    if (options.id !== undefined) props['id'] = options.id;
    applyA11yProps(props, options);
    const node = this._graph.createNode('heading', { parent: this._node, props });
    const resolved = bindValue<TextValue>(this._graph, node, 'text', text);
    node.setProp('text', resolved);
  }

  text(content: BindableText, options: TextOptions = {}): void {
    const props: Props = {};
    if (options.class !== undefined) props['class'] = options.class;
    if (options.id !== undefined) props['id'] = options.id;
    applyA11yProps(props, options);
    const node = this._graph.createNode('text', { parent: this._node, props });
    const resolved = bindValue<TextValue>(this._graph, node, 'text', content);
    node.setProp('text', resolved);
  }

  button(label: BindableText, options: ButtonOptions = {}): void {
    const props: Props = {};
    if (options.class !== undefined) props['class'] = options.class;
    if (options.id !== undefined) props['id'] = options.id;
    applyA11yProps(props, options);
    const node = this._graph.createNode('button', { parent: this._node, props });
    const resolved = bindValue<TextValue>(this._graph, node, 'label', label);
    node.setProp('label', resolved);
    if (options.disabled !== undefined) {
      const resolvedDisabled = bindValue(this._graph, node, 'disabled', options.disabled);
      node.setProp('disabled', resolvedDisabled);
    }
    if (options.onClick !== undefined) {
      const handlerKey = `click:${node.id}`;
      this._graph.registerHandler(handlerKey, options.onClick as () => unknown);
      node.addEvent({ type: 'click', handlerKey });
    }
  }

  input(options: InputOptions = {}): void {
    const props: Props = {};
    props['inputType'] = options.type ?? 'text';
    if (options.placeholder !== undefined) props['placeholder'] = options.placeholder;
    if (options.class !== undefined) props['class'] = options.class;
    if (options.id !== undefined) props['id'] = options.id;
    applyA11yProps(props, options);
    const nodeOpts: { key?: string; props: Props; parent: GraphNode } = {
      props,
      parent: this._node,
    };
    if (options.id !== undefined) nodeOpts.key = options.id;
    const node = this._graph.createNode('input', nodeOpts);

    // Two-way `bind` expands to a value binding + an input write-back. The type
    // system (BoundInputOptions vs ControlledInputOptions) guarantees `bind` is
    // never combined with explicit `value`/`onInput`, so there is no ambiguity.
    const bindSignal = options.bind;
    const valueBindable: Bindable<string> | undefined =
      bindSignal !== undefined ? bindSignal : options.value;
    const inputHandler: ((value: string) => void) | undefined =
      bindSignal !== undefined ? (v: string) => bindSignal.set(v) : options.onInput;

    if (valueBindable !== undefined) {
      const resolved = bindValue(this._graph, node, 'value', valueBindable);
      node.setProp('value', resolved);
    }
    if (options.disabled !== undefined) {
      const resolved = bindValue(this._graph, node, 'disabled', options.disabled);
      node.setProp('disabled', resolved);
    }
    if (inputHandler !== undefined) {
      const handlerKey = `input:${node.id}`;
      this._graph.registerHandler(handlerKey, inputHandler as () => unknown);
      node.addEvent({ type: 'input', handlerKey });
    }
    if (options.onChange !== undefined) {
      const handlerKey = `change:${node.id}`;
      this._graph.registerHandler(handlerKey, options.onChange as () => unknown);
      node.addEvent({ type: 'change', handlerKey });
    }
  }

  image(options: ImageOptions): void {
    const props: Props = {
      src: options.src,
      alt: options.alt,
    };
    if (options.width !== undefined) props['width'] = options.width;
    if (options.height !== undefined) props['height'] = options.height;
    if (options.class !== undefined) props['class'] = options.class;
    if (options.id !== undefined) props['id'] = options.id;
    applyA11yProps(props, options);
    const nodeOpts: { key?: string; props: Props; parent: GraphNode } = {
      props,
      parent: this._node,
    };
    if (options.id !== undefined) nodeOpts.key = options.id;
    this._graph.createNode('image', nodeOpts);
  }

  link(label: BindableText, options: LinkOptions): void {
    const props: Props = {
      href: options.href,
      external: options.external ?? false,
    };
    if (options.class !== undefined) props['class'] = options.class;
    if (options.id !== undefined) props['id'] = options.id;
    applyA11yProps(props, options);
    const node = this._graph.createNode('link', { parent: this._node, props });
    const resolved = bindValue<TextValue>(this._graph, node, 'label', label);
    node.setProp('label', resolved);
    if (options.onClick !== undefined) {
      const handlerKey = `click:${node.id}`;
      this._graph.registerHandler(handlerKey, options.onClick as () => unknown);
      node.addEvent({ type: 'click', handlerKey });
    }
  }
}

// ── Container builder ─────────────────────────────────────────────────────────

class ContainerBuilderBase extends ContentBuilderBase implements ContainerDSL {
  section(key: string, builder: SectionBuilder, options: SectionOptions = {}): void {
    const node = this._graph.createNode('section', {
      key,
      parent: this._node,
      props: containerProps(options),
    });
    registerTransition(this._graph, node, options.transition);
    builder(new SectionBuilderImpl(node, this._graph));
  }

  container(key: string, builder: ContainerBuilderFn, options: ContainerOptions = {}): void {
    const node = this._graph.createNode('container', {
      key,
      parent: this._node,
      props: containerProps(options),
    });
    registerTransition(this._graph, node, options.transition);
    builder(new ContainerBuilderImpl(node, this._graph));
  }

  list(key: string, builder: ListBuilder, options: ListOptions = {}): void {
    const node = this._graph.createNode('list', {
      key,
      parent: this._node,
      props: containerProps(options),
    });
    registerTransition(this._graph, node, options.transition);
    builder(new ListBuilderImpl(node, this._graph));
  }

  listOf<T>(
    key: string,
    items: Signal<T[]> | ReadonlySignal<T[]>,
    renderItem: (item: T, index: number, content: ContentDSL) => void,
    options: ListOptions = {},
  ): void {
    const graph = this._graph;
    const node = graph.createNode('reactive-list', {
      key,
      parent: this._node,
      props: containerProps(options),
    });
    registerTransition(graph, node, options.transition);

    // Register the driving signal so the runtime/renderer can subscribe to it.
    const signalId = `${node.id}:items`;
    node.stateRefs.push({ signalId, propKey: 'items' });
    graph.registerHandler(`__signal__${signalId}`, items as unknown as () => unknown);

    // Build a single detached list-item subtree for one item. The item's
    // reconciliation `key` is identity-only, and its value signature is stored
    // in the internal `_sig` prop so the renderer can detect (and apply a
    // targeted update for) a data change on an item whose identity is stable.
    const buildItem = (item: T, index: number): GraphNode => {
      const itemKey = reactiveListItemKey(item, index);
      const itemNode = graph.createNode('list-item', {
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
          _item: item as unknown as Props[string],
        },
      });
      renderItem(item, index, new ContainerBuilderImpl(itemNode, graph));
      // Per-item enter/leave transition (§7). Registered on every item node so a
      // freshly-built row (append/prepend/change) carries it; keyed identity is
      // unaffected because the transition descriptor is keyed by node id and the
      // row's reconciliation key is derived separately.
      registerTransition(graph, itemNode, options.itemTransition);
      return itemNode;
    };

    // Lazy reconciliation plan (spec §15 — the measured keyed-list hot path).
    //
    // Instead of eagerly rebuilding all N item GraphNodes (and hashing every item
    // with JSON.stringify) on *every* emission — the dominant cost of the old
    // `buildAll` path — the renderer receives lightweight descriptors and only
    // materialises a subtree for rows that are genuinely new or whose data
    // actually changed. `key` is cheap (identity only); `sig()` and `build()` are
    // thunks the reconciler calls on demand.
    const buildPlan = (raw: unknown): ListPlanEntry[] => {
      const arr = Array.isArray(raw) ? (raw as T[]) : [];
      const plan: ListPlanEntry[] = new Array(arr.length);
      for (let i = 0; i < arr.length; i++) {
        const item = arr[i]!;
        const index = i;
        plan[i] = {
          key: reactiveListItemKey(item, index),
          item,
          sig: () => reactiveListItemSignature(item),
          build: () => buildItem(item, index),
        };
      }
      return plan;
    };
    graph.registerHandler(`__listplan__${node.id}`, buildPlan as unknown as () => unknown);

    // Build the initial children into the graph so the first mount renders them.
    const current = isSignal(items)
      ? (items as ReadonlySignal<T[]>).peek()
      : (items as unknown as T[]);
    const initial = Array.isArray(current) ? current : [];
    initial.forEach((item, i) => {
      node.appendChild(buildItem(item, i));
    });
  }

  form(key: string, builder: FormBuilder, options: FormOptions = {}): void {
    const props: Props = containerProps(options);
    const node = this._graph.createNode('form', {
      key,
      parent: this._node,
      props,
    });
    registerTransition(this._graph, node, options.transition);
    if (options.onSubmit !== undefined) {
      const handlerKey = `submit:${node.id}`;
      this._graph.registerHandler(handlerKey, options.onSubmit as () => unknown);
      node.addEvent({ type: 'submit', handlerKey });
    }
    builder(new FormBuilderImpl(node, this._graph));
  }

  when(
    condition: Bindable<boolean>,
    builder: ContainerBuilderFn,
    elseBuilder?: ContainerBuilderFn,
    options: WhenOptions = {},
  ): void {
    const graph = this._graph;
    // A dedicated 'conditional' node reuses the reactive-list reconciliation
    // machinery (same signal subscription + keyed reconcile) but renders as a
    // neutral <div> rather than a <ul>. It holds zero or one child branch.
    const node = graph.createNode('conditional', {
      parent: this._node,
      props: containerProps({}),
    });

    // A transition on a `when` applies to whichever branch is mounted/removed
    // (§2). `appear` promotes the transition to a config that also animates the
    // branch present on the very first mount; the renderer distinguishes appear
    // from a reactive enter via the descriptor's `appear` flag.
    const branchTransition: TransitionConfig | undefined =
      options.transition !== undefined && options.appear === true
        ? { ...options.transition, appear: true }
        : options.transition;

    // Build the active branch as a single keyed container. Distinct keys for the
    // then/else branches make a flip a clean swap under the keyed reconciler.
    const buildBranch = (build: ContainerBuilderFn, tag: 'then' | 'else'): GraphNode => {
      const branchKey = `when-${tag}:${node.id}`;
      const branch = graph.createNode('container', {
        key: branchKey,
        props: { key: branchKey },
      });
      registerTransition(graph, branch, branchTransition);
      build(new ContainerBuilderImpl(branch, graph));
      return branch;
    };

    const buildAll = (raw: unknown): GraphNode[] => {
      if (raw) return [buildBranch(builder, 'then')];
      return elseBuilder !== undefined ? [buildBranch(elseBuilder, 'else')] : [];
    };

    if (isSignal(condition)) {
      const signalId = `${node.id}:items`;
      node.stateRefs.push({ signalId, propKey: 'items' });
      graph.registerHandler(`__signal__${signalId}`, condition as unknown as () => unknown);
      graph.registerHandler(`__listbuild__${node.id}`, buildAll as unknown as () => unknown);
      const current = (condition as ReadonlySignal<boolean>).peek();
      for (const child of buildAll(current)) node.appendChild(child);
    } else {
      // Static condition — resolve once at build time, no reactive wiring.
      for (const child of buildAll(condition)) node.appendChild(child);
    }
  }

  errorBoundary(
    id: string,
    builder: ContainerBuilderFn,
    options: ErrorBoundaryOptions,
  ): void {
    // Normalise the observed error source(s) into an array.
    const sources: ErrorSource[] =
      options.source === undefined
        ? []
        : Array.isArray(options.source)
          ? [...options.source]
          : [options.source];

    // The boundary's own captured error (from a synchronous build throw) and a
    // retry nonce that forces a re-evaluation even when the boolean is unchanged.
    const localError = signal<unknown>(undefined);
    const retryNonce = signal<number>(0);

    const readError = (): unknown => {
      const local = localError.peek();
      if (local !== undefined && local !== null) return local;
      for (const s of sources) {
        const e = s.peek();
        if (e !== undefined && e !== null) return e;
      }
      return undefined;
    };

    // Reactive condition: true while an error is present. Reads every input so a
    // change in any source (or a retry) re-runs the conditional.
    const hasError = derived<boolean>(() => {
      retryNonce.get();
      localError.get();
      for (const s of sources) s.get();
      return readError() !== undefined;
    });

    const retry = (): void => {
      localError.set(undefined);
      options.onRetry?.();
      // Force the body branch to re-attempt even if no observed value changed.
      retryNonce.update((n) => n + 1);
    };

    // Wrap in a container so the whole boundary is addressable and disposes as a
    // unit. `when` provides the reactive body↔fallback swap (and its cleanup).
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
        (body) => {
          try {
            builder(body);
          } catch (err) {
            // Surface the throw as the boundary's error on the next microtask
            // (deferred to avoid re-entrant reconciliation during this build).
            queueMicrotask(() => localError.set(err));
          }
        },
      );
    }, { id });
  }

  asyncBoundary<T>(
    key: string,
    res: Resource<T>,
    branches: AsyncBoundaryBranches<T>,
  ): void {
    // Pure sugar over `resource` + `when` — no second async system, no new node
    // type, no renderer wiring. Three mutually-exclusive, exhaustive reactive
    // conditions select the live branch. Error wins; then resolved data (kept
    // visible during a refetch); then loading/idle.
    const isError = derived<boolean>(() => res.status.get() === 'error');
    const showSuccess = derived<boolean>(
      () => res.status.get() !== 'error' && res.data.get() !== undefined,
    );
    const showLoading = derived<boolean>(
      () => res.status.get() !== 'error' && res.data.get() === undefined,
    );
    // Narrow the data signal to `T` for the success branch. Only read inside the
    // success branch, where `data` is guaranteed present.
    const dataSignal = derived<T>(() => res.data.get() as T);
    const retry = (): void => {
      void res.refetch();
    };

    this.container(key, (c) => {
      c.when(isError, (fb) => branches.error?.(fb, res.error.peek(), retry));
      c.when(showSuccess, (sb) => branches.success(sb, dataSignal));
      c.when(showLoading, (lb) => branches.loading?.(lb));
    }, { key });
  }

  // ── Portals & overlays ──────────────────────────────────────────────────────

  portal(key: string, builder: ContainerBuilderFn, options: PortalOptions = {}): void {
    const node = this._graph.createNode('portal', {
      key,
      parent: this._node,
      props: containerProps(options),
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
  head(metadata: HeadMetadata): void {
    const node = this._graph.createNode('head', {
      parent: this._node,
      props: { 'data-streetui-head-anchor': '' },
    });
    const contribution = resolveHead(metadata);
    this._graph.registerHandler(
      `__head__${node.id}`,
      (() => contribution) as unknown as () => unknown,
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
  private _overlay(
    kind: OverlayKindConfig,
    key: string,
    options: OverlayOptions,
    builder: ContainerBuilderFn,
  ): void {
    const graph = this._graph;
    const portalNode = graph.createNode('portal', {
      key,
      parent: this._node,
      props: { key },
    });

    // Resolve `open` to a signal we can both bind (drives the panel's `when`)
    // and hand to the renderer (drives focus behavior). A literal is wrapped so
    // the panel still mounts/unmounts through the same reactive path.
    const openBindable = options.open;
    const openSignal: ReadonlySignal<boolean> = isSignal(openBindable)
      ? (openBindable as ReadonlySignal<boolean>)
      : signal(openBindable as boolean);

    // Panel a11y semantics (kind defaults, overridable via options).
    const panelOptions: ContainerOptions = {
      role: options.role ?? kind.role,
      ...(kind.ariaModal ? { ariaModal: true } : {}),
      ...(kind.ariaLive !== undefined ? { ariaLive: kind.ariaLive } : {}),
      ...(options.class !== undefined ? { class: options.class } : {}),
      ...(options.ariaLabel !== undefined ? { ariaLabel: options.ariaLabel } : {}),
      ...(options.ariaLabelledBy !== undefined ? { ariaLabelledBy: options.ariaLabelledBy } : {}),
      ...(options.ariaDescribedBy !== undefined ? { ariaDescribedBy: options.ariaDescribedBy } : {}),
    };

    const portalBuilder = new ContainerBuilderImpl(portalNode, graph);
    portalBuilder.when(
      openSignal,
      (panelHost) => {
        panelHost.container(`${key}__panel`, builder, panelOptions);
      },
      undefined,
      // Overlay open/close rides the panel's `when`; a transition animates the
      // panel in on open and — via the reconciler's deferred-leave — plays the
      // leave before the panel is removed (§10). Focus is restored at close-
      // request time (see wireOverlayBehavior), so it never stays trapped inside
      // a panel that is animating away.
      options.transition !== undefined ? { transition: options.transition } : {},
    );

    const descriptor: OverlayBehaviorDescriptor = {
      open: openSignal,
      modal: kind.modal,
      takesFocus: kind.takesFocus,
      menu: kind.menu ?? false,
      closeOnEscape: options.closeOnEscape ?? kind.defaultCloseOnEscape,
      restoreFocus: options.restoreFocus ?? kind.defaultRestoreFocus,
      ...(options.initialFocusId !== undefined ? { initialFocusId: options.initialFocusId } : {}),
      ...(options.onClose !== undefined ? { onClose: options.onClose } : {}),
    };
    graph.registerHandler(
      `__overlay__${portalNode.id}`,
      (() => descriptor) as unknown as () => unknown,
    );
  }

  dialog(key: string, options: OverlayOptions, builder: ContainerBuilderFn): void {
    this._overlay(OVERLAY_KINDS.dialog, key, options, builder);
  }

  popover(key: string, options: OverlayOptions, builder: ContainerBuilderFn): void {
    this._overlay(OVERLAY_KINDS.popover, key, options, builder);
  }

  tooltip(key: string, options: OverlayOptions, builder: ContainerBuilderFn): void {
    this._overlay(OVERLAY_KINDS.tooltip, key, options, builder);
  }

  dropdown(key: string, options: OverlayOptions, builder: ContainerBuilderFn): void {
    this._overlay(OVERLAY_KINDS.dropdown, key, options, builder);
  }

  toast(key: string, options: OverlayOptions, builder: ContainerBuilderFn): void {
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
  component<P>(
    key: string,
    def: ComponentDefinition<P>,
    props: P,
    children?: ContainerBuilderFn,
  ): void {
    const graph = this._graph;
    const node = graph.createNode('component', {
      key,
      parent: this._node,
      // `data-streetui-component` is a non-underscore prop, so it reaches the
      // DOM as an attribute and is visible to DevTools (§21) — unlike the
      // internal `_`-prefixed metadata the renderer hides.
      props: { key, 'data-streetui-component': def.name },
    });

    // Ownership collector: every teardown the setup registers lands here and is
    // handed to the NodeInstance at mount.
    const cleanups: Array<() => void> = [];
    const ctx: ComponentContext = {
      key,
      onCleanup(fn: () => void): void {
        cleanups.push(fn);
      },
      effect(fn: () => void | (() => void)): void {
        // Reuse the EXISTING reactive engine (§8) — no new reactivity. The
        // effect runs immediately (build time, like errorBoundary's derived);
        // its unsubscribe is owned by this component.
        cleanups.push(effect(fn));
      },
      renderChildren(content: ContainerDSL): void {
        if (children !== undefined) children(content);
      },
    };

    // Run setup to get the render function, guarding a synchronous throw the
    // same way errorBoundary does (defer so we never re-enter reconciliation
    // during this build). A component wrapped in an errorBoundary still surfaces
    // the error through the boundary's observed sources.
    let render: ComponentRender;
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
        (() => cleanups) as unknown as () => unknown,
      );
    }
  }
}

// ── Concrete builder implementations ─────────────────────────────────────────

export class SectionBuilderImpl extends ContainerBuilderBase implements SectionDSL {}
export class ContainerBuilderImpl extends ContainerBuilderBase implements ContainerDSL {}
export class FormBuilderImpl extends ContainerBuilderBase implements FormDSL {}

export class ListBuilderImpl extends ContentBuilderBase implements ListDSL {
  item(key: string, builder: ContainerBuilderFn, options: ContainerOptions = {}): void {
    const node = this._graph.createNode('list-item', {
      key,
      parent: this._node,
      props: containerProps(options),
    });
    registerTransition(this._graph, node, options.transition);
    builder(new ContainerBuilderImpl(node, this._graph));
  }
}

export class PageBuilderImpl extends ContainerBuilderBase implements PageDSL {}

// ── App builder ───────────────────────────────────────────────────────────────

export class AppBuilder implements AppDSL {
  constructor(private readonly _graph: ApplicationGraph) {}

  page(key: string, builder: PageBuilder): void {
    const node = this._graph.createNode('page', {
      key,
      parent: this._graph.root,
      props: { key },
    });
    builder(new PageBuilderImpl(node, this._graph));
  }
}
