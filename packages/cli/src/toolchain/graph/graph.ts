/**
 * StreetUI's module dependency graph. It is the single source of truth for
 * module identity, dependencies, importers, transformation cache state, and
 * HMR invalidation. Both the dev server and the production builder use it.
 */

import { createHash } from 'node:crypto';
import type { ModuleKind } from '../resolve/resolver.js';

export type ModuleState = 'clean' | 'dirty' | 'error';

export interface ModuleNode {
  /** Canonical identity (absolute source path). */
  readonly id: string;
  /** Browser/dev URL. */
  readonly url: string;
  /** Absolute source file (or virtual path). */
  readonly file: string;
  readonly kind: ModuleKind;
  /** Source text as last read from disk. */
  source: string;
  readonly contentHash: string;
  mtimeMs: number;
  /** specifier → dependency module id. */
  readonly dependencies: Map<string, string>;
  readonly importers: Set<string>;
  state: ModuleState;
  hmrAccepted: boolean;
  error?: string | undefined;
}

export function hashContent(source: string): string {
  return createHash('sha256').update(source).digest('hex');
}

export function shortHash(source: string, length = 8): string {
  return hashContent(source).slice(0, length);
}

export class ModuleGraph {
  readonly nodes = new Map<string, ModuleNode>();
  readonly root: string;

  constructor(root: string) {
    this.root = root;
  }

  add(node: ModuleNode): ModuleNode {
    const existing = this.nodes.get(node.id);
    if (existing !== undefined) return existing;
    this.nodes.set(node.id, node);
    return node;
  }

  get(id: string): ModuleNode | undefined {
    return this.nodes.get(id);
  }

  connect(importerId: string, specifier: string, dependencyId: string): void {
    const importer = this.nodes.get(importerId);
    const dependency = this.nodes.get(dependencyId);
    if (importer === undefined || dependency === undefined) return;
    importer.dependencies.set(specifier, dependencyId);
    dependency.importers.add(importerId);
  }

  /** Mark a module dirty and clear its cached transform state. */
  invalidate(id: string): ModuleNode | undefined {
    const node = this.nodes.get(id);
    if (node === undefined) return undefined;
    node.state = 'dirty';
    node.error = undefined;
    return node;
  }

  /** All transitive importers of a module, nearest first. */
  dependents(id: string): string[] {
    const seen = new Set<string>();
    const queue = [id];
    const result: string[] = [];
    while (queue.length > 0) {
      const current = queue.shift() as string;
      const node = this.nodes.get(current);
      if (node === undefined) continue;
      for (const importer of node.importers) {
        if (seen.has(importer)) continue;
        seen.add(importer);
        result.push(importer);
        queue.push(importer);
      }
    }
    return result;
  }

  /** Dependency cycles as arrays of module ids. */
  detectCycles(): string[][] {
    const cycles: string[][] = [];
    const state = new Map<string, 'visiting' | 'visited'>();
    const stack: string[] = [];

    const visit = (id: string): void => {
      const current = state.get(id);
      if (current === 'visited') return;
      if (current === 'visiting') {
        const start = stack.indexOf(id);
        if (start >= 0) cycles.push([...stack.slice(start), id]);
        return;
      }
      state.set(id, 'visiting');
      stack.push(id);
      const node = this.nodes.get(id);
      if (node !== undefined) {
        for (const dependency of node.dependencies.values()) visit(dependency);
      }
      stack.pop();
      state.set(id, 'visited');
    };

    for (const id of this.nodes.keys()) visit(id);
    return cycles;
  }

  /** Depth-first post-order traversal from an entry (dependencies before importers). */
  postOrder(entryId: string): string[] {
    const visited = new Set<string>();
    const result: string[] = [];
    const visit = (id: string): void => {
      if (visited.has(id)) return;
      visited.add(id);
      const node = this.nodes.get(id);
      if (node === undefined) return;
      for (const dependency of node.dependencies.values()) visit(dependency);
      result.push(id);
    };
    visit(entryId);
    return result;
  }

  /** Depth-first pre-order traversal from an entry (importers before dependencies). */
  preOrder(entryId: string): string[] {
    const visited = new Set<string>();
    const result: string[] = [];
    const visit = (id: string): void => {
      if (visited.has(id)) return;
      visited.add(id);
      result.push(id);
      const node = this.nodes.get(id);
      if (node === undefined) return;
      for (const dependency of node.dependencies.values()) visit(dependency);
    };
    visit(entryId);
    return result;
  }

  /** CSS nodes reachable from an entry, in import order. */
  cssInOrder(entryId: string): ModuleNode[] {
    const visited = new Set<string>();
    const result: ModuleNode[] = [];
    const visit = (id: string): void => {
      if (visited.has(id)) return;
      visited.add(id);
      const node = this.nodes.get(id);
      if (node === undefined) return;
      for (const dependency of node.dependencies.values()) visit(dependency);
      if (node.kind === 'css') result.push(node);
    };
    visit(entryId);
    return result;
  }

  /** Asset nodes reachable from an entry. */
  assets(entryId: string): ModuleNode[] {
    const visited = new Set<string>();
    const result: ModuleNode[] = [];
    const visit = (id: string): void => {
      if (visited.has(id)) return;
      visited.add(id);
      const node = this.nodes.get(id);
      if (node === undefined) return;
      for (const dependency of node.dependencies.values()) visit(dependency);
      if (node.kind === 'asset') result.push(node);
    };
    visit(entryId);
    return result;
  }
}