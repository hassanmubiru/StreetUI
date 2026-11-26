/**
 * Dashboard example tests: data layer, route mapping, SSR output for every
 * view, and real form validation behavior. No browser required.
 */
import { describe, it, expect } from 'vitest';
import { renderToString } from 'streetui/server';
import { fetchUsers, fetchProjects, USERS, PROJECTS } from './data.js';
import { createState, compileApp, snapshot, viewForPath } from './app.js';

const renderView = async (view: 'overview' | 'users' | 'projects' | 'settings' | 'not-found'): Promise<string> => {
  const state = createState({ view });
  await Promise.all([state.overview.refetch(), state.users.refetch(), state.projects.refetch()]);
  return renderToString(compileApp(state));
};

describe('data layer', () => {
  it('filters users by query and role with correct pagination', async () => {
    const admins = await fetchUsers({ query: '', role: 'admin', page: 1, pageSize: 4 });
    expect(admins.items.every((u) => u.role === 'admin')).toBe(true);
    expect(admins.total).toBe(USERS.filter((u) => u.role === 'admin').length);
    expect(admins.items.length).toBeLessThanOrEqual(4);

    const ava = await fetchUsers({ query: 'ava', role: 'all', page: 1, pageSize: 8 });
    expect(ava.total).toBeGreaterThan(0);
    expect(ava.items.every((u) => `${u.name} ${u.email}`.toLowerCase().includes('ava'))).toBe(true);

    const paged = await fetchUsers({ query: '', role: 'all', page: 3, pageSize: 8 });
    expect(paged.pageCount).toBe(3);
    expect(paged.items.length).toBe(USERS.length - 16);

    const none = await fetchUsers({ query: 'no-such-person', role: 'all', page: 1, pageSize: 8 });
    expect(none.total).toBe(0);
  });

  it('filters projects by status', async () => {
    const atRisk = await fetchProjects('at-risk');
    expect(atRisk.length).toBe(PROJECTS.filter((p) => p.status === 'at-risk').length);
    expect(atRisk.every((p) => p.status === 'at-risk')).toBe(true);
    expect((await fetchProjects('all')).length).toBe(PROJECTS.length);
  });
});

describe('route mapping', () => {
  it('maps paths to views with a 404 fallback', () => {
    expect(viewForPath('/')).toBe('overview');
    expect(viewForPath('/users?role=admin')).toBe('users');
    expect(viewForPath('/projects/')).toBe('projects');
    expect(viewForPath('/settings')).toBe('settings');
    expect(viewForPath('/does-not-exist')).toBe('not-found');
  });
});

describe('SSR', () => {
  it('renders the overview with metrics and activity', async () => {
    const html = await renderView('overview');
    expect(html).toContain('Acme Admin');
    expect(html).toContain('Total users');
    expect(html).toContain('Recent activity');
    expect(html).toContain('Billing migration');
    expect(html).toContain('id="brand"');
  });

  it('server render returns a complete document with app root and state island', async () => {
    const { render } = await import('./server.js');
    const result = await render({ url: '/users' });
    expect(result.html).toContain('id="app"');
    expect(result.html).toContain('Acme Admin');
    expect(result.html).toContain('streetui-dashboard');
    expect(result.html).toContain('of 24 users');
  });

  it('renders the users table with filters and pagination', async () => {
    const html = await renderView('users');
    expect(html).toContain('Search name or email');
    expect(html).toContain('id="user-search"');
    expect(html).toContain('of 24 users');
    expect(html).toContain('Page 1 of 3');
    expect(html).toContain('id="users-next"');
  });

  it('renders projects with status badges and progress', async () => {
    const html = await renderView('projects');
    expect(html).toContain('Billing migration');
    expect(html).toContain('on-track');
    expect(html).toContain('Progress: 72%');
  });

  it('renders all three settings forms with labels', async () => {
    const html = await renderView('settings');
    expect(html).toContain('Full name');
    expect(html).toContain('Organization name');
    expect(html).toContain('New password (min 8 characters)');
    expect(html).toContain('id="profile-submit"');
  });

  it('renders the 404 view for unknown routes', async () => {
    const html = await renderView('not-found');
    expect(html).toContain('Page not found');
  });

  it('produces a JSON-serialisable snapshot for hydration', async () => {
    const state = createState({ view: 'users', userQuery: 'ava', theme: 'dark' });
    const snap = snapshot(state);
    expect(snap.view).toBe('users');
    expect(snap.userQuery).toBe('ava');
    expect(snap.theme).toBe('dark');
    expect(JSON.parse(JSON.stringify(snap)).view).toBe('users');
  });
});

describe('forms', () => {
  it('rejects invalid profile input with validator messages', async () => {
    const state = createState({ view: 'settings' });
    await state.profileForm.submit();
    const errors = state.profileForm.errors.get();
    expect(errors.name).toBeDefined();
    expect(errors.email).toBeDefined();
    expect(state.profileSaved.get()).toBe('');
  });

  it('accepts a valid profile and records the saved message', async () => {
    const state = createState({ view: 'settings' });
    state.profileForm.field('name').value.set('Ada Lovelace');
    state.profileForm.field('email').value.set('ada@example.com');
    await state.profileForm.submit();
    expect(Object.keys(state.profileForm.errors.get()).length).toBe(0);
    expect(state.profileSaved.get()).toContain('Ada Lovelace');
    expect(state.profileSaved.get()).toContain('ada@example.com');
  });

  it('enforces the minimum password length', async () => {
    const state = createState({ view: 'settings' });
    state.passwordForm.field('current').value.set('old-secret');
    state.passwordForm.field('next').value.set('short');
    await state.passwordForm.submit();
    expect(state.passwordForm.errors.get().next).toBeDefined();
    expect(state.passwordSaved.get()).toBe('');

    state.passwordForm.field('next').value.set('long-enough-secret');
    await state.passwordForm.submit();
    expect(state.passwordSaved.get()).toContain('Password updated');
  });
});
