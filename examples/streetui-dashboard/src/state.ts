/**
 * Reactive application state for the dashboard. One definition is shared by
 * SSR and the browser; the SSR island carries a JSON snapshot so hydration
 * rebuilds the identical state in place.
 */
import { signal, derived, resource, type Signal, type Resource } from 'streetui';
import { createForm, required, email, minLength, type Form } from 'streetui';
import { fetchOverview, fetchUsers, fetchProjects, type OverviewData, type Page, type User, type Project } from './data.js';

export type View = 'overview' | 'users' | 'projects' | 'settings' | 'not-found';
export const STATE_KEY = 'streetui-dashboard';

export interface AppSnapshot {
  readonly view: View;
  readonly userQuery: string;
  readonly userRole: string;
  readonly userPage: number;
  readonly projectStatus: string;
  readonly theme: 'light' | 'dark';
  readonly profileSaved: string;
  readonly workspaceSaved: string;
  readonly passwordSaved: string;
}

export interface AppState {
  readonly view: Signal<View>;
  readonly userQuery: Signal<string>;
  readonly userRole: Signal<string>;
  readonly userPage: Signal<number>;
  readonly projectStatus: Signal<string>;
  readonly theme: Signal<'light' | 'dark'>;
  readonly overview: Resource<OverviewData>;
  readonly users: Resource<Page<User>>;
  readonly projects: Resource<readonly Project[]>;
  readonly profileSaved: Signal<string>;
  readonly workspaceSaved: Signal<string>;
  readonly passwordSaved: Signal<string>;
  readonly profileForm: Form<{ name: string; email: string }>;
  readonly workspaceForm: Form<{ organization: string; slug: string }>;
  readonly passwordForm: Form<{ current: string; next: string }>;
}

export function viewForPath(path: string): View {
  const clean = path.replace(/[?#].*$/, '').replace(/\/+$/, '') || '/';
  if (clean === '/' || clean === '/overview') return 'overview';
  if (clean === '/users') return 'users';
  if (clean === '/projects') return 'projects';
  if (clean === '/settings') return 'settings';
  return 'not-found';
}

export function navigate(state: AppState, view: View): void {
  state.view.set(view);
  if (typeof history !== 'undefined' && typeof location !== 'undefined') {
    const path = view === 'overview' ? '/' : `/${view}`;
    if (location.pathname !== path) history.pushState({ view }, '', path);
  }
}

export function createState(seed?: Partial<AppSnapshot>): AppState {
  const view = signal<View>(seed?.view ?? 'overview');
  const userQuery = signal(seed?.userQuery ?? '');
  const userRole = signal(seed?.userRole ?? 'all');
  const userPage = signal(seed?.userPage ?? 1);
  const projectStatus = signal(seed?.projectStatus ?? 'all');
  const theme = signal<'light' | 'dark'>(seed?.theme ?? 'light');
  const profileSaved = signal(seed?.profileSaved ?? '');
  const workspaceSaved = signal(seed?.workspaceSaved ?? '');
  const passwordSaved = signal(seed?.passwordSaved ?? '');

  const overview = resource<OverviewData>(({ signal: abort }) => fetchOverviewWithAbort(abort));
  const users = resource<Page<User>>(({ signal: abort }) =>
    fetchUsersWithAbort(abort, userQuery.peek(), userRole.peek(), userPage.peek()),
  );
  const projects = resource<readonly Project[]>(({ signal: abort }) => fetchProjectsWithAbort(abort, projectStatus.peek()));

  const profileForm = createForm<{ name: string; email: string }>({
    initialValues: { name: '', email: '' },
    validators: { name: [required()], email: [required(), email()] },
    onSubmit: async (values) => {
      profileSaved.set(`Profile saved for ${values.name} (${values.email})`);
    },
  });
  const workspaceForm = createForm<{ organization: string; slug: string }>({
    initialValues: { organization: '', slug: '' },
    validators: { organization: [required()], slug: [required(), minLength(3)] },
    onSubmit: async (values) => {
      workspaceSaved.set(`Workspace “${values.organization}” saved (slug: ${values.slug})`);
    },
  });
  const passwordForm = createForm<{ current: string; next: string }>({
    initialValues: { current: '', next: '' },
    validators: { current: [required()], next: [required(), minLength(8)] },
    onSubmit: async () => {
      passwordSaved.set('Password updated successfully.');
    },
  });

  return {
    view,
    userQuery,
    userRole,
    userPage,
    projectStatus,
    theme,
    overview,
    users,
    projects,
    profileSaved,
    workspaceSaved,
    passwordSaved,
    profileForm,
    workspaceForm,
    passwordForm,
  };
}

export function snapshot(state: AppState): AppSnapshot {
  return {
    view: state.view.peek(),
    userQuery: state.userQuery.peek(),
    userRole: state.userRole.peek(),
    userPage: state.userPage.peek(),
    projectStatus: state.projectStatus.peek(),
    theme: state.theme.peek(),
    profileSaved: state.profileSaved.peek(),
    workspaceSaved: state.workspaceSaved.peek(),
    passwordSaved: state.passwordSaved.peek(),
  };
}

function fetchOverviewWithAbort(_abort: AbortSignal): Promise<OverviewData> {
  return fetchOverview();
}
function fetchUsersWithAbort(_abort: AbortSignal, query: string, role: string, page: number): Promise<Page<User>> {
  return fetchUsers({ query, role, page, pageSize: 8 });
}
function fetchProjectsWithAbort(_abort: AbortSignal, status: string): Promise<readonly Project[]> {
  return fetchProjects(status);
}

/** Refetch helpers used by filters (debouncing is left to the view layer). */
export function applyUserFilter(state: AppState, patch: { query?: string; role?: string; page?: number }): void {
  if (patch.query !== undefined) state.userQuery.set(patch.query);
  if (patch.role !== undefined) state.userRole.set(patch.role);
  if (patch.page !== undefined) state.userPage.set(patch.page);
  else state.userPage.set(1);
  state.users.refetch();
}
