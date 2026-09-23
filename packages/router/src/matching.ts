/**
 * Route matching — pure functions, no DOM, no reactivity.
 *
 * A pattern is matched segment-by-segment against a pathname:
 *  - a literal segment must equal the path segment,
 *  - a `:name` segment captures the path segment into `params.name`,
 *  - a `*` segment (or a whole-pattern `*`) is a catch-all that matches the
 *    remainder of the path and captures it into `params['*']`.
 *
 * Matching is intentionally small: no optional segments, no regex constraints,
 * no nested route trees. Composition of layouts is done in the DSL, not here.
 */

/** Split a path into non-empty segments. `/` → [], `/a/b` → ['a','b']. */
function segments(path: string): string[] {
  return path.split('/').filter((s) => s.length > 0);
}

/** Normalize a pathname: ensure a single leading slash, drop a trailing slash. */
export function normalizePath(path: string): string {
  let p = path.trim();
  if (p === '') return '/';
  if (!p.startsWith('/')) p = `/${p}`;
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
  return p;
}

/**
 * Try to match a single pattern against a pathname.
 * Returns the captured params on success, or `null` on no match.
 */
export function matchPattern(
  pattern: string,
  pathname: string,
): Record<string, string> | null {
  // Whole-pattern wildcard: matches everything.
  if (pattern === '*') {
    return { '*': normalizePath(pathname).slice(1) };
  }

  const patSegs = segments(pattern);
  const pathSegs = segments(normalizePath(pathname));
  const params: Record<string, string> = {};

  for (let i = 0; i < patSegs.length; i++) {
    const patSeg = patSegs[i]!;

    // Trailing catch-all: capture the rest of the path.
    if (patSeg === '*') {
      params['*'] = pathSegs.slice(i).map((s) => decodeURIComponent(s)).join('/');
      return params;
    }

    const pathSeg = pathSegs[i];
    if (pathSeg === undefined) return null; // path ran out of segments

    if (patSeg.startsWith(':')) {
      const name = patSeg.slice(1);
      if (name === '') return null; // malformed `:` with no name
      params[name] = decodeURIComponent(pathSeg);
      continue;
    }

    if (patSeg !== pathSeg) return null; // literal mismatch
  }

  // All pattern segments consumed — the path must be fully consumed too.
  if (pathSegs.length !== patSegs.length) return null;
  return params;
}

export interface MatchResult<R> {
  readonly route: R;
  readonly params: Record<string, string>;
}

/**
 * Match a pathname against an ordered list of routes. The first route whose
 * pattern matches wins (definition order), so more specific routes should be
 * listed before a `*` fallback.
 */
export function matchRoutes<R extends { path: string }>(
  routes: readonly R[],
  pathname: string,
): MatchResult<R> | null {
  for (const route of routes) {
    const params = matchPattern(route.path, pathname);
    if (params !== null) return { route, params };
  }
  return null;
}

/** Split a `to` target into its pathname and (already-stripped) search string. */
export function splitTarget(to: string): { pathname: string; search: string } {
  const hashIndex = to.indexOf('#');
  const withoutHash = hashIndex >= 0 ? to.slice(0, hashIndex) : to;
  const qIndex = withoutHash.indexOf('?');
  if (qIndex < 0) return { pathname: normalizePath(withoutHash), search: '' };
  return {
    pathname: normalizePath(withoutHash.slice(0, qIndex)),
    search: withoutHash.slice(qIndex + 1),
  };
}
