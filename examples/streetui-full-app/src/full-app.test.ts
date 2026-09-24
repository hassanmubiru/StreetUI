/**
 * Full-app integration under a DOM (happy-dom). Exercises SSR + hydration +
 * DOM identity + signals + i18n + context + forms + resource, plus live router
 * navigation — all composed in one app.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { resetIdCounter } from 'streetui';
import { renderToString, serializeState } from 'streetui';
import { compileApp } from './index.js';
import { createDeps, snapshot, STATE_KEY, type AppSnapshot, type User } from './deps.js';
import { hydrateApp } from './browser-entry.js';
import { mountFullApp } from './routed.js';

const SEED: AppSnapshot = { count: 5, locale: 'en', user: { id: 1, name: 'Ada' } };

function planted(seed: AppSnapshot): Element {
  resetIdCounter();
  const deps = createDeps({ seed });
  const html = renderToString(compileApp(deps, { name: 'dark' }));
  const island = serializeState({ [STATE_KEY]: snapshot(deps) });
  document.body.innerHTML = `<div id="app">${html}</div>${island}`;
  resetIdCounter();
  return document.getElementById('app')!;
}

beforeEach(() => {
  document.body.innerHTML = '';
  resetIdCounter();
});

describe('full-app — server render', () => {
  it('renders i18n title, seeded count, context theme and seeded resource', () => {
    resetIdCounter();
    const deps = createDeps({ seed: SEED });
    const html = renderToString(compileApp(deps, { name: 'dark' }));
    expect(html).toContain('StreetUI Full App'); // i18n title (en)
    expect(html).toContain('Count: 5'); // seeded signal via i18n interpolation
    expect(html).toContain('theme:dark'); // context consumed at build
    expect(html).toContain('Ada'); // seeded resource data rendered
  });
});

describe('full-app — hydration + interactivity', () => {
  it('adopts the server DOM (identity) and drives it live', () => {
    const app = planted(SEED);
    const serverTitle = app.querySelector('#title');
    const serverCount = app.querySelector('#count');
    expect(serverTitle).not.toBeNull();

    const { deps } = hydrateApp(app, document, { name: 'dark' });

    // Same node objects — adopted, not recreated.
    expect(app.querySelector('#title')).toBe(serverTitle);
    expect(app.querySelector('#count')).toBe(serverCount);

    // Signal: increment updates the same node in place.
    (app.querySelector('#inc') as HTMLButtonElement).dispatchEvent(new Event('click'));
    expect(serverCount?.textContent).toContain('6');

    // i18n: switch locale — title + count text swap to French in place.
    (app.querySelector('#lang') as HTMLButtonElement).dispatchEvent(new Event('click'));
    expect(deps.i18n.locale.peek()).toBe('fr');
    expect(serverTitle?.textContent).toContain('complète');
    expect(app.querySelector('#count')).toBe(serverCount); // still the same node
  });

  it('forms: validation error appears after a touched, invalid field', () => {
    const app = planted(SEED);
    const { deps } = hydrateApp(app, document, { name: 'dark' });
    const nameInput = app.querySelector('#name-input') as HTMLInputElement;
    nameInput.value = 'a'; // too short (minLength 2)
    nameInput.dispatchEvent(new Event('input'));
    expect(deps.form.field('name').valid.peek()).toBe(false);
    expect(app.querySelector('#name-error')?.textContent).toBeTruthy();
  });
});

describe('full-app — resource async load', () => {
  it('loads a user through the resource when not server-seeded', async () => {
    let resolveUser: (u: User) => void = () => {};
    const p = new Promise<User>((r) => { resolveUser = r; });
    const deps = createDeps({ loadUser: () => p });
    expect(deps.user.status.peek()).toBe('loading');
    resolveUser({ id: 9, name: 'Grace' });
    // Flush the microtask chain: resource loader → loadUser() → state update.
    for (let i = 0; i < 5 && deps.user.status.peek() === 'loading'; i++) {
      await Promise.resolve();
    }
    expect(deps.user.status.peek()).toBe('success');
    expect(deps.user.data.peek()?.name).toBe('Grace');
  });
});

describe('full-app — router', () => {
  it('mounts a shell + route and navigates client-side', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const mounted = mountFullApp(container, { path: '/' });
    expect(container.querySelector('#shell-nav')).not.toBeNull();

    (container.querySelector('#nav-user') as HTMLAnchorElement).dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }),
    );
    expect(container.querySelector('#user-id')?.textContent).toContain('7');
    // Shell persisted across navigation.
    expect(container.querySelector('#shell-nav')).not.toBeNull();
    mounted.unmount();
    container.remove();
  });
});
