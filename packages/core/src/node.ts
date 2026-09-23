/**
 * Framework node primitives — the base abstraction for every node
 * in the Semantic Application Graph.
 */

import { type NodeId, generateNodeId } from './identity.js';

export type SemanticNodeType =
  | 'application'
  | 'page'
  | 'section'
  | 'container'
  | 'heading'
  | 'text'
  | 'button'
  | 'input'
  | 'form'
  | 'list'
  | 'list-item'
  | 'image'
  | 'link'
  | 'component'
  | 'slot'
  | 'fragment'
  | 'reactive-list';

export interface NodeMetadata {
  readonly createdAt: number;
  readonly [key: string]: unknown;
}

export abstract class BaseNode {
  readonly id: NodeId;
  readonly type: SemanticNodeType;
  readonly metadata: NodeMetadata;

  constructor(type: SemanticNodeType, id?: NodeId) {
    this.type = type;
    this.id = id ?? generateNodeId(type);
    this.metadata = { createdAt: Date.now() };
  }

  abstract clone(): BaseNode;
}
