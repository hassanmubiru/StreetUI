/**
 * StreetUI HMR protocol (version 1).
 *
 * These messages travel over the dev server's own WebSocket. The browser
 * client applies the guarantees documented in `docs/toolchain/architecture.md`:
 * CSS updates in place, accepted modules re-run their accept callback, and
 * everything else falls back to a verified full reload.
 */

import type { BuildProblem } from '../../diagnostics.js';

export const HMR_PROTOCOL_VERSION = 1 as const;
export const HMR_PATH = '/__streetui_hmr';
export const HMR_CLIENT_PATH = '/@streetui/client/hmr.js';
export const HMR_RUNTIME_PATH = '/@streetui/client/hmr-runtime.js';

export interface HmrUpdate {
  /** Module id (absolute source path). */
  readonly id: string;
  /** Fresh URL including a cache-busting query. */
  readonly url: string;
  /** True when the module registered an accept callback (or is CSS). */
  readonly accepted: boolean;
  readonly kind: 'js' | 'css';
}

export type HmrServerMessage =
  | { readonly type: 'connected'; readonly protocol: number }
  | { readonly type: 'update'; readonly updates: readonly HmrUpdate[] }
  | { readonly type: 'reload'; readonly reason: string }
  | { readonly type: 'error'; readonly diagnostics: readonly BuildProblem[]; readonly fatal: boolean }
  | { readonly type: 'runtime-error'; readonly message: string; readonly stack?: string }
  | { readonly type: 'ping' };

export type HmrClientMessage =
  | { readonly type: 'connected' }
  | { readonly type: 'runtime-error'; readonly message: string; readonly stack?: string }
  | { readonly type: 'pong' }
  | { readonly type: 'log'; readonly level: 'info' | 'warn' | 'error'; readonly message: string }
  | { readonly type: 'hmr_applied'; readonly updateId: string; readonly ok: true }
  | { readonly type: 'hmr_failed'; readonly updateId: string; readonly ok: false; readonly error: string };

export function isHmrClientMessage(value: unknown): value is HmrClientMessage {
  return typeof value === 'object' && value !== null && typeof (value as { type?: unknown }).type === 'string';
}

/** Narrow unknown JSON to a server message shape without trusting it. */
export function parseServerMessage(text: string): HmrServerMessage | undefined {
  try {
    const parsed = JSON.parse(text) as { type?: unknown };
    if (typeof parsed.type !== 'string') return undefined;
    return parsed as HmrServerMessage;
  } catch {
    return undefined;
  }
}