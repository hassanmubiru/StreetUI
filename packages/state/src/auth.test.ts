/**
 * Tests for the optional auth session primitive (§19). Built on resource +
 * mutation; no network. Cover the loading→authenticated / unauthenticated
 * transitions, error state, refresh, and logout→unauthenticated.
 */
import { describe, it, expect } from 'vitest';
import { createAuthSession } from './auth.js';

interface User {
  readonly id: string;
}

/** Await the microtasks an immediate resource load schedules. */
const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

describe('createAuthSession', () => {
  it('starts loading, then resolves to authenticated with the user', async () => {
    const session = createAuthSession<User>({ loadUser: async () => ({ id: 'u1' }) });
    expect(session.status.get()).toBe('loading');
    expect(session.loading.get()).toBe(true);

    await flush();
    expect(session.status.get()).toBe('authenticated');
    expect(session.authenticated.get()).toBe(true);
    expect(session.user.get()).toEqual({ id: 'u1' });
  });

  it('resolves to unauthenticated when loadUser returns null', async () => {
    const session = createAuthSession<User>({ loadUser: async () => null });
    await flush();
    expect(session.status.get()).toBe('unauthenticated');
    expect(session.unauthenticated.get()).toBe(true);
    expect(session.user.get()).toBeUndefined();
  });

  it('surfaces an error state when loadUser rejects', async () => {
    const session = createAuthSession<User>({
      loadUser: async () => {
        throw new Error('network');
      },
    });
    await flush();
    expect(session.status.get()).toBe('error');
    expect((session.error.get() as Error).message).toBe('network');
  });

  it('logout runs the server logout then refreshes to unauthenticated', async () => {
    let current: User | null = { id: 'u1' };
    let loggedOut = false;
    const session = createAuthSession<User>({
      loadUser: async () => current,
      logout: async () => {
        loggedOut = true;
        current = null;
      },
    });
    await flush();
    expect(session.authenticated.get()).toBe(true);

    await session.logout();
    expect(loggedOut).toBe(true);
    expect(session.status.get()).toBe('unauthenticated');
    expect(session.user.get()).toBeUndefined();
  });

  it('refresh re-checks the session (e.g. after a sign-in elsewhere)', async () => {
    let current: User | null = null;
    const session = createAuthSession<User>({ loadUser: async () => current, immediate: false });
    // immediate:false → stays loading until first refresh.
    expect(session.status.get()).toBe('loading');

    current = { id: 'u2' };
    await session.refresh();
    expect(session.status.get()).toBe('authenticated');
    expect(session.user.get()).toEqual({ id: 'u2' });
  });
});
