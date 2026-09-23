/**
 * Reconciliation — diff-based child list updates.
 *
 * When the children of a node change (e.g. a list driven by state),
 * this reconciler:
 *  1. Matches old instances to new graph nodes by key
 *  2. Reuses matched instances (updates their props)
 *  3. Creates new instances for additions
 *  4. Removes stale instances
 *  5. Moves DOM nodes to match new order
 *
 * For the initial release this implements keyed reconciliation.
 */

import type { RenderContext } from './render-context.js';
import type { GraphNode } from '@streetui/graph';
import type { NodeInstance } from './node-instance.js';
import { patchNode } from './patch.js';

export interface ReconcileResult {
  /** Instances in the new order. */
  instances: NodeInstance[];
  /** Instances that were removed and must be disposed. */
  removed: NodeInstance[];
}

/**
 * Reconcile children of a container element against a new list of graph nodes.
 *
 * @param ctx         Render context
 * @param parentDom   The DOM parent element
 * @param oldInstances Current child instances (in order)
 * @param newNodes    New graph children (in desired order)
 * @param mountFn     Factory to create a new NodeInstance for a graph node
 */
export function reconcileChildren(
  ctx: RenderContext,
  parentDom: Element,
  oldInstances: NodeInstance[],
  newNodes: readonly GraphNode[],
  mountFn: (node: GraphNode, parent: Element) => NodeInstance,
): ReconcileResult {
  // Build key → old instance map
  const oldByKey = new Map<string, NodeInstance>();
  for (const inst of oldInstances) {
    const key = inst.graphNode.key ?? inst.graphNode.id;
    oldByKey.set(key, inst);
  }

  const newInstances: NodeInstance[] = [];
  const usedKeys = new Set<string>();

  for (const newNode of newNodes) {
    const key = newNode.key ?? newNode.id;
    const existing = oldByKey.get(key);

    if (existing !== undefined) {
      // Reuse — patch changed props
      usedKeys.add(key);
      patchExistingInstance(ctx, existing, newNode);
      newInstances.push(existing);
    } else {
      // New — create and mount
      const inst = mountFn(newNode, parentDom);
      newInstances.push(inst);
    }
  }

  // Determine removed instances
  const removed: NodeInstance[] = [];
  for (const inst of oldInstances) {
    const key = inst.graphNode.key ?? inst.graphNode.id;
    if (!usedKeys.has(key)) {
      removed.push(inst);
    }
  }

  // Remove stale DOM nodes
  for (const inst of removed) {
    const parent = ctx.dom.parentNode(inst.domNode);
    if (parent !== null) {
      ctx.dom.removeChild(parent, inst.domNode);
    }
    inst.dispose();
  }

  // Reorder DOM nodes to match new order
  let referenceNode: Node | null = null;
  for (let i = newInstances.length - 1; i >= 0; i--) {
    const inst = newInstances[i];
    if (inst === undefined) continue;
    const domNode = inst.domNode;
    const currentNext = ctx.dom.nextSibling(domNode);

    if (currentNext !== referenceNode) {
      ctx.dom.insertBefore(parentDom, domNode, referenceNode);
    }
    referenceNode = domNode;
  }

  return { instances: newInstances, removed };
}

function patchExistingInstance(
  ctx: RenderContext,
  instance: NodeInstance,
  newNode: GraphNode,
): void {
  const oldNode = instance.graphNode;
  for (const [key, newVal] of Object.entries(newNode.props)) {
    const oldVal = oldNode.getProp(key);
    if (!Object.is(oldVal, newVal)) {
      patchNode(ctx, instance.graphNode, key, newVal);
    }
  }
}
