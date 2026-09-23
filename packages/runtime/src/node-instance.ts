/**
 * RuntimeNodeInstance — the runtime's live representation of a GraphNode.
 *
 * Each GraphNode in the compiled application gets a corresponding
 * RuntimeNodeInstance during mounting. The instance owns:
 *  - the DOM node(s) produced for this graph node
 *  - all signal subscriptions that drive updates
 *  - all DOM event listeners
 *  - child instances
 */

import { CleanupRegistry } from '@streetui/core';
import type { GraphNode } from '@streetui/graph';
import type { Signal, ReadonlySignal } from '@streetui/state';

export interface NodeInstanceOptions {
  readonly graphNode: GraphNode;
  readonly domNode: Node;
}

export class RuntimeNodeInstance {
  readonly graphNode: GraphNode;
  domNode: Node;
  readonly children: RuntimeNodeInstance[] = [];
  readonly cleanup: CleanupRegistry = new CleanupRegistry();
  private _mounted = false;

  constructor(options: NodeInstanceOptions) {
    this.graphNode = options.graphNode;
    this.domNode = options.domNode;
  }

  get isMounted(): boolean {
    return this._mounted;
  }

  mount(): void {
    this._mounted = true;
  }

  unmount(): void {
    if (!this._mounted) return;
    this._mounted = false;
    for (const child of this.children) {
      child.unmount();
    }
    this.cleanup.run();
  }

  addChild(instance: RuntimeNodeInstance): void {
    this.children.push(instance);
  }

  /** Subscribe to a signal and register the unsubscribe for cleanup. */
  trackSignal<T>(
    signal: Signal<T> | ReadonlySignal<T>,
    handler: (value: T) => void,
  ): void {
    const unsub = signal.subscribe(handler);
    this.cleanup.add(unsub);
  }

  /** Register an arbitrary cleanup function (e.g. DOM event removal). */
  trackCleanup(fn: () => void): void {
    this.cleanup.add(fn);
  }
}
