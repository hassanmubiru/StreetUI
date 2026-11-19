/**
 * __PROJECT_NAME__ — form demo with validation.
 */

import { streetui, type PageDSL } from '@streetui/dsl';
import { signal, derived, type Signal } from '@streetui/state';
import { compile, type CompiledApplication } from '@streetui/compiler';

export interface AppState {
  readonly name: Signal<string>;
  readonly email: Signal<string>;
  readonly submitted: Signal<boolean>;
}

export interface AppSnapshot {
  readonly name: string;
  readonly email: string;
  readonly submitted: boolean;
}

export const STATE_KEY = '__PROJECT_NAME__';

export function createState(seed?: Partial<AppSnapshot>): AppState {
  return {
    name: signal(seed?.name ?? ''),
    email: signal(seed?.email ?? ''),
    submitted: signal(seed?.submitted ?? false),
  };
}

export function snapshot(state: AppState): AppSnapshot {
  return { name: state.name.peek(), email: state.email.peek(), submitted: state.submitted.peek() };
}

export function buildApp(page: PageDSL, state: AppState): void {
  const nameError = derived(() => {
    const n = state.name.get();
    if (n.length > 0 && n.length < 2) return 'Name must be at least 2 characters';
    return '';
  });

  const emailError = derived(() => {
    const e = state.email.get();
    if (e.length > 0 && !e.includes('@')) return 'Email must contain @';
    return '';
  });

  const isValid = derived(() =>
    state.name.get().length >= 2 &&
    state.email.get().includes('@') &&
    !state.submitted.get()
  );

  page.heading('Form Demo', { id: 'brand', level: 1 });
  page.section('main', (s) => {
    s.text('Name:', { id: 'name-label' });
    s.input({
      id: 'name-input',
      type: 'text',
      value: derived(() => state.name.get()),
      onChange: (v) => state.name.set(v),
    });
    s.text(nameError, { id: 'name-error', role: 'alert' });

    s.text('Email:', { id: 'email-label' });
    s.input({
      id: 'email-input',
      type: 'email',
      value: derived(() => state.email.get()),
      onChange: (v) => state.email.set(v),
    });
    s.text(emailError, { id: 'email-error', role: 'alert' });

    s.button('Submit', {
      id: 'submit-btn',
      disabled: !isValid.get(),
      onClick: () => state.submitted.set(true),
    });

    s.when(state.submitted, (sub) => {
      sub.text('Thank you for submitting!', { id: 'success-msg', role: 'status' });
      sub.button('Reset', {
        id: 'reset-btn',
        onClick: () => {
          state.name.set('');
          state.email.set('');
          state.submitted.set(false);
        },
      });
    });
  }, { id: 'main' });
}

export function compileApp(state: AppState): CompiledApplication {
  const app = streetui.app({ name: '__PROJECT_NAME__' });
  app.page('home', (page) => buildApp(page, state));
  return compile(app);
}
