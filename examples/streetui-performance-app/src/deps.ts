/**
 * The shared reactive dependency graph for the performance app.
 *
 * One `createDeps()` definition is constructed on BOTH server and client so
 * hydration can adopt the server DOM. It composes every StreetUI system:
 * signals + derived, i18n, context, a validated form, and a server-seedable
 * resource — plus the reactive state that drives the 10k-row table (search,
 * role filter, sort), the 1,000 interactive controls, notifications and the
 * modal.
 */
import { signal, derived, resource, type Signal, type ReadonlySignal, type Resource } from 'streetui';
import { createI18n, type I18n } from 'streetui';
import { createForm, required, minLength, email, type Form } from 'streetui';
import { createContext } from 'streetui';
import { makeUsers, selectRows, type UserRow, type Role, type SortKey, type SortDir } from './data.js';

export interface Theme {
  readonly name: 'light' | 'dark';
}
export const ThemeContext = createContext<Theme>({ name: 'light' }, 'theme');

export const MESSAGES = {
  en: {
    appTitle: 'StreetUI Console',
    navHome: 'Overview',
    navDashboard: 'Dashboard',
    navUsers: 'Users',
    navSettings: 'Settings',
    usersHeading: 'Users ({count})',
    searchPlaceholder: 'Search users…',
    filterAll: 'All roles',
    totalUsers: 'Total users: {count}',
    activeUsers: 'Active: {count}',
    avgScore: 'Average score: {score}',
    settingsHeading: 'Settings',
    save: 'Save',
    reset: 'Reset',
    openModal: 'Open confirmation',
    confirm: 'Confirm',
    cancel: 'Cancel',
    detailHeading: 'User #{id}',
    loading: 'Loading…',
    retry: 'Retry',
  },
  fr: {
    appTitle: 'Console StreetUI',
    navHome: 'Aperçu',
    navDashboard: 'Tableau de bord',
    navUsers: 'Utilisateurs',
    navSettings: 'Paramètres',
    usersHeading: 'Utilisateurs ({count})',
    searchPlaceholder: 'Rechercher…',
    filterAll: 'Tous les rôles',
    totalUsers: 'Total : {count}',
    activeUsers: 'Actifs : {count}',
    avgScore: 'Score moyen : {score}',
    settingsHeading: 'Paramètres',
    save: 'Enregistrer',
    reset: 'Réinitialiser',
    openModal: 'Ouvrir la confirmation',
    confirm: 'Confirmer',
    cancel: 'Annuler',
    detailHeading: 'Utilisateur n°{id}',
    loading: 'Chargement…',
    retry: 'Réessayer',
  },
} as const;

export interface Messages {
  readonly [key: string]: string;
  readonly appTitle: string;
  readonly navHome: string;
  readonly navDashboard: string;
  readonly navUsers: string;
  readonly navSettings: string;
  readonly usersHeading: string;
  readonly searchPlaceholder: string;
  readonly filterAll: string;
  readonly totalUsers: string;
  readonly activeUsers: string;
  readonly avgScore: string;
  readonly settingsHeading: string;
  readonly save: string;
  readonly reset: string;
  readonly openModal: string;
  readonly confirm: string;
  readonly cancel: string;
  readonly detailHeading: string;
  readonly loading: string;
  readonly retry: string;
}

export interface UserDetail {
  readonly id: number;
  readonly name: string;
  readonly bio: string;
}

export interface Notification {
  readonly id: number;
  readonly text: string;
}

/** How many rows/controls the app builds. Overridable for tests + benchmarks. */
export interface DepsSizing {
  readonly rows?: number;
  readonly controls?: number;
}

export interface AppSnapshot {
  readonly locale: string;
  readonly query: string;
  readonly role: Role | 'all';
  readonly rows: number;
  readonly controls: number;
}

export interface AppDeps {
  readonly rows: readonly UserRow[];
  readonly controlsCount: number;
  // table reactive state
  readonly query: Signal<string>;
  readonly roleFilter: Signal<Role | 'all'>;
  readonly sortKey: Signal<SortKey>;
  readonly sortDir: Signal<SortDir>;
  readonly visibleRows: ReadonlySignal<UserRow[]>;
  // derived dashboard metrics
  readonly totalCount: ReadonlySignal<number>;
  readonly activeCount: ReadonlySignal<number>;
  readonly avgScore: ReadonlySignal<number>;
  // 1,000 interactive controls: one signal each (fine-grained isolation proof)
  readonly toggles: readonly Signal<boolean>[];
  readonly toggledCount: ReadonlySignal<number>;
  // notifications + modal
  readonly notifications: Signal<Notification[]>;
  readonly modalOpen: Signal<boolean>;
  // systems
  readonly i18n: I18n<Messages>;
  readonly settingsForm: Form<{ displayName: string; contactEmail: string }>;
  readonly userDetail: Resource<UserDetail>;
  // helpers
  notify(text: string): void;
  pushToggle(index: number): void;
}

export interface CreateDepsOptions {
  readonly seed?: AppSnapshot;
  readonly sizing?: DepsSizing;
  /** Loader for the user-detail resource. Defaults to a deterministic stub. */
  readonly loadUser?: (id: number) => Promise<UserDetail>;
  /** Id the detail resource loads on construction (route /users/:id). */
  readonly detailId?: number;
}

const DEFAULT_ROWS = 10_000;
const DEFAULT_CONTROLS = 1_000;

export function createDeps(options: CreateDepsOptions = {}): AppDeps {
  const { seed, sizing, loadUser, detailId } = options;
  const rowCount = sizing?.rows ?? seed?.rows ?? DEFAULT_ROWS;
  const controlsCount = sizing?.controls ?? seed?.controls ?? DEFAULT_CONTROLS;

  const rows = makeUsers(rowCount);

  const query = signal<string>(seed?.query ?? '');
  const roleFilter = signal<Role | 'all'>(seed?.role ?? 'all');
  const sortKey = signal<SortKey>('id');
  const sortDir = signal<SortDir>('asc');

  // Derived, reconciled view over 10k rows — recomputes only when a dependency
  // it reads (query/role/sort) actually changes.
  const visibleRows = derived<UserRow[]>(() =>
    selectRows(rows, {
      query: query.get(),
      role: roleFilter.get(),
      sortKey: sortKey.get(),
      sortDir: sortDir.get(),
    }),
  );

  const totalCount = derived<number>(() => visibleRows.get().length);
  const activeCount = derived<number>(() => visibleRows.get().filter((r) => r.status === 'active').length);
  const avgScore = derived<number>(() => {
    const v = visibleRows.get();
    if (v.length === 0) return 0;
    let sum = 0;
    for (const r of v) sum += r.score;
    return Math.round(sum / v.length);
  });

  // 1,000 independent boolean signals — each drives exactly one control, so a
  // single toggle proves fine-grained isolation (one DOM mutation).
  const toggles: Signal<boolean>[] = new Array(controlsCount);
  for (let i = 0; i < controlsCount; i++) toggles[i] = signal<boolean>(false);
  const toggledCount = derived<number>(() => {
    let n = 0;
    for (const t of toggles) if (t.get()) n++;
    return n;
  });

  const notifications = signal<Notification[]>([]);
  const modalOpen = signal<boolean>(false);
  let notifId = 0;

  const i18n = createI18n<Messages>({
    locale: seed?.locale ?? 'en',
    messages: MESSAGES,
    fallbackLocale: 'en',
  });

  const settingsForm = createForm<{ displayName: string; contactEmail: string }>({
    initialValues: { displayName: '', contactEmail: '' },
    validators: {
      displayName: [required(), minLength(2)],
      contactEmail: [required(), email()],
    },
  });

  const userDetail = resource<UserDetail>(
    async ({ signal: abort }) => {
      const id = detailId ?? 1;
      if (loadUser) return loadUser(id);
      // Deterministic stub resolving on a microtask; honours abort.
      return await new Promise<UserDetail>((res, rej) => {
        queueMicrotask(() => {
          if (abort.aborted) {
            rej(new DOMException('Aborted', 'AbortError'));
            return;
          }
          const row = rows[(id - 1) % rows.length];
          res({ id, name: row?.name ?? `User ${id}`, bio: `Profile for user #${id}.` });
        });
      });
    },
    { immediate: detailId !== undefined },
  );

  const deps: AppDeps = {
    rows,
    controlsCount,
    query,
    roleFilter,
    sortKey,
    sortDir,
    visibleRows,
    totalCount,
    activeCount,
    avgScore,
    toggles,
    toggledCount,
    notifications,
    modalOpen,
    i18n,
    settingsForm,
    userDetail,
    notify(text: string): void {
      notifId += 1;
      notifications.set([...notifications.peek(), { id: notifId, text }]);
    },
    pushToggle(index: number): void {
      const t = toggles[index];
      if (t !== undefined) t.set(!t.peek());
    },
  };
  return deps;
}

export function snapshot(deps: AppDeps): AppSnapshot {
  return {
    locale: deps.i18n.locale.peek(),
    query: deps.query.peek(),
    role: deps.roleFilter.peek(),
    rows: deps.rows.length,
    controls: deps.controlsCount,
  };
}

export const STATE_KEY = 'performance-app';
