/**
 * Reconciliation — diff-based child list updates.
 *
 * When the children of a node change (e.g. a list driven by state),
 * this reconciler:
 *  1. Matches old instances to new graph nodes by key
 *  2. Reuses matched instances (updates their props)
 *  3. Applies a targeted content update to a reused item whose data changed
 *  4. Creates new instances for additions
 *  5. Removes stale instances (and prunes their handler registrations)
 *  6. Moves DOM nodes to match new order
 *
 * This is keyed reconciliation over the semantic graph — there is no virtual
 * DOM. A reused item keeps its own DOM element; only its changed content is
 * updated in place (falling back to remounting a subtree only where its shape
 * actually changed).
 */

import type { RenderContext } from './render-context.js';
import type { GraphNode } from '@streetui/graph';
import type { NodeInstance } from './node-instance.js';
import { patchNode } from './patch.js';

export type MountFn = (node: GraphNode, parent: Element) => NodeInstance;

export interface ReconcileResult {
  /** Instances in the new order. */
  instances: NodeInstance[];
  /** Instances that were removed and must be disposed. */
  removed: NodeInstance[];
  /**
   * GraphNodes freshly materialised during this reconcile (new rows + rebuilt
   * changed rows). The caller detaches any of these that were not adopted as a
   * live instance's graph node, so no orphan subtree lingers in the graph index.
   */
  built?: GraphNode[];
}

/**
 * A lazy reconciliation descriptor for one reactive-list row (mirrors the DSL's
 * `ListPlanEntry`). `sig()` and `build()` are only invoked for rows that are
 * genuinely new or whose source reference changed — the whole point of the
 * plan path (spec §15).
 */
export interface PlanEntry {
  readonly key: string;
  readonly item: unknown;
  readonly sig: () => string;
  readonly build: () => GraphNode;
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
  mountFn: MountFn,
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
      // Reuse — identity is stable, so the DOM element is preserved.
      usedKeys.add(key);
      const oldSig = existing.graphNode.getProp('_sig');
      const newSig = newNode.getProp('_sig');
      patchExistingInstance(ctx, existing, newNode);
      // Data changed but identity did not → targeted content update in place.
      if (!Object.is(oldSig, newSig)) {
        reconcileItemChildren(ctx, existing, newNode, mountFn);
      }
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
  reorderDom(ctx, parentDom, newInstances);

  return { instances: newInstances, removed };
}

/**
 * Plan-based keyed reconciliation (spec §15 — the optimised reactive-list path).
 *
 * Identical observable result to {@link reconcileChildren}, but driven by lazy
 * {@link PlanEntry} descriptors instead of a pre-built array of GraphNodes:
 *
 *  - a reused row whose `item` reference is unchanged does **zero** work — no
 *    signature hash, no subtree build, no prop patch (the common case for
 *    append / prepend / remove / reorder / reverse, where existing item objects
 *    keep their identity);
 *  - a reused row whose reference changed hashes lazily and, only on a real
 *    signature change, materialises a fresh subtree for a targeted in-place
 *    content update;
 *  - a genuinely new key builds + mounts exactly one subtree.
 *
 * DOM reordering uses a longest-increasing-subsequence pass so the number of
 * moves is minimal (e.g. a prepend into a 10k list moves 1 node, not 10k).
 */
export function reconcileChildrenByPlan(
  ctx: RenderContext,
  parentDom: Element,
  oldInstances: NodeInstance[],
  plan: readonly PlanEntry[],
  mountFn: MountFn,
): ReconcileResult {
  const oldByKey = new Map<string, NodeInstance>();
  for (const inst of oldInstances) {
    oldByKey.set(inst.graphNode.key ?? inst.graphNode.id, inst);
  }

  const newInstances: NodeInstance[] = [];
  const usedKeys = new Set<string>();
  const built: GraphNode[] = [];

  for (const entry of plan) {
    const existing = oldByKey.get(entry.key);
    if (existing !== undefined) {
      usedKeys.add(entry.key);
      const oldItem = existing.graphNode.getProp('_item');
      // Identity short-circuit: same reference ⇒ data cannot have changed.
      if (!Object.is(oldItem, entry.item)) {
        const newSig = entry.sig();
        const oldSig = existing.graphNode.getProp('_sig');
        if (!Object.is(oldSig, newSig)) {
          const freshNode = entry.build();
          built.push(freshNode);
          patchExistingInstance(ctx, existing, freshNode);
          reconcileItemChildren(ctx, existing, freshNode, mountFn);
          existing.graphNode.setProp('_sig', newSig);
        }
        // Cache the new reference so the next pass can short-circuit again.
        existing.graphNode.setProp('_item', entry.item as never);
      }
      newInstances.push(existing);
    } else {
      const freshNode = entry.build();
      built.push(freshNode);
      const inst = mountFn(freshNode, parentDom);
      newInstances.push(inst);
    }
  }

  // Determine + remove stale instances.
  const removed: NodeInstance[] = [];
  for (const inst of oldInstances) {
    const key = inst.graphNode.key ?? inst.graphNode.id;
    if (!usedKeys.has(key)) removed.push(inst);
  }
  for (const inst of removed) {
    const parent = ctx.dom.parentNode(inst.domNode);
    if (parent !== null) ctx.dom.removeChild(parent, inst.domNode);
    inst.dispose();
  }

  // Minimal-move reorder to the desired order.
  reorderDomMinimal(ctx, parentDom, oldInstances, newInstances);

  return { instances: newInstances, removed, built };
}

/**
 * Minimal-move DOM reorder.
 *
 * Reused nodes retain their previous DOM slots and newly-mounted nodes sit at
 * the end. We compute the longest increasing subsequence of the reused nodes'
 * previous positions; those are already in correct relative order and stay put.
 * Every other node is inserted before its right-hand neighbour, walking
 * right-to-left. This yields exactly (n − |LIS|) `insertBefore` calls — the
 * minimum — instead of the O(n) sweep the naive reorder performs on a prepend.
 */
function reorderDomMinimal(
  ctx: RenderContext,
  parentDom: Element,
  oldInstances: NodeInstance[],
  newInstances: NodeInstance[],
): void {
  const n = newInstances.length;
  if (n === 0) return;

  const oldIndexOf = new Map<NodeInstance, number>();
  for (let i = 0; i < oldInstances.length; i++) oldIndexOf.set(oldInstances[i]!, i);

  const source = new Array<number>(n);
  let moved = false;
  let lastSeen = -1;
  for (let i = 0; i < n; i++) {
    const oi = oldIndexOf.get(newInstances[i]!);
    if (oi === undefined) {
      source[i] = -1; // freshly mounted row
      moved = true;
    } else {
      source[i] = oi;
      if (oi < lastSeen) moved = true; // an out-of-order reused row exists
      else lastSeen = oi;
    }
  }

  // Fast path: nothing is out of order and there are no new rows to reposition.
  if (!moved) return;

  const keep = longestIncreasingSubsequence(source);

  let refNode: Node | null = null;
  for (let i = n - 1; i >= 0; i--) {
    const domNode = newInstances[i]!.domNode;
    if (source[i] === -1 || !keep.has(i)) {
      if (ctx.dom.nextSibling(domNode) !== refNode) {
        ctx.dom.insertBefore(parentDom, domNode, refNode);
      }
    }
    refNode = domNode;
  }
}

/**
 * Indices (into `source`) forming a longest strictly-increasing subsequence,
 * ignoring `-1` entries (new rows, which always move). O(n log n) with
 * predecessor reconstruction.
 */
function longestIncreasingSubsequence(source: readonly number[]): Set<number> {
  const keep = new Set<number>();
  const n = source.length;
  const tails: number[] = []; // tails[k] = source-index of smallest tail of an LIS of length k+1
  const prev = new Array<number>(n).fill(-1);

  for (let i = 0; i < n; i++) {
    const v = source[i]!;
    if (v < 0) continue;
    let lo = 0;
    let hi = tails.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (source[tails[mid]!]! < v) lo = mid + 1;
      else hi = mid;
    }
    if (lo > 0) prev[i] = tails[lo - 1]!;
    tails[lo] = i;
  }

  let idx = tails.length > 0 ? tails[tails.length - 1]! : -1;
  while (idx >= 0) {
    keep.add(idx);
    idx = prev[idx]!;
  }
  return keep;
}

/**
 * Targeted in-place content update for a reused list item whose data changed.
 *
 * The item's DOM element is kept; only its contents are updated. Children are
 * matched positionally against the freshly-built subtree:
 *  - same node type at a position → the existing child is reused and its props
 *    are patched in place (e.g. a text node's text is rewritten), then we
 *    recurse into its children;
 *  - different type / new position → the fresh child node is reparented onto the
 *    live item node and mounted;
 *  - surplus old children → disposed, with DOM, subscriptions, listeners and
 *    handler registrations all torn down.
 *
 * This deliberately reuses the same keyed/positional strategy rather than a
 * virtual DOM, and never destroys the item element itself.
 */
function reconcileItemChildren(
  ctx: RenderContext,
  itemInstance: NodeInstance,
  newItemNode: GraphNode,
  mountFn: MountFn,
): void {
  const el = itemInstance.domNode;
  if (!ctx.dom.isElement(el)) return;

  const oldChildren = [...itemInstance.children];
  const newChildNodes = [...newItemNode.children];
  const nextChildren: NodeInstance[] = [];
  const kept = new Set<NodeInstance>();

  for (let i = 0; i < newChildNodes.length; i++) {
    const newChild = newChildNodes[i]!;
    const oldChild = oldChildren[i];

    if (oldChild !== undefined && oldChild.graphNode.type === newChild.type) {
      // Reuse in place — patch this node's props and recurse into descendants.
      patchExistingInstance(ctx, oldChild, newChild);
      reconcileItemChildren(ctx, oldChild, newChild, mountFn);
      nextChildren.push(oldChild);
      kept.add(oldChild);
    } else {
      // Structural change at this position — mount the fresh child. Reparent it
      // out of the freshly-built subtree so the wholesale detach of the
      // unadopted item node (in mount.ts) does not remove this now-live node.
      itemInstance.graphNode.appendChild(newChild);
      const inst = mountFn(newChild, el);
      nextChildren.push(inst);
    }
  }

  // Dispose old children that were not reused (surplus or type-mismatched).
  for (const old of oldChildren) {
    if (kept.has(old)) continue;
    const parent = ctx.dom.parentNode(old.domNode);
    if (parent !== null) ctx.dom.removeChild(parent, old.domNode);
    old.dispose();
    forgetInstanceTree(ctx, old);
    ctx.graph.detachNode(old.graphNode);
  }

  // Restore correct DOM order within the item element.
  reorderDom(ctx, el, nextChildren);

  // Sync the live instance's children.
  itemInstance.children.length = 0;
  for (const c of nextChildren) itemInstance.children.push(c);

  // Keep the graph model's item children consistent with the reconciled order.
  for (const c of [...itemInstance.graphNode.children]) {
    itemInstance.graphNode.removeChild(c);
  }
  for (const c of nextChildren) itemInstance.graphNode.appendChild(c.graphNode);
}

/** Move a parent's DOM children to match the given instance order (minimal moves). */
function reorderDom(
  ctx: RenderContext,
  parentDom: Element,
  instances: NodeInstance[],
): void {
  let referenceNode: Node | null = null;
  for (let i = instances.length - 1; i >= 0; i--) {
    const inst = instances[i];
    if (inst === undefined) continue;
    const domNode = inst.domNode;
    const currentNext = ctx.dom.nextSibling(domNode);
    if (currentNext !== referenceNode) {
      ctx.dom.insertBefore(parentDom, domNode, referenceNode);
    }
    referenceNode = domNode;
  }
}

/** Recursively drop an instance subtree from the renderer's instance index. */
function forgetInstanceTree(ctx: RenderContext, instance: NodeInstance): void {
  ctx.instances.delete(instance.graphNode.id);
  for (const child of instance.children) forgetInstanceTree(ctx, child);
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
