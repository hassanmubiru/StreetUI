/**
 * Installs a `happy-dom` window as the global DOM so the real
 * `BrowserDOMAdapter` (which references `document`, `Node`, `Element`, …) runs
 * unchanged inside a plain Node process during benchmarking.
 *
 * happy-dom is a devDependency used only by this benchmark tool and by the SSR
 * example's vitest env — it never enters the framework runtime. Absolute DOM
 * timings under happy-dom are not browser timings, but every before/after
 * comparison runs in this same environment, so the *relative* deltas that gate
 * an optimization are valid (see docs/performance.md, "Methodology").
 */

import { Window } from 'happy-dom';

let installed = false;

export function installHappyDom(): void {
  if (installed) return;
  const win = new Window({ url: 'http://localhost/' });
  const g = globalThis as unknown as Record<string, unknown>;
  g['window'] = win;
  g['document'] = win.document;
  g['Node'] = win.Node;
  g['Element'] = win.Element;
  g['HTMLElement'] = win.HTMLElement;
  g['Text'] = win.Text;
  g['Comment'] = win.Comment;
  g['DocumentFragment'] = win.DocumentFragment;
  g['Event'] = win.Event;
  g['CustomEvent'] = win.CustomEvent;
  installed = true;
}

/** Fresh detached container element for a mount benchmark. */
export function freshContainer(): Element {
  return document.createElement('div');
}
