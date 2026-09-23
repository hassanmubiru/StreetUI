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
import type { RenderContext } from './render-context.js';
import { NodeInstance } from './node-instance.js';
import { applyProp } from './attributes.js';
import { wireEvents } from './events.js';
import { resolveTag } from './tag-map.js';

export function mountGraph(ctx: RenderContext): NodeInstance {
  return mountNode(ctx, ctx.graph.root, ctx.container);
}

function mountNode(
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
    wireSignalBindings(ctx, graphNode, instance, (propKey, value) => {
      if (propKey === 'text') {
        dom.setTextContent(textNode, String(value ?? ''));
      } else {
        applyProp(dom, el, propKey, value);
      }
    });

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

    wireSignalBindings(ctx, graphNode, instance, (propKey, value) => {
      if (propKey === 'text') {
        dom.setTextContent(el, String(value ?? ''));
      } else {
        applyProp(dom, el, propKey, value);
      }
    });

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

    wireSignalBindings(ctx, graphNode, instance, (propKey, value) => {
      if (propKey === 'value') {
        dom.setProperty(el, 'value', String(value ?? ''));
      } else {
        applyProp(dom, el, propKey, value);
      }
    });

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

    wireSignalBindings(ctx, graphNode, instance, (propKey, value) => {
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
    });

    dom.appendChild(parentDom, el);
    return instance;
  }

  // Container / section / page / form / list / list-item — structural nodes
  const tag = resolveTag(graphNode.type);
  const el = dom.createElement(tag);
  applyNodeProps(ctx, graphNode, el);

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

function applyNodeProps(ctx: RenderContext, graphNode: GraphNode, el: Element): void {
  const skipKeys = new Set(['text', 'label', 'level', 'inputType', 'src', 'alt',
    'href', 'external', 'value', 'placeholder', 'disabled', '_renderKey', 'key', 'name']);
  for (const [key, value] of Object.entries(graphNode.props)) {
    if (skipKeys.has(key)) continue;
    applyProp(ctx.dom, el, key, value);
  }
}

function wireSignalBindings(
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
