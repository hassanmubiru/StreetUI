/**
 * Semantic Application Graph nodes.
 *
 * Every element in a StreetUI application is represented as a GraphNode.
 * Nodes form a tree: each has an optional parent and an ordered list of children.
 */

import { generateNodeId, type NodeId, type SemanticNodeType } from '@streetui/core';

// ── Property values ───────────────────────────────────────────────────────────

export type PropValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | string[]
  | number[]
  | Record<string, unknown>;

export type Props = Record<string, PropValue>;

// ── Event descriptors ─────────────────────────────────────────────────────────

export interface EventDescriptor {
  readonly type: string;
  /** Reference key into the application's handler registry. */
  readonly handlerKey: string;
}

// ── State references ──────────────────────────────────────────────────────────

export interface StateRef {
  /** ID of the signal/store this node's property is bound to. */
  readonly signalId: string;
  /** The prop key on this node that is bound. */
  readonly propKey: string;
}

// ── The core graph node ───────────────────────────────────────────────────────

export interface GraphNodeData {
  readonly id: NodeId;
  readonly type: SemanticNodeType;
  readonly key: string | undefined;
  props: Props;
  events: EventDescriptor[];
  stateRefs: StateRef[];
  children: GraphNode[];
  parent: GraphNode | null;
}

export class GraphNode implements GraphNodeData {
  readonly id: NodeId;
  readonly type: SemanticNodeType;
  readonly key: string | undefined;
  props: Props;
  events: EventDescriptor[];
  stateRefs: StateRef[];
  children: GraphNode[];
  parent: GraphNode | null;

  constructor(
    type: SemanticNodeType,
    options: {
      id?: NodeId;
      key?: string;
      props?: Props;
      events?: EventDescriptor[];
      stateRefs?: StateRef[];
    } = {},
  ) {
    this.type = type;
    this.id = options.id ?? generateNodeId(type);
    this.key = options.key;
    this.props = options.props ?? {};
    this.events = options.events ?? [];
    this.stateRefs = options.stateRefs ?? [];
    this.children = [];
    this.parent = null;
  }

  // ── Child management ────────────────────────────────────────────────────────

  appendChild(child: GraphNode): void {
    if (child.parent !== null) {
      child.parent.removeChild(child);
    }
    child.parent = this;
    this.children.push(child);
  }

  insertBefore(child: GraphNode, reference: GraphNode): void {
    const idx = this.children.indexOf(reference);
    if (idx === -1) {
      this.appendChild(child);
      return;
    }
    if (child.parent !== null) {
      child.parent.removeChild(child);
    }
    child.parent = this;
    this.children.splice(idx, 0, child);
  }

  removeChild(child: GraphNode): void {
    const idx = this.children.indexOf(child);
    if (idx === -1) return;
    this.children.splice(idx, 1);
    child.parent = null;
  }

  replaceChild(newChild: GraphNode, oldChild: GraphNode): void {
    const idx = this.children.indexOf(oldChild);
    if (idx === -1) {
      throw new Error(`GraphNode.replaceChild: oldChild is not a child of this node`);
    }
    if (newChild.parent !== null) {
      newChild.parent.removeChild(newChild);
    }
    oldChild.parent = null;
    newChild.parent = this;
    this.children.splice(idx, 1, newChild);
  }

  // ── Prop helpers ────────────────────────────────────────────────────────────

  setProp(key: string, value: PropValue): void {
    this.props = { ...this.props, [key]: value };
  }

  getProp<T extends PropValue = PropValue>(key: string): T | undefined {
    return this.props[key] as T | undefined;
  }

  // ── Event helpers ───────────────────────────────────────────────────────────

  addEvent(descriptor: EventDescriptor): void {
    this.events.push(descriptor);
  }

  removeEvent(type: string): void {
    this.events = this.events.filter(e => e.type !== type);
  }

  // ── Queries ─────────────────────────────────────────────────────────────────

  get isLeaf(): boolean {
    return this.children.length === 0;
  }

  get depth(): number {
    let d = 0;
    let node: GraphNode | null = this.parent;
    while (node !== null) {
      d++;
      node = node.parent;
    }
    return d;
  }

  get root(): GraphNode {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    let node: GraphNode = this;
    while (node.parent !== null) {
      node = node.parent;
    }
    return node;
  }

  /** Shallow clone — does not clone children. */
  shallowClone(): GraphNode {
    const opts: { key?: string; props: Props; events: EventDescriptor[]; stateRefs: StateRef[] } = {
      props: { ...this.props },
      events: [...this.events],
      stateRefs: [...this.stateRefs],
    };
    if (this.key !== undefined) opts.key = this.key;
    return new GraphNode(this.type, opts);
  }
}
