/**
 * NodeInstance — the renderer's live counterpart to a GraphNode.
 *
 * Tracks the actual DOM node(s), all signal subscriptions that drive
 * targeted DOM updates, and DOM event listener teardowns.
 */

import { CleanupRegistry } from '@streetui/core';
import type { GraphNode } from '@streetui/graph';
import type { ReadonlySignal } from '@streetui/state';

export class NodeInstance {
  readonly graphNode: GraphNode;
  /** The primary DOM node for this instance (element or text node). */
  domNode: Node;
  readonly children: NodeInstance[] = [];
  readonly cleanup: CleanupRegistry = new CleanupRegistry();

  constructor(graphNode: GraphNode, domNode: Node) {
    this.graphNode = graphNode;
    this.domNode = domNode;
  }

  addChild(child: NodeInstance): void {
    this.children.push(child);
  }

  /** Subscribe to a signal; auto-cleanup on unmount. */
  trackSignal<T>(sig: ReadonlySignal<T>, handler: (v: T) => void): void {
    const unsub = sig.subscribe(handler);
    this.cleanup.add(unsub);
  }

  /** Register a raw cleanup fn (DOM event removal, etc.). */
  trackCleanup(fn: () => void): void {
    this.cleanup.add(fn);
  }

  dispose(): void {
    for (const child of this.children) {
      child.dispose();
    }
    this.cleanup.run();
  }
}
