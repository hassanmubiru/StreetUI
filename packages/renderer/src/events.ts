/**
 * Event wiring for the renderer.
 *
 * Given a GraphNode with event descriptors, this wires DOM listeners
 * that call the handlers stored in the graph's handler registry.
 */

import type { DOMAdapter } from '@streetui/dom';
import type { ApplicationGraph, GraphNode } from '@streetui/graph';
import type { NodeInstance } from './node-instance.js';

export function wireEvents(
  dom: DOMAdapter,
  graph: ApplicationGraph,
  node: GraphNode,
  element: Element,
  instance: NodeInstance,
): void {
  // Fast exit for event-free nodes — avoids allocating a for-of iterator over
  // an empty array on every node during a large mount/hydrate.
  if (node.events.length === 0) return;
  for (const eventDesc of node.events) {
    const handler = graph.getHandler(eventDesc.handlerKey);
    if (handler === undefined) continue;

    const domListener: EventListener = (domEvent: Event) => {
      // For input events, pass the current value as first arg
      if (eventDesc.type === 'input' || eventDesc.type === 'change') {
        const input = domEvent.target as HTMLInputElement;
        (handler as (v: string) => void)(input.value);
      } else if (eventDesc.type === 'submit') {
        domEvent.preventDefault();
        (handler as (e: Event) => void)(domEvent);
      } else {
        (handler as () => void)();
      }
    };

    dom.addEventListener(element, eventDesc.type, domListener);
    instance.trackCleanup(() => {
      dom.removeEventListener(element, eventDesc.type, domListener);
    });
  }
}
