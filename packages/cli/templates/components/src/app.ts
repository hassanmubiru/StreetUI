/**
 * __PROJECT_NAME__ — reusable components demo.
 */

import { streetui, type PageDSL, type SectionDSL } from '@streetui/dsl';
import { signal, derived, type Signal } from '@streetui/state';
import { compile, type CompiledApplication } from '@streetui/compiler';

interface CardProps {
  readonly title: string;
  readonly content: string;
  readonly count: Signal<number>;
}

function renderCard(s: SectionDSL, props: CardProps): void {
  s.section('card', (c) => {
    c.heading(props.title, { id: `card-${props.title}-title`, level: 3 });
    c.text(props.content, { id: `card-${props.title}-content` });
    c.text(derived(() => `Count: ${props.count.get()}`), { id: `card-${props.title}-count` });
    c.button('+1', {
      id: `card-${props.title}-btn`,
      onClick: () => props.count.set(props.count.get() + 1),
    });
  }, { id: `card-${props.title}`, class: 'card' });
}

export interface AppState {
  readonly card1Count: Signal<number>;
  readonly card2Count: Signal<number>;
  readonly card3Count: Signal<number>;
}

export interface AppSnapshot {
  readonly card1Count: number;
  readonly card2Count: number;
  readonly card3Count: number;
}

export const STATE_KEY = '__PROJECT_NAME__';

export function createState(seed?: Partial<AppSnapshot>): AppState {
  return {
    card1Count: signal(seed?.card1Count ?? 0),
    card2Count: signal(seed?.card2Count ?? 0),
    card3Count: signal(seed?.card3Count ?? 0),
  };
}

export function snapshot(state: AppState): AppSnapshot {
  return {
    card1Count: state.card1Count.peek(),
    card2Count: state.card2Count.peek(),
    card3Count: state.card3Count.peek(),
  };
}

export function buildApp(page: PageDSL, state: AppState): void {
  page.heading('Components Demo', { id: 'brand', level: 1 });
  page.section('cards', (s) => {
    renderCard(s, {
      title: 'Card One',
      content: 'This is the first card.',
      count: state.card1Count,
    });
    renderCard(s, {
      title: 'Card Two',
      content: 'This is the second card.',
      count: state.card2Count,
    });
    renderCard(s, {
      title: 'Card Three',
      content: 'This is the third card.',
      count: state.card3Count,
    });
  }, { id: 'cards', class: 'cards-grid' });
}

export function compileApp(state: AppState): CompiledApplication {
  const app = streetui.app({ name: '__PROJECT_NAME__' });
  app.page('home', (page) => buildApp(page, state));
  return compile(app);
}
