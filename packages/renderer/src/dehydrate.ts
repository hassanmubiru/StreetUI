/**
 * SSR state transfer (dehydration) — move server-resolved data to the client.
 *
 * When the server resolves resources before rendering, their data must reach
 * the client so hydration can seed them (via `resource({ initialData })`)
 * instead of refetching. StreetUI does this with a single, framework-scoped
 * `<script>` payload rather than blindly interpolating `JSON.stringify` into
 * markup.
 *
 * Safety (v0.4 rule #16): the JSON is emitted into a
 * `<script type="application/json">` block — an inert data island the browser
 * never executes — and every character that could terminate that block or be
 * reinterpreted by the HTML/JS parser is escaped to its `\uXXXX` form. Because
 * `<` inside JSON parses back to `<`, the payload round-trips exactly
 * while being impossible to break out of. This is deterministic (stable key
 * order is the caller's responsibility) and typed at the boundary as
 * `Record<string, unknown>` — never `any`.
 */

import type { DOMAdapter } from '@streetui/dom';

/** Attribute marking StreetUI's state island so the client can find it. */
export const STATE_MARKER_ATTR = 'data-streetui-state';

/**
 * Escape a JSON string for safe embedding inside a `<script>` element:
 *   <  >  &         → HTML / `</script>` breakout and entity ambiguity
 *   U+2028 / U+2029 → invalid raw in JS string literals
 * Uses code-point checks so no raw separator characters live in this source.
 */
function escapeForScript(json: string): string {
  let out = '';
  for (const ch of json) {
    const code = ch.charCodeAt(0);
    if (ch === '<') out += '\\u003c';
    else if (ch === '>') out += '\\u003e';
    else if (ch === '&') out += '\\u0026';
    else if (code === 0x2028) out += '\\u2028';
    else if (code === 0x2029) out += '\\u2029';
    else out += ch;
  }
  return out;
}

/**
 * Serialize a state map to an HTML `<script>` island for inclusion in the
 * server-rendered document (typically just before the closing tag of the
 * mount container). Returns an empty string for an empty map.
 */
export function serializeState(state: Record<string, unknown>): string {
  if (Object.keys(state).length === 0) return '';
  const json = escapeForScript(JSON.stringify(state));
  return `<script type="application/json" ${STATE_MARKER_ATTR}>${json}</script>`;
}

/**
 * Read the state island back on the client. Searches `root` for StreetUI's
 * state `<script>` and parses it. Returns an empty object when absent or
 * unparseable (hydration then proceeds as a cold client render). Routed through
 * the DOM adapter so it is testable and never assumes a global `document`.
 */
export function readState(
  dom: DOMAdapter,
  root: Element | Document,
): Record<string, unknown> {
  const el = dom.querySelector(root, `script[${STATE_MARKER_ATTR}]`);
  if (el === null) return {};
  const text = dom.getTextContent(el);
  if (text === null || text.length === 0) return {};
  try {
    const parsed: unknown = JSON.parse(text);
    if (parsed !== null && typeof parsed === 'object') {
      return parsed as Record<string, unknown>;
    }
    return {};
  } catch {
    return {};
  }
}
