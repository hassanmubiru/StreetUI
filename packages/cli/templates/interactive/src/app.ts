/**
 * __PROJECT_NAME__ — interactive widgets demo.
 */

import { streetui, type PageDSL } from '@streetui/dsl';
import { signal, derived, type Signal } from '@streetui/state';
import { compile, type CompiledApplication } from '@streetui/compiler';

export interface AppState {
  readonly sliderVal: Signal<number>;
  readonly toggleOn: Signal<boolean>;
  readonly color: Signal<string>;
  readonly searchText: Signal<string>;
}

export interface AppSnapshot {
  readonly sliderVal: number;
  readonly toggleOn: boolean;
  readonly color: string;
  readonly searchText: string;
}

export const STATE_KEY = '__PROJECT_NAME__';

export function createState(seed?: Partial<AppSnapshot>): AppState {
  return {
    sliderVal: signal(seed?.sliderVal ?? 50),
    toggleOn: signal(seed?.toggleOn ?? true),
    color: signal(seed?.color ?? '#3b82f6'),
    searchText: signal(seed?.searchText ?? ''),
  };
}

export function snapshot(state: AppState): AppSnapshot {
  return {
    sliderVal: state.sliderVal.peek(),
    toggleOn: state.toggleOn.peek(),
    color: state.color.peek(),
    searchText: state.searchText.peek(),
  };
}

export function buildApp(page: PageDSL, state: AppState): void {
  const sliderDoubled = derived(() => state.sliderVal.get() * 2);
  const charCount = derived(() => state.searchText.get().length);

  page.heading('Interactive Demo', { id: 'brand', level: 1 });
  page.section('main', (s) => {
    s.section('slider-widget', (w) => {
      w.text(derived(() => `Slider value: ${state.sliderVal.get()}`), { id: 'slider-val' });
      w.text(derived(() => `Doubled: ${sliderDoubled.get()}`), { id: 'slider-doubled' });
      w.input({
        id: 'slider-input',
        type: 'number',
        min: 0,
        max: 100,
        value: derived(() => String(state.sliderVal.get())),
        onChange: (v) => state.sliderVal.set(Number(v) || 0),
      });
    }, { id: 'slider-widget' });

    s.section('toggle-widget', (w) => {
      w.text(derived(() => `Toggle is: ${state.toggleOn.get() ? 'ON' : 'OFF'}`), { id: 'toggle-status' });
      s.when(state.toggleOn, (c) => c.text('Feature is ON', { id: 'toggle-feature-on' }), (c) => c.text('Feature is OFF', { id: 'toggle-feature-off' }));
      w.button('Toggle', {
        id: 'toggle-btn',
        onClick: () => state.toggleOn.set(!state.toggleOn.get()),
      });
    }, { id: 'toggle-widget' });

    s.section('color-widget', (w) => {
      w.text('Color picker:', { id: 'color-label' });
      w.input({
        id: 'color-input',
        type: 'text',
        placeholder: '#3b82f6',
        value: derived(() => state.color.get()),
        onChange: (v) => {
          if (/^#[0-9a-fA-F]{6}$/.test(v)) state.color.set(v);
        },
      });
      w.text(derived(() => `Color: ${state.color.get()}`), { id: 'color-preview' });
    }, { id: 'color-widget' });

    s.section('search-widget', (w) => {
      w.input({
        id: 'search-input',
        type: 'search',
        placeholder: 'Type to search…',
        value: derived(() => state.searchText.get()),
        onChange: (v) => state.searchText.set(v),
      });
      w.text(derived(() => `${charCount.get()} characters`), { id: 'char-count' });
    }, { id: 'search-widget' });
  }, { id: 'main' });
}

export function compileApp(state: AppState): CompiledApplication {
  const app = streetui.app({ name: '__PROJECT_NAME__' });
  app.page('home', (page) => buildApp(page, state));
  return compile(app);
}
