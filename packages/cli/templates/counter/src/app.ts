/**
 * __PROJECT_NAME__ — counter demo with increment, decrement, reset, and step size.
 */

import { streetui, type PageDSL } from '@streetui/dsl';
import { signal, derived, type Signal } from '@streetui/state';
import { compile, type CompiledApplication } from '@streetui/compiler';

export interface AppState {
  readonly count: Signal<number>;
  readonly step: Signal<number>;
}

export interface AppSnapshot {
  readonly count: number;
  readonly step: number;
}

export const STATE_KEY = '__PROJECT_NAME__';

export function createState(seed?: Partial<AppSnapshot>): AppState {
  return {
    count: signal(seed?.count ?? 0),
    step: signal(seed?.step ?? 1),
  };
}

export function snapshot(state: AppState): AppSnapshot {
  return { count: state.count.peek(), step: state.step.peek() };
}

export function buildApp(page: PageDSL, state: AppState): void {
  const doubled = derived(() => state.count.get() * 2);

  page.heading('Counter Demo', { id: 'brand', level: 1 });
  page.section('main', (s) => {
    s.text('Step size:', { id: 'step-label' });
    s.input({
      id: 'step-input',
      type: 'number',
      placeholder: 'step',
      value: derived(() => String(state.step.get())),
      onChange: (v) => state.step.set(Number(v) || 1),
    });
    s.text(derived(() => `Count: ${state.count.get()}`), { id: 'count-display' });
    s.text(derived(() => `Doubled: ${doubled.get()}`), { id: 'doubled-display' });
    s.button('+', {
      id: 'increment',
      onClick: () => state.count.set(state.count.peek() + state.step.peek()),
    });
    s.button('-', {
      id: 'decrement',
      onClick: () => state.count.set(state.count.peek() - state.step.peek()),
    });
    s.button('Reset', {
      id: 'reset',
      onClick: () => state.count.set(0),
    });
  }, { id: 'main' });
}

export function compileApp(state: AppState): CompiledApplication {
  const app = streetui.app({ name: '__PROJECT_NAME__' });
  app.page('home', (page) => buildApp(page, state));
  return compile(app);
}
