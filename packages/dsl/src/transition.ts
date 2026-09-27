/**
 * Transition configuration (§2, §4).
 *
 * A `TransitionConfig` is a pure, declarative description of a CSS class-based
 * enter/leave transition — the engine choice for this milestone. It contains NO
 * DOM references, NO timers and NO browser-only APIs, so it is safe to build on
 * the server (where it is simply ignored — see the renderer's SSR guard) and to
 * carry on a graph handler (`__transition__<nodeId>`) alongside the existing
 * `__overlay__`/`__component__` descriptors.
 *
 * The class model follows the widely-understood enter/leave convention:
 *
 *   enter:  [enterActive (+ enter) whole phase] · enterFrom (start) → enterTo (end)
 *   leave:  [leaveActive (+ leave) whole phase] · leaveFrom (start) → leaveTo (end)
 *
 * `name` is a shorthand that expands to `${name}-enter-from`,
 * `${name}-enter-active`, `${name}-enter-to` and the leave equivalents; explicit
 * class fields override the derived ones. Because the classes are just strings,
 * SSR output is deterministic (no class is applied on the server at all — the
 * controller is browser-only), satisfying §4/§21.
 */
export interface TransitionConfig {
  /** Shorthand base: expands to `${name}-enter-from`, `${name}-enter-active`, … */
  readonly name?: string;
  /** Class(es) present for the whole enter phase (in addition to `enterActive`). */
  readonly enter?: string;
  /** Class(es) applied at the start of enter, removed on the next frame. */
  readonly enterFrom?: string;
  /** Class(es) present for the whole enter phase (where the CSS `transition` lives). */
  readonly enterActive?: string;
  /** Class(es) added on the next frame, removed when enter completes. */
  readonly enterTo?: string;
  /** Class(es) present for the whole leave phase (in addition to `leaveActive`). */
  readonly leave?: string;
  /** Class(es) applied at the start of leave, removed on the next frame. */
  readonly leaveFrom?: string;
  /** Class(es) present for the whole leave phase (where the CSS `transition` lives). */
  readonly leaveActive?: string;
  /** Class(es) added on the next frame, removed when leave completes. */
  readonly leaveTo?: string;
  /**
   * Also animate the very first appearance (initial mount). Hydration never
   * animates appear (the DOM is already present and correct); this only affects
   * fresh browser mounts. Defaults to false.
   */
  readonly appear?: boolean;
  /**
   * Fallback completion timeout in milliseconds. A transition normally completes
   * on the element's `transitionend`/`animationend`. This timeout is the safety
   * net for (a) transitions that fire no such event and (b) test DOMs like
   * happy-dom that dispatch no transition events at all — making tests
   * deterministic without a real browser (§24). Defaults to 1000. Use a small
   * value (or 0 → next macrotask) in tests.
   */
  readonly duration?: number;
}

/**
 * The resolved, ready-to-apply form of a {@link TransitionConfig}: each phase's
 * classes are pre-split into arrays so the controller applies/removes them with
 * no per-run string parsing. Produced once by {@link resolveTransition} at wire
 * time (browser only).
 */
export interface ResolvedTransition {
  /** enter classes present for the whole phase (base `enter` + `enterActive`). */
  readonly enterActive: readonly string[];
  /** enter start classes (removed next frame). */
  readonly enterFrom: readonly string[];
  /** enter end classes (added next frame). */
  readonly enterTo: readonly string[];
  readonly leaveActive: readonly string[];
  readonly leaveFrom: readonly string[];
  readonly leaveTo: readonly string[];
  readonly appear: boolean;
  readonly duration: number;
}

/** Split a class string on whitespace into a de-duplicated array (empty-safe). */
function classes(value: string | undefined): string[] {
  if (value === undefined) return [];
  const out: string[] = [];
  for (const token of value.split(/\s+/)) {
    if (token.length > 0 && !out.includes(token)) out.push(token);
  }
  return out;
}

/** Merge two class arrays, preserving order and dropping duplicates. */
function merge(a: string[], b: string[]): string[] {
  const out = [...a];
  for (const token of b) if (!out.includes(token)) out.push(token);
  return out;
}

/**
 * Resolve a {@link TransitionConfig} into applied class arrays. The `name`
 * shorthand supplies defaults; any explicit field overrides the derived class
 * for that phase-slot (still merged with `enter`/`leave` base classes).
 */
export function resolveTransition(config: TransitionConfig): ResolvedTransition {
  const n = config.name;
  const enterActive = merge(
    classes(config.enter),
    classes(config.enterActive ?? (n !== undefined ? `${n}-enter-active` : undefined)),
  );
  const leaveActive = merge(
    classes(config.leave),
    classes(config.leaveActive ?? (n !== undefined ? `${n}-leave-active` : undefined)),
  );
  return {
    enterActive,
    enterFrom: classes(config.enterFrom ?? (n !== undefined ? `${n}-enter-from` : undefined)),
    enterTo: classes(config.enterTo ?? (n !== undefined ? `${n}-enter-to` : undefined)),
    leaveActive,
    leaveFrom: classes(config.leaveFrom ?? (n !== undefined ? `${n}-leave-from` : undefined)),
    leaveTo: classes(config.leaveTo ?? (n !== undefined ? `${n}-leave-to` : undefined)),
    appear: config.appear ?? false,
    duration: config.duration ?? 1000,
  };
}

/** Runtime brand check for a transition descriptor value. */
export function isTransitionConfig(value: unknown): value is TransitionConfig {
  if (value === null || typeof value !== 'object') return false;
  const o = value as Record<string, unknown>;
  // A config is meaningful only if it carries at least one class source.
  return (
    typeof o['name'] === 'string' ||
    typeof o['enter'] === 'string' ||
    typeof o['enterActive'] === 'string' ||
    typeof o['enterFrom'] === 'string' ||
    typeof o['leave'] === 'string' ||
    typeof o['leaveActive'] === 'string' ||
    typeof o['leaveFrom'] === 'string'
  );
}
