import { describe, it, expect, beforeEach } from 'vitest';
import { resetIdCounter } from '@streetui/core';
import { GraphNode } from './graph-node.js';
import { ApplicationGraph } from './graph.js';

beforeEach(() => resetIdCounter());

describe('GraphNode', () => {
  it('creates a node with correct type', () => {
    const n = new GraphNode('button');
    expect(n.type).toBe('button');
  });

  it('starts with no children and no parent', () => {
    const n = new GraphNode('section');
    expect(n.children).toHaveLength(0);
    expect(n.parent).toBeNull();
  });

  it('appendChild sets parent and child', () => {
    const parent = new GraphNode('section');
    const child = new GraphNode('button');
    parent.appendChild(child);
    expect(parent.children).toContain(child);
    expect(child.parent).toBe(parent);
  });

  it('removeChild detaches node', () => {
    const parent = new GraphNode('section');
    const child = new GraphNode('button');
    parent.appendChild(child);
    parent.removeChild(child);
    expect(parent.children).toHaveLength(0);
    expect(child.parent).toBeNull();
  });

  it('insertBefore positions child correctly', () => {
    const parent = new GraphNode('section');
    const a = new GraphNode('text');
    const b = new GraphNode('text');
    const c = new GraphNode('text');
    parent.appendChild(a);
    parent.appendChild(c);
    parent.insertBefore(b, c);
    expect(parent.children.indexOf(b)).toBe(1);
  });

  it('replaceChild swaps nodes', () => {
    const parent = new GraphNode('section');
    const old = new GraphNode('text');
    const replacement = new GraphNode('heading');
    parent.appendChild(old);
    parent.replaceChild(replacement, old);
    expect(parent.children[0]).toBe(replacement);
    expect(old.parent).toBeNull();
  });

  it('setProp / getProp roundtrip', () => {
    const n = new GraphNode('button');
    n.setProp('label', 'Click me');
    expect(n.getProp('label')).toBe('Click me');
  });

  it('addEvent / removeEvent', () => {
    const n = new GraphNode('button');
    n.addEvent({ type: 'click', handlerKey: 'h1' });
    expect(n.events).toHaveLength(1);
    n.removeEvent('click');
    expect(n.events).toHaveLength(0);
  });

  it('depth is 0 for root', () => {
    const n = new GraphNode('application');
    expect(n.depth).toBe(0);
  });

  it('depth increases with nesting', () => {
    const root = new GraphNode('application');
    const page = new GraphNode('page');
    const section = new GraphNode('section');
    root.appendChild(page);
    page.appendChild(section);
    expect(section.depth).toBe(2);
  });

  it('root returns topmost ancestor', () => {
    const root = new GraphNode('application');
    const child = new GraphNode('page');
    const grandchild = new GraphNode('section');
    root.appendChild(child);
    child.appendChild(grandchild);
    expect(grandchild.root).toBe(root);
  });

  it('isLeaf is true when no children', () => {
    const n = new GraphNode('text');
    expect(n.isLeaf).toBe(true);
  });

  it('shallowClone creates independent copy', () => {
    const n = new GraphNode('button', { props: { label: 'A' } });
    const clone = n.shallowClone();
    clone.setProp('label', 'B');
    expect(n.getProp('label')).toBe('A');
  });

  it('reparents child when appended to new parent', () => {
    const p1 = new GraphNode('section');
    const p2 = new GraphNode('section');
    const child = new GraphNode('text');
    p1.appendChild(child);
    p2.appendChild(child);
    expect(p1.children).toHaveLength(0);
    expect(p2.children).toContain(child);
    expect(child.parent).toBe(p2);
  });
});

describe('ApplicationGraph', () => {
  let graph: ApplicationGraph;

  beforeEach(() => {
    graph = new ApplicationGraph({ name: 'test-app' });
  });

  it('creates with an application root node', () => {
    expect(graph.root.type).toBe('application');
    expect(graph.root.getProp('name')).toBe('test-app');
  });

  it('createNode attaches to specified parent', () => {
    const page = graph.createNode('page', { parent: graph.root });
    expect(graph.root.children).toContain(page);
  });

  it('findById locates nodes', () => {
    const page = graph.createNode('page', { parent: graph.root });
    expect(graph.findById(page.id)).toBe(page);
  });

  it('findByType returns matching nodes', () => {
    graph.createNode('button', { parent: graph.root });
    graph.createNode('button', { parent: graph.root });
    graph.createNode('text', { parent: graph.root });
    expect(graph.findByType('button')).toHaveLength(2);
  });

  it('findAll with predicate works', () => {
    graph.createNode('button', { parent: graph.root, props: { label: 'ok' } });
    graph.createNode('text', { parent: graph.root, props: { label: 'ok' } });
    const results = graph.findAll(n => n.getProp('label') === 'ok');
    expect(results).toHaveLength(2);
  });

  it('detachNode removes from index', () => {
    const page = graph.createNode('page', { parent: graph.root });
    graph.detachNode(page);
    expect(graph.findById(page.id)).toBeUndefined();
    expect(graph.root.children).toHaveLength(0);
  });

  it('nodeCount tracks all nodes', () => {
    expect(graph.nodeCount).toBe(1); // root
    graph.createNode('page', { parent: graph.root });
    graph.createNode('section', { parent: graph.root });
    expect(graph.nodeCount).toBe(3);
  });

  it('walk visits all nodes', () => {
    const page = graph.createNode('page', { parent: graph.root });
    graph.createNode('section', { parent: page });
    const visited: string[] = [];
    graph.walk(n => visited.push(n.type));
    expect(visited).toEqual(['application', 'page', 'section']);
  });

  it('registerHandler / getHandler roundtrip', () => {
    const fn = () => 42;
    graph.registerHandler('myHandler', fn);
    expect(graph.getHandler('myHandler')).toBe(fn);
  });

  it('validate warns on missing handler', () => {
    const btn = graph.createNode('button', { parent: graph.root });
    btn.addEvent({ type: 'click', handlerKey: 'missing' });
    const dc = graph.validate();
    expect(dc.hasWarnings).toBe(true);
  });

  it('validate passes when handler exists', () => {
    const btn = graph.createNode('button', { parent: graph.root });
    btn.addEvent({ type: 'click', handlerKey: 'myFn' });
    graph.registerHandler('myFn', () => {});
    const dc = graph.validate();
    expect(dc.hasErrors).toBe(false);
  });

  it('serializes to plain object', () => {
    graph.createNode('page', { parent: graph.root, props: { title: 'Home' } });
    const serialized = graph.serialize();
    expect(serialized.name).toBe('test-app');
    expect(serialized.root.type).toBe('application');
    expect(serialized.root.children[0]?.type).toBe('page');
  });
});
