/**
 * Environment detection and capability flags.
 * The framework behaves slightly differently in browser vs. server vs. test.
 *
 * We use `typeof` checks throughout to remain safe across environments
 * without depending on @types/node.
 */

export type EnvironmentKind = 'browser' | 'server' | 'worker' | 'test' | 'unknown';

export interface EnvironmentCapabilities {
  readonly hasDom: boolean;
  readonly hasWindow: boolean;
  readonly hasDocument: boolean;
  readonly isSecureContext: boolean;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
declare const process: any;
/* eslint-enable @typescript-eslint/no-explicit-any */

function detectEnvironment(): EnvironmentKind {
  // Explicit test override via process.env
  try {
    if (
      typeof process !== 'undefined' &&
      process !== null &&
      typeof process === 'object' &&
      (process.env?.['NODE_ENV'] === 'test' || process.env?.['VITEST'] === 'true')
    ) {
      return 'test';
    }
  } catch {
    // process may not be defined in all environments
  }

  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    return 'browser';
  }

  if (
    typeof self !== 'undefined' &&
    typeof (self as unknown as Record<string, unknown>)['importScripts'] === 'function'
  ) {
    return 'worker';
  }

  try {
    if (typeof process !== 'undefined' && typeof process === 'object') {
      return 'server';
    }
  } catch {
    // ignore
  }

  return 'unknown';
}

function detectCapabilities(): EnvironmentCapabilities {
  return {
    hasDom: typeof document !== 'undefined',
    hasWindow: typeof window !== 'undefined',
    hasDocument: typeof document !== 'undefined',
    isSecureContext:
      typeof window !== 'undefined'
        ? ((window as unknown as Record<string, unknown>)['isSecureContext'] === true)
        : false,
  };
}

export class Environment {
  readonly kind: EnvironmentKind;
  readonly capabilities: EnvironmentCapabilities;

  constructor(kind?: EnvironmentKind) {
    this.kind = kind ?? detectEnvironment();
    this.capabilities = detectCapabilities();
  }

  get isBrowser(): boolean {
    return this.kind === 'browser';
  }

  get isServer(): boolean {
    return this.kind === 'server';
  }

  get isTest(): boolean {
    return this.kind === 'test';
  }

  get isWorker(): boolean {
    return this.kind === 'worker';
  }
}

/** The singleton environment for this execution context. */
export const environment = new Environment();
