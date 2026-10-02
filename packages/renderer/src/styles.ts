/**
 * StreetUI styling — SSR stylesheet emission + hydration adoption (§15–§17).
 *
 * This is the exact companion to `renderHead` (head.ts): where the head runtime
 * serializes merged `head()` contributions into `<head>`, this serializes the
 * process-wide deduplicated CSS rule registry into a single
 * `<style data-streetui-css>` block for the caller to place in `<head>`.
 *
 *   • `renderStyles()` — SERVER. Serializes `styleRegistry` in deterministic band
 *     order (tokens → base → responsive → state → variant) and stamps the block
 *     with `data-streetui-css-keys="<id> <id> …"` so the browser can adopt the
 *     identities on hydration instead of re-emitting duplicate rules (§17).
 *     Returns `''` when the registry is empty — so an app that declares no styles
 *     (and no token block) emits nothing extra and existing SSR output stays
 *     byte-identical (§16, the empty-registry guarantee).
 *
 *   • `adoptServerStyles(dom, root)` — BROWSER. Finds the server-emitted style
 *     block under `root` (or `document`), reads its identity keys, and seeds the
 *     registry via `adoptServerIdentities` so client-side `style()`/token calls
 *     for the same identities register no duplicate rule (§17).
 *
 * CSS is inherently global and cascading, so — unlike head — the stylesheet is
 * the whole process registry (a deduped superset), not a per-graph walk. The
 * registry is keyed by content identity and never by node, so it is bounded by
 * source diversity and strands nothing when nodes unmount (§15, leak-free).
 */

import type { DOMAdapter } from '@streetui/dom';
import { styleRegistry, type StyleRegistry } from '@streetui/core';

/** Marker attribute identifying the framework's single managed stylesheet block. */
const CSS_MARKER = 'data-streetui-css';
/** Attribute carrying the ordered identities the server stylesheet already shipped. */
const CSS_KEYS = 'data-streetui-css-keys';

export interface RenderStylesOptions {
  /** Registry to serialize (defaults to the shared process-wide instance). */
  readonly registry?: StyleRegistry;
}

/**
 * Serialize the deduplicated CSS registry to a `<style data-streetui-css>` block
 * for placement inside `<head>`. Deterministic and byte-stable: an empty registry
 * yields `''` (§16); otherwise the single block carries every registered rule in
 * fixed band order plus the identity list for hydration adoption (§17).
 */
export function renderStyles(options: RenderStylesOptions = {}): string {
  const registry = options.registry ?? styleRegistry;
  const css = registry.serializeCSS();
  if (css.length === 0) return '';
  const keys = registry.identities().join(' ');
  return `<style ${CSS_MARKER} ${CSS_KEYS}="${keys}">${css}</style>`;
}

/**
 * Adopt a server-emitted stylesheet's identities into the registry so the client
 * does not re-emit duplicate rules for the same styles (§17). Safe to call when
 * no server block exists (no-op) and idempotent. Returns the number of identities
 * adopted (0 when there was nothing to adopt).
 */
export function adoptServerStyles(
  dom: DOMAdapter,
  root: Element | null,
  options: RenderStylesOptions = {},
): number {
  const registry = options.registry ?? styleRegistry;
  const el = findStyleBlock(dom, root);
  if (el === null) return 0;
  const keysAttr = dom.getAttribute(el, CSS_KEYS);
  if (keysAttr === null || keysAttr.length === 0) {
    // A block with no keys attribute still means the server shipped a sheet;
    // mark the registry adopted so later identities are treated as additive.
    registry.adoptServerIdentities([]);
    return 0;
  }
  const ids = keysAttr.split(' ').filter((s) => s.length > 0);
  registry.adoptServerIdentities(ids);
  return ids.length;
}

/** Locate the single `[data-streetui-css]` block under `root` (else `document`). */
function findStyleBlock(dom: DOMAdapter, root: Element | null): Element | null {
  const head = dom.head();
  const scope: Element | null = root ?? head;
  if (scope === null) return null;
  return searchDescendants(dom, scope);
}

/** Depth-first search for the first element carrying the CSS marker attribute. */
function searchDescendants(dom: DOMAdapter, el: Element): Element | null {
  if (dom.isElement(el) && dom.getAttribute(el, CSS_MARKER) !== null) return el;
  for (const child of dom.childNodes(el)) {
    if (!dom.isElement(child)) continue;
    const found = searchDescendants(dom, child as Element);
    if (found !== null) return found;
  }
  return null;
}
