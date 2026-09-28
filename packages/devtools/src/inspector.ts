/**
 * StreetUI DevTools — graph inspector and debug utilities.
 */

import { formatDiagnostic } from '@streetui/core';
import type { ApplicationGraph, GraphNode } from '@streetui/graph';
import type { CompiledApplication } from '@streetui/compiler';

export interface InspectedNode {
  id: string;
  type: string;
  key: string | undefined;
  props: Record<string, unknown>;
  eventTypes: string[];
  stateBindings: string[];
  children: InspectedNode[];
  depth: number;
}

export function inspectGraph(graph: ApplicationGraph): InspectedNode {
  return inspectNode(graph.root, 0);
}

function inspectNode(node: GraphNode, depth: number): InspectedNode {
  return {
    id: node.id,
    type: node.type,
    key: node.key,
    props: { ...node.props },
    eventTypes: node.events.map(e => e.type),
    stateBindings: node.stateRefs.map(r => `${r.propKey}→${r.signalId}`),
    depth,
    children: node.children.map(c => inspectNode(c, depth + 1)),
  };
}

/** Print a human-readable tree of the graph to a string. */
export function printGraph(graph: ApplicationGraph): string {
  const lines: string[] = [];
  graph.walk((node, depth) => {
    const indent = '  '.repeat(depth);
    const props = Object.entries(node.props)
      .filter(([k]) => !k.startsWith('_'))
      .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
      .join(', ');
    const events = node.events.length > 0
      ? ` [events: ${node.events.map(e => e.type).join(', ')}]`
      : '';
    const stateRefs = node.stateRefs.length > 0
      ? ` [signals: ${node.stateRefs.map(r => r.propKey).join(', ')}]`
      : '';
    lines.push(`${indent}<${node.type}${props ? ` ${props}` : ''}${events}${stateRefs}>`);
  });
  return lines.join('\n');
}

/** Print compilation diagnostics to a string. */
export function printDiagnostics(compiled: CompiledApplication): string {
  if (compiled.diagnostics.diagnostics.length === 0) {
    return '(no diagnostics)';
  }
  return compiled.diagnostics.diagnostics.map(formatDiagnostic).join('\n');
}

/** Returns node counts per type. */
export function nodeTypeStats(graph: ApplicationGraph): Record<string, number> {
  const counts: Record<string, number> = {};
  graph.walk(node => {
    counts[node.type] = (counts[node.type] ?? 0) + 1;
  });
  return counts;
}

/** A single component instance surfaced for DevTools inspection (§21). */
export interface InspectedComponent {
  /** The build-order node id (churns across rebuilds — not stable identity). */
  id: string;
  /** The stable, author-provided identity key passed at the call site. */
  key: string | undefined;
  /** The definition's human-readable name (from `data-streetui-component`). */
  name: string;
  /** Depth of the component node in the graph. */
  depth: number;
  /** Number of direct child nodes the component rendered. */
  childCount: number;
}

/**
 * List every `component()` instance in the graph, in document order, with its
 * stable `key`, human-readable `name` and location. Components are ordinary
 * `'component'` GraphNodes (they flow through `inspectGraph`/`printGraph`
 * already); this is the first-class, component-aware view for DevTools — it
 * reads the inspectable `data-streetui-component` name attribute the DSL sets,
 * never any internal `_`-prefixed metadata. Names/keys are stable across
 * fine-grained prop updates (which never rebuild the node).
 */
export function inspectComponents(graph: ApplicationGraph): InspectedComponent[] {
  const out: InspectedComponent[] = [];
  graph.walk((node, depth) => {
    if (node.type !== 'component') return;
    const name = node.props['data-streetui-component'];
    out.push({
      id: node.id,
      key: node.key,
      name: typeof name === 'string' ? name : 'Component',
      depth,
      childCount: node.children.length,
    });
  });
  return out;
}

// ── Interaction inspection (§19) ─────────────────────────────────────────────

/** An overlay currently wired in the graph (dialog/popover/tooltip/…). */
export interface InspectedOverlay {
  /** The build-order node id of the overlay's portal host. */
  id: string;
  /** The stable author-provided key, if any. */
  key: string | undefined;
  /** Whether the overlay is open right now (peeked, no subscription). */
  open: boolean;
  /** Modal (focus-trapping) overlay? */
  modal: boolean;
  /** Does it move focus into itself on open? */
  takesFocus: boolean;
  /** Is it a roving-focus menu (role="menu")? */
  menu: boolean;
  /** Does Escape close it? */
  closeOnEscape: boolean;
  /** Does it restore focus to the opener on close? */
  restoreFocus: boolean;
  /** Depth of the portal host node in the graph. */
  depth: number;
}

/** A transition currently wired on a graph node. */
export interface InspectedTransition {
  /** The build-order node id the transition is attached to. */
  id: string;
  /** The stable author-provided key, if any. */
  key: string | undefined;
  /** The node type the transition animates (element/portal/list-item/…). */
  nodeType: string;
  /** Fallback completion timeout in ms (the resolved `duration`). */
  duration: number;
  /** Does it animate the very first appearance (initial mount)? */
  appear: boolean;
  /** Depth of the node in the graph. */
  depth: number;
}

/** A prod-safe snapshot of the graph's interaction wiring. */
export interface InspectedInteractions {
  overlays: InspectedOverlay[];
  transitions: InspectedTransition[];
}

/**
 * Minimal structural views of the descriptors the DSL registers behind
 * `__overlay__<id>` / `__transition__<id>`. Duplicated here (not imported from
 * `@streetui/dsl`) so DevTools reads the wiring structurally, with no build-time
 * dependency on the DSL package — the same no-fragmentation discipline the
 * renderer already follows.
 */
interface OverlayDescriptorLike {
  readonly open: { peek(): boolean };
  readonly modal: boolean;
  readonly takesFocus: boolean;
  readonly menu: boolean;
  readonly closeOnEscape: boolean;
  readonly restoreFocus: boolean;
}
interface ResolvedTransitionLike {
  readonly duration: number;
  readonly appear: boolean;
}

/**
 * Snapshot every overlay and transition currently wired in the graph, in
 * document order. This is the interaction-aware companion to
 * {@link inspectComponents}: it reads only the `__overlay__<id>` /
 * `__transition__<id>` handler descriptors and public graph structure — it
 * peeks the `open` signal without subscribing, retains no DOM nodes, mutates
 * nothing, and is safe to call in production. Because a departing overlay's
 * handler is pruned on detach (`_unregisterNodeHandlers`), a closed-and-removed
 * overlay simply no longer appears here.
 */
export function inspectInteractions(graph: ApplicationGraph): InspectedInteractions {
  const overlays: InspectedOverlay[] = [];
  const transitions: InspectedTransition[] = [];
  graph.walk((node, depth) => {
    const overlayFn = graph.getHandler(`__overlay__${node.id}`) as
      | (() => OverlayDescriptorLike)
      | undefined;
    if (overlayFn !== undefined) {
      const d = overlayFn();
      overlays.push({
        id: node.id,
        key: node.key,
        open: d.open.peek(),
        modal: d.modal,
        takesFocus: d.takesFocus,
        menu: d.menu,
        closeOnEscape: d.closeOnEscape,
        restoreFocus: d.restoreFocus,
        depth,
      });
    }
    const transitionFn = graph.getHandler(`__transition__${node.id}`) as
      | (() => ResolvedTransitionLike)
      | undefined;
    if (transitionFn !== undefined) {
      const t = transitionFn();
      transitions.push({
        id: node.id,
        key: node.key,
        nodeType: node.type,
        duration: t.duration,
        appear: t.appear,
        depth,
      });
    }
  });
  return { overlays, transitions };
}

