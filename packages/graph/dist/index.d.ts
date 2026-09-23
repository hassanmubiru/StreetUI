import { NodeId, SemanticNodeType, DiagnosticCollector } from '@streetui/core';

/**
 * Semantic Application Graph nodes.
 *
 * Every element in a StreetUI application is represented as a GraphNode.
 * Nodes form a tree: each has an optional parent and an ordered list of children.
 */

type PropValue = string | number | boolean | null | undefined | string[] | number[] | Record<string, unknown>;
type Props = Record<string, PropValue>;
interface EventDescriptor {
    readonly type: string;
    /** Reference key into the application's handler registry. */
    readonly handlerKey: string;
}
interface StateRef {
    /** ID of the signal/store this node's property is bound to. */
    readonly signalId: string;
    /** The prop key on this node that is bound. */
    readonly propKey: string;
}
interface GraphNodeData {
    readonly id: NodeId;
    readonly type: SemanticNodeType;
    readonly key: string | undefined;
    props: Props;
    events: EventDescriptor[];
    stateRefs: StateRef[];
    children: GraphNode[];
    parent: GraphNode | null;
}
declare class GraphNode implements GraphNodeData {
    readonly id: NodeId;
    readonly type: SemanticNodeType;
    readonly key: string | undefined;
    props: Props;
    events: EventDescriptor[];
    stateRefs: StateRef[];
    children: GraphNode[];
    parent: GraphNode | null;
    constructor(type: SemanticNodeType, options?: {
        id?: NodeId;
        key?: string;
        props?: Props;
        events?: EventDescriptor[];
        stateRefs?: StateRef[];
    });
    appendChild(child: GraphNode): void;
    insertBefore(child: GraphNode, reference: GraphNode): void;
    removeChild(child: GraphNode): void;
    replaceChild(newChild: GraphNode, oldChild: GraphNode): void;
    setProp(key: string, value: PropValue): void;
    getProp<T extends PropValue = PropValue>(key: string): T | undefined;
    addEvent(descriptor: EventDescriptor): void;
    removeEvent(type: string): void;
    get isLeaf(): boolean;
    get depth(): number;
    get root(): GraphNode;
    /** Shallow clone — does not clone children. */
    shallowClone(): GraphNode;
}

/**
 * The Semantic Application Graph.
 *
 * Holds the application root node and all its descendants.
 * Supports traversal, lookup by ID, validation, and serialization.
 */

interface ApplicationGraphOptions {
    readonly name: string;
    readonly version?: string;
}
interface HandlerFn {
    (...args: unknown[]): unknown;
}
declare class ApplicationGraph {
    readonly root: GraphNode;
    readonly name: string;
    readonly version: string;
    private readonly _nodeIndex;
    /** Handler registry — maps handlerKey → actual function */
    readonly handlers: Map<string, HandlerFn>;
    constructor(options: ApplicationGraphOptions);
    createNode(type: GraphNode['type'], options?: {
        key?: string;
        props?: Props;
        parent?: GraphNode;
    }): GraphNode;
    attachNode(node: GraphNode, parent: GraphNode): void;
    detachNode(node: GraphNode): void;
    private _removeFromIndex;
    registerHandler(key: string, fn: HandlerFn): void;
    getHandler(key: string): HandlerFn | undefined;
    findById(id: NodeId): GraphNode | undefined;
    findAll(predicate: (node: GraphNode) => boolean): GraphNode[];
    findByType(type: GraphNode['type']): GraphNode[];
    walk(visitor: (node: GraphNode, depth: number) => void): void;
    private _walk;
    get nodeCount(): number;
    validate(): DiagnosticCollector;
    serialize(): SerializedGraph;
    private _serializeNode;
}
interface SerializedNode {
    readonly id: string;
    readonly type: string;
    readonly key: string | undefined;
    readonly props: Props;
    readonly events: EventDescriptor[];
    readonly stateRefs: unknown[];
    readonly children: SerializedNode[];
}
interface SerializedGraph {
    readonly name: string;
    readonly version: string;
    readonly root: SerializedNode;
}

export { ApplicationGraph, type ApplicationGraphOptions, type EventDescriptor, GraphNode, type GraphNodeData, type HandlerFn, type PropValue, type Props, type SerializedGraph, type SerializedNode, type StateRef };
