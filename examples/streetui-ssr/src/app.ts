/**
 * The one application used by BOTH the server and the browser. This is the whole
 * point of universal rendering: a single semantic definition (DSL) is rendered
 * to HTML on the server and hydrated into a live app in the browser — no forked
 * code paths, no second renderer.
 *
 * Everything reactive lives in `AppState`. The server builds an app around a
 * fresh state, serializes that state into the HTML, and the browser rebuilds the
 * same state (seeded from the embedded island) before hydrating. Because the two
 * sides construct structurally identical trees, hydration adopts the server DOM
 * instead of recreating it.
 */

import { streetui, type PageDSL } from '@streetui/dsl';
import { signal, derived, type Signal } from '@streetui/state';
import { compile, type CompiledApplication } from '@streetui/compiler';

export interface AppState {
  readonly count: Signal<number>;
  readonly name: Signal<string>;
  readonly showDetails: Signal<boolean>;
  readonly todos: Signal<Array<{ id: number; label: string }>>;
}

/** Plain, JSON-serializable snapshot of the reactive state (for the SSR island). */
export interface AppSnapshot {
  readonly count: number;
  readonly name: string;
  readonly showDetails: boolean;
  readonly todos: ReadonlyArray<{ id: number; label: string }>;
}

export const STATE_KEY = 'ssr-demo';

/** Create the app's reactive state, optionally seeded from a server snapshot. */
export function createState(seed?: AppSnapshot): AppState {
  return {
    count: signal(seed?.count ?? 0),
    name: signal(seed?.name ?? 'world'),
    showDetails: signal(seed?.showDetails ?? false),
    todos: signal(
      (seed?.todos ?? [
        { id: 1, label: 'Render on the server' },
        { id: 2, label: 'Ship HTML' },
        { id: 3, label: 'Hydrate in place' },
      ]).map((t) => ({ id: t.id, label: t.label })),
    ),
  };
}

/** Read a serializable snapshot out of the live state. */
export function snapshot(state: AppState): AppSnapshot {
  return {
    count: state.count.peek(),
    name: state.name.peek(),
    showDetails: state.showDetails.peek(),
    todos: state.todos.peek().map((t) => ({ id: t.id, label: t.label })),
  };
}

/** Build the application UI against a given state. Identical on both sides. */
export function buildApp(page: PageDSL, state: AppState): void {
  const countLabel = derived(() => `Count: ${state.count.get()}`);
  const greeting = derived(() => `Hello, ${state.name.get()}!`);

  page.heading('StreetUI — Universal Rendering', { id: 'title' });

  page.section('counter', (s) => {
    s.text(countLabel, { id: 'count' });
    s.button('Increment', {
      id: 'inc',
      onClick: () => state.count.set(state.count.peek() + 1),
    });
  });

  page.section('greeter', (s) => {
    s.input({ id: 'name-input', bind: state.name, placeholder: 'your name' });
    s.text(greeting, { id: 'greeting' });
  });

  page.section('details', (s) => {
    s.button('Toggle details', {
      id: 'toggle',
      onClick: () => state.showDetails.set(!state.showDetails.peek()),
    });
    s.when(state.showDetails, (b) => b.text('Server and client share one model.', { id: 'detail' }));
  });

  page.section('todos', (s) => {
    s.heading('Todo', { id: 'todos-title', level: 2 });
    s.listOf('todo-list', state.todos, (item, _i, c) => c.text(item.label));
  });
}

/** Compile the app for a given state into a renderable graph. */
export function compileApp(state: AppState): CompiledApplication {
  const app = streetui.app({ name: 'ssr-demo' });
  app.page('home', (page) => buildApp(page, state));
  return compile(app);
}
