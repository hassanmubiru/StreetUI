/**
 * __PROJECT_NAME__ — todo list demo with add, toggle done, and delete.
 */

import { streetui, type PageDSL } from '@streetui/dsl';
import { signal, derived, type Signal } from '@streetui/state';
import { compile, type CompiledApplication } from '@streetui/compiler';

interface TodoItem {
  readonly id: number;
  readonly text: string;
  readonly done: boolean;
}

export interface AppState {
  readonly todos: Signal<TodoItem[]>;
  readonly newText: Signal<string>;
  readonly nextId: Signal<number>;
}

export interface AppSnapshot {
  readonly todos: TodoItem[];
  readonly newText: string;
  readonly nextId: number;
}

export const STATE_KEY = '__PROJECT_NAME__';

export function createState(seed?: Partial<AppSnapshot>): AppState {
  return {
    todos: signal(seed?.todos ?? []),
    newText: signal(seed?.newText ?? ''),
    nextId: signal(seed?.nextId ?? 1),
  };
}

export function snapshot(state: AppState): AppSnapshot {
  return { todos: state.todos.peek(), newText: state.newText.peek(), nextId: state.nextId.peek() };
}

export function buildApp(page: PageDSL, state: AppState): void {
  const remaining = derived(() => state.todos.get().filter((t) => !t.done).length);

  page.heading('Todo List', { id: 'brand', level: 1 });
  page.section('main', (s) => {
    s.text(derived(() => `${remaining.get()} remaining`), { id: 'remaining' });
    s.input({
      id: 'new-todo-input',
      type: 'text',
      placeholder: 'What needs to be done?',
      value: derived(() => state.newText.get()),
      onChange: (v) => state.newText.set(v),
    });
    s.button('Add', {
      id: 'add-btn',
      disabled: derived(() => state.newText.get().trim().length === 0),
      onClick: () => {
        const text = state.newText.get().trim();
        if (!text) return;
        state.todos.set([...state.todos.get(), { id: state.nextId.get(), text, done: false }]);
        state.nextId.set(state.nextId.get() + 1);
        state.newText.set('');
      },
    });
    s.listOf('todo-list', state.todos, (todo, _index, item) => {
      item.text(`${todo.done ? '✓' : '·'} ${todo.text}`, { id: `todo-${todo.id}-text` });
      item.button(todo.done ? 'Undo' : 'Done', {
        id: `todo-${todo.id}-toggle`,
        onClick: () => {
          state.todos.set(state.todos.get().map((t) =>
            t.id === todo.id ? { ...t, done: !t.done } : t
          ));
        },
      });
      item.button('Delete', {
        id: `todo-${todo.id}-delete`,
        onClick: () => {
          state.todos.set(state.todos.get().filter((t) => t.id !== todo.id));
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
