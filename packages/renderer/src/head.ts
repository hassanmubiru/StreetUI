/**
 * Document head / metadata runtime (2.0 §1–§3).
 *
 * Two entry points, sharing the normalized {@link HeadEntry} model the DSL's
 * `head()` produces (mirrored here as a local structural type so the renderer
 * takes no compile-time dependency on the DSL package — the same convention as
 * the overlay/component descriptors):
 *
 *   • `wireHeadBehavior(ctx, node, instance)` — BROWSER. Reads the
 *     `__head__<id>` descriptor, registers this node's contribution with a
 *     per-render {@link HeadManager} (created lazily on `ctx`), subscribes to any
 *     reactive attr/text signals, and tracks cleanup on the NodeInstance so the
 *     contribution is withdrawn (and the manager re-applies the merged result)
 *     when the node unmounts or the route changes. Server-safe: when
 *     `dom.head()` is null (SSR) it is a no-op.
 *
 *   • `renderHead(compiled)` — SERVER. Walks the compiled graph in document
 *     order, merges every live `head()` contribution (last-in-document-order
 *     wins per dedup key — §3), and serializes the effective tags to an HTML
 *     string for the caller to place inside `<head>`. Only the active graph is
 *     walked, so only active-route metadata is emitted (§2). Each tag carries
 *     `data-streetui-head` + `data-streetui-head-key="…"` so the browser adopts
 *     it on hydration instead of creating a duplicate.
 */

import type { GraphNode, ApplicationGraph } from '@streetui/graph';
import { ServerDOMAdapter } from '@streetui/dom';
import type { CompiledApplication } from '@streetui/compiler';
import type { DOMAdapter } from '@streetui/dom';
import type { RenderContext } from './render-context.js';
import type { NodeInstance } from './node-instance.js';

/** The marker attribute stamped on every framework-managed head tag. */
const HEAD_MARKER = 'data-streetui-head';
/** The attribute carrying a tag's dedup key, so hydration can match server tags. */
const HEAD_KEY = 'data-streetui-head-key';

// ── Structural mirror of the DSL's head entry model ─────────────────────────────

interface HeadEntryLike {
  readonly tag: 'title' | 'meta' | 'link' | 'base';
  readonly dedupKey: string;
  readonly attrs: Readonly<Record<string, unknown>>;
  readonly text?: unknown;
}
interface HeadContributionLike {
  readonly entries: readonly HeadEntryLike[];
}

interface SignalLike {
  subscribe: (fn: (v: unknown) => void) => () => void;
  peek: () => unknown;
}

function isSignalLike(v: unknown): v is SignalLike {
  return (
    v !== null &&
    typeof v === 'object' &&
    typeof (v as Record<string, unknown>)['subscribe'] === 'function' &&
    typeof (v as Record<string, unknown>)['peek'] === 'function'
  );
}

/** Read a bindable value to its current string (peeking a signal, else stringifying). */
function readValue(v: unknown): string {
  if (isSignalLike(v)) return String(v.peek() ?? '');
  return String(v ?? '');
}

/** A fully-resolved head tag: concrete strings, ready to write to the DOM/serialize. */
interface ResolvedTag {
  readonly tag: 'title' | 'meta' | 'link' | 'base';
  readonly attrs: Record<string, string>;
  readonly text?: string;
}

function resolveEntry(entry: HeadEntryLike): ResolvedTag {
  const attrs: Record<string, string> = {};
  for (const key of Object.keys(entry.attrs)) {
    attrs[key] = readValue(entry.attrs[key]);
  }
  const resolved: ResolvedTag = { tag: entry.tag, attrs };
  if (entry.tag === 'title') {
    return { ...resolved, text: readValue(entry.text) };
  }
  return resolved;
}

// ── Browser head manager ────────────────────────────────────────────────────────

interface AppliedRecord {
  el: Element;
  attrKeys: Set<string>;
  tag: string;
}

/**
 * Coordinates every live `head()` node's contribution into a single
 * `document.head`. One instance per render (lazily created on `ctx`). Merges by
 * dedup key with last-in-document-order winning, and applies the minimal diff to
 * the DOM on every register/unregister/signal change. Adopts server-emitted tags
 * on the first apply so hydration produces no duplicates.
 */
export class HeadManager {
  private readonly _dom: DOMAdapter;
  private readonly _head: Element;
  private readonly _contributions = new Map<string, { order: number; entries: readonly HeadEntryLike[] }>();
  private readonly _applied = new Map<string, AppliedRecord>();
  private _order = 0;
  private _adopted = false;

  constructor(dom: DOMAdapter, head: Element) {
    this._dom = dom;
    this._head = head;
  }

  /** Register (or replace) a node's contribution and re-apply the merged result. */
  register(nodeId: string, entries: readonly HeadEntryLike[]): void {
    this._contributions.set(nodeId, { order: this._order++, entries });
    this.apply();
  }

  /** Withdraw a node's contribution (unmount / route change) and re-apply. */
  unregister(nodeId: string): void {
    if (this._contributions.delete(nodeId)) this.apply();
  }

  /** Recompute the merged head and patch `document.head` to match. */
  apply(): void {
    if (!this._adopted) {
      this._adoptServerTags();
      this._adopted = true;
    }

    // Merge: iterate contributions in document order; per dedup key the last
    // writer wins (§3). Within a contribution, later entries win too.
    const ordered = [...this._contributions.values()].sort((a, b) => a.order - b.order);
    const merged = new Map<string, ResolvedTag>();
    for (const contribution of ordered) {
      for (const entry of contribution.entries) {
        merged.set(entry.dedupKey, resolveEntry(entry));
      }
    }

    // Upsert desired tags.
    for (const [key, desired] of merged) {
      const existing = this._applied.get(key);
      if (existing !== undefined && existing.tag === desired.tag) {
        this._reconcileAttrs(existing, desired);
      } else {
        if (existing !== undefined) {
          // Tag kind changed for this key (rare) — drop the old element.
          this._dom.removeChild(this._head, existing.el);
          this._applied.delete(key);
        }
        const el = this._createTag(key, desired);
        this._dom.appendChild(this._head, el);
        this._applied.set(key, { el, attrKeys: new Set(Object.keys(desired.attrs)), tag: desired.tag });
      }
    }

    // Remove managed tags no longer desired.
    for (const [key, record] of [...this._applied]) {
      if (!merged.has(key)) {
        this._dom.removeChild(this._head, record.el);
        this._applied.delete(key);
      }
    }
  }

  private _createTag(key: string, desired: ResolvedTag): Element {
    const el = this._dom.createElement(desired.tag);
    this._dom.setAttribute(el, HEAD_MARKER, '');
    this._dom.setAttribute(el, HEAD_KEY, key);
    for (const attr of Object.keys(desired.attrs)) {
      this._dom.setAttribute(el, attr, desired.attrs[attr]!);
    }
    if (desired.tag === 'title') this._dom.setTextContent(el, desired.text ?? '');
    return el;
  }

  private _reconcileAttrs(record: AppliedRecord, desired: ResolvedTag): void {
    const nextKeys = new Set(Object.keys(desired.attrs));
    // Remove attrs that are no longer present.
    for (const attr of record.attrKeys) {
      if (!nextKeys.has(attr)) this._dom.removeAttribute(record.el, attr);
    }
    // Set/overwrite desired attrs (idempotent when unchanged — matters on the
    // hydration adopt path, where the element is a server tag being re-asserted).
    for (const attr of nextKeys) {
      this._dom.setAttribute(record.el, attr, desired.attrs[attr]!);
    }
    if (desired.tag === 'title') this._dom.setTextContent(record.el, desired.text ?? '');
    record.attrKeys = nextKeys;
  }

  /**
   * Seed `_applied` from server-emitted `[data-streetui-head-key]` tags already
   * in `document.head`. The subsequent diff reuses these elements when the
   * client desires the same key (no duplicate), rewrites them if the value
   * changed, or removes them if the client graph no longer wants them.
   */
  private _adoptServerTags(): void {
    for (const child of this._dom.childNodes(this._head)) {
      if (!this._dom.isElement(child)) continue;
      const el = child as Element;
      const key = this._dom.getAttribute(el, HEAD_KEY);
      if (key === null) continue;
      this._applied.set(key, {
        el,
        attrKeys: new Set(this._attrNames(el)),
        tag: this._dom.tagName(el),
      });
    }
  }

  /** The framework-managed attribute names currently on a server tag. */
  private _attrNames(el: Element): string[] {
    // We cannot enumerate a live element's attributes through the minimal
    // DOMAdapter surface, so we re-assert from the desired set on first apply
    // (see `_reconcileAttrs`, which sets desired keys and removes only tracked
    // ones). Tracking the marker keys is enough to keep them from lingering.
    const names: string[] = [];
    if (this._dom.getAttribute(el, HEAD_MARKER) !== null) names.push(HEAD_MARKER);
    if (this._dom.getAttribute(el, HEAD_KEY) !== null) names.push(HEAD_KEY);
    return names;
  }
}

/** Lazily get (or create) the render's HeadManager. Null on the server. */
function getHeadManager(ctx: RenderContext): HeadManager | null {
  const head = ctx.dom.head();
  if (head === null) return null; // server render pass — renderHead handles SSR
  const mutable = ctx as { head?: HeadManager };
  if (mutable.head === undefined) mutable.head = new HeadManager(ctx.dom, head);
  return mutable.head;
}

/**
 * Wire a mounted/hydrated `head` node's contribution into `document.head`.
 * Server-safe (no-op when there is no document). Shared by the mount and hydrate
 * paths so both establish identical ownership + cleanup.
 */
export function wireHeadBehavior(
  ctx: RenderContext,
  graphNode: GraphNode,
  instance: NodeInstance,
): void {
  const manager = getHeadManager(ctx);
  if (manager === null) return;

  const descFn = ctx.graph.getHandler(`__head__${graphNode.id}`) as
    | (() => HeadContributionLike)
    | undefined;
  if (descFn === undefined) return;

  const contribution = descFn();
  const nodeId = graphNode.id;
  manager.register(nodeId, contribution.entries);

  // Subscribe to any reactive attr/text signals; a change re-applies the merged
  // head. All subscriptions + the contribution withdrawal are tracked on the
  // instance, so a route change / unmount tears them down and re-applies.
  for (const entry of contribution.entries) {
    for (const attrKey of Object.keys(entry.attrs)) {
      const v = entry.attrs[attrKey];
      if (isSignalLike(v)) {
        instance.trackCleanup(v.subscribe(() => manager.apply()));
      }
    }
    if (isSignalLike(entry.text)) {
      instance.trackCleanup(entry.text.subscribe(() => manager.apply()));
    }
  }

  instance.trackCleanup(() => manager.unregister(nodeId));
}

// ── Server-side head emission ─────────────────────────────────────────────────

/**
 * Render the active graph's merged document metadata to an HTML string suitable
 * for placing inside `<head>`. Walks the graph in document order, merges every
 * `head()` contribution (last-in-document-order wins per dedup key), and
 * serializes each effective tag with the `data-streetui-head` marker so the
 * browser adopts it on hydration. Returns `''` when the app declares no metadata
 * — so apps that never call `head()` emit nothing extra and existing SSR output
 * is unchanged.
 */
export function renderHead(compiled: CompiledApplication): string {
  const graph: ApplicationGraph = compiled.graph;

  const merged = new Map<string, ResolvedTag>();
  graph.walk((node) => {
    if (node.type !== 'head') return;
    const descFn = graph.getHandler(`__head__${node.id}`) as
      | (() => HeadContributionLike)
      | undefined;
    if (descFn === undefined) return;
    for (const entry of descFn().entries) {
      merged.set(entry.dedupKey, resolveEntry(entry));
    }
  });

  if (merged.size === 0) return '';

  const dom = new ServerDOMAdapter();
  let out = '';
  for (const [key, desired] of merged) {
    const el = dom.createElement(desired.tag);
    dom.setAttribute(el, HEAD_MARKER, '');
    dom.setAttribute(el, HEAD_KEY, key);
    for (const attr of Object.keys(desired.attrs)) {
      dom.setAttribute(el, attr, desired.attrs[attr]!);
    }
    if (desired.tag === 'title') dom.setTextContent(el, desired.text ?? '');
    out += dom.serializeOuter(el);
  }
  return out;
}
