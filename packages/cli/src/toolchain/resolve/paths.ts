/**
 * Path safety helpers for the dev server and production preview.
 *
 * The containment rule is `path.relative`, never a raw `startsWith`: a prefix
 * check treats a sibling directory (`<root>-secret`) as inside the root.
 */

import { isAbsolute, relative, resolve, sep } from 'node:path';

/** Decode a URL path, rejecting malformed percent-encoding and null bytes. */
export function safeDecode(value: string): string | undefined {
  try {
    const decoded = decodeURIComponent(value);
    return decoded.includes('\0') ? undefined : decoded;
  } catch {
    return undefined;
  }
}

/** True when `child` is `parent` or lives underneath it. */
export function isInside(parent: string, child: string): boolean {
  const rel = relative(parent, child);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

/** Normalise a path to forward slashes (module URLs are always POSIX). */
export function toPosix(value: string): string {
  return value.split(sep).join('/');
}

/** Convert a POSIX module URL path back to a native path. */
export function fromPosix(value: string): string {
  return value.split('/').join(sep);
}

/** Strip query/hash from a URL path. */
export function pathnameOf(url: string): string {
  const q = url.indexOf('?');
  const h = url.indexOf('#');
  let end = url.length;
  if (q >= 0) end = Math.min(end, q);
  if (h >= 0) end = Math.min(end, h);
  return url.slice(0, end);
}

/** Join and normalize a path, ensuring it stays under `root`. */
export function resolveUnder(root: string, ...parts: string[]): string | undefined {
  const full = resolve(root, ...parts);
  return isInside(root, full) ? full : undefined;
}