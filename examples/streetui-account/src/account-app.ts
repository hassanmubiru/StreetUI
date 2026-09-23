/**
 * StreetUI Account — the whole v0.5 platform working together.
 *
 * One realistic "Create account" application that exercises, in a single build:
 *   • @streetui/router     — pages, params, client navigation, SSR + hydration
 *   • @streetui/state       — signals, derived, resource() for async plan loading
 *   • @streetui/forms       — reactive form model, validators, submission lifecycle
 *   • @streetui/context     — pass the form + i18n down without prop drilling
 *   • @streetui/i18n        — typed, reactive translation with a live locale toggle
 *   • @streetui/core        — deterministic a11yIds() for label/description wiring
 *
 * Nothing is faked: plans are fetched from a real HTTP endpoint and submitting
 * the form POSTs to a real endpoint (see api-server.ts). The exact same build
 * function renders on the server (renderToString via the router) and hydrates on
 * the client, so translations and a11y ids must be deterministic — they are.
 */

import { signal, derived, resource, type Resource } from '@streetui/state';
import type { ContainerDSL } from '@streetui/dsl';
import { a11yIds } from '@streetui/core';
import {
  createForm,
  required,
  email as emailValidator,
  minLength,
  type Form,
} from '@streetui/forms';
import { createI18n, type I18n } from '@streetui/i18n';
import { createContext, type Context } from '@streetui/context';
import {
  createRouter,
  mountRouter,
  routerOutlet,
  type Router,
  type RouteDefinition,
  type RouteContext,
  type RouterHistory,
} from '@streetui/router';
import type { Plan } from './api-server.js';

// ── i18n messages ───────────────────────────────────────────────────────────────
const messages = {
  en: {
    'app.title': 'StreetUI Accounts',
    'nav.home': 'Home',
    'nav.signup': 'Create account',
    'locale.toggle': 'Switch language',
    'home.tagline': 'Everything in one app: routing, forms, i18n and accessibility.',
    'signup.title': 'Create your account',
    'signup.name': 'Full name',
    'signup.email': 'Email address',
    'signup.password': 'Password',
    'signup.submit': 'Create account',
    'signup.submitting': 'Creating account…',
    'signup.plans': 'Available plans',
    'plans.loading': 'Loading plans…',
    'plans.error': 'Could not load plans.',
    'plans.retry': 'Retry',
    'status.error': 'That email is already registered.',
    'err.required': 'This field is required',
    'err.email': 'Enter a valid email address',
    'err.password': 'Password must be at least 8 characters',
    'welcome.title': 'Welcome aboard!',
    'welcome.body': 'Your account has been created.',
    'notfound.title': 'Not found',
    'notfound.body': 'There is nothing here.',
  },
  fr: {
    'app.title': 'Comptes StreetUI',
    'nav.home': 'Accueil',
    'nav.signup': 'Créer un compte',
    'locale.toggle': 'Changer de langue',
    'home.tagline': 'Tout dans une appli : routage, formulaires, i18n et accessibilité.',
    'signup.title': 'Créez votre compte',
    'signup.name': 'Nom complet',
    'signup.email': 'Adresse e-mail',
    'signup.password': 'Mot de passe',
    'signup.submit': 'Créer un compte',
    'signup.submitting': 'Création du compte…',
    'signup.plans': 'Offres disponibles',
    'plans.loading': 'Chargement des offres…',
    'plans.error': 'Impossible de charger les offres.',
    'plans.retry': 'Réessayer',
    'status.error': 'Cet e-mail est déjà enregistré.',
    'err.required': 'Ce champ est obligatoire',
    'err.email': 'Saisissez une adresse e-mail valide',
    'err.password': 'Le mot de passe doit comporter au moins 8 caractères',
    'welcome.title': 'Bienvenue !',
    'welcome.body': 'Votre compte a été créé.',
    'notfound.title': 'Introuvable',
    'notfound.body': "Il n'y a rien ici.",
  },
} as const;

type Messages = (typeof messages)['en'];
export type AccountI18n = I18n<Messages>;

export interface SignupValues {
  readonly name: string;
  readonly email: string;
  readonly password: string;
  [key: string]: string;
}

// ── Context: make the active form + i18n available to nested field helpers ───────
interface FormScope {
  readonly form: Form<SignupValues>;
  readonly i18n: AccountI18n;
}
const FormContext: Context<FormScope | null> = createContext<FormScope | null>(
  null,
  'streetui.account.form',
);

// ── API client (real HTTP, no mocking) ──────────────────────────────────────────
export async function fetchPlans(baseUrl: string, signal: AbortSignal): Promise<Plan[]> {
  const response = await fetch(`${baseUrl}/api/plans`, { signal });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.json()) as Plan[];
}

export async function createAccount(baseUrl: string, values: SignupValues): Promise<void> {
  const response = await fetch(`${baseUrl}/api/accounts`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: values.email, name: values.name }),
  });
  if (!response.ok) {
    throw new Error(response.status === 409 ? 'conflict' : `HTTP ${response.status}`);
  }
}

// ── Field helper — reads the form + i18n from context (no prop drilling) ──────────
function textField(
  scope: ContainerDSL,
  fieldName: keyof SignupValues & string,
  labelKey: keyof Messages & string,
  type: 'text' | 'email' | 'password',
): void {
  const scoped = FormContext.consume();
  if (scoped === null) {
    throw new Error('textField must be built within a FormContext provider');
  }
  const { form, i18n } = scoped;
  const f = form.field(fieldName);
  const ids = a11yIds(fieldName);
  // Errors are only surfaced once the field has actually been interacted with.
  const showError = derived(() => f.touched.get() && f.error.get() !== undefined);

  scope.container(
    `${fieldName}-group`,
    (group) => {
      group.text(i18n.t(labelKey), { id: ids.label });
      group.input({
        bind: f.value,
        type,
        id: ids.input,
        ariaLabelledBy: ids.label,
        ariaDescribedBy: ids.error,
        ariaRequired: true,
      });
      group.when(showError, (err) => {
        err.text(
          derived(() => f.error.get() ?? ''),
          { id: ids.error, role: 'alert', ariaLive: 'polite' },
        );
      });
    },
    { id: `${fieldName}-group` },
  );
}

export interface AccountAppOptions {
  /** Base URL of the account API (see api-server.ts). */
  readonly baseUrl: string;
  /** The i18n instance — shared so a locale toggle re-renders every binding. */
  readonly i18n: AccountI18n;
  readonly history?: RouterHistory;
  /** Observability seams for tests. */
  readonly onForm?: (form: Form<SignupValues>) => void;
  readonly onPlansResource?: (resource: Resource<Plan[]>) => void;
  readonly onCreated?: (values: SignupValues) => void;
}

function pageLayout(
  scope: ContainerDSL,
  opts: { id: string; title: import('@streetui/dsl').BindableText },
  body: (content: ContainerDSL) => void,
): void {
  scope.section(
    opts.id,
    (s) => {
      s.heading(opts.title, { level: 1, id: `${opts.id}-title` });
      s.container(`${opts.id}-body`, (content) => body(content), { id: `${opts.id}-body` });
    },
    { id: `page-${opts.id}` },
  );
}

function buildRoutes(
  opts: AccountAppOptions,
  navigate: (path: string) => void,
): RouteDefinition[] {
  const i18n = opts.i18n;

  const home: RouteDefinition = {
    path: '/',
    builder: (page) =>
      pageLayout(page, { id: 'home', title: i18n.t('app.title') }, (c) => {
        c.text(i18n.t('home.tagline'), { id: 'home-tagline' });
        c.link('→', { href: '/signup', id: 'home-signup-link', ariaLabel: i18n.translate('nav.signup') });
      }),
  };

  const signup: RouteDefinition = {
    path: '/signup',
    builder: (page, ctx: RouteContext) => {
      const form = createForm<SignupValues>({
        initialValues: { name: '', email: '', password: '' },
        validators: {
          name: required(i18n.translate('err.required')),
          email: [
            required(i18n.translate('err.required')),
            emailValidator(i18n.translate('err.email')),
          ],
          password: [
            required(i18n.translate('err.required')),
            minLength(8, i18n.translate('err.password')),
          ],
        },
        onSubmit: async (values) => {
          await createAccount(opts.baseUrl, values);
          opts.onCreated?.(values);
          navigate('/welcome');
        },
      });
      ctx.onCleanup(() => form.dispose());
      opts.onForm?.(form);

      const plansRes = resource<Plan[]>(({ signal }) => fetchPlans(opts.baseUrl, signal), {
        onCleanup: ctx.onCleanup,
      });
      opts.onPlansResource?.(plansRes);
      const plans = derived<Plan[]>(() => plansRes.data.get() ?? []);

      pageLayout(page, { id: 'signup', title: i18n.t('signup.title') }, (c) => {
        c.form(
          'signup-form',
          (fb) => {
            FormContext.provide({ form, i18n }, () => {
              textField(fb, 'name', 'signup.name', 'text');
              textField(fb, 'email', 'signup.email', 'email');
              textField(fb, 'password', 'signup.password', 'password');
            });
            fb.button(
              derived(() =>
                form.submitting.get()
                  ? i18n.translate('signup.submitting')
                  : i18n.translate('signup.submit'),
              ),
              { id: 'signup-submit', disabled: form.submitting, onClick: () => void form.submit() },
            );
            fb.when(derived(() => form.status.get() === 'error'), (st) => {
              st.text(i18n.t('status.error'), {
                id: 'signup-status',
                role: 'alert',
                ariaLive: 'assertive',
              });
            });
          },
          { id: 'signup-form', onSubmit: () => void form.submit() },
        );

        c.container(
          'signup-plans',
          (pl) => {
            pl.text(i18n.t('signup.plans'), { id: 'plans-title' });
            pl.errorBoundary(
              'plans-boundary',
              (body) => {
                body.when(
                  derived(() => plansRes.loading.get() && plansRes.data.get() === undefined),
                  (l) => l.text(i18n.t('plans.loading'), { id: 'plans-loading' }),
                );
                body.listOf(
                  'plans-list',
                  plans,
                  (plan, _i, item) => item.text(plan.name, { id: `plan-${plan.id}` }),
                  { id: 'plans-list' },
                );
              },
              {
                source: plansRes.error,
                onRetry: () => void plansRes.refetch(),
                fallback: (fbk) => {
                  fbk.text(i18n.t('plans.error'), { id: 'plans-error' });
                  fbk.button(i18n.t('plans.retry'), {
                    id: 'plans-retry',
                    onClick: () => void plansRes.refetch(),
                  });
                },
              },
            );
          },
          { id: 'signup-plans' },
        );
      });
    },
  };

  const welcome: RouteDefinition = {
    path: '/welcome',
    builder: (page) =>
      pageLayout(page, { id: 'welcome', title: i18n.t('welcome.title') }, (c) => {
        c.text(i18n.t('welcome.body'), { id: 'welcome-body', role: 'status', ariaLive: 'polite' });
        c.link('↩', { href: '/', id: 'welcome-home', ariaLabel: i18n.translate('nav.home') });
      }),
  };

  const notFound: RouteDefinition = {
    path: '*',
    builder: (page) =>
      pageLayout(page, { id: 'notfound', title: i18n.t('notfound.title') }, (c) => {
        c.text(i18n.t('notfound.body'), { id: 'notfound-body' });
        c.link('↩', { href: '/', id: 'notfound-home', ariaLabel: i18n.translate('nav.home') });
      }),
  };

  return [home, signup, welcome, notFound];
}

// __SHELL__
