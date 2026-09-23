/**
 * Reusable application builders for the benchmark suites. Everything here goes
 * through the *real* public DSL (`streetui.app` → `compile`) — no hand-built
 * graphs, no test doubles — so the measurements reflect the pipeline a real app
 * exercises.
 */

import { streetui, type StreetApp } from '@streetui/dsl';
import { compile, type CompiledApplication } from '@streetui/compiler';
import { signal, type Signal } from '@streetui/state';

export interface ListItem {
  readonly id: number;
  readonly label: string;
}

/** N sequential list items (id === position by default). */
export function makeItems(n: number, offset = 0): ListItem[] {
  const out: ListItem[] = new Array<ListItem>(n);
  for (let i = 0; i < n; i++) {
    const id = i + offset;
    out[i] = { id, label: `item-${id}` };
  }
  return out;
}

/** A flat page of `n` static text nodes — the simplest sizing workload. */
export function buildFlatApp(n: number): StreetApp {
  const app = streetui.app({ name: 'flat', version: '0.7.0' });
  app.page('home', (page) => {
    page.section('main', (s) => {
      s.heading('Flat benchmark', { level: 1 });
      for (let i = 0; i < n; i++) {
        s.text(`text node ${i}`, { class: 'row' });
      }
    });
  });
  return app;
}

/**
 * A page of `n` text nodes all bound to a single signal — used to measure the
 * cost of notifying `n` subscribers on one `.set()`.
 */
export function buildReactiveApp(n: number): { app: StreetApp; sig: Signal<string> } {
  const sig = signal('initial');
  const app = streetui.app({ name: 'reactive', version: '0.7.0' });
  app.page('home', (page) => {
    page.section('main', (s) => {
      for (let i = 0; i < n; i++) {
        s.text(sig, { class: 'bound' });
      }
    });
  });
  return { app, sig };
}

/** A keyed reactive list driven by a mutable items signal. */
export function buildListApp(items: Signal<ListItem[]>): StreetApp {
  const app = streetui.app({ name: 'list', version: '0.7.0' });
  app.page('home', (page) => {
    page.section('main', (s) => {
      s.listOf('rows', items, (item, _i, content) => {
        content.text(item.label, { class: 'cell' });
      });
    });
  });
  return app;
}

/** A conditional (`when`) driven by a boolean signal, for toggle benchmarks. */
export function buildConditionalApp(cond: Signal<boolean>): StreetApp {
  const app = streetui.app({ name: 'conditional', version: '0.7.0' });
  app.page('home', (page) => {
    page.section('main', (s) => {
      s.when(
        cond,
        (then) => {
          then.heading('Visible', { level: 2 });
          then.text('branch content');
        },
        (els) => {
          els.text('hidden');
        },
      );
    });
  });
  return app;
}

/** A page with `n` inputs each carrying a class/aria attribute bag (attr work). */
export function buildAttrApp(n: number): StreetApp {
  const app = streetui.app({ name: 'attrs', version: '0.7.0' });
  app.page('home', (page) => {
    page.section('main', (s) => {
      for (let i = 0; i < n; i++) {
        s.input({
          type: 'text',
          placeholder: `field ${i}`,
          class: 'form-control large',
          ariaLabel: `field ${i}`,
          role: 'textbox',
        });
      }
    });
  });
  return app;
}

export function compileApp(app: StreetApp): CompiledApplication {
  return compile(app);
}
