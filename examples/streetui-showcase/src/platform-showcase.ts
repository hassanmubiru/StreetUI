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
  type ReadonlySignal,
  type RouteDefinition,
  type MountedRouter,
  type PageDSL,
  type ContainerDSL,
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

// __APPEND_MARKER__
