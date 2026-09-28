/**
 * Optional auth session primitive (2.0 §19) — reactive authentication state for
 * building sign-in UIs and protected routes, composed entirely from the existing
 * `resource` (the "who am I" read) and `mutation` (logout / refresh writes).
 *
 * There is no new auth framework here and no credential handling: the app
 * supplies a `loadUser` function (however it authenticates — a StreetJS session
 * cookie, a bearer token, anything) that returns the current user or `null`. The
 * primitive turns that into the states a UI switches on — `loading`,
 * `authenticated`, `unauthenticated`, `error` — plus `refresh()` and `logout()`.
 *
 * How the pieces the spec names fit together (all EXISTING seams, no new ones):
 *   - loading / unauth / auth  → switch UI with `when(session.authenticated, …)`
 *     etc. (the renderer's existing conditional).
 *   - refresh / logout         → `session.refresh()` / `session.logout()`.
 *   - protected route          → in a route's setup, read `session.status`; when
 *     `unauthenticated`, navigate to the login route (router). Throwing inside a
 *     guarded builder is caught by `errorBoundary` for an error fallback. This
 *     module stays router-agnostic so core has no router dependency — the app
 *     wires the navigation, exactly as with any other signal.
 */

import { signal, derived, batch, type ReadonlySignal } from './signal.js';
import { resource, type ResourceLoaderContext } from './resource.js';
import { mutation } from './mutation.js';

/** The four states an auth-aware UI switches on. */
export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'error';

/** Load the current user, or `null`/`undefined` when nobody is signed in. */
export type LoadUser<TUser> = (ctx: ResourceLoaderContext) => Promise<TUser | null | undefined> | TUser | null | undefined;

export interface AuthSessionConfig<TUser> {
  /** Resolve the current user (or null when unauthenticated). Abort-aware. */
  readonly loadUser: LoadUser<TUser>;
  /**
   * Perform the server-side logout (clear the cookie/token). Optional — when
   * omitted, `logout()` just re-checks the session. After it resolves the
   * session refreshes, so `loadUser` should then return null.
   */
  readonly logout?: () => Promise<void> | void;
  /** Skip the initial load; stays `loading` until the first `refresh()`. */
  readonly immediate?: boolean;
  /** Teardown registrar (e.g. a component's `ctx.onCleanup`). */
  readonly onCleanup?: (fn: () => void) => void;
}

export interface AuthSession<TUser> {
  /** The current coarse auth state. */
  readonly status: ReadonlySignal<AuthStatus>;
  /** The signed-in user, or `undefined` when not authenticated. */
  readonly user: ReadonlySignal<TUser | undefined>;
  /** The most recent load/logout error, or `undefined`. */
  readonly error: ReadonlySignal<unknown>;
  /** `status === 'authenticated'`. */
  readonly authenticated: ReadonlySignal<boolean>;
  /** `status === 'unauthenticated'`. */
  readonly unauthenticated: ReadonlySignal<boolean>;
  /** `status === 'loading'` (the initial who-am-I is still in flight). */
  readonly loading: ReadonlySignal<boolean>;
  /** True while a `logout()` is in flight. */
  readonly loggingOut: ReadonlySignal<boolean>;
  /** Re-run `loadUser` (e.g. after a token refresh or a focus regain). */
  refresh(): Promise<void>;
  /** Run the configured server logout, then refresh (→ unauthenticated). */
  logout(): Promise<void>;
  /** Cancel in-flight work and detach. Idempotent. */
  dispose(): void;
}

/**
 * Create an {@link AuthSession}. The session starts in `loading` and resolves to
 * `authenticated`/`unauthenticated` once `loadUser` settles (unless
 * `immediate: false`).
 */
export function createAuthSession<TUser>(config: AuthSessionConfig<TUser>): AuthSession<TUser> {
  const session = resource<TUser | null | undefined>(
    (ctx) => config.loadUser(ctx),
    {
      ...(config.immediate !== undefined ? { immediate: config.immediate } : {}),
      ...(config.onCleanup !== undefined ? { onCleanup: config.onCleanup } : {}),
    },
  );

  const status = derived<AuthStatus>(() => {
    const s = session.status.get();
    const d = session.data.get();
    if (s === 'error') return 'error';
    // Never loaded yet → loading. A refetch keeps the prior state visible (no
    // flicker): data is already set, so we fall through to auth/unauth below.
    if (s === 'idle' || (s === 'loading' && d === undefined)) return 'loading';
    return d === null || d === undefined ? 'unauthenticated' : 'authenticated';
  });

  const user = derived<TUser | undefined>(() => {
    const d = session.data.get();
    return d === null ? undefined : d;
  });

  const authenticated = derived<boolean>(() => status.get() === 'authenticated');
  const unauthenticated = derived<boolean>(() => status.get() === 'unauthenticated');
  const loading = derived<boolean>(() => status.get() === 'loading');

  const logoutMutation = mutation<void, void>(
    async () => {
      await config.logout?.();
    },
    { onSuccess: () => session.refetch() },
  );

  const dispose = (): void => {
    session.dispose();
    status.dispose();
    user.dispose();
    authenticated.dispose();
    unauthenticated.dispose();
    loading.dispose();
    logoutMutation.dispose();
  };

  return {
    status,
    user,
    error: session.error,
    authenticated,
    unauthenticated,
    loading,
    loggingOut: logoutMutation.pending,
    refresh: () => session.refetch(),
    logout: () => logoutMutation.mutate(undefined),
    dispose,
  };
}
