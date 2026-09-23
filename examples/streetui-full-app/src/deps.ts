/**
 * Shared reactive dependencies for the full app. One definition constructed on
 * BOTH sides (server + browser) so hydration adopts the server DOM. Composes
 * every StreetUI system: signals, i18n, context, forms + validators, and a
 * server-seedable resource.
 */
import { signal, resource, type Signal, type Resource } from '@streetui/state';
import { createI18n, type I18n } from '@streetui/i18n';
import { createForm, required, minLength, email, type Form } from '@streetui/forms';
import { createContext } from '@streetui/context';

export interface Theme {
  readonly name: 'light' | 'dark';
}
/** A context every part of the tree can consume during build. */
export const ThemeContext = createContext<Theme>({ name: 'light' }, 'theme');

export const MESSAGES = {
  en: {
    title: 'StreetUI Full App',
    greeting: 'Hello, {name}!',
    count: 'Count: {count}',
    signup: 'Sign up',
    loaded: 'Loaded user: {name}',
  },
  fr: {
    title: 'Application complète StreetUI',
    greeting: 'Bonjour, {name} !',
    count: 'Compte : {count}',
    signup: "S'inscrire",
    loaded: 'Utilisateur chargé : {name}',
  },
} as const;

export interface Messages {
  readonly [key: string]: string;
  readonly title: string;
  readonly greeting: string;
  readonly count: string;
  readonly signup: string;
  readonly loaded: string;
}
export interface User {
  readonly id: number;
  readonly name: string;
}

/** JSON-serializable snapshot embedded in the SSR island. */
export interface AppSnapshot {
  readonly count: number;
  readonly locale: string;
  readonly user?: User;
}

export interface AppDeps {
  readonly count: Signal<number>;
  readonly i18n: I18n<Messages>;
  readonly form: Form<{ name: string; email: string }>;
  readonly user: Resource<User>;
}

export interface CreateDepsOptions {
  readonly seed?: AppSnapshot;
  /** Async loader used only when there is no server-seeded user. */
  readonly loadUser?: () => Promise<User>;
}

export function createDeps(options: CreateDepsOptions = {}): AppDeps {
  const { seed, loadUser } = options;
  const count = signal(seed?.count ?? 0);

  const i18n = createI18n<Messages>({
    locale: seed?.locale ?? 'en',
    messages: MESSAGES,
    fallbackLocale: 'en',
  });

  const form = createForm<{ name: string; email: string }>({
    initialValues: { name: '', email: '' },
    validators: {
      name: [required(), minLength(2)],
      email: [required(), email()],
    },
  });

  // Server-seeded resource: when the snapshot carries a user, the resource is
  // born 'success' with that data and does NOT refetch on hydration. Otherwise
  // it loads via the provided async loader.
  const user = resource<User>(
    async () => {
      if (loadUser) return loadUser();
      return { id: 0, name: 'anonymous' };
    },
    seed?.user !== undefined
      ? { initialData: seed.user, immediate: false }
      : { immediate: loadUser !== undefined },
  );

  return { count, i18n, form, user };
}

export function snapshot(deps: AppDeps): AppSnapshot {
  const data = deps.user.data.peek();
  return {
    count: deps.count.peek(),
    locale: deps.i18n.locale.peek(),
    ...(data !== undefined ? { user: data } : {}),
  };
}

export const STATE_KEY = 'full-app';
