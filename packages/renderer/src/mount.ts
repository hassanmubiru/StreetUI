/**
 * Initial mount — creates DOM nodes for every GraphNode and
 * attaches them into the container.
 *
 * This is a recursive depth-first walk. For each GraphNode:
 *  1. Create the DOM element (or text node)
 *  2. Apply props/attributes
 *  3. Wire events
 *  4. Wire signal subscriptions for reactive props
 *  5. Recurse into children
 *  6. Insert into the DOM
 */

import type { GraphNode, ApplicationGraph } from '@streetui/graph';
import type { DOMAdapter } from '@streetui/dom';
import type { RenderContext } from './render-context.js';
import { NodeInstance } from './node-instance.js';
import { applyProp } from './attributes.js';
import { wireEvents } from './events.js';
import { resolveTag } from './tag-map.js';
import {
  reconcileChildren,
  reconcileChildrenByPlan,
  type PlanEntry,
} from './reconciliation.js';

/**
 * Prop keys handled by the per-type mount branches (or reserved internals), so
 * `applyNodeProps` must skip them to avoid double-applying. This set is
 * invariant across nodes, so it is hoisted to module scope: allocating it once
 * (rather than per node) removes N Set allocations per mount/SSR pass and the
 * GC pressure they create. Treat as read-only — never mutate.
 */
const SKIP_PROP_KEYS: ReadonlySet<string> = new Set([
  'text', 'label', 'level', 'inputType', 'src', 'alt', 'href', 'external',
  'value', 'placeholder', 'disabled', '_renderKey', 'key', 'name',
]);

export function mountGraph(ctx: RenderContext): NodeInstance {
  return mountNode(ctx, ctx.graph.root, ctx.container);
}

export function mountNode(
  ctx: RenderContext,
  graphNode: GraphNode,
  parentDom: Node,
): NodeInstance {
  const { dom, graph } = ctx;

  // The application root node maps to the container itself — don't create a duplicate element
  if (graphNode.type === 'application') {
    const instance = new NodeInstance(graphNode, parentDom);
    ctx.instances.set(graphNode.id, instance);
    for (const child of graphNode.children) {
      const childInstance = mountNode(ctx, child, parentDom);
      instance.addChild(childInstance);
    }
    return instance;
  }

  // Text-only nodes render as a <span> containing a text node
  if (graphNode.type === 'text') {
    const text = String(graphNode.getProp('text') ?? '');
    const el = dom.createElement('span');
    const textNode = dom.createTextNode(text);
    dom.appendChild(el, textNode);
    applyNodeProps(ctx, graphNode, el);
    wireEvents(dom, graph, graphNode, el, new NodeInstance(graphNode, el));

    const instance = new NodeInstance(graphNode, el);
    ctx.instances.set(graphNode.id, instance);

    // Reactive text binding
    wireSignalBindings(ctx, graphNode, instance, textUpdate(dom, el, textNode));

    dom.appendChild(parentDom, el);
    return instance;
  }

  // Heading nodes
  if (graphNode.type === 'heading') {
    const level = (graphNode.getProp('level') as number | undefined) ?? 1;
    const tag = `h${level}` as string;
    const el = dom.createElement(tag);
    const text = String(graphNode.getProp('text') ?? '');
    dom.setTextContent(el, text);
    applyNodeProps(ctx, graphNode, el);

    const instance = new NodeInstance(graphNode, el);
    ctx.instances.set(graphNode.id, instance);
    wireEvents(dom, graph, graphNode, el, instance);

    wireSignalBindings(ctx, graphNode, instance, headingUpdate(dom, el));

    dom.appendChild(parentDom, el);
    return instance;
  }

  // Input nodes
  if (graphNode.type === 'input') {
    const el = dom.createElement('input') as HTMLInputElement;
    const inputType = String(graphNode.getProp('inputType') ?? 'text');
    dom.setAttribute(el, 'type', inputType);
    const placeholder = graphNode.getProp('placeholder');
    if (placeholder !== undefined) dom.setAttribute(el, 'placeholder', String(placeholder));
    const value = graphNode.getProp('value');
    if (value !== undefined) dom.setProperty(el, 'value', String(value));
    applyNodeProps(ctx, graphNode, el);

    const instance = new NodeInstance(graphNode, el);
    ctx.instances.set(graphNode.id, instance);
    wireEvents(dom, graph, graphNode, el, instance);

    wireSignalBindings(ctx, graphNode, instance, inputUpdate(dom, el));

    dom.appendChild(parentDom, el);
    return instance;
  }

  // Image nodes
  if (graphNode.type === 'image') {
    const el = dom.createElement('img') as HTMLImageElement;
    const src = graphNode.getProp('src');
    const alt = graphNode.getProp('alt');
    if (src !== undefined) dom.setAttribute(el, 'src', String(src));
    if (alt !== undefined) dom.setAttribute(el, 'alt', String(alt));
    const width = graphNode.getProp('width');
    const height = graphNode.getProp('height');
    if (width !== undefined) dom.setAttribute(el, 'width', String(width));
    if (height !== undefined) dom.setAttribute(el, 'height', String(height));
    applyNodeProps(ctx, graphNode, el);

    const instance = new NodeInstance(graphNode, el);
    ctx.instances.set(graphNode.id, instance);
    dom.appendChild(parentDom, el);
    return instance;
  }

  // Link nodes
  if (graphNode.type === 'link') {
    const el = dom.createElement('a') as HTMLAnchorElement;
    const href = graphNode.getProp('href');
    const label = graphNode.getProp('label');
    const external = graphNode.getProp('external');
    if (href !== undefined) dom.setAttribute(el, 'href', String(href));
    if (label !== undefined) dom.setTextContent(el, String(label));
    if (external === true) {
      dom.setAttribute(el, 'target', '_blank');
      dom.setAttribute(el, 'rel', 'noopener noreferrer');
    }
    applyNodeProps(ctx, graphNode, el);

    const instance = new NodeInstance(graphNode, el);
    ctx.instances.set(graphNode.id, instance);
    wireEvents(dom, graph, graphNode, el, instance);
    dom.appendChild(parentDom, el);
    return instance;
  }

  // Button nodes
  if (graphNode.type === 'button') {
    const el = dom.createElement('button') as HTMLButtonElement;
    const label = graphNode.getProp('label');
    if (label !== undefined) dom.setTextContent(el, String(label));
    const disabled = graphNode.getProp('disabled');
    if (disabled === true) dom.setAttribute(el, 'disabled', '');
    applyNodeProps(ctx, graphNode, el);

    const instance = new NodeInstance(graphNode, el);
    ctx.instances.set(graphNode.id, instance);
    wireEvents(dom, graph, graphNode, el, instance);

    wireSignalBindings(ctx, graphNode, instance, buttonUpdate(dom, el));

    dom.appendChild(parentDom, el);
    return instance;
  }

  // Reactive list / conditional — a container whose children are driven by a
  // Signal. Initial child subtrees are already built into the graph by the DSL;
  // on signal change we reconcile the freshly-built desired children against the
  // live DOM using the keyed reconciler (no virtual DOM). A `conditional` uses
  // the identical machinery but renders as a neutral <div> holding 0..1 branch.
  if (graphNode.type === 'reactive-list' || graphNode.type === 'conditional') {
    const tag = resolveTag(graphNode.type);
    const el = dom.createElement(tag);
    applyNodeProps(ctx, graphNode, el);

    const instance = new NodeInstance(graphNode, el);
    ctx.instances.set(graphNode.id, instance);

    for (const child of graphNode.children) {
      const childInstance = mountNode(ctx, child, el);
      instance.addChild(childInstance);
    }

    dom.appendChild(parentDom, el);
    wireReactiveList(ctx, graphNode, instance, el);
    return instance;
  }

  // Container / section / page / form / list / list-item — structural nodes
  const tag = resolveTag(graphNode.type);
  const el = dom.createElement(tag);
  applyNodeProps(ctx, graphNode, el);

  // Surface a reactive-list item's stable, identity-only reconciliation key as a
  // public `data-streetui-key` attribute (e.g. "id:1"). This exposes only the
  // identity part — never the internal `_sig` value signature, signal ids or
  // graph node ids — so a row is directly selectable and its identity is
  // inspectable across reorders and in-place data updates.
  if (graphNode.type === 'list-item') {
    const itemKey = graphNode.getProp('key');
    if (itemKey !== undefined) {
      dom.setAttribute(el, 'data-streetui-key', String(itemKey));
    }
  }

  // wire form submit
  if (graphNode.type === 'form') {
    wireEvents(dom, graph, graphNode, el, new NodeInstance(graphNode, el));
  }

  const instance = new NodeInstance(graphNode, el);
  ctx.instances.set(graphNode.id, instance);

  // Recurse into children
  for (const child of graphNode.children) {
    const childInstance = mountNode(ctx, child, el);
    instance.addChild(childInstance);
  }

  dom.appendChild(parentDom, el);
  return instance;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Per-node-type reactive-binding factories. Each returns the `onUpdate`
 * callback that `wireSignalBindings` invokes when a bound signal changes.
 * Extracted so both the browser mount path and the hydration path apply the
 * exact same DOM mutation semantics for each prop — no duplicated rendering
 * logic.
 */
export function textUpdate(
  dom: DOMAdapter,
  el: Element,
  textNode: Text,
): (propKey: string, value: unknown) => void {
  return (propKey, value) => {
    if (propKey === 'text') {
      dom.setTextContent(textNode, String(value ?? ''));
    } else {
      applyProp(dom, el, propKey, value);
    }
  };
}

export function headingUpdate(
  dom: DOMAdapter,
  el: Element,
): (propKey: string, value: unknown) => void {
  return (propKey, value) => {
    if (propKey === 'text') {
      dom.setTextContent(el, String(value ?? ''));
    } else {
      applyProp(dom, el, propKey, value);
    }
  };
}

export function inputUpdate(
  dom: DOMAdapter,
  el: Element,
): (propKey: string, value: unknown) => void {
  return (propKey, value) => {
    if (propKey === 'value') {
      dom.setProperty(el, 'value', String(value ?? ''));
    } else {
      applyProp(dom, el, propKey, value);
    }
  };
}

export function buttonUpdate(
  dom: DOMAdapter,
  el: Element,
): (propKey: string, value: unknown) => void {
  return (propKey, value) => {
    if (propKey === 'label') {
      dom.setTextContent(el, String(value ?? ''));
    } else if (propKey === 'disabled') {
      if (value === true) {
        dom.setAttribute(el, 'disabled', '');
      } else {
        dom.removeAttribute(el, 'disabled');
      }
    } else {
      applyProp(dom, el, propKey, value);
    }
  };
}

export function applyNodeProps(ctx: RenderContext, graphNode: GraphNode, el: Element): void {
  for (const [key, value] of Object.entries(graphNode.props)) {
    if (SKIP_PROP_KEYS.has(key)) continue;
    applyProp(ctx.dom, el, key, value);
  }
}

export function wireSignalBindings(
  ctx: RenderContext,
  graphNode: GraphNode,
  instance: NodeInstance,
  onUpdate: (propKey: string, value: unknown) => void,
): void {
  for (const stateRef of graphNode.stateRefs) {
    const signalKey = `__signal__${stateRef.signalId}`;
    const maybeSig = ctx.graph.getHandler(signalKey) as
      | { subscribe: (fn: (v: unknown) => void) => () => void; peek: () => unknown }
      | undefined;
    if (maybeSig === undefined || typeof maybeSig.subscribe !== 'function') continue;

    // Subscribe directly — avoids the ReadonlySignal<T> generic variance issue
    const unsub = maybeSig.subscribe((value) => {
      onUpdate(stateRef.propKey, value);
    });
    instance.trackCleanup(unsub);
  }
}

// ── Reactive list wiring ────────────────────────────────────────────────────────

type ListBuildFn = (items: unknown) => GraphNode[];
type ListPlanFn = (items: unknown) => PlanEntry[];

/**
 * Subscribe a reactive-list instance to its driving signal. On each change the
 * DSL-registered plan factory produces lightweight per-row descriptors, which
 * are reconciled against the live DOM with the keyed, minimal-move reconciler
 * (spec §15). A `conditional` node has no plan handler and falls back to the
 * eager build factory (it only ever renders 0..1 branch, so eager is fine).
 */
export function wireReactiveList(
  ctx: RenderContext,
  graphNode: GraphNode,
  instance: NodeInstance,
  el: Element,
): void {
  const plan = ctx.graph.getHandler(`__listplan__${graphNode.id}`) as
    | ListPlanFn
    | undefined;
  const build = ctx.graph.getHandler(`__listbuild__${graphNode.id}`) as
    | ListBuildFn
    | undefined;
  if (plan === undefined && build === undefined) return;

  for (const stateRef of graphNode.stateRefs) {
    if (stateRef.propKey !== 'items') continue;
    const sig = ctx.graph.getHandler(`__signal__${stateRef.signalId}`) as
      | { subscribe: (fn: (v: unknown) => void) => () => void }
      | undefined;
    if (sig === undefined || typeof sig.subscribe !== 'function') continue;

    const unsub = sig.subscribe((value) => {
      if (plan !== undefined) {
        reconcileReactiveListByPlan(ctx, graphNode, instance, el, plan(value));
      } else {
        reconcileReactiveList(ctx, graphNode, instance, el, build!(value));
      }
    });
    instance.trackCleanup(unsub);
  }
}

function reconcileReactiveListByPlan(
  ctx: RenderContext,
  listNode: GraphNode,
  listInstance: NodeInstance,
  listEl: Element,
  plan: PlanEntry[],
): void {
  const oldInstances = [...listInstance.children];
  const result = reconcileChildrenByPlan(
    ctx,
    listEl,
    oldInstances,
    plan,
    (node, parent) => mountNode(ctx, node, parent),
  );

  // Sync the live instance's children to the reconciled order.
  listInstance.children.length = 0;
  for (const inst of result.instances) listInstance.children.push(inst);

  // Forget removed instances, and drop their graph nodes.
  for (const removed of result.removed) {
    forgetInstance(ctx, removed);
    ctx.graph.detachNode(removed.graphNode);
  }
  // Detach any freshly-built subtree that was not adopted as a live instance
  // (e.g. the top node of a rebuilt changed row, whose live instance keeps its
  // original graph node).
  const adopted = new Set(result.instances.map((i) => i.graphNode));
  for (const node of result.built ?? []) {
    if (!adopted.has(node)) ctx.graph.detachNode(node);
  }

  // Keep the graph model consistent: list node children match the new order.
  for (const child of [...listNode.children]) listNode.removeChild(child);
  for (const inst of result.instances) listNode.appendChild(inst.graphNode);
}

function reconcileReactiveList(
  ctx: RenderContext,
  listNode: GraphNode,
  listInstance: NodeInstance,
  listEl: Element,
  newNodes: GraphNode[],
): void {
  const oldInstances = [...listInstance.children];
  const result = reconcileChildren(
    ctx,
    listEl,
    oldInstances,
    newNodes,
    (node, parent) => mountNode(ctx, node, parent),
  );

  // Sync the live instance's children to the reconciled order.
  listInstance.children.length = 0;
  for (const inst of result.instances) listInstance.children.push(inst);

  // Forget removed instances from the renderer index, and drop their graph
  // nodes (and any un-adopted freshly-built duplicates) from the graph index.
  for (const removed of result.removed) {
    forgetInstance(ctx, removed);
    ctx.graph.detachNode(removed.graphNode);
  }
  const adopted = new Set(result.instances.map((i) => i.graphNode));
  for (const built of newNodes) {
    if (!adopted.has(built)) ctx.graph.detachNode(built);
  }

  // Keep the graph model consistent: list node children match the new order.
  for (const child of [...listNode.children]) listNode.removeChild(child);
  for (const inst of result.instances) listNode.appendChild(inst.graphNode);
}

/** Recursively remove an instance subtree from the renderer's instance index. */
function forgetInstance(ctx: RenderContext, instance: NodeInstance): void {
  ctx.instances.delete(instance.graphNode.id);
  for (const child of instance.children) forgetInstance(ctx, child);
}
