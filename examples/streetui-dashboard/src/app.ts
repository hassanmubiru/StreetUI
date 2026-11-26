/**
 * The universal dashboard application: one UI definition shared by SSR and the
 * browser, compiled into an immutable application graph.
 *
 * Routes (viewForPath): `/` overview, `/users`, `/projects`, `/settings`, and a
 * 404 fallback. Every page uses real StreetUI primitives — components,
 * resources with loading/error states, validated forms, reactive filters,
 * theming, and accessible labeling.
 */
import { streetui, compile, type CompiledApplication, type PageDSL } from 'streetui';
import { derived, signal } from 'streetui';
import { style, cx, a11yIds } from 'streetui';
import { createState, navigate, applyUserFilter, type AppState, type View } from './state.js';
import { PageHeader, EmptyState } from './components.js';

const navButton = style({ padding: '8px 14px', borderRadius: '8px', border: '1px solid transparent', background: 'transparent', color: 'var(--text)', cursor: 'pointer' });
const navActive = style({ background: 'var(--accent-soft)', border: '1px solid var(--accent)', color: 'var(--accent)' });
const tableClass = style({ width: '100%', fontSize: '14px' });
const thClass = style({ textAlign: 'left', color: 'var(--muted)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '8px 10px', border: '1px solid var(--border)' });
const tdClass = style({ padding: '10px', border: '1px solid var(--border)' });
const filterButton = style({ padding: '6px 12px', borderRadius: '999px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', cursor: 'pointer', fontSize: '13px' });
const inputClass = style({ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', minWidth: '240px' });
const primaryButton = style({ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--accent)', background: 'var(--accent)', color: 'var(--accent-contrast)', cursor: 'pointer', fontWeight: 600 });
const cardGrid = style({ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '16px' });
const badgeBase = style({ borderRadius: '999px', padding: '2px 10px', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' });

const statusColor = (status: string): string =>
  status === 'active' || status === 'on-track' || status === 'done'
    ? 'var(--ok)'
    : status === 'invited' || status === 'at-risk'
      ? 'var(--warn)'
      : 'var(--muted)';

/** Collect human-readable validator messages (drops empty fields). */
function errorMessages(errors: Partial<Record<string, string | undefined>>): string[] {
  const messages: string[] = [];
  for (const value of Object.values(errors)) {
    if (typeof value === 'string') messages.push(value);
  }
  return messages;
}

export function buildApp(page: PageDSL, state: AppState): void {
  page.section('topbar', (bar) => {
    bar.heading('Acme Admin', { level: 1, id: 'brand', class: style({ fontSize: '20px', margin: 0 }) });
    bar.button(derived(() => (state.theme.get() === 'light' ? 'Dark theme' : 'Light theme')), {
      id: 'theme-toggle',
      class: filterButton,
      onClick: () => state.theme.set(state.theme.peek() === 'light' ? 'dark' : 'light'),
    });
  }, { class: style({ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }), role: 'banner' });

  page.section('nav', (nav) => {
    const items: readonly { readonly view: View; readonly label: string }[] = [
      { view: 'overview', label: 'Overview' },
      { view: 'users', label: 'Users' },
      { view: 'projects', label: 'Projects' },
      { view: 'settings', label: 'Settings' },
    ];
    for (const item of items) {
      nav.button(item.label, {
        id: `nav-${item.view}`,
        class: navButton,
        onClick: () => navigate(state, item.view),
      });
    }
  }, { role: 'navigation', ariaLabel: 'Primary', class: style({ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }) });

  page.section('main', (main) => {
    main.when(derived(() => state.view.get() === 'overview'), (p) => overviewPage(p, state));
    main.when(derived(() => state.view.get() === 'users'), (p) => usersPage(p, state));
    main.when(derived(() => state.view.get() === 'projects'), (p) => projectsPage(p, state));
    main.when(derived(() => state.view.get() === 'settings'), (p) => settingsPage(p, state));
    main.when(derived(() => state.view.get() === 'not-found'), (p) => {
      p.component('page-header', PageHeader, { title: signal('Page not found'), subtitle: signal('The route you requested does not exist.') });
      p.button('Back to overview', { id: 'not-found-home', class: primaryButton, onClick: () => navigate(state, 'overview') });
    });
  }, { role: 'main' });
}

function overviewPage(page: PageDSL, state: AppState): void {
  page.component('page-header', PageHeader, {
    title: signal('Overview'),
    subtitle: signal('Workspace health, recent activity, and what needs attention.'),
  });

  page.when(state.overview.loading, (l) => l.text('Loading overview…', { id: 'overview-loading', role: 'status' }));
  page.when(derived(() => state.overview.error.get() !== undefined), (e) => {
    e.text('Could not load the overview. Check the data source and retry.', { role: 'alert' });
    e.button('Retry', { id: 'overview-retry', class: primaryButton, onClick: () => void state.overview.refetch() });
  });

  const data = derived(() => state.overview.data.get());
  page.when(derived(() => data.get() !== undefined), (ready) => {
    ready.section('metrics', (grid) => {
      grid.listOf('metric-list', derived(() => (data.get()?.metrics ?? []).slice()), (metric, _i, content) => {
        content.text(metric.label, { class: style({ color: 'var(--muted)', fontSize: '13px' }) });
        content.text(String(metric.value), { class: style({ fontSize: '28px', fontWeight: 700, display: 'block', marginTop: '4px' }) });
        content.text(metric.delta, { class: style({ color: 'var(--muted)', fontSize: '12px', marginTop: '4px', display: 'block' }) });
      });
    }, { class: cardGrid });

    ready.section('activity', (section) => {
      section.heading('Recent activity', { level: 3 });
      section.listOf('activity-list', derived(() => (data.get()?.activity ?? []).slice()), (item, _i, content) => {
        content.text(item.text, { class: style({ display: 'block' }) });
        content.text(item.at, { class: style({ color: 'var(--muted)', fontSize: '12px' }) });
      });
    }, { class: style({ marginTop: '28px' }) });
  });
}

function usersPage(page: PageDSL, state: AppState): void {
  page.component('page-header', PageHeader, {
    title: signal('Users'),
    subtitle: signal('Search, filter by role, and page through the team directory.'),
  });

  page.section('filters', (filters) => {
      filters.text('Search', { id: 'user-search-label', class: style({ color: 'var(--muted)', fontSize: '13px' }) });
      filters.input({
      id: 'user-search',
      class: inputClass,
      placeholder: 'Search name or email',
      value: state.userQuery,
      onChange: (value: string) => applyUserFilter(state, { query: value }),
      ariaLabelledBy: 'user-search-label',
    });
    for (const role of ['all', 'owner', 'admin', 'member', 'viewer'] as const) {
      filters.button(role, {
        id: `role-${role}`,
        class: filterButton,
        onClick: () => applyUserFilter(state, { role }),
      });
    }
  }, { class: style({ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }) });

  page.when(state.users.loading, (l) => l.text('Loading users…', { id: 'users-loading', role: 'status' }));
  page.when(derived(() => state.users.error.get() !== undefined), (e) => {
    e.text('Could not load users. Retry the request.', { role: 'alert' });
    e.button('Retry', { id: 'users-retry', class: primaryButton, onClick: () => void state.users.refetch() });
  });

  const data = derived(() => state.users.data.get());
  page.when(derived(() => data.get() !== undefined && data.get()!.total === 0), (empty) => {
    empty.component('empty-users', EmptyState, {
      title: signal('No users match these filters'),
      hint: signal('Try a different search term or role.'),
    });
  });

  page.when(derived(() => data.get() !== undefined && data.get()!.total > 0), (ready) => {
    ready.text(derived(() => `Showing ${data.get()!.items.length} of ${data.get()!.total} users`), {
      class: style({ color: 'var(--muted)', marginBottom: '8px', display: 'block' }),
    });
    ready.section('user-table', (table) => {
      table.section('head', (head) => {
        head.text('Name', { class: thClass });
        head.text('Role', { class: thClass });
        head.text('Status', { class: thClass });
        head.text('Last active', { class: thClass });
      }, { class: style({ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr' }) });
      table.listOf('user-rows', derived(() => (data.get()?.items ?? []).slice()), (user, _i, content) => {
        content.text(user.name, { class: style({ fontWeight: 600, display: 'block' }) });
        content.text(user.email, { class: style({ color: 'var(--muted)', fontSize: '13px', display: 'block' }) });
        content.text(user.role, { class: tdClass });
        content.text(user.status, { class: cx(badgeBase, style({ color: statusColor(user.status), border: `1px solid ${statusColor(user.status)}` })) });
        content.text(user.lastActive, { class: tdClass });
      });
    }, { class: tableClass });

    ready.section('pagination', (pager) => {
      pager.button('Previous', {
        id: 'users-prev',
        class: filterButton,
        disabled: derived(() => (data.get()?.page ?? 1) <= 1),
        onClick: () => applyUserFilter(state, { page: Math.max(1, (data.get()?.page ?? 1) - 1) }),
      });
      pager.text(derived(() => `Page ${data.get()?.page ?? 1} of ${data.get()?.pageCount ?? 1}`), { class: style({ color: 'var(--muted)' }) });
      pager.button('Next', {
        id: 'users-next',
        class: filterButton,
        disabled: derived(() => (data.get()?.page ?? 1) >= (data.get()?.pageCount ?? 1)),
        onClick: () => applyUserFilter(state, { page: (data.get()?.page ?? 1) + 1 }),
      });
    }, { class: style({ display: 'flex', gap: '12px', alignItems: 'center', marginTop: '16px' }) });
  });
}

function projectsPage(page: PageDSL, state: AppState): void {
  page.component('page-header', PageHeader, {
    title: signal('Projects'),
    subtitle: signal('Delivery status across the current portfolio.'),
  });

  page.section('status-filters', (filters) => {
    for (const status of ['all', 'on-track', 'at-risk', 'done'] as const) {
      filters.button(status, {
        id: `status-${status}`,
        class: filterButton,
        onClick: () => {
          state.projectStatus.set(status);
          void state.projects.refetch();
        },
      });
    }
  }, { class: style({ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }) });

  page.when(state.projects.loading, (l) => l.text('Loading projects…', { role: 'status' }));
  page.when(derived(() => state.projects.error.get() !== undefined), (e) => {
    e.text('Could not load projects. Retry the request.', { role: 'alert' });
    e.button('Retry', { id: 'projects-retry', class: primaryButton, onClick: () => void state.projects.refetch() });
  });

  const items = derived(() => state.projects.data.get() ?? []);
  page.when(derived(() => state.projects.data.get() !== undefined && items.get().length === 0), (empty) => {
    empty.component('empty-projects', EmptyState, {
      title: signal('No projects in this state'),
      hint: signal('Pick another status filter.'),
    });
  });

  page.when(derived(() => items.get().length > 0), (ready) => {
    ready.section('project-grid', (grid) => {
      grid.listOf('project-list', derived(() => items.get().slice()), (project, _i, content) => {
        content.text(project.name, { class: style({ fontWeight: 600 }) });
        content.text(project.status, { class: cx(badgeBase, style({ color: statusColor(project.status), border: `1px solid ${statusColor(project.status)}` })) });
        content.text(`Owner: ${project.owner}`, { class: style({ color: 'var(--muted)', fontSize: '13px' }) });
        content.text(`Progress: ${project.progress}%`, { class: style({ marginTop: '4px', display: 'block' }) });
      });
    }, { class: cardGrid });
  });
}

function settingsPage(page: PageDSL, state: AppState): void {
  page.component('page-header', PageHeader, {
    title: signal('Settings'),
    subtitle: signal('Profile, workspace, and security preferences with real validation.'),
  });

  page.form('profile-form', (form) => {
    form.heading('Profile', { level: 3 });
    const nameIds = a11yIds('profile-name');
    form.text('Full name', { id: nameIds.label });
    form.input({ id: nameIds.input, bind: state.profileForm.field('name').value, ariaLabelledBy: nameIds.label, ariaRequired: true, class: inputClass });
    const emailIds = a11yIds('profile-email');
    form.text('Email', { id: emailIds.label });
    form.input({ id: emailIds.input, bind: state.profileForm.field('email').value, type: 'email', ariaLabelledBy: emailIds.label, ariaRequired: true, class: inputClass });
    form.when(derived(() => Object.keys(state.profileForm.errors.get()).length > 0), (errors) => {
      errors.listOf('profile-errors', derived(() => errorMessages(state.profileForm.errors.get())), (message, _i, content) => {
        content.text(message, { role: 'alert', class: style({ color: 'var(--danger)', display: 'block' }) });
      });
    });
    form.when(derived(() => state.profileSaved.get().length > 0), (saved) => saved.text(state.profileSaved, { role: 'status' }));
    form.button(derived(() => (state.profileForm.submitting.get() ? 'Saving…' : 'Save profile')), {
      id: 'profile-submit',
      class: primaryButton,
      disabled: state.profileForm.submitting,
      onClick: () => void state.profileForm.submit(),
    });
  }, { id: 'profile-form', onSubmit: () => void state.profileForm.submit() });

  page.form('workspace-form', (form) => {
    form.heading('Workspace', { level: 3 });
    const orgIds = a11yIds('workspace-org');
    form.text('Organization name', { id: orgIds.label });
    form.input({ id: orgIds.input, bind: state.workspaceForm.field('organization').value, ariaLabelledBy: orgIds.label, ariaRequired: true, class: inputClass });
    const slugIds = a11yIds('workspace-slug');
    form.text('Workspace slug (min 3 characters)', { id: slugIds.label });
    form.input({ id: slugIds.input, bind: state.workspaceForm.field('slug').value, ariaLabelledBy: slugIds.label, ariaRequired: true, class: inputClass });
    form.when(derived(() => Object.keys(state.workspaceForm.errors.get()).length > 0), (errors) => {
      errors.listOf('workspace-errors', derived(() => errorMessages(state.workspaceForm.errors.get())), (message, _i, content) => {
        content.text(message, { role: 'alert', class: style({ color: 'var(--danger)', display: 'block' }) });
      });
    });
    form.when(derived(() => state.workspaceSaved.get().length > 0), (saved) => saved.text(state.workspaceSaved, { role: 'status' }));
    form.button(derived(() => (state.workspaceForm.submitting.get() ? 'Saving…' : 'Save workspace')), {
      id: 'workspace-submit',
      class: primaryButton,
      disabled: state.workspaceForm.submitting,
      onClick: () => void state.workspaceForm.submit(),
    });
  }, { id: 'workspace-form', onSubmit: () => void state.workspaceForm.submit() });

  page.form('password-form', (form) => {
    form.heading('Security', { level: 3 });
    const currentIds = a11yIds('password-current');
    form.text('Current password', { id: currentIds.label });
    form.input({ id: currentIds.input, bind: state.passwordForm.field('current').value, type: 'password', ariaLabelledBy: currentIds.label, ariaRequired: true, class: inputClass });
    const nextIds = a11yIds('password-next');
    form.text('New password (min 8 characters)', { id: nextIds.label });
    form.input({ id: nextIds.input, bind: state.passwordForm.field('next').value, type: 'password', ariaLabelledBy: nextIds.label, ariaRequired: true, class: inputClass });
    form.when(derived(() => Object.keys(state.passwordForm.errors.get()).length > 0), (errors) => {
      errors.listOf('password-errors', derived(() => errorMessages(state.passwordForm.errors.get())), (message, _i, content) => {
        content.text(message, { role: 'alert', class: style({ color: 'var(--danger)', display: 'block' }) });
      });
    });
    form.when(derived(() => state.passwordSaved.get().length > 0), (saved) => saved.text(state.passwordSaved, { role: 'status' }));
    form.button(derived(() => (state.passwordForm.submitting.get() ? 'Updating…' : 'Update password')), {
      id: 'password-submit',
      class: primaryButton,
      disabled: state.passwordForm.submitting,
      onClick: () => void state.passwordForm.submit(),
    });
  }, { id: 'password-form', onSubmit: () => void state.passwordForm.submit() });
}

export function compileApp(state: AppState): CompiledApplication {
  const app = streetui.app({ name: 'Acme Admin' });
  app.page('dashboard', (page) => buildApp(page, state));
  return compile(app);
}

export { createState, viewForPath, snapshot, STATE_KEY } from './state.js';
export type { AppSnapshot } from './state.js';
