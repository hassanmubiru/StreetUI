/**
 * __PROJECT_NAME__ — a minimal universal StreetUI app shared by the server and
 * the browser. Rendered to HTML on the server and hydrated in place on the
 * client. Demonstrates a signal-backed counter and a `when()` conditional.
 */

import { streetui, type PageDSL } from 'streetui';
import { signal, derived, type Signal } from 'streetui';
import { compile, type CompiledApplication } from 'streetui';

export interface AppState {
  readonly count: Signal<number>;
  readonly showTip: Signal<boolean>;
}

export interface AppSnapshot {
  readonly count: number;
  readonly showTip: boolean;
}

export const STATE_KEY = '__PROJECT_NAME__';

export function createState(seed?: Partial<AppSnapshot>): AppState {
  return {
    count: signal(seed?.count ?? 0),
    showTip: signal(seed?.showTip ?? false),
  };
}

export function snapshot(state: AppState): AppSnapshot {
  return { count: state.count.peek(), showTip: state.showTip.peek() };
}

export function buildApp(page: PageDSL, state: AppState): void {
  const countLabel = derived(() => `Count: ${state.count.get()}`);

  page.heading('__PROJECT_NAME__', { id: 'brand', level: 1 });
  page.section('main', (s) => {
    s.text('Your StreetUI app is running. Edit src/app.ts to change this.', { id: 'intro' });
    s.text(countLabel, { id: 'count' });
    s.button('Increment', {
      id: 'increment',
      onClick: () => state.count.set(state.count.peek() + 1),
    });
    s.button('Toggle tip', {
      id: 'toggle-tip',
      onClick: () => state.showTip.set(!state.showTip.peek()),
    });
    s.when(state.showTip, (tip) =>
      tip.text('Tip: signals + when() give you reactive UI with no virtual DOM.', {
        id: 'tip',
        role: 'note',
      }),
    );
  }, { id: 'main' });
}

export function compileApp(state: AppState): CompiledApplication {
  const app = streetui.app({ name: '__PROJECT_NAME__' });
  app.page('home', (page) => buildApp(page, state));
  return compile(app);
}
