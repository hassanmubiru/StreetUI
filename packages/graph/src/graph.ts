/**
 * The Semantic Application Graph.
 *
 * Holds the application root node and all its descendants.
 * Supports traversal, lookup by ID, validation, and serialization.
 */

import { type NodeId, DiagnosticCollector } from '@streetui/core';
import { GraphNode, type Props, type EventDescriptor } from './graph-node.js';

export interface ApplicationGraphOptions {
  readonly name: string;
  readonly version?: string;
}

export interface HandlerFn {
  (...args: unknown[]): unknown;
}

export class ApplicationGraph {
  readonly root: GraphNode;
  readonly name: string;
  readonly version: string;
  private readonly _nodeIndex: Map<NodeId, GraphNode> = new Map();
  /** Handler registry — maps handlerKey → actual function */
  readonly handlers: Map<string, HandlerFn> = new Map();

  constructor(options: ApplicationGraphOptions) {
    this.name = options.name;
    this.version = options.version ?? '0.0.1';
    this.root = new GraphNode('application', { props: { name: options.name } });
    this._nodeIndex.set(this.root.id, this.root);
  }

  // ── Node creation & attachment ────────────────────────────────────────────

  createNode(
    type: GraphNode['type'],
    options: { key?: string; props?: Props; parent?: GraphNode } = {},
  ): GraphNode {
    const nodeOpts: { key?: string; props?: Props } = {};
    if (options.key !== undefined) nodeOpts.key = options.key;
    if (options.props !== undefined) nodeOpts.props = options.props;
    const node = new GraphNode(type, nodeOpts);
    this._nodeIndex.set(node.id, node);
    if (options.parent !== undefined) {
      options.parent.appendChild(node);
    }
    return node;
  }

  attachNode(node: GraphNode, parent: GraphNode): void {
    this._nodeIndex.set(node.id, node);
    parent.appendChild(node);
  }

  detachNode(node: GraphNode): void {
    if (node.parent !== null) {
      node.parent.removeChild(node);
    }
    this._removeFromIndex(node);
  }

  private _removeFromIndex(node: GraphNode): void {
    this._nodeIndex.delete(node.id);
    for (const child of node.children) {
      this._removeFromIndex(child);
    }
  }

  // ── Handler registry ──────────────────────────────────────────────────────

  registerHandler(key: string, fn: HandlerFn): void {
    this.handlers.set(key, fn);
  }

  getHandler(key: string): HandlerFn | undefined {
    return this.handlers.get(key);
  }

  // ── Lookup ────────────────────────────────────────────────────────────────

  findById(id: NodeId): GraphNode | undefined {
    return this._nodeIndex.get(id);
  }

  findAll(predicate: (node: GraphNode) => boolean): GraphNode[] {
    const results: GraphNode[] = [];
    this._walk(this.root, node => {
      if (predicate(node)) results.push(node);
    });
    return results;
  }

  findByType(type: GraphNode['type']): GraphNode[] {
    return this.findAll(n => n.type === type);
  }

  // ── Traversal ─────────────────────────────────────────────────────────────

  walk(visitor: (node: GraphNode, depth: number) => void): void {
    this._walk(this.root, visitor, 0);
  }

  private _walk(
    node: GraphNode,
    visitor: (node: GraphNode, depth: number) => void,
    depth: number = 0,
  ): void {
    visitor(node, depth);
    for (const child of node.children) {
      this._walk(child, visitor, depth + 1);
    }
  }

  get nodeCount(): number {
    return this._nodeIndex.size;
  }

  // ── Validation ────────────────────────────────────────────────────────────

  validate(): DiagnosticCollector {
    const dc = new DiagnosticCollector();

    this.walk((node) => {
      // Validate event handler references exist
      for (const event of node.events) {
        if (!this.handlers.has(event.handlerKey)) {
          dc.warn(
            'GRAPH_MISSING_HANDLER',
            `Node "${node.id}" references handler "${event.handlerKey}" which is not registered`,
            { nodeId: node.id },
          );
        }
      }

      // Validate page nodes are direct children of root
      if (node.type === 'page' && node.parent?.type !== 'application') {
        dc.error(
          'GRAPH_PAGE_DEPTH',
          `Page node "${node.id}" must be a direct child of the application root`,
          { nodeId: node.id },
        );
      }
    });

    return dc;
  }

  // ── Serialization ─────────────────────────────────────────────────────────

  serialize(): SerializedGraph {
    return {
      name: this.name,
      version: this.version,
      root: this._serializeNode(this.root),
    };
  }

  private _serializeNode(node: GraphNode): SerializedNode {
    const result: SerializedNode = {
      id: node.id,
      type: node.type,
      key: node.key,
      props: node.props,
      events: node.events,
      stateRefs: node.stateRefs,
      children: node.children.map(c => this._serializeNode(c)),
    };
    return result;
  }
}

export interface SerializedNode {
  readonly id: string;
  readonly type: string;
  readonly key: string | undefined;
  readonly props: Props;
  readonly events: EventDescriptor[];
  readonly stateRefs: unknown[];
  readonly children: SerializedNode[];
}

export interface SerializedGraph {
  readonly name: string;
  readonly version: string;
  readonly root: SerializedNode;
}
