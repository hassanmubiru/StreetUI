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
  Bindable,
  BindableText,
  TextValue,
  PageBuilder,
  SectionBuilder,
  ContainerBuilder as ContainerBuilderFn,
  FormBuilder,
  ListBuilder,
} from './dsl-types.js';
import type { Signal, ReadonlySignal } from '@streetui/state';

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

function containerProps(options: ContainerOptions): Props {
  const props: Props = {};
  if (options.class !== undefined) props['class'] = options.class;
  if (options.id !== undefined) props['id'] = options.id;
  if (options.key !== undefined) props['key'] = options.key;
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

// ── Base content builder ──────────────────────────────────────────────────────

class ContentBuilderBase implements ContentDSL {
  constructor(
    protected readonly _node: GraphNode,
    protected readonly _graph: ApplicationGraph,
  ) {}

  heading(text: BindableText, options: HeadingOptions = {}): void {
    const nodeOpts: { props?: Props } = {
      props: {
        level: options.level ?? 1,
        ...(options.class !== undefined ? { class: options.class } : {}),
        ...(options.id !== undefined ? { id: options.id } : {}),
      },
    };
    const node = this._graph.createNode('heading', { parent: this._node, ...nodeOpts });
    const resolved = bindValue<TextValue>(this._graph, node, 'text', text);
    node.setProp('text', resolved);
  }

  text(content: BindableText, options: TextOptions = {}): void {
    const props: Props = {};
    if (options.class !== undefined) props['class'] = options.class;
    if (options.id !== undefined) props['id'] = options.id;
    const node = this._graph.createNode('text', { parent: this._node, props });
    const resolved = bindValue<TextValue>(this._graph, node, 'text', content);
    node.setProp('text', resolved);
  }

  button(label: BindableText, options: ButtonOptions = {}): void {
    const props: Props = {};
    if (options.class !== undefined) props['class'] = options.class;
    if (options.id !== undefined) props['id'] = options.id;
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
    builder(new SectionBuilderImpl(node, this._graph));
  }

  container(key: string, builder: ContainerBuilderFn, options: ContainerOptions = {}): void {
    const node = this._graph.createNode('container', {
      key,
      parent: this._node,
      props: containerProps(options),
    });
    builder(new ContainerBuilderImpl(node, this._graph));
  }

  list(key: string, builder: ListBuilder, options: ListOptions = {}): void {
    const node = this._graph.createNode('list', {
      key,
      parent: this._node,
      props: containerProps(options),
    });
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
        props: { key: itemKey, _sig: reactiveListItemSignature(item) },
      });
      renderItem(item, index, new ContainerBuilderImpl(itemNode, graph));
      return itemNode;
    };

    // Factory the renderer invokes on every change to produce the desired,
    // freshly-rendered child nodes for the new items array.
    const buildAll = (raw: unknown): GraphNode[] => {
      const arr = Array.isArray(raw) ? (raw as T[]) : [];
      return arr.map((item, i) => buildItem(item, i));
    };
    graph.registerHandler(`__listbuild__${node.id}`, buildAll as unknown as () => unknown);

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
    if (options.onSubmit !== undefined) {
      const handlerKey = `submit:${node.id}`;
      this._graph.registerHandler(handlerKey, options.onSubmit as () => unknown);
      node.addEvent({ type: 'submit', handlerKey });
    }
    builder(new FormBuilderImpl(node, this._graph));
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
