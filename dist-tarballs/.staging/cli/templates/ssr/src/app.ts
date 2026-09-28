/**
 * __PROJECT_NAME__ — the universal application, shared by the server and the
 * browser. This single definition is rendered to HTML on the server and then
 * hydrated in place on the client, so there is exactly one source of truth for
 * the UI and its reactive state.
 *
 * It demonstrates the StreetUI essentials a new app needs:
 *   • signals            — `count`, `view`, `name` reactive state
 *   • conditional views  — `when(...)` swaps Home / About without a framework
 *   • navigation         — buttons flip the `view` signal (and the URL)
 *   • a form             — an input bound to a signal, submitted to show a greeting
 *
 * State is JSON-serialisable so the server can embed a snapshot and the browser
 * can rebuild the identical state before hydrating (no flash, no divergence).
 */

import { streetui, type PageDSL } from '@streetui/dsl';
import { signal, derived, type Signal } from '@streetui/state';
import { compile, type CompiledApplication } from '@streetui/compiler';

/** The set of top-level views. Kept tiny on purpose. */
export type View = 'home' | 'about';

export interface AppState {
  readonly count: Signal<number>;
  readonly view: Signal<View>;
  readonly name: Signal<string>;
  readonly greeting: Signal<string>;
}

/** Plain snapshot embedded in the SSR HTML and used to reseed on the client. */
export interface AppSnapshot {
  readonly count: number;
  readonly view: View;
  readonly name: string;
  readonly greeting: string;
}

/** The key under which this app's state is stored in the SSR island. */
export const STATE_KEY = '__PROJECT_NAME__';

/** Build reactive state, optionally seeded from a server snapshot. */
export function createState(seed?: Partial<AppSnapshot>): AppState {
  return {
    count: signal(seed?.count ?? 0),
    view: signal<View>(seed?.view ?? 'home'),
    name: signal(seed?.name ?? ''),
    greeting: signal(seed?.greeting ?? ''),
  };
}

/** Read a serialisable snapshot out of the live state. */
export function snapshot(state: AppState): AppSnapshot {
  return {
    count: state.count.peek(),
    view: state.view.peek(),
    name: state.name.peek(),
    greeting: state.greeting.peek(),
  };
}

/** Map a request path to the initial view (so SSR renders the right page). */
export function viewForPath(path: string): View {
  return path.replace(/[?#].*$/, '').replace(/\/+$/, '') === '/about' ? 'about' : 'home';
}

/** The one UI definition. Identical on the server and in the browser. */
export function buildApp(page: PageDSL, state: AppState): void {
  const isHome = derived(() => state.view.get() === 'home');
  const isAbout = derived(() => state.view.get() === 'about');
  const hasGreeting = derived(() => state.greeting.get().length > 0);
  const countLabel = derived(() => `You clicked ${state.count.get()} times`);

  page.heading('__PROJECT_NAME__', { id: 'brand', level: 1 });

  page.section('nav', (n) => {
    n.button('Home', { id: 'nav-home', onClick: () => navigate(state, 'home') });
    n.button('About', { id: 'nav-about', onClick: () => navigate(state, 'about') });
  }, { id: 'nav', role: 'navigation' });

  page.when(isHome, (home) => {
    home.section('home', (s) => {
      s.text('Welcome to your new StreetUI app.', { id: 'home-tagline' });
      s.text(countLabel, { id: 'count' });
      s.button('Click me', {
        id: 'increment',
        onClick: () => state.count.set(state.count.peek() + 1),
      });

      s.form('greet-form', (f) => {
        f.input({ id: 'name-input', bind: state.name, placeholder: 'Your name' });
        f.button('Say hello', {
          id: 'greet-submit',
          onClick: () => submitGreeting(state),
        });
        f.when(hasGreeting, (g) =>
          g.text(derived(() => state.greeting.get()), { id: 'greeting', role: 'status' }),
        );
      }, { id: 'greet-form', onSubmit: () => submitGreeting(state) });
    }, { id: 'home' });
  });

  page.when(isAbout, (about) => {
    about.section('about', (s) => {
      s.heading('About', { id: 'about-title', level: 2 });
      s.text(
        'This project was scaffolded with the StreetUI CLI. Edit src/app.ts to ' +
          'change what renders on both the server and the client.',
        { id: 'about-body' },
      );
    }, { id: 'about' });
  });
}

/** Flip the active view and keep the URL in sync when a browser is present. */
function navigate(state: AppState, view: View): void {
  state.view.set(view);
  if (typeof history !== 'undefined' && typeof location !== 'undefined') {
    const path = view === 'about' ? '/about' : '/';
    if (location.pathname !== path) history.pushState({ view }, '', path);
  }
}

/** Turn the name field into a greeting. */
function submitGreeting(state: AppState): void {
  const name = state.name.peek().trim();
  state.greeting.set(name.length > 0 ? `Hello, ${name}!` : 'Hello there!');
}

/** Compile the app for a given state into a renderable graph. */
export function compileApp(state: AppState): CompiledApplication {
  const app = streetui.app({ name: '__PROJECT_NAME__' });
  app.page('home', (page) => buildApp(page, state));
  return compile(app);
}
