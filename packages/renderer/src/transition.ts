/**
 * CSS class-based enter/leave transition controller (§2–§8).
 *
 * This is the browser-only runtime that consumes the `__transition__<nodeId>`
 * descriptor the DSL registers (a pre-resolved {@link ResolvedTransitionLike}).
 * It is deliberately structural about that descriptor — like the renderer's
 * `__overlay__`/`__component__` handling — so the renderer takes NO compile-time
 * dependency on the DSL package.
 *
 * Engine (confirmed decision): CSS classes, no Web Animations API, no
 * browser-only API referenced at module scope. Every timer / rAF / event
 * binding is reached lazily through `globalThis` and only ever runs when
 * `dom.body() !== null` (the same SSR guard `wireOverlayBehavior` uses), so:
 *   - server output is byte-identical (nothing here runs during SSR — §21);
 *   - happy-dom, which dispatches no `transitionend`/`animationend`, still
 *     completes deterministically via the fallback timeout (§24).
 *
 * The controller is created once per reactive container instance (reactive-list
 * or conditional) so its `leaving` map survives across reconcile passes — that
 * is what makes leave→enter reclaim (§6) and keyed-identity list leave (§7)
 * correct.
 */

import type { DOMAdapter } from '@streetui/dom';
import type { ApplicationGraph, GraphNode } from '@streetui/graph';
import type { NodeInstance } from './node-instance.js';

/**
 * The renderer's structural view of the resolved transition the DSL stores in
 * `__transition__<id>`. Mirrors `@streetui/dsl`'s `ResolvedTransition` without
 * importing it (no renderer→dsl dependency).
 */
export interface ResolvedTransitionLike {
  readonly enterActive: readonly string[];
  readonly enterFrom: readonly string[];
  readonly enterTo: readonly string[];
  readonly leaveActive: readonly string[];
  readonly leaveFrom: readonly string[];
  readonly leaveTo: readonly string[];
  readonly appear: boolean;
  readonly duration: number;
}

/**
 * Hooks handed to the reconciler so it can (a) reclaim an instance that is
 * mid-leave when its key re-enters (leave→enter cancellation), (b) defer the
 * remove/dispose/forget/detach chain for a leaving instance until its animation
 * ends, and (c) play the enter animation for a freshly-inserted instance. When
 * no transition applies (or we are on the server) every hook degrades to the
 * pre-transition synchronous behaviour.
 */
export interface TransitionHooks {
  /**
   * If an instance for `key` is currently animating out, cancel its leave and
   * return it for reuse; otherwise undefined. The caller re-mounts nothing and
   * reuses the returned instance's live DOM node.
   */
  takeLeaving(key: string): NodeInstance | undefined;
  /**
   * Begin a leave animation for a removed instance. Returns true when the whole
   * teardown chain has been deferred to animation-end (caller must NOT remove,
   * dispose, forget or detach it), or false when there is no transition / no
   * browser and the caller should tear it down synchronously as before.
   */
  beginLeave(inst: NodeInstance): boolean;
  /** Play the enter animation for a freshly-inserted (or reclaimed) instance. */
  onEnter(inst: NodeInstance): void;
}

/** Read the pre-resolved transition descriptor for a node, if any. */
export function getResolvedTransition(
  graph: ApplicationGraph,
  nodeId: string,
): ResolvedTransitionLike | undefined {
  const fn = graph.getHandler(`__transition__${nodeId}`) as
    | (() => ResolvedTransitionLike)
    | undefined;
  return fn === undefined ? undefined : fn();
}

// ── Browser-global access (lazy, never at module scope) ──────────────────────

interface RafHost {
  requestAnimationFrame?: (cb: () => void) => number;
  setTimeout: (cb: () => void, ms: number) => unknown;
  clearTimeout: (h: unknown) => void;
}

function host(): RafHost {
  return globalThis as unknown as RafHost;
}

/** Schedule a callback for the next frame (falls back to a macrotask). */
function nextFrame(cb: () => void): void {
  const h = host();
  if (typeof h.requestAnimationFrame === 'function') {
    // Double rAF: ensures the "from" classes have been painted before we flip
    // to the "to" classes, so the transition actually runs in real browsers.
    h.requestAnimationFrame(() => h.requestAnimationFrame(cb));
  } else {
    h.setTimeout(cb, 0);
  }
}

// ── Class list manipulation via the adapter (no classList dependency) ─────────

function splitClass(value: string | null): string[] {
  if (value === null) return [];
  const out: string[] = [];
  for (const t of value.split(/\s+/)) if (t.length > 0) out.push(t);
  return out;
}

function addClasses(dom: DOMAdapter, el: Element, classes: readonly string[]): void {
  if (classes.length === 0) return;
  const current = splitClass(dom.getAttribute(el, 'class'));
  let changed = false;
  for (const c of classes) {
    if (!current.includes(c)) {
      current.push(c);
      changed = true;
    }
  }
  if (changed) dom.setAttribute(el, 'class', current.join(' '));
}

function removeClasses(dom: DOMAdapter, el: Element, classes: readonly string[]): void {
  if (classes.length === 0) return;
  const current = splitClass(dom.getAttribute(el, 'class'));
  const next = current.filter((c) => !classes.includes(c));
  if (next.length !== current.length) {
    if (next.length === 0) dom.removeAttribute(el, 'class');
    else dom.setAttribute(el, 'class', next.join(' '));
  }
}

/**
 * One running enter-or-leave animation on a single element. Owns exactly one set
 * of DOM listeners + one fallback timer, and guarantees `settle`/`cancel` run
 * their cleanup at most once — no stale callbacks, no duplicate listeners, no
 * duplicate cleanup (§6).
 */
interface Run {
  /** Force the animation to its end synchronously (used by cancellation). */
  cancel(): void;
}

function startRun(
  dom: DOMAdapter,
  el: Element,
  active: readonly string[],
  from: readonly string[],
  to: readonly string[],
  duration: number,
  onDone: () => void,
): Run {
  const h = host();
  let finished = false;
  let timer: unknown = null;

  const onEvent = ((e: Event): void => {
    // Ignore bubbling transition/animation events from descendants.
    if (e.target !== el) return;
    finish();
  }) as EventListener;

  const detach = (): void => {
    dom.removeEventListener(el, 'transitionend', onEvent);
    dom.removeEventListener(el, 'animationend', onEvent);
    if (timer !== null) {
      h.clearTimeout(timer);
      timer = null;
    }
  };

  const finish = (): void => {
    if (finished) return;
    finished = true;
    detach();
    // Clear all transition classes so the element rests in its natural state.
    removeClasses(dom, el, active);
    removeClasses(dom, el, to);
    removeClasses(dom, el, from);
    onDone();
  };

  // Phase 1: apply the starting + active classes immediately.
  addClasses(dom, el, from);
  addClasses(dom, el, active);

  dom.addEventListener(el, 'transitionend', onEvent);
  dom.addEventListener(el, 'animationend', onEvent);
  // Fallback completion: the safety net for elements that fire no transition
  // event (and the ONLY completion signal under happy-dom, where tests set a
  // small duration). 0 → next macrotask.
  timer = h.setTimeout(finish, duration);

  // Phase 2: on the next frame flip from → to so the CSS transition runs.
  nextFrame(() => {
    if (finished) return;
    removeClasses(dom, el, from);
    addClasses(dom, el, to);
  });

  return {
    cancel: () => {
      // Cancel = settle immediately (removes classes, clears listeners/timer)
      // but WITHOUT invoking onDone, so a cancelled leave never finalizes the
      // node it was about to destroy.
      if (finished) return;
      finished = true;
      detach();
      removeClasses(dom, el, active);
      removeClasses(dom, el, to);
      removeClasses(dom, el, from);
    },
  };
}

interface LeavingEntry {
  readonly inst: NodeInstance;
  readonly run: Run;
}

/**
 * Per-container transition controller. One instance is created for each
 * reactive-list / conditional NodeInstance in {@link wireReactiveList}; its
 * `leaving` map persists across every reconcile of that container.
 */
export class TransitionController {
  private readonly leaving = new Map<string, LeavingEntry>();

  constructor(
    private readonly dom: DOMAdapter,
    private readonly graph: ApplicationGraph,
    /** Full teardown of a leaving instance (remove + dispose + forget + detach). */
    private readonly finalize: (inst: NodeInstance) => void,
  ) {}

  /** True only in a real DOM environment (browser). */
  private get browser(): boolean {
    return this.dom.body() !== null;
  }

  private keyOf(inst: NodeInstance): string {
    return inst.graphNode.key ?? inst.graphNode.id;
  }

  private resolved(node: GraphNode): ResolvedTransitionLike | undefined {
    return getResolvedTransition(this.graph, node.id);
  }

  /** Run the enter animation for `inst` if it carries a transition (browser only). */
  enter(inst: NodeInstance): void {
    if (!this.browser) return;
    const rt = this.resolved(inst.graphNode);
    if (rt === undefined) return;
    const el = inst.domNode;
    if (!this.dom.isElement(el)) return;
    startRun(this.dom, el, rt.enterActive, rt.enterFrom, rt.enterTo, rt.duration, () => {
      /* enter has no teardown; classes already cleared by the run */
    });
  }

  /**
   * Play `appear` for any initial child that opted into it (fresh browser mount
   * only — hydration must never animate appear, §22, and this is called only on
   * the mount path).
   */
  appear(children: readonly NodeInstance[]): void {
    if (!this.browser) return;
    for (const child of children) {
      const rt = this.resolved(child.graphNode);
      if (rt !== undefined && rt.appear) this.enter(child);
    }
  }

  hooks(): TransitionHooks {
    return {
      takeLeaving: (key) => {
        const entry = this.leaving.get(key);
        if (entry === undefined) return undefined;
        entry.run.cancel(); // leave→enter: stop the leave, keep the live node
        this.leaving.delete(key);
        return entry.inst;
      },
      beginLeave: (inst) => {
        if (!this.browser) return false;
        const rt = this.resolved(inst.graphNode);
        if (rt === undefined) return false;
        const el = inst.domNode;
        if (!this.dom.isElement(el)) return false;
        const key = this.keyOf(inst);
        // If a prior leave for this key is somehow still running, settle it.
        const prior = this.leaving.get(key);
        if (prior !== undefined) prior.run.cancel();
        const run = startRun(
          this.dom,
          el,
          rt.leaveActive,
          rt.leaveFrom,
          rt.leaveTo,
          rt.duration,
          () => {
            // Only finalize if THIS run is still the registered one (it may have
            // been reclaimed by a re-entering key, which cancels without done).
            const current = this.leaving.get(key);
            if (current !== undefined && current.run === run) {
              this.leaving.delete(key);
              this.finalize(inst);
            }
          },
        );
        this.leaving.set(key, { inst, run });
        return true;
      },
      onEnter: (inst) => this.enter(inst),
    };
  }
}
