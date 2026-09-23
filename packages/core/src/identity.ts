/**
 * Node and application identity utilities.
 * Every node in the semantic graph has a stable, unique identity.
 */

let _counter = 0;

/** Generate a framework-internal monotonic integer ID. */
export function nextId(): number {
  return ++_counter;
}

/** Reset the counter (test use only). */
export function resetIdCounter(): void {
  _counter = 0;
}

/** Opaque branded type for node IDs. */
export type NodeId = string & { readonly __brand: 'NodeId' };

/** Create a NodeId from a string (must be unique at call site). */
export function createNodeId(value: string): NodeId {
  return value as NodeId;
}

/** Generate a fresh, unique NodeId. */
export function generateNodeId(prefix: string = 'node'): NodeId {
  return createNodeId(`${prefix}:${nextId()}`);
}

/** Parse the prefix from a NodeId. */
export function nodeIdPrefix(id: NodeId): string {
  const colon = id.indexOf(':');
  return colon === -1 ? id : id.slice(0, colon);
}

/** Branded type for application IDs. */
export type ApplicationId = string & { readonly __brand: 'ApplicationId' };

/** Generate a fresh application ID. */
export function generateApplicationId(name: string): ApplicationId {
  return `app:${name}:${nextId()}` as ApplicationId;
}
