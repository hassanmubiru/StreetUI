/**
 * Tests for the reactive-surface inspection APIs. These verify read-only
 * snapshots and — importantly — that sensitive surfaces stay hidden by default.
 */
import { describe, it, expect } from 'vitest';
import { signal, derived, resource } from '@streetui/state';
import {
  inspectSignal,
  inspectResource,
  inspectRouter,
  inspectForm,
  inspectContext,
  inspectI18n,
} from './inspect-reactive.js';

describe('inspectSignal', () => {
  it('reports kind, value, and observer count', () => {
    const s = signal(41);
    const unsub = s.subscribe(() => {});
    const snap = inspectSignal(s);
    expect(snap.kind).toBe('writable');
    expect(snap.value).toBe(41);
    expect(snap.observerCount).toBe(1);
    unsub();
  });

  it('classifies derived signals', () => {
    const s = signal(2);
    const d = derived(() => s.peek() * 2);
    expect(inspectSignal(d).kind).toBe('derived');
  });

  it('redacts the value when asked', () => {
    const secret = signal('hunter2');
    expect(inspectSignal(secret, { redact: true }).value).toBe('[redacted]');
    expect(inspectSignal(secret, { redact: (v) => `len:${String(v).length}` }).value).toBe('len:7');
  });
});

describe('inspectResource', () => {
  it('hides payload and error message by default', async () => {
    const r = resource<string>(() => Promise.resolve('SENSITIVE'));
    await r.refetch();
    const snap = inspectResource(r);
    expect(snap.status).toBe('success');
    expect(snap.hasData).toBe(true);
    expect(snap.data).toBeUndefined(); // not leaked
  });

  it('includes payload only when explicitly opted in', async () => {
    const r = resource<string>(() => Promise.resolve('VALUE'));
    await r.refetch();
    expect(inspectResource(r, { includeData: true }).data).toBe('VALUE');
  });

  it('exposes only the error constructor name by default', async () => {
    const r = resource<string>(() => Promise.reject(new TypeError('boom secret')));
    await r.refetch().catch(() => {});
    const snap = inspectResource(r);
    expect(snap.hasError).toBe(true);
    expect(snap.errorName).toBe('TypeError');
    expect(snap.errorMessage).toBeUndefined();
    expect(inspectResource(r, { includeData: true }).errorMessage).toBe('boom secret');
  });
});

describe('inspectRouter', () => {
  it('snapshots the current route', () => {
    const route = signal({
      path: '/users/7',
      pattern: '/users/:id',
      params: { id: '7' },
      query: new URLSearchParams('tab=profile'),
      isFallback: false,
    });
    const snap = inspectRouter({ currentRoute: route });
    expect(snap.path).toBe('/users/7');
    expect(snap.params).toEqual({ id: '7' });
    expect(snap.query).toEqual({ tab: 'profile' });
    expect(snap.isFallback).toBe(false);
  });
});

describe('inspectForm', () => {
  it('hides entered values by default but shows validation state', () => {
    const form = {
      values: signal({ email: 'a@b.co', password: 'secret' }),
      errors: signal<Record<string, string | undefined>>({ password: 'too short' }),
      touched: signal<Record<string, boolean | undefined>>({ email: true }),
      dirty: signal(true),
      valid: signal(false),
      status: signal('idle'),
    };
    const snap = inspectForm(form);
    expect(snap.fields).toEqual(['email', 'password']);
    expect(snap.errors).toEqual({ password: 'too short' });
    expect(snap.touched).toEqual({ email: true });
    expect(snap.valid).toBe(false);
    expect(snap.values).toBeUndefined(); // passwords not leaked
    expect(inspectForm(form, { includeValues: true }).values).toEqual({
      email: 'a@b.co',
      password: 'secret',
    });
  });
});

describe('inspectContext', () => {
  it('reports description and provider presence without dumping the value', () => {
    let active = false;
    const ctx = {
      id: Symbol('app.theme'),
      hasProvider: () => active,
    };
    expect(inspectContext(ctx).description).toBe('app.theme');
    expect(inspectContext(ctx).hasProvider).toBe(false);
    active = true;
    expect(inspectContext(ctx).hasProvider).toBe(true);
  });
});

describe('inspectI18n', () => {
  it('reports locale/locales and probes for missing keys', () => {
    const i18n = {
      locale: signal('en'),
      locales: ['en', 'fr'] as const,
      has: (key: string) => key === 'title',
    };
    const snap = inspectI18n(i18n, { checkKeys: ['title', 'subtitle'] });
    expect(snap.locale).toBe('en');
    expect(snap.locales).toEqual(['en', 'fr']);
    expect(snap.missingKeys).toEqual(['subtitle']);
  });
});
