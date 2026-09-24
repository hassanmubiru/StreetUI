/**
 * Browser entry — read the SSR state island, rebuild identical deps, and
 * hydrate the server DOM in place. Auto-boots in a real browser when a `#app`
 * mount node is present; also callable directly from tests/benchmarks.
 */
import { createRenderer, readState, BrowserDOMAdapter } from 'streetui';
import { compilePage, type ViewName } from './index.js';
import { createDeps, STATE_KEY, type AppDeps, type AppSnapshot, type Theme } from './deps.js';

export interface HydrateResult {
  readonly deps: AppDeps;
  unmount(): void;
}

export function hydrateApp(
  container: Element,
  opts: { stateRoot?: Element | Document; view?: ViewName; theme?: Theme } = {},
): HydrateResult {
  const dom = new BrowserDOMAdapter();
  const transferred = readState(dom, opts.stateRoot ?? container);
  const seed = transferred[STATE_KEY] as AppSnapshot | undefined;

  const deps = createDeps(seed !== undefined ? { seed } : {});
  const compiled = compilePage(deps, opts.view ?? 'users', opts.theme);
  const renderer = createRenderer({ domAdapter: dom });
  const handle = renderer.hydrate(compiled, container);

  return {
    deps,
    unmount(): void {
      handle.unmount();
      deps.userDetail.dispose();
      deps.settingsForm.dispose();
    },
  };
}

if (typeof document !== 'undefined') {
  const boot = (): void => {
    const app = document.getElementById('app');
    if (app !== null) hydrateApp(app, { stateRoot: document });
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
}
