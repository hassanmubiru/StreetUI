/**
 * Reactive-surface inspection for DevTools.
 *
 * These functions turn the framework's live objects — signals, resources,
 * router, forms, context, i18n — into plain, read-only snapshots suitable for a
 * DevTools panel. They never mutate anything and never subscribe; each call is a
 * one-shot `peek`. Sensitive-by-default surfaces (resource payloads, form field
 * values) are omitted unless the caller explicitly opts in, so a panel cannot
 * accidentally display tokens, passwords, or private data.
 *
 * Router/forms/context/i18n are described by *structural* interfaces rather than
 * imported types, so DevTools stays decoupled from those packages (no extra
 * dependencies) while still inspecting them when present.
 */

import {
  type ReadonlySignal,
  type ResourceStatus,
  type SignalKind,
  signalKind,
  observerCount,
} from '@streetui/state';

// ── Signals ─────────────────────────────────────────────────────────────────

export interface SignalInspection {
  /** Whether the signal is writable or a derived computation. */
  readonly kind: SignalKind;
  /** The current value (redacted if requested). */
  readonly value: unknown;
  /** Live observer count when the signal exposes it, else undefined. */
  readonly observerCount: number | undefined;
}

export interface InspectSignalOptions {
  /**
   * Redact the value: `true` replaces it with `'[redacted]'`; a function maps
   * the raw value to whatever should be shown. Use for signals that may hold
   * sensitive data. Omitted → the value is shown as-is.
   */
  readonly redact?: boolean | ((value: unknown) => unknown);
}

/** Snapshot a signal's kind, current value, and observer count. Read-only. */
export function inspectSignal(
  source: ReadonlySignal<unknown>,
  options: InspectSignalOptions = {},
): SignalInspection {
  const raw = source.peek();
  let value: unknown = raw;
  if (options.redact === true) value = '[redacted]';
  else if (typeof options.redact === 'function') value = options.redact(raw);

  return {
    kind: signalKind(source),
    value,
    observerCount: observerCount(source),
  };
}

// ── Resources ─────────────────────────────────────────────────────────────

/** The read-only slice of a resource this module needs. */
export interface ResourceLike {
  readonly status: ReadonlySignal<ResourceStatus>;
  readonly data: ReadonlySignal<unknown>;
  readonly error: ReadonlySignal<unknown>;
  readonly loading: ReadonlySignal<boolean>;
  readonly isRefetching: ReadonlySignal<boolean>;
}

export interface ResourceInspection {
  readonly status: ResourceStatus;
  readonly loading: boolean;
  readonly isRefetching: boolean;
  readonly hasData: boolean;
  readonly hasError: boolean;
  /** The error's constructor name (safe — no message/payload). */
  readonly errorName: string | undefined;
  /** The error message — only present when `includeData` is set. */
  readonly errorMessage?: string;
  /** The loaded value — only present when `includeData` is set. */
  readonly data?: unknown;
}

export interface InspectResourceOptions {
  /**
   * Include the loaded `data` and the error `message`. Off by default because a
   * resource payload commonly carries user or secret data.
   */
  readonly includeData?: boolean;
}

/** Snapshot a resource's lifecycle. Payload/message hidden unless opted in. */
export function inspectResource(
  resource: ResourceLike,
  options: InspectResourceOptions = {},
): ResourceInspection {
  const error = resource.error.peek();
  const hasError = error !== undefined && error !== null;
  const base: ResourceInspection = {
    status: resource.status.peek(),
    loading: resource.loading.peek(),
    isRefetching: resource.isRefetching.peek(),
    hasData: resource.data.peek() !== undefined,
    hasError,
    errorName: hasError ? errorConstructorName(error) : undefined,
  };
  if (options.includeData !== true) return base;

  return {
    ...base,
    data: resource.data.peek(),
    ...(hasError ? { errorMessage: errorMessageOf(error) } : {}),
  };
}

function errorConstructorName(error: unknown): string {
  if (error instanceof Error) return error.name;
  return typeof error;
}

function errorMessageOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

// ── Router ──────────────────────────────────────────────────────────────────

export interface RouteMatchLike {
  readonly path: string;
  readonly pattern: string;
  readonly params: Readonly<Record<string, string>>;
  readonly query: URLSearchParams;
  readonly isFallback?: boolean;
}

export interface RouterLike {
  readonly currentRoute: ReadonlySignal<RouteMatchLike>;
}

export interface RouterInspection {
  readonly path: string;
  readonly pattern: string;
  readonly params: Record<string, string>;
  readonly query: Record<string, string>;
  readonly isFallback: boolean;
}

/** Snapshot the router's current route. Read-only. */
export function inspectRouter(router: RouterLike): RouterInspection {
  const match = router.currentRoute.peek();
  const query: Record<string, string> = {};
  for (const [k, v] of match.query.entries()) query[k] = v;
  return {
    path: match.path,
    pattern: match.pattern,
    params: { ...match.params },
    query,
    isFallback: match.isFallback === true,
  };
}

// ── Forms ─────────────────────────────────────────────────────────────────

export interface FormLike {
  readonly values: ReadonlySignal<Record<string, unknown>>;
  readonly errors: ReadonlySignal<Record<string, string | undefined>>;
  readonly touched: ReadonlySignal<Record<string, boolean | undefined>>;
  readonly dirty: ReadonlySignal<boolean>;
  readonly valid: ReadonlySignal<boolean>;
  readonly status: ReadonlySignal<string>;
}

export interface FormInspection {
  readonly fields: string[];
  /** Per-field validation messages (safe — not the entered values). */
  readonly errors: Record<string, string>;
  readonly touched: Record<string, boolean>;
  readonly dirty: boolean;
  readonly valid: boolean;
  readonly status: string;
  /** Entered field values — only present when `includeValues` is set. */
  readonly values?: Record<string, unknown>;
}

export interface InspectFormOptions {
  /**
   * Include the entered field `values`. Off by default because form fields
   * frequently hold passwords or other secrets.
   */
  readonly includeValues?: boolean;
}

/** Snapshot form validation state. Entered values hidden unless opted in. */
export function inspectForm(form: FormLike, options: InspectFormOptions = {}): FormInspection {
  const values = form.values.peek();
  const errorsRaw = form.errors.peek();
  const touchedRaw = form.touched.peek();

  const errors: Record<string, string> = {};
  for (const [k, v] of Object.entries(errorsRaw)) if (v !== undefined) errors[k] = v;
  const touched: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(touchedRaw)) touched[k] = v === true;

  const base: FormInspection = {
    fields: Object.keys(values),
    errors,
    touched,
    dirty: form.dirty.peek(),
    valid: form.valid.peek(),
    status: form.status.peek(),
  };
  if (options.includeValues !== true) return base;
  return { ...base, values: { ...values } };
}

// ── Context ─────────────────────────────────────────────────────────────────

export interface ContextLike {
  readonly id: symbol;
  hasProvider(): boolean;
}

export interface ContextInspection {
  /** The context's descriptive label (from its Symbol). */
  readonly description: string;
  /** Whether a provider is currently active. */
  readonly hasProvider: boolean;
}

/** Snapshot a context's identity and provider presence. No value dumped. */
export function inspectContext(context: ContextLike): ContextInspection {
  return {
    description: context.id.description ?? 'streetui.context',
    hasProvider: context.hasProvider(),
  };
}

// ── i18n ──────────────────────────────────────────────────────────────────

export interface I18nLike {
  readonly locale: ReadonlySignal<string>;
  readonly locales: ReadonlyArray<string>;
  has(key: string): boolean;
}

export interface I18nInspection {
  readonly locale: string;
  readonly locales: string[];
  /** Of the probed keys, those with no translation in the active/fallback locale. */
  readonly missingKeys?: string[];
}

export interface InspectI18nOptions {
  /** Keys to probe for presence; any absent ones are reported as missing. */
  readonly checkKeys?: readonly string[];
}

/** Snapshot i18n locale state and (optionally) missing translation keys. */
export function inspectI18n(i18n: I18nLike, options: InspectI18nOptions = {}): I18nInspection {
  const base: I18nInspection = {
    locale: i18n.locale.peek(),
    locales: [...i18n.locales],
  };
  if (options.checkKeys === undefined) return base;
  const missingKeys = options.checkKeys.filter((k) => !i18n.has(k));
  return { ...base, missingKeys };
}
