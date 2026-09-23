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

// ── Base content builder ──────────────────────────────────────────────────────

class ContentBuilderBase implements ContentDSL {
  constructor(
    protected readonly _node: GraphNode,
    protected readonly _graph: ApplicationGraph,
  ) {}

  heading(text: Bindable<string>, options: HeadingOptions = {}): void {
    const nodeOpts: { props?: Props } = {
      props: {
        level: options.level ?? 1,
        ...(options.class !== undefined ? { class: options.class } : {}),
        ...(options.id !== undefined ? { id: options.id } : {}),
      },
    };
    const node = this._graph.createNode('heading', { parent: this._node, ...nodeOpts });
    const resolved = bindValue(this._graph, node, 'text', text);
    node.setProp('text', resolved);
  }

  text(content: Bindable<string>, options: TextOptions = {}): void {
    const props: Props = {};
    if (options.class !== undefined) props['class'] = options.class;
    if (options.id !== undefined) props['id'] = options.id;
    const node = this._graph.createNode('text', { parent: this._node, props });
    const resolved = bindValue(this._graph, node, 'text', content);
    node.setProp('text', resolved);
  }

  button(label: Bindable<string>, options: ButtonOptions = {}): void {
    const props: Props = {};
    if (options.class !== undefined) props['class'] = options.class;
    if (options.id !== undefined) props['id'] = options.id;
    const node = this._graph.createNode('button', { parent: this._node, props });
    const resolved = bindValue(this._graph, node, 'label', label);
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
    if (options.value !== undefined) {
      const resolved = bindValue(this._graph, node, 'value', options.value);
      node.setProp('value', resolved);
    }
    if (options.disabled !== undefined) {
      const resolved = bindValue(this._graph, node, 'disabled', options.disabled);
      node.setProp('disabled', resolved);
    }
    if (options.onInput !== undefined) {
      const handlerKey = `input:${node.id}`;
      this._graph.registerHandler(handlerKey, options.onInput as () => unknown);
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

  link(label: Bindable<string>, options: LinkOptions): void {
    const props: Props = {
      href: options.href,
      external: options.external ?? false,
    };
    if (options.class !== undefined) props['class'] = options.class;
    if (options.id !== undefined) props['id'] = options.id;
    const node = this._graph.createNode('link', { parent: this._node, props });
    const resolved = bindValue(this._graph, node, 'label', label);
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
