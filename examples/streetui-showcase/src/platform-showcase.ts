/**
 * StreetUI 2.0 Platform Showcase — the primary end-to-end integration app (§21).
 *
 * A real, multi-route application built entirely on the public `streetui` API.
 * It exercises the whole 2.0 application platform through the real pipeline
 * (DSL → Compiler → Graph → Runtime → Renderer → real DOM, plus SSR + hydration):
 *
 *   • Routing: dashboard `/`, users `/users`, user details `/users/:id`, settings `/settings`
 *   • Overlays: modal dialog (edit), popover (info), dropdown (menu), toast (notifications)
 *   • Transitions: a CSS-class transition on a disclosure region
 *   • Async data: `resource` + `asyncBoundary` (loading / error / success)
 *   • Error handling: `errorBoundary` around a route that can fail (unknown id)
 *   • Data mutations: `createForm` → `mutation` → `onSuccess` refetch → reactive UI
 *   • Route metadata: per-route `head({ title, description })`
 *   • i18n: `createI18n`, reactive `t()` bindings, live locale switch
 *   • a11y: roles, aria labels, focus-managed overlays
 *   • SSR + hydration: `renderToString` / `renderHead` then `renderer.hydrate`
 *
 * There is NO virtual DOM, NO second reactive system, and NO fake framework —
 * everything below is the one public package. Data lives in an in-memory store
 * behind async loaders (a stand-in for any transport); nothing is faked at the
 * framework layer.
 */

import {
  signal,
  derived,
  compile,
  streetui,
  resource,
  mutation,
  createForm,
  required,
  minLength,
  createI18n,
  createRouter,
  mountRouter,
  routerOutlet,
  createMemoryHistory,
  type Signal,
  type RouteDefinition,
  type MountedRouter,
  type Router,
  type PageDSL,
} from 'streetui';

// ── Domain ───────────────────────────────────────────────────────────────────

export interface User {
  readonly id: number;
  readonly name: string;
  readonly role: string;
  readonly email: string;
}

const SEED_USERS: readonly User[] = [
  { id: 1, name: 'Ada Lovelace', role: 'admin', email: 'ada@example.com' },
  { id: 2, name: 'Alan Turing', role: 'engineer', email: 'alan@example.com' },
  { id: 3, name: 'Grace Hopper', role: 'engineer', email: 'grace@example.com' },
];

/**
 * The in-memory "server". Async loaders return promises (a real transport would
 * go over `createClient`); mutations write through and callers refetch. This is
 * the single source of truth shared across every route.
 */
export interface ShowcaseData {
  readonly users: Signal<User[]>;
  loadUsers(): Promise<User[]>;
  loadUser(id: number): Promise<User>;
  saveUser(patch: { id: number; name: string; role: string }): Promise<User>;
}

export function createShowcaseData(): ShowcaseData {
  const users = signal<User[]>(SEED_USERS.map((u) => ({ ...u })));

  return {
    users,
    loadUsers: () => Promise.resolve(users.get().map((u) => ({ ...u }))),
    loadUser: (id) => {
      const found = users.get().find((u) => u.id === id);
      return found
        ? Promise.resolve({ ...found })
        : Promise.reject(new Error(`User ${id} was not found`));
    },
    saveUser: (patch) => {
      let next: User | undefined;
      users.update((arr) =>
        arr.map((u) => {
          if (u.id !== patch.id) return u;
          next = { ...u, name: patch.name, role: patch.role };
          return next;
        }),
      );
      return next ? Promise.resolve(next) : Promise.reject(new Error(`User ${patch.id} was not found`));
    },
  };
}

// ── i18n ───────────────────────────────────────────────────────────────────────

export interface ShowcaseMessages {
  readonly [key: string]: string;
}

export function createShowcaseI18n() {
  return createI18n({
    locale: 'en',
    fallbackLocale: 'en',
    messages: {
      en: {
        'nav.dashboard': 'Dashboard',
        'nav.users': 'Users',
        'nav.settings': 'Settings',
        'nav.menu': 'Menu',
        'dash.title': 'Dashboard',
        'dash.welcome': 'Welcome to the StreetUI platform showcase.',
        'dash.info': 'This app uses one public package: streetui.',
        'dash.details': 'Every route, overlay and transition runs on the real renderer.',
        'users.title': 'Users',
        'user.title': 'User details',
        'user.edit': 'Edit',
        'settings.title': 'Settings',
        'settings.language': 'Language',
        'settings.displayName': 'Display name',
        'settings.save': 'Save settings',
        'settings.saved': 'Settings saved.',
        'common.save': 'Save',
        'common.cancel': 'Cancel',
        'common.retry': 'Retry',
        'common.loading': 'Loading…',
      },
      fr: {
        'nav.dashboard': 'Tableau de bord',
        'nav.users': 'Utilisateurs',
        'nav.settings': 'Paramètres',
        'nav.menu': 'Menu',
        'dash.title': 'Tableau de bord',
        'dash.welcome': 'Bienvenue dans la vitrine de la plateforme StreetUI.',
        'dash.info': 'Cette application utilise un seul paquet public : streetui.',
        'dash.details': 'Chaque route, superposition et transition utilise le vrai moteur de rendu.',
        'users.title': 'Utilisateurs',
        'user.title': "Détails de l'utilisateur",
        'user.edit': 'Modifier',
        'settings.title': 'Paramètres',
        'settings.language': 'Langue',
        'settings.displayName': "Nom d'affichage",
        'settings.save': 'Enregistrer',
        'settings.saved': 'Paramètres enregistrés.',
        'common.save': 'Enregistrer',
        'common.cancel': 'Annuler',
        'common.retry': 'Réessayer',
        'common.loading': 'Chargement…',
      },
    },
  });
}

// ── Shared UI state (framework-owned signals) ────────────────────────────────

export interface ShowcaseUI {
  readonly toastOpen: Signal<boolean>;
  readonly toastText: Signal<string>;
  readonly menuOpen: Signal<boolean>;
  readonly infoOpen: Signal<boolean>;
  readonly editOpen: Signal<boolean>;
  readonly detailsOpen: Signal<boolean>;
  openToast(message: string): void;
}

function createShowcaseUI(): ShowcaseUI {
  const toastOpen = signal(false);
  const toastText = signal('');
  return {
    toastOpen,
    toastText,
    menuOpen: signal(false),
    infoOpen: signal(false),
    editOpen: signal(false),
    detailsOpen: signal(false),
    openToast(message: string) {
      toastText.set(message);
      toastOpen.set(true);
    },
  };
}

type I18n = ReturnType<typeof createShowcaseI18n>;

// ── Route builders (each is a real page over the public DSL) ──────────────────

/** `/` — dashboard: heading, popover, and a transition-animated disclosure. */
function buildDashboard(page: PageDSL, i18n: I18n, ui: ShowcaseUI): void {
  page.head({ title: i18n.t('dash.title'), description: 'StreetUI platform showcase — dashboard' });
  page.section(
    'dashboard',
    (s) => {
      s.heading(i18n.t('dash.title'), { level: 1, id: 'dash-title' });
      s.text(i18n.t('dash.welcome'), { id: 'dash-welcome' });

      // Popover (non-modal overlay) — cooperative open/close via a signal we own.
      s.button('Info', { id: 'dash-info-btn', onClick: () => ui.infoOpen.set(true), ariaLabel: 'Show info' });
      s.popover('dash-info', { open: ui.infoOpen, onClose: () => ui.infoOpen.set(false) }, (p) => {
        p.text(i18n.t('dash.info'), { id: 'dash-info-text' });
      });

      // Transition-animated disclosure — the branch is mounted/removed by the
      // keyed reconciler; the CSS transition defers removal until it completes.
      s.button('Toggle details', { id: 'dash-toggle', onClick: () => ui.detailsOpen.update((v) => !v) });
      s.when(
        ui.detailsOpen,
        (b) => b.text(i18n.t('dash.details'), { id: 'dash-details' }),
        undefined,
        { transition: { name: 'fade', duration: 15 } },
      );
    },
    { id: 'dashboard', role: 'region', ariaLabel: 'Dashboard' },
  );
}

/** `/users` — async list via `resource` + `asyncBoundary` (loading/error/success). */
function buildUsers(page: PageDSL, onCleanup: (fn: () => void) => void, data: ShowcaseData, i18n: I18n): void {
  page.head({ title: i18n.t('users.title'), description: 'StreetUI platform showcase — users' });
  page.section(
    'users',
    (s) => {
      s.heading(i18n.t('users.title'), { level: 1, id: 'users-title' });

      const usersRes = resource<User[]>(() => data.loadUsers(), { immediate: true });
      onCleanup(() => usersRes.dispose());

      s.asyncBoundary('users-async', usersRes, {
        loading: (c) => c.text(i18n.t('common.loading'), { id: 'users-loading' }),
        error: (c, e, retry) => {
          c.text(`Error: ${(e as Error).message}`, { id: 'users-error' });
          c.button(i18n.translate('common.retry'), { id: 'users-retry', onClick: retry });
        },
        success: (c, users) => {
          c.listOf(
            'users-list',
            users,
            (u, _i, item) => {
              item.link(u.name, { href: `/users/${u.id}`, id: `user-link-${u.id}` });
              item.text(u.role, { id: `user-role-${u.id}` });
            },
            { id: 'users-list' },
          );
        },
      });
    },
    { id: 'users', role: 'region', ariaLabel: 'Users' },
  );
}

/** `/users/:id` — detail behind an `errorBoundary`, with an edit modal that
 *  drives a `mutation` and refetches on success. */
function buildUserDetails(
  page: PageDSL,
  id: number,
  onCleanup: (fn: () => void) => void,
  data: ShowcaseData,
  i18n: I18n,
  ui: ShowcaseUI,
): void {
  page.head({ title: i18n.t('user.title'), description: 'StreetUI platform showcase — user details' });

  const detail = resource<User>(() => data.loadUser(id), { immediate: true });
  const saveMutation = mutation<{ id: number; name: string; role: string }, User>(
    (patch) => data.saveUser(patch),
    {
      onSuccess: () => {
        detail.refetch();
        ui.editOpen.set(false);
        ui.openToast(i18n.translate('settings.saved'));
      },
    },
  );
  const form = createForm<{ name: string; role: string }>({
    initialValues: { name: '', role: '' },
    validators: { name: [required(), minLength(2)] },
    onSubmit: (values) => {
      void saveMutation.mutate({ id, name: values.name, role: values.role });
    },
  });
  onCleanup(() => {
    detail.dispose();
    saveMutation.dispose();
    form.dispose();
  });

  page.section(
    'user',
    (s) => {
      s.heading(i18n.t('user.title'), { level: 1, id: 'user-title' });

      s.errorBoundary(
        'user-detail-boundary',
        (body) => {
          body.when(detail.loading, (c) => c.text(i18n.t('common.loading'), { id: 'user-loading' }));
          body.when(
            derived(() => detail.status.get() === 'success'),
            (c) => {
              c.text(
                derived(() => detail.data.get()?.name ?? ''),
                { id: 'user-name' },
              );
              c.text(
                derived(() => detail.data.get()?.email ?? ''),
                { id: 'user-email' },
              );
              c.button(i18n.t('user.edit'), {
                id: 'user-edit-btn',
                onClick: () => {
                  const u = detail.data.peek();
                  if (u) {
                    form.field('name').setValue(u.name);
                    form.field('role').setValue(u.role);
                  }
                  ui.editOpen.set(true);
                },
              });
            },
          );
        },
        {
          fallback: (fb, e, retry) => {
            fb.text(`Error: ${(e as Error).message}`, { id: 'user-detail-error' });
            fb.button(i18n.translate('common.retry'), { id: 'user-detail-retry', onClick: retry });
          },
          source: detail.error,
          onRetry: () => detail.refetch(),
        },
      );

      // Edit modal (focus-trapped dialog) with a validated form → mutation.
      s.dialog(
        'user-edit',
        {
          open: ui.editOpen,
          onClose: () => ui.editOpen.set(false),
          ariaLabel: 'Edit user',
          initialFocusId: 'edit-name',
        },
        (d) => {
          d.heading(i18n.t('user.edit'), { level: 2, id: 'edit-title' });
          d.form(
            'edit-form',
            (f) => {
              f.input({ id: 'edit-name', type: 'text', placeholder: 'Name', bind: form.field('name').value });
              f.text(
                derived(() => form.field('name').error.get() ?? ''),
                { id: 'edit-name-error' },
              );
              f.input({ id: 'edit-role', type: 'text', placeholder: 'Role', bind: form.field('role').value });
              f.button(i18n.t('common.save'), { id: 'edit-save' });
              f.button(i18n.t('common.cancel'), { id: 'edit-cancel', onClick: () => ui.editOpen.set(false) });
            },
            { id: 'edit-form', onSubmit: () => form.submit() },
          );
        },
      );
    },
    { id: 'user', role: 'region', ariaLabel: 'User details' },
  );
}

/** `/settings` — i18n locale switch + a form that raises a toast on save. */
function buildSettings(page: PageDSL, onCleanup: (fn: () => void) => void, i18n: I18n, ui: ShowcaseUI): void {
  page.head({ title: i18n.t('settings.title'), description: 'StreetUI platform showcase — settings' });

  const settingsForm = createForm<{ displayName: string }>({
    initialValues: { displayName: '' },
    validators: { displayName: [required()] },
    onSubmit: () => ui.openToast(i18n.translate('settings.saved')),
  });
  onCleanup(() => settingsForm.dispose());

  page.section(
    'settings',
    (s) => {
      s.heading(i18n.t('settings.title'), { level: 1, id: 'settings-title' });
      s.text(i18n.t('settings.language'), { id: 'settings-lang-label' });
      s.button('English', { id: 'lang-en', onClick: () => i18n.setLocale('en') });
      s.button('Français', { id: 'lang-fr', onClick: () => i18n.setLocale('fr') });

      s.form(
        'settings-form',
        (f) => {
          f.text(i18n.t('settings.displayName'), { id: 'settings-name-label' });
          f.input({ id: 'settings-name', type: 'text', bind: settingsForm.field('displayName').value });
          f.button(i18n.t('settings.save'), { id: 'settings-save' });
        },
        { id: 'settings-form', onSubmit: () => settingsForm.submit(), ariaLabel: 'Settings form' },
      );
    },
    { id: 'settings', role: 'region', ariaLabel: 'Settings' },
  );
}

/** The persistent shell: nav (with a dropdown), a global toast, and the outlet. */
function buildShell(sh: PageDSL, i18n: I18n, ui: ShowcaseUI): void {
  sh.section(
    'nav',
    (n) => {
      n.link(i18n.t('nav.dashboard'), { href: '/', id: 'nav-dashboard' });
      n.link(i18n.t('nav.users'), { href: '/users', id: 'nav-users' });
      n.link(i18n.t('nav.settings'), { href: '/settings', id: 'nav-settings' });
      n.button(i18n.t('nav.menu'), { id: 'menu-btn', onClick: () => ui.menuOpen.update((v) => !v), ariaLabel: 'Open menu' });
      n.dropdown('nav-menu', { open: ui.menuOpen, onClose: () => ui.menuOpen.set(false) }, (m) => {
        m.button('English', { id: 'menu-en', onClick: () => { i18n.setLocale('en'); ui.menuOpen.set(false); } });
        m.button('Français', { id: 'menu-fr', onClick: () => { i18n.setLocale('fr'); ui.menuOpen.set(false); } });
      });
    },
    { id: 'shell-nav', role: 'navigation', ariaLabel: 'Main' },
  );

  sh.toast('global-toast', { open: ui.toastOpen, onClose: () => ui.toastOpen.set(false) }, (t) => {
    t.text(ui.toastText, { id: 'toast-text' });
  });

  routerOutlet(sh);
}

// ── App factory ────────────────────────────────────────────────────────────────

export interface MountedShowcase {
  /** The mounted router handle (`{ outlet, unmount() }`). */
  readonly mounted: MountedRouter;
  /** The live router — exposes `navigate`, `currentRoute`, etc. for driving the app. */
  readonly router: Router;
}

export interface PlatformShowcase {
  readonly data: ShowcaseData;
  readonly i18n: I18n;
  readonly ui: ShowcaseUI;
  routes(): RouteDefinition[];
  mount(container: Element, opts?: { path?: string; hydrate?: boolean }): MountedShowcase;
}

export function createPlatformShowcase(): PlatformShowcase {
  const data = createShowcaseData();
  const i18n = createShowcaseI18n();
  const ui = createShowcaseUI();

  const routes = (): RouteDefinition[] => [
    { path: '/', builder: (page) => buildDashboard(page, i18n, ui) },
    { path: '/users', builder: (page, ctx) => buildUsers(page, ctx.onCleanup, data, i18n) },
    {
      path: '/users/:id',
      builder: (page, ctx) => buildUserDetails(page, Number(ctx.params.id), ctx.onCleanup, data, i18n, ui),
    },
    { path: '/settings', builder: (page, ctx) => buildSettings(page, ctx.onCleanup, i18n, ui) },
    { path: '*', builder: (page) => page.section('nf', (s) => s.heading('Not found', { id: 'not-found', level: 1 })) },
  ];

  const mount = (container: Element, opts: { path?: string; hydrate?: boolean } = {}): MountedShowcase => {
    const router = createRouter({ routes: routes(), history: createMemoryHistory(opts.path ?? '/') });
    const mounted = mountRouter(router, {
      container,
      ...(opts.hydrate !== undefined ? { hydrate: opts.hydrate } : {}),
      shell: (sh) => buildShell(sh, i18n, ui),
    });
    return { mounted, router };
  };

  return { data, i18n, ui, routes, mount };
}

// ── Standalone dashboard (for SSR + hydration demonstration) ──────────────────

export interface DashboardBundle {
  readonly compiled: ReturnType<typeof compile>;
  readonly i18n: I18n;
  readonly ui: ShowcaseUI;
}

/**
 * Compile the dashboard as a standalone page (no router) so it can be
 * server-rendered with `renderToString` / `renderHead` and then hydrated with
 * `renderer.hydrate`. Built deterministically so both sides match byte-for-byte.
 */
export function createDashboardBundle(): DashboardBundle {
  const i18n = createShowcaseI18n();
  const ui = createShowcaseUI();
  const app = streetui.app({ name: 'StreetUI Platform Showcase', version: '2.0.0' });
  app.page('home', (page: PageDSL) => buildDashboard(page, i18n, ui));
  return { compiled: compile(app), i18n, ui };
}

