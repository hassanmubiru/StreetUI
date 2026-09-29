/**
 * Detailed structural inspectors for DevTools (2.2 Phase 1).
 *
 * Two read-only views derived purely from the one compiled graph — no second
 * graph, no subscriptions, no runtime instrumentation:
 *
 *   - `inspectEvents`  — the Event Inspector panel (#8): every node that carries
 *     event handlers, with the handler *types* it registers (never the handler
 *     functions themselves).
 *   - `inspectSignalGraph` — the Signal / Dependency Graph panel (#4): the
 *     bipartite wiring between distinct signal ids and the graph nodes that bind
 *     them, optionally enriched with each signal's live `kind` and
 *     `observerCount` when the caller supplies the live `Signal` instances by id.
 *
 * Both are pure: safe to call in a server, a test, or a DevTools panel.
 */

import type { CompiledApplication } from '@streetui/compiler';
import type { ApplicationGraph } from '@streetui/graph';
import {
  type ReadonlySignal,
  type SignalKind,
  signalKind,
  observerCount,
} from '@streetui/state';

// ── Event inspector (panel #8) ───────────────────────────────────────────────

/** A node that registers one or more event handlers. */
export interface InspectedEventNode {
  /** The build-order node id. */
  readonly id: string;
  /** The node's semantic type (button/input/…). */
  readonly nodeType: string;
  /** The stable author-provided key, if any. */
  readonly key: string | undefined;
  /** Depth of the node in the graph. */
  readonly depth: number;
  /** Event types wired on the node (e.g. `['click', 'keydown']`). Sorted. */
  readonly eventTypes: readonly string[];
}

/** A prod-safe summary of the graph's event wiring. */
export interface EventInspection {
  /** Every node carrying handlers, in document order. */
  readonly nodes: readonly InspectedEventNode[];
  /** Total handler registrations across all nodes. */
  readonly totalHandlers: number;
  /** Count of registrations per event type (e.g. `{ click: 3, input: 2 }`). */
  readonly byType: Readonly<Record<string, number>>;
}

/**
 * List every node that registers event handlers, with the handler *types* it
 * wires. Reads only the public graph structure (`node.events[].type`); the
 * handler functions are never surfaced. Document order, deterministic.
 */
export function inspectEvents(graph: ApplicationGraph): EventInspection {
  const nodes: InspectedEventNode[] = [];
  const byType: Record<string, number> = {};
  let totalHandlers = 0;

  graph.walk((node, depth) => {
    if (node.events.length === 0) return;
    const types = node.events.map((e) => e.type);
    for (const t of types) {
      byType[t] = (byType[t] ?? 0) + 1;
      totalHandlers += 1;
    }
    nodes.push({
      id: node.id,
      nodeType: node.type,
      key: node.key,
      depth,
      eventTypes: [...types].sort(),
    });
  });

  return { nodes, totalHandlers, byType };
}

// ── Signal / dependency graph (panel #4) ─────────────────────────────────────

/** One signal id and the nodes that bind it. */
export interface SignalGraphNode {
  /** The signal id as recorded in the graph's state references. */
  readonly signalId: string;
  /** Distinct graph-node ids that bind this signal. */
  readonly boundNodeIds: readonly string[];
  /** Number of binding edges into this signal (may exceed boundNodeIds if a node binds it twice). */
  readonly bindingCount: number;
  /** Live signal kind, present only when the live instance was supplied. */
  readonly kind?: SignalKind;
  /** Live observer count, present only when the live instance was supplied. */
  readonly observerCount?: number;
}

/** A single binding edge: a node prop is driven by a signal. */
export interface SignalGraphEdge {
  readonly signalId: string;
  readonly nodeId: string;
  readonly nodeType: string;
  readonly propKey: string;
}

/** The bipartite signal↔node wiring of an application. */
export interface SignalGraph {
  /** Distinct signals bound anywhere in the graph, sorted by id. */
  readonly signals: readonly SignalGraphNode[];
  /** Every binding edge, in document order. */
  readonly edges: readonly SignalGraphEdge[];
}

export interface InspectSignalGraphOptions {
  /**
   * Live `Signal` instances keyed by their signal id. When supplied, each
   * matching signal in the graph is enriched with its live `kind` and
   * `observerCount`. Purely additive — omit for a structure-only graph.
   */
  readonly signalsById?: Readonly<Record<string, ReadonlySignal<unknown>>>;
}

/**
 * Build the bipartite dependency graph between signals and the nodes that bind
 * them. Structural by default; pass `signalsById` to enrich with live
 * kind/observer counts. Deterministic ordering (edges in document order,
 * signals sorted by id).
 */
export function inspectSignalGraph(
  compiled: CompiledApplication,
  options: InspectSignalGraphOptions = {},
): SignalGraph {
  const graph = compiled.graph;
  const edges: SignalGraphEdge[] = [];
  const byId = new Map<string, { boundNodeIds: Set<string>; bindingCount: number }>();

  graph.walk((node) => {
    for (const ref of node.stateRefs) {
      edges.push({
        signalId: ref.signalId,
        nodeId: node.id,
        nodeType: node.type,
        propKey: ref.propKey,
      });
      let entry = byId.get(ref.signalId);
      if (entry === undefined) {
        entry = { boundNodeIds: new Set<string>(), bindingCount: 0 };
        byId.set(ref.signalId, entry);
      }
      entry.boundNodeIds.add(node.id);
      entry.bindingCount += 1;
    }
  });

  const live = options.signalsById;
  const signals: SignalGraphNode[] = [...byId.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([signalId, entry]) => {
      const base: SignalGraphNode = {
        signalId,
        boundNodeIds: [...entry.boundNodeIds],
        bindingCount: entry.bindingCount,
      };
      const sig = live?.[signalId];
      if (sig === undefined) return base;
      const oc = observerCount(sig);
      return {
        ...base,
        kind: signalKind(sig),
        ...(oc !== undefined ? { observerCount: oc } : {}),
      };
    });

  return { signals, edges };
}
