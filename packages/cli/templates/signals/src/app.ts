/**
 * __PROJECT_NAME__ — signals and derived state demo.
 */

import { streetui, type PageDSL } from '@streetui/dsl';
import { signal, derived, type Signal } from '@streetui/state';
import { compile, type CompiledApplication } from '@streetui/compiler';

export interface AppState {
  readonly firstName: Signal<string>;
  readonly lastName: Signal<string>;
  readonly age: Signal<number>;
}

export interface AppSnapshot {
  readonly firstName: string;
  readonly lastName: string;
  readonly age: number;
}

export const STATE_KEY = '__PROJECT_NAME__';

export function createState(seed?: Partial<AppSnapshot>): AppState {
  return {
    firstName: signal(seed?.firstName ?? 'John'),
    lastName: signal(seed?.lastName ?? 'Doe'),
    age: signal(seed?.age ?? 30),
  };
}

export function snapshot(state: AppState): AppSnapshot {
  return { firstName: state.firstName.peek(), lastName: state.lastName.peek(), age: state.age.peek() };
}

export function buildApp(page: PageDSL, state: AppState): void {
  const fullName = derived(() => `${state.firstName.get()} ${state.lastName.get()}`);
  const isAdult = derived(() => state.age.get() >= 18);
  const birthYear = derived(() => new Date().getFullYear() - state.age.get());

  page.heading('Signals Demo', { id: 'brand', level: 1 });
  page.section('main', (s) => {
    s.text('First name:', { id: 'fn-label' });
    s.input({
      id: 'first-name-input',
      type: 'text',
      value: derived(() => state.firstName.get()),
      onChange: (v) => state.firstName.set(v),
    });

    s.text('Last name:', { id: 'ln-label' });
    s.input({
      id: 'last-name-input',
      type: 'text',
      value: derived(() => state.lastName.get()),
      onChange: (v) => state.lastName.set(v),
    });

    s.text('Age:', { id: 'age-label' });
    s.input({
      id: 'age-input',
      type: 'number',
      value: derived(() => String(state.age.get())),
      onChange: (v) => state.age.set(Number(v) || 0),
    });

    s.heading('Derived values:', { id: 'derived-title', level: 2 });
    s.text(derived(() => `Full name: ${fullName.get()}`), { id: 'full-name' });
    s.text(derived(() => `Birth year (approx): ${birthYear.get()}`), { id: 'birth-year' });
    s.text(derived(() => `Is adult: ${isAdult.get() ? 'Yes' : 'No'}`), { id: 'is-adult' });
  }, { id: 'main' });
}

export function compileApp(state: AppState): CompiledApplication {
  const app = streetui.app({ name: '__PROJECT_NAME__' });
  app.page('home', (page) => buildApp(page, state));
  return compile(app);
}
