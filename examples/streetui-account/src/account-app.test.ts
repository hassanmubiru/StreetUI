import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { resetIdCounter } from '@streetui/core';
import { createMemoryHistory } from '@streetui/router';
import type { Form } from '@streetui/forms';
import { createAccountApi, type AccountApi } from './api-server.js';
import {
  mountAccountApp,
  createAccountI18n,
  type SignupValues,
  type AccountI18n,
} from './account-app.js';

const tick = (ms = 25): Promise<void> => new Promise((r) => setTimeout(r, ms));
const text = (el: Element | null): string => el?.textContent?.trim() ?? '';

let api: AccountApi;
let baseUrl: string;

beforeAll(async () => {
  api = createAccountApi();
  baseUrl = await api.listen();
});
afterAll(async () => {
  await api.close();
});
beforeEach(() => {
  api.setFail(false);
  resetIdCounter();
});

interface Harness {
  container: HTMLDivElement;
  i18n: AccountI18n;
  form?: Form<SignupValues>;
  unmount(): void;
}

function mount(path: string, locale = 'en'): Harness {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const i18n = createAccountI18n(locale);
  const harness: Harness = { container, i18n, unmount: () => {} };
  resetIdCounter();
  const app = mountAccountApp(container, {
    baseUrl,
    i18n,
    history: createMemoryHistory(path),
    onForm: (f) => {
      harness.form = f;
    },
  });
  harness.unmount = () => {
    app.unmount();
    container.remove();
  };
  return harness;
}

describe('account app — forms + validation', () => {
  it('shows a field error after an invalid, touched submit and does not create', async () => {
    const h = mount('/signup');
    await tick();
    const form = h.form!;
    form.field('email').value.set('not-an-email');
    await form.submit(); // invalid → stays idle, all fields touched
    expect(form.status.get()).toBe('idle');
    expect(text(h.container.querySelector('#email-error'))).toBe('Enter a valid email address');
    expect(text(h.container.querySelector('#name-error'))).toBe('This field is required');
    expect(api.accounts().length).toBe(0);
    h.unmount();
  });

  it('creates an account against the real API and navigates to /welcome', async () => {
    const h = mount('/signup');
    await tick();
    const form = h.form!;
    form.setValues({ name: 'Ada Lovelace', email: 'ada@example.com', password: 'supersecret' });
    await form.submit();
    expect(form.status.get()).toBe('success');
    expect(api.accounts().some((a) => a.email === 'ada@example.com')).toBe(true);
    // Router navigated to the welcome route (shell persisted).
    expect(text(h.container.querySelector('#welcome-title'))).toBe('Welcome aboard!');
    h.unmount();
  });

  it('enters the error state when the API rejects a duplicate email (409)', async () => {
    api.register('dupe@example.com');
    const h = mount('/signup');
    await tick();
    const form = h.form!;
    form.setValues({ name: 'Dup', email: 'dupe@example.com', password: 'supersecret' });
    await form.submit();
    expect(form.status.get()).toBe('error');
    expect(h.container.querySelector('#signup-status')?.getAttribute('role')).toBe('alert');
    h.unmount();
  });

  it('submits via the native form submit event (Enter / submit button)', async () => {
    const h = mount('/signup');
    await tick();
    h.form!.setValues({ name: 'Grace', email: 'grace@example.com', password: 'longenough' });
    h.container.querySelector('#signup-form')!.dispatchEvent(new Event('submit'));
    await tick(40);
    expect(api.accounts().some((a) => a.email === 'grace@example.com')).toBe(true);
    h.unmount();
  });
});

describe('account app — resources (plans)', () => {
  it('loads plans from the real API and renders them', async () => {
    const h = mount('/signup');
    await tick(40);
    expect(text(h.container.querySelector('#plan-free'))).toBe('Free');
    expect(text(h.container.querySelector('#plan-pro'))).toBe('Pro');
    h.unmount();
  });

  it('shows an error + retry when the plans request fails', async () => {
    api.setFail(true);
    const h = mount('/signup');
    await tick(40);
    expect(text(h.container.querySelector('#plans-error'))).toBe('Could not load plans.');
    // Recover and retry via the live button.
    api.setFail(false);
    (h.container.querySelector('#plans-retry') as HTMLElement).dispatchEvent(new Event('click'));
    await tick(40);
    expect(text(h.container.querySelector('#plan-free'))).toBe('Free');
    h.unmount();
  });
});

describe('account app — i18n (reactive locale)', () => {
  it('re-renders every binding when the locale toggle flips en↔fr', () => {
    const h = mount('/');
    expect(text(h.container.querySelector('#brand'))).toBe('StreetUI Accounts');
    expect(text(h.container.querySelector('#home-tagline'))).toContain('Everything in one app');
    (h.container.querySelector('#locale-toggle') as HTMLElement).dispatchEvent(new Event('click'));
    expect(text(h.container.querySelector('#brand'))).toBe('Comptes StreetUI');
    expect(text(h.container.querySelector('#home-tagline'))).toContain('Tout dans une appli');
    h.unmount();
  });

  it('starts in the requested locale', () => {
    const h = mount('/', 'fr');
    expect(text(h.container.querySelector('#brand'))).toBe('Comptes StreetUI');
    h.unmount();
  });
});

describe('account app — accessibility', () => {
  it('wires deterministic label/description ids and required state on fields', async () => {
    const h = mount('/signup');
    await tick();
    const emailInput = h.container.querySelector('#email-input');
    expect(emailInput?.getAttribute('aria-labelledby')).toBe('email-label');
    expect(emailInput?.getAttribute('aria-describedby')).toBe('email-error');
    expect(emailInput?.getAttribute('aria-required')).toBe('true');
    expect(h.container.querySelector('#site-nav')?.getAttribute('role')).toBe('navigation');
    h.unmount();
  });
});

describe('account app — SSR + hydration', () => {
  it('adopts server markup and runs live client navigation afterwards', async () => {
    // 1. Server render (same build fn, deterministic ids + locale).
    resetIdCounter();
    const serverContainer = document.createElement('div');
    const server = mountAccountApp(serverContainer, {
      baseUrl,
      i18n: createAccountI18n('en'),
      history: createMemoryHistory('/signup'),
    });
    const html = serverContainer.innerHTML;
    server.unmount();
    expect(html).toContain('id="email-input"');
    expect(html).toContain('aria-required="true"');

    // 2. Plant markup + hydrate.
    const container = document.createElement('div');
    document.body.appendChild(container);
    container.innerHTML = html;
    const brandBefore = container.querySelector('#brand');
    const emailBefore = container.querySelector('#email-input');
    expect(brandBefore).not.toBeNull();

    resetIdCounter();
    const i18n = createAccountI18n('en');
    const client = mountAccountApp(container, {
      baseUrl,
      i18n,
      history: createMemoryHistory('/signup'),
      hydrate: true,
    });

    // Adopted the exact server nodes (no recreation).
    expect(container.querySelector('#brand')).toBe(brandBefore);
    expect(container.querySelector('#email-input')).toBe(emailBefore);

    // Live after hydration: navigate client-side; shell persists.
    client.router.navigate('/');
    expect(container.querySelector('#brand')).toBe(brandBefore);
    expect(text(container.querySelector('#home-tagline'))).toContain('Everything in one app');

    client.unmount();
    container.remove();
  });
});
