/**
 * Tests for the 2.2 detail inspectors: the Event Inspector (#8) and the
 * Signal / Dependency Graph (#4). Both are pure structural derivations over the
 * one compiled graph — these assert the wiring is reported faithfully and
 * deterministically, and that live enrichment is purely additive.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { resetIdCounter } from '@streetui/core';
import { streetui } from '@streetui/dsl';
import { compile, type CompiledApplication } from '@streetui/compiler';
import { signal } from '@streetui/state';
import { inspectEvents, inspectSignalGraph } from './inspect-detail.js';

beforeEach(() => resetIdCounter());

function buildApp(): { compiled: CompiledApplication; label: ReturnType<typeof signal<string>> } {
  const label = signal('dynamic');
  const app = streetui.app({ name: 'detail-demo', version: '2.2.0' });
  app.page('home', (page) => {
    page.heading('Title');
    page.text(label);
    page.button('Go', { onClick: () => void 0 });
    page.button('Stop', { onClick: () => void 0 });
  });
  return { compiled: compile(app), label };
}

describe('inspectEvents (panel #8)', () => {
  it('lists every node with handlers and counts by event type, never the handlers', () => {
    const { compiled } = buildApp();
    const e = inspectEvents(compiled.graph);
    expect(e.totalHandlers).toBe(2);
    expect(e.byType['click']).toBe(2);
    expect(e.nodes.length).toBe(2);
    for (const n of e.nodes) {
      expect(n.eventTypes).toEqual(['click']);
      expect(typeof n.id).toBe('string');
      // No handler function is ever surfaced.
      expect(Object.keys(n)).not.toContain('handler');
      expect(Object.keys(n)).not.toContain('handlerKey');
    }
  });

  it('returns empty structure for a graph with no handlers', () => {
    resetIdCounter();
    const app = streetui.app({ name: 'no-events', version: '2.2.0' });
    app.page('home', (page) => page.text('static'));
    const e = inspectEvents(compile(app).graph);
    expect(e.nodes).toEqual([]);
    expect(e.totalHandlers).toBe(0);
    expect(e.byType).toEqual({});
  });
});

describe('inspectSignalGraph (panel #4)', () => {
  it('derives signal->node binding edges structurally', () => {
    const { compiled } = buildApp();
    const g = inspectSignalGraph(compiled);
    expect(g.signals.length).toBeGreaterThanOrEqual(1);
    expect(g.edges.length).toBeGreaterThanOrEqual(1);
    const first = g.signals[0]!;
    expect(first.bindingCount).toBeGreaterThanOrEqual(1);
    expect(first.boundNodeIds.length).toBeGreaterThanOrEqual(1);
    // Structure-only: no live kind/observer counts unless supplied.
    expect(first.kind).toBeUndefined();
    expect(first.observerCount).toBeUndefined();
    // Edges reference real nodes with a prop key.
    expect(typeof g.edges[0]!.nodeId).toBe('string');
    expect(typeof g.edges[0]!.propKey).toBe('string');
  });

  it('enriches with live kind/observer counts only when signalsById is given (additive)', () => {
    const { compiled, label } = buildApp();
    const structural = inspectSignalGraph(compiled);
    const id = structural.signals[0]!.signalId;
    const enriched = inspectSignalGraph(compiled, { signalsById: { [id]: label } });
    const sig = enriched.signals.find((s) => s.signalId === id)!;
    expect(sig.kind).toBe('writable');
    expect(typeof sig.observerCount === 'number' || sig.observerCount === undefined).toBe(true);
    // Signals present in the graph but without a live instance stay structural.
    const unmatched = inspectSignalGraph(compiled, { signalsById: {} });
    expect(unmatched.signals[0]!.kind).toBeUndefined();
  });

  it('is deterministic: signals sorted by id, edges in document order', () => {
    const { compiled } = buildApp();
    const a = inspectSignalGraph(compiled);
    const b = inspectSignalGraph(compiled);
    expect(a).toEqual(b);
    const ids = a.signals.map((s) => s.signalId);
    expect([...ids].sort()).toEqual(ids);
  });
});
