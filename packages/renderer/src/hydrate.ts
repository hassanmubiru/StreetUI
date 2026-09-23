/**
 * Hydration — attach a live StreetUI runtime to server-rendered HTML.
 *
 * `hydrate` walks the semantic application graph top-down against the DOM that
 * the server already produced. For every graph node it *adopts* the matching
 * existing element (creating a `NodeInstance` that points at it) and attaches
 * behavior — event listeners and signal subscriptions — using the exact same
 * helpers the browser mount path uses (`wireEvents`, `wireSignalBindings`,
 * `wireReactiveList`, and the per-type update factories). Nothing is recreated
 * when the DOM matches.
 *
 * Matching is positional and works because every non-application graph node
 * maps to exactly one element (see mount.ts). When the element at a position
 * does not match the expected tag (or is missing), only that subtree is
 * repaired: the fresh subtree is mounted and spliced into place, leaving the
 * rest of the hydrated tree untouched. A local mismatch never tears down the
 * whole app.
 */

import type { GraphNode } from '@streetui/graph';
import type { RenderContext } from './render-context.js';
import { NodeInstance } from './node-instance.js';
import { wireEvents } from './events.js';
import { resolveTag } from './tag-map.js';
import {
  mountNode,
  wireSignalBindings,
  wireReactiveList,
  textUpdate,
  headingUpdate,
  inputUpdate,
  buttonUpdate,
} from './mount.js';

/** Hydrate the whole application graph against `ctx.container`. */
export function hydrateGraph(ctx: RenderContext): NodeInstance {
  const root = ctx.graph.root;
  // The application root maps to the container itself (no element of its own),
  // exactly as in mountNode.
  const instance = new NodeInstance(root, ctx.container);
  ctx.instances.set(root.id, instance);
  hydrateChildren(ctx, root, instance, ctx.container);
  return instance;
}

/**
 * Adopt `domNode` as the live element for `graphNode` and attach behavior.
 * The caller has already verified `domNode` matches `graphNode` (right tag).
 */
function hydrateNode(ctx: RenderContext, graphNode: GraphNode, domNode: Element): NodeInstance {
  const { dom, graph } = ctx;

  switch (graphNode.type) {
    case 'text': {
      // <span> with an inner text node. Adopt the text node (or create one if
      // the server markup somehow lacks it).
      let textNode = dom.firstChild(domNode);
      if (textNode === null || !dom.isTextNode(textNode)) {
        const created = dom.createTextNode(String(graphNode.getProp('text') ?? ''));
        dom.appendChild(domNode, created);
        textNode = created;
      }
      const instance = new NodeInstance(graphNode, domNode);
      ctx.instances.set(graphNode.id, instance);
      wireEvents(dom, graph, graphNode, domNode, instance);
      wireSignalBindings(ctx, graphNode, instance, textUpdate(dom, domNode, textNode as Text));
      return instance;
    }

    case 'heading': {
      const instance = new NodeInstance(graphNode, domNode);
      ctx.instances.set(graphNode.id, instance);
      wireEvents(dom, graph, graphNode, domNode, instance);
      wireSignalBindings(ctx, graphNode, instance, headingUpdate(dom, domNode));
      return instance;
    }

    case 'input': {
      const instance = new NodeInstance(graphNode, domNode);
      ctx.instances.set(graphNode.id, instance);
      // The controlled value is already present in the server HTML (reflected as
      // the `value` attribute). Re-assert it as a live property so the element's
      // current value matches the bound signal exactly.
      const value = graphNode.getProp('value');
      if (value !== undefined) dom.setProperty(domNode, 'value', String(value));
      wireEvents(dom, graph, graphNode, domNode, instance);
      wireSignalBindings(ctx, graphNode, instance, inputUpdate(dom, domNode));
      return instance;
    }

    case 'button': {
      const instance = new NodeInstance(graphNode, domNode);
      ctx.instances.set(graphNode.id, instance);
      wireEvents(dom, graph, graphNode, domNode, instance);
      wireSignalBindings(ctx, graphNode, instance, buttonUpdate(dom, domNode));
      return instance;
    }

    case 'image':
    case 'link': {
      // Leaf elements with no reactive bindings or events beyond what the markup
      // already encodes; links may still carry click handlers.
      const instance = new NodeInstance(graphNode, domNode);
      ctx.instances.set(graphNode.id, instance);
      if (graphNode.type === 'link') wireEvents(dom, graph, graphNode, domNode, instance);
      return instance;
    }

    case 'reactive-list':
    case 'conditional': {
      // The server rendered the initial children (built into the graph at
      // compile time from the initial signal state). Adopt them positionally,
      // then subscribe for future signal changes — the same keyed reconciler as
      // the browser drives subsequent updates against the adopted instances.
      const instance = new NodeInstance(graphNode, domNode);
      ctx.instances.set(graphNode.id, instance);
      hydrateChildren(ctx, graphNode, instance, domNode);
      wireReactiveList(ctx, graphNode, instance, domNode);
      return instance;
    }

    default: {
      // Structural nodes: container / section / page / form / list / list-item.
      const instance = new NodeInstance(graphNode, domNode);
      ctx.instances.set(graphNode.id, instance);
      if (graphNode.type === 'form') {
        wireEvents(dom, graph, graphNode, domNode, instance);
      }
      hydrateChildren(ctx, graphNode, instance, domNode);
      return instance;
    }
  }
}

// ── Child matching + local mismatch recovery ───────────────────────────────────

/**
 * Positionally match a parent's expected child graph nodes against the actual
 * child *elements* in the DOM. Matching children are hydrated in place; a
 * mismatch (wrong tag or a missing element) triggers a local repair — the fresh
 * subtree is mounted and spliced into the correct position — without disturbing
 * sibling subtrees. Surplus DOM elements are removed.
 */
function hydrateChildren(
  ctx: RenderContext,
  parentGraphNode: GraphNode,
  parentInstance: NodeInstance,
  parentDom: Element,
): void {
  const expected = parentGraphNode.children;
  const actual = elementChildren(ctx, parentDom);
  let cursor = 0;

  for (const childNode of expected) {
    const want = expectedTag(ctx, childNode);
    const actualEl = actual[cursor];

    if (
      actualEl !== undefined &&
      ctx.dom.isElement(actualEl) &&
      ctx.dom.tagName(actualEl) === want
    ) {
      // Match — adopt the existing element.
      const inst = hydrateNode(ctx, childNode, actualEl);
      parentInstance.addChild(inst);
      cursor++;
    } else {
      // Mismatch or missing — repair only this subtree. Mount fresh, then move
      // it into the correct position ahead of the offending/absent node.
      const ref = actualEl ?? null;
      const inst = mountFreshAt(ctx, childNode, parentDom, ref);
      parentInstance.addChild(inst);
      if (actualEl !== undefined) {
        // Drop the mismatched element that the fresh node replaces.
        ctx.dom.removeChild(parentDom, actualEl);
        cursor++;
      }
    }
  }

  // Remove any surplus server elements the graph no longer expects.
  for (let i = cursor; i < actual.length; i++) {
    ctx.dom.removeChild(parentDom, actual[i]!);
  }
}

/** Mount a fresh subtree for `node` and splice it before `ref` (or append). */
function mountFreshAt(
  ctx: RenderContext,
  node: GraphNode,
  parentDom: Element,
  ref: Node | null,
): NodeInstance {
  // mountNode appends the new subtree at the end of parentDom.
  const inst = mountNode(ctx, node, parentDom);
  if (ref !== null) {
    ctx.dom.insertBefore(parentDom, inst.domNode, ref);
  }
  return inst;
}

/** The element (not text/comment) children of a node, in order. */
function elementChildren(ctx: RenderContext, parent: Element): Element[] {
  const out: Element[] = [];
  for (const node of ctx.dom.childNodes(parent)) {
    if (ctx.dom.isElement(node)) out.push(node);
  }
  return out;
}

/** The HTML tag a graph node is expected to occupy in the DOM. */
function expectedTag(ctx: RenderContext, graphNode: GraphNode): string {
  switch (graphNode.type) {
    case 'text':
      return 'span';
    case 'heading': {
      const level = (graphNode.getProp('level') as number | undefined) ?? 1;
      return `h${level}`;
    }
    case 'input':
      return 'input';
    case 'image':
      return 'img';
    case 'link':
      return 'a';
    case 'button':
      return 'button';
    default:
      // reactive-list → ul, conditional → div, structural → resolveTag.
      return resolveTag(graphNode.type);
  }
}
