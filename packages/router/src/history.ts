/**
 * Router history — a small abstraction over the navigation source so the router
 * can run both in the browser (real `window.history` + `popstate`) and in tests
 * (an in-memory stack, fully deterministic, no globals).
 *
 * Internal navigation never triggers a full-page reload: the browser history
 * uses `pushState`/`replaceState` and notifies listeners synchronously.
 */

export interface RouterLocation {
  /** Pathname, always normalized with a single leading slash. */
  readonly pathname: string;
  /** Query string without the leading `?`. */
  readonly search: string;
}

export interface RouterHistory {
  /** The current location. */
  location(): RouterLocation;
  /** Push a new entry and notify listeners. */
  push(pathname: string, search: string): void;
  /** Replace the current entry and notify listeners. */
  replace(pathname: string, search: string): void;
  /** Go back one entry. */
  back(): void;
  /** Go forward one entry. */
  forward(): void;
  /** Subscribe to location changes. Returns an unsubscribe function. */
  listen(cb: () => void): () => void;
  /** Detach any global listeners (browser only). */
  dispose(): void;
}

function buildLocation(pathname: string, search: string): RouterLocation {
  return { pathname, search };
}

function toUrl(pathname: string, search: string): string {
  return search.length > 0 ? `${pathname}?${search}` : pathname;
}

/**
 * Browser history backed by `window.history`. `pushState`/`replaceState` do not
 * emit `popstate`, so we notify listeners ourselves after those calls; genuine
 * back/forward navigation arrives via the `popstate` event.
 */
export function createBrowserHistory(): RouterHistory {
  const listeners = new Set<() => void>();
  const notify = (): void => {
    for (const cb of listeners) cb();
  };
  const onPopState = (): void => notify();
  window.addEventListener('popstate', onPopState);

  const current = (): RouterLocation => {
    const loc = window.location;
    return buildLocation(loc.pathname, loc.search.replace(/^\?/, ''));
  };

  return {
    location: current,
    push(pathname, search) {
      window.history.pushState({}, '', toUrl(pathname, search));
      notify();
    },
    replace(pathname, search) {
      window.history.replaceState({}, '', toUrl(pathname, search));
      notify();
    },
    back() {
      window.history.back(); // async → emits popstate
    },
    forward() {
      window.history.forward(); // async → emits popstate
    },
    listen(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    dispose() {
      window.removeEventListener('popstate', onPopState);
      listeners.clear();
    },
  };
}

/**
 * In-memory history for tests and non-DOM environments. Maintains an explicit
 * stack and cursor so `back()`/`forward()` are deterministic.
 */
export function createMemoryHistory(initial = '/'): RouterHistory {
  const listeners = new Set<() => void>();
  const notify = (): void => {
    for (const cb of listeners) cb();
  };

  const parse = (entry: string): RouterLocation => {
    const qIndex = entry.indexOf('?');
    if (qIndex < 0) return buildLocation(entry, '');
    return buildLocation(entry.slice(0, qIndex), entry.slice(qIndex + 1));
  };

  const stack: string[] = [initial];
  let index = 0;

  return {
    location() {
      return parse(stack[index]!);
    },
    push(pathname, search) {
      // Drop any forward entries, then append.
      stack.splice(index + 1);
      stack.push(toUrl(pathname, search));
      index = stack.length - 1;
      notify();
    },
    replace(pathname, search) {
      stack[index] = toUrl(pathname, search);
      notify();
    },
    back() {
      if (index > 0) {
        index--;
        notify();
      }
    },
    forward() {
      if (index < stack.length - 1) {
        index++;
        notify();
      }
    },
    listen(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    dispose() {
      listeners.clear();
    },
  };
}
