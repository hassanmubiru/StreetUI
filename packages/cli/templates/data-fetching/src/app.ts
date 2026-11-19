/**
 * __PROJECT_NAME__ — async data fetching demo.
 */

import { streetui, type PageDSL } from '@streetui/dsl';
import { signal, derived, type Signal } from '@streetui/state';
import { compile, type CompiledApplication } from '@streetui/compiler';

interface User {
  readonly id: number;
  readonly name: string;
  readonly email: string;
}

export interface AppState {
  readonly users: Signal<User[]>;
  readonly loading: Signal<boolean>;
  readonly error: Signal<string>;
  readonly filter: Signal<string>;
}

export interface AppSnapshot {
  readonly users: User[];
  readonly loading: boolean;
  readonly error: string;
  readonly filter: string;
}

export const STATE_KEY = '__PROJECT_NAME__';

export function createState(seed?: Partial<AppSnapshot>): AppState {
  return {
    users: signal(seed?.users ?? []),
    loading: signal(seed?.loading ?? false),
    error: signal(seed?.error ?? ''),
    filter: signal(seed?.filter ?? ''),
  };
}

export function snapshot(state: AppState): AppSnapshot {
  return {
    users: state.users.peek(),
    loading: state.loading.peek(),
    error: state.error.peek(),
    filter: state.filter.peek(),
  };
}

export function buildApp(page: PageDSL, state: AppState): void {
  const filtered = derived(() =>
    state.users.get().filter((u) =>
      (u.name + ' ' + u.email).toLowerCase().includes(state.filter.get().toLowerCase())
    )
  );

  page.heading('Data Fetching Demo', { id: 'brand', level: 1 });
  page.section('main', (s) => {
    s.button('Load Users', {
      id: 'load-btn',
      disabled: state.loading,
      onClick: async () => {
        state.loading.set(true);
        state.error.set('');
        try {
          const res = await fetch('https://jsonplaceholder.typicode.com/users');
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = (await res.json()) as User[];
          state.users.set(data);
        } catch (err) {
          state.error.set(err instanceof Error ? err.message : 'Failed to fetch');
        } finally {
          state.loading.set(false);
        }
      },
    });

    s.text('Filter:', { id: 'filter-label' });
    s.input({
      id: 'filter-input',
      type: 'search',
      placeholder: 'Filter users…',
      value: derived(() => state.filter.get()),
      onChange: (v) => state.filter.set(v),
    });

    s.when(state.loading, (c) => {
      c.text('Loading…', { id: 'loading-msg', role: 'status' });
    });

    s.when(derived(() => state.error.get() !== ''), (c) => {
      c.text(state.error, { id: 'error-msg', role: 'alert' });
    });

    s.listOf('user-list', filtered, (user, _index, item) => {
      item.text(`Name: ${user.name}`, { id: `user-${user.id}-name` });
      item.text(`Email: ${user.email}`, { id: `user-${user.id}-email` });
    });

    s.when(
      derived(() => state.users.get().length > 0 && filtered.get().length === 0),
      (c) => c.text('No users match your filter.', { id: 'no-results' })
    );
  }, { id: 'main' });
}

export function compileApp(state: AppState): CompiledApplication {
  const app = streetui.app({ name: '__PROJECT_NAME__' });
  app.page('home', (page) => buildApp(page, state));
  return compile(app);
}
