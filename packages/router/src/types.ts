/**
 * StreetUI Router — public type surface.
 *
 * The router sits ABOVE the DSL/compiler/runtime/renderer and composes them.
 * It introduces no new rendering path and no second reactive system: route
 * state is a StreetUI `signal`, route cleanup reuses the core `CleanupRegistry`,
 * and each route renders as an ordinary compiled StreetUI application tree.
 */

import type { PageDSL } from '@streetui/dsl';

/**
 * Context handed to a route builder when its route becomes active.
 *
 * `params` are the values captured from dynamic segments (`/users/:id`),
 * `query` is the parsed query string, and `onCleanup` registers work to run
 * when the router navigates away from this route (subscriptions, effects,
 * timers). It is backed by a route-scoped `CleanupRegistry` — there is no
 * separate cleanup mechanism.
 */
export interface RouteContext {
  /** Full matched pathname, e.g. `/users/123`. */
  readonly path: string;
  /** The route pattern that matched, e.g. `/users/:id` or `*`. */
  readonly pattern: string;
  /** Dynamic segment values captured from the path. */
  readonly params: Readonly<Record<string, string>>;
  /** Parsed query string (everything after `?`). */
  readonly query: URLSearchParams;
  /** Register a callback to run when navigating away from this route. */
  onCleanup(fn: () => void): void;
}

/** Builds a route's page tree. Receives the page scope and the route context. */
export type RouteBuilder = (page: PageDSL, ctx: RouteContext) => void;

/** A single route: a path pattern and the builder that renders it. */
export interface RouteDefinition {
  /**
   * Path pattern. Supports:
   *  - static segments:      `/`, `/docs`, `/docs/getting-started`
   *  - dynamic `:param`:     `/users/:id`
   *  - catch-all wildcard:   `*` (matches anything — use for a 404 route)
   */
  readonly path: string;
  readonly builder: RouteBuilder;
}

/** The result of resolving a location against the route table. */
export interface RouteMatch {
  /** The active pathname (no query string). */
  readonly path: string;
  /** The pattern of the matched route. */
  readonly pattern: string;
  /** Captured dynamic params. */
  readonly params: Readonly<Record<string, string>>;
  /** Parsed query string. */
  readonly query: URLSearchParams;
  /** The route definition that produced this match. */
  readonly route: RouteDefinition;
  /** True when this match came from the wildcard/fallback (no explicit route). */
  readonly isFallback: boolean;
}
