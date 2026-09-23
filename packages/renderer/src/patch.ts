/**
 * Patch — targeted DOM updates driven by signal changes.
 *
 * When a signal fires, we look up the NodeInstance and apply
 * only the changed prop — no full re-render, no tree diffing.
 */

import type { RenderContext } from './render-context.js';
import type { GraphNode } from '@streetui/graph';
import { applyProp, patchProp } from './attributes.js';

export function patchNode(
  ctx: RenderContext,
  graphNode: GraphNode,
  propKey: string,
  newValue: unknown,
): void {
  const instance = ctx.instances.get(graphNode.id);
  if (instance === undefined) return;

  const domNode = instance.domNode;
  if (!ctx.dom.isElement(domNode)) return;

  const oldValue = graphNode.getProp(propKey);

  switch (propKey) {
    case 'text':
      if (!Object.is(oldValue, newValue)) {
        ctx.dom.setTextContent(domNode, String(newValue ?? ''));
        graphNode.setProp('text', String(newValue ?? ''));
      }
      break;
    case 'label':
      if (!Object.is(oldValue, newValue)) {
        ctx.dom.setTextContent(domNode, String(newValue ?? ''));
        graphNode.setProp('label', String(newValue ?? ''));
      }
      break;
    case 'disabled':
      if (newValue === true) {
        ctx.dom.setAttribute(domNode, 'disabled', '');
      } else {
        ctx.dom.removeAttribute(domNode, 'disabled');
      }
      graphNode.setProp('disabled', Boolean(newValue));
      break;
    case 'value':
      if (!Object.is(oldValue, newValue)) {
        ctx.dom.setProperty(domNode, 'value', String(newValue ?? ''));
        graphNode.setProp('value', String(newValue ?? ''));
      }
      break;
    default:
      patchProp(ctx.dom, domNode, propKey, oldValue, newValue);
      graphNode.setProp(propKey, newValue as string);
      break;
  }
}
