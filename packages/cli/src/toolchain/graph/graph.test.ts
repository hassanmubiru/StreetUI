import { describe, it, expect } from 'vitest';
import { ModuleGraph, hashContent } from './graph.js';

describe('module graph', () => {
  it('tracks connect, importers, and dependents', () => {
    const graph = new ModuleGraph('/root');
    graph.add({ id: '/a', url: '/a', file: '/a', kind: 'ts', source: '', contentHash: '', mtimeMs: 0, dependencies: new Map(), importers: new Set(), state: 'clean', hmrAccepted: false });
    graph.add({ id: '/b', url: '/b', file: '/b', kind: 'ts', source: '', contentHash: '', mtimeMs: 0, dependencies: new Map(), importers: new Set(), state: 'clean', hmrAccepted: false });
    graph.add({ id: '/c', url: '/c', file: '/c', kind: 'ts', source: '', contentHash: '', mtimeMs: 0, dependencies: new Map(), importers: new Set(), state: 'clean', hmrAccepted: false });
    graph.connect('/a', './b', '/b');
    graph.connect('/b', './c', '/c');
    expect(graph.dependents('/c')).toEqual(['/b', '/a']);
    expect(graph.dependents('/b')).toEqual(['/a']);
  });

  it('detects cycles', () => {
    const graph = new ModuleGraph('/root');
    for (const id of ['/a', '/b', '/c']) {
      graph.add({ id, url: id, file: id, kind: 'ts', source: '', contentHash: '', mtimeMs: 0, dependencies: new Map(), importers: new Set(), state: 'clean', hmrAccepted: false });
    }
    graph.connect('/a', './b', '/b');
    graph.connect('/b', './c', '/c');
    graph.connect('/c', './a', '/a');
    expect(graph.detectCycles().length).toBeGreaterThan(0);
  });

  it('hashes content deterministically', () => {
    expect(hashContent('abc')).toBe(hashContent('abc'));
    expect(hashContent('abc')).not.toBe(hashContent('abd'));
  });
});
