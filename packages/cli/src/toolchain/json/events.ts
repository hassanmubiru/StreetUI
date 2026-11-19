/**
 * Stable machine-readable event stream for AI coding agents.
 *
 * `--json` writes one JSON object per line (JSONL) to stdout. Human-readable
 * logs are suppressed or redirected to stderr by the CLI. `schemaVersion` is
 * always present so consumers can reject incompatible streams.
 *
 * Every event carries `schemaVersion`, `eventId`, `sessionId`, `framework`,
 * and `timestamp`. `eventId` is a unique identifier for the event; `sessionId`
 * identifies the agent session the event belongs to.
 */

import { randomUUID } from 'node:crypto';

export const STREETUI_EVENT_SCHEMA_VERSION = 1 as const;

export function makeEventId(): string {
  return randomUUID();
}

export interface EventBase {
  readonly schemaVersion: typeof STREETUI_EVENT_SCHEMA_VERSION;
  readonly eventId: string;
  readonly sessionId: string;
  readonly framework: 'streetui';
  readonly timestamp: string;
}

export interface ProjectDetectedEvent extends EventBase {
  readonly event: 'project_detected';
  readonly root: string;
  readonly version: string;
  readonly template?: string;
}

export interface EnvironmentCheckedEvent extends EventBase {
  readonly event: 'environment_checked';
  readonly ok: boolean;
  readonly checks: ReadonlyArray<{ name: string; ok: boolean; detail: string }>;
}

export interface CompilationStartedEvent extends EventBase {
  readonly event: 'compilation_started';
  readonly mode: 'development' | 'production';
}

export interface CompilationCompletedEvent extends EventBase {
  readonly event: 'compilation_completed';
  readonly mode: 'development' | 'production';
  readonly modules: number;
  readonly durationMs: number;
}

export interface ServerStartedEvent extends EventBase {
  readonly event: 'server_started';
  readonly url: string;
  readonly port: number;
  readonly host: string;
  /** Installed framework/CLI version. */
  readonly version?: string | undefined;
}

export interface PreviewReadyEvent extends EventBase {
  readonly event: 'preview_ready';
  readonly url: string;
  readonly port: number;
  readonly status: 'ready';
  /** Installed framework/CLI version. */
  readonly version?: string | undefined;
}

export interface FileChangedEvent extends EventBase {
  readonly event: 'file_changed';
  readonly file: string;
}

export interface ModuleUpdatedEvent extends EventBase {
  readonly event: 'module_updated';
  readonly id: string;
  readonly url: string;
  readonly accepted: boolean;
}

export interface RuntimeErrorEvent extends EventBase {
  readonly event: 'runtime_error';
  readonly message: string;
  readonly stack?: string;
}

export interface BuildStartedEvent extends EventBase {
  readonly event: 'build_started';
}

export interface PlaygroundStartedEvent extends EventBase {
  readonly event: 'playground_started';
  readonly url: string;
  readonly port: number;
  readonly host: string;
}

export interface SessionAttachedEvent extends EventBase {
  readonly event: 'session_attached';
  readonly url: string;
  readonly previewUrl: string;
  readonly port: number;
  readonly host: string;
  /** Bearer token for the authenticated playground control API. JSONL stdout
   * is sensitive while this event is relayed — never place this value in the
   * preview iframe or page scripts. */
  readonly token: string;
  readonly version?: string | undefined;
}

export interface BuildCompletedEvent extends EventBase {
  readonly event: 'build_completed';
  readonly outDir: string;
  readonly files: number;
  readonly durationMs: number;
}

export interface ServerStoppedEvent extends EventBase {
  readonly event: 'server_stopped';
}

export interface SessionStoppedEvent extends EventBase {
  readonly event: 'session_stopped';
  readonly reason?: string;
}

export interface SessionReadyEvent extends EventBase {
  readonly event: 'session_ready';
  readonly url: string;
  readonly port: number;
  readonly host: string;
}

export interface HmrAppliedEvent extends EventBase {
  readonly event: 'hmr_applied';
  readonly file: string;
  readonly accepted: boolean;
}

export interface HmrFailedEvent extends EventBase {
  readonly event: 'hmr_failed';
  readonly file: string;
  readonly error: string;
}

export interface DiagnosticsUpdatedEvent extends EventBase {
  readonly event: 'diagnostics_updated';
  readonly diagnostics: ReadonlyArray<DiagnosticEntry>;
}

export interface BuildFailedEvent extends EventBase {
  readonly event: 'build_failed';
  readonly error: string;
}

export interface BrowserConnectedEvent extends EventBase {
  readonly event: 'browser_connected';
  readonly url: string;
  readonly clientId?: string;
}

export interface BrowserDisconnectedEvent extends EventBase {
  readonly event: 'browser_disconnected';
  readonly url: string;
  readonly clientId?: string;
}

export interface BrowserConsoleEvent extends EventBase {
  readonly event: 'browser_console';
  readonly level: 'info' | 'warn' | 'error';
  readonly message: string;
  readonly file?: string;
  readonly line?: number;
  readonly clientId?: string;
}

export interface BrowserErrorEvent extends EventBase {
  readonly event: 'browser_error';
  readonly message: string;
  readonly stack?: string;
  readonly file?: string;
  readonly line?: number;
  readonly column?: number;
  readonly clientId?: string;
}

export interface PreviewInspectedEvent extends EventBase {
  readonly event: 'preview_inspected';
  readonly url: string;
  readonly title?: string;
  readonly route?: string;
  readonly readyState: string;
}

export interface DiagnosticEntry {
  readonly id: string;
  readonly severity: 'error' | 'warning' | 'info';
  readonly code: string;
  readonly message: string;
  readonly file?: string;
  readonly line?: number;
  readonly column?: number;
  readonly stack?: string;
  readonly suggestion?: string;
}

export type StreetUIEvent =
  | ProjectDetectedEvent
  | EnvironmentCheckedEvent
  | CompilationStartedEvent
  | CompilationCompletedEvent
  | ServerStartedEvent
  | PreviewReadyEvent
  | FileChangedEvent
  | ModuleUpdatedEvent
  | RuntimeErrorEvent
  | BuildStartedEvent
  | BuildCompletedEvent
  | BuildFailedEvent
  | PlaygroundStartedEvent
  | SessionAttachedEvent
  | SessionReadyEvent
  | HmrAppliedEvent
  | HmrFailedEvent
  | DiagnosticsUpdatedEvent
  | BrowserConnectedEvent
  | BrowserDisconnectedEvent
  | BrowserConsoleEvent
  | BrowserErrorEvent
  | PreviewInspectedEvent
  | SessionStoppedEvent
  | ServerStoppedEvent;

export type StreetUIEventType = StreetUIEvent['event'];

/** Sink used by commands to publish events. */
export interface EventLogger {
  emit(event: StreetUIEvent): void;
  /** Convenience: emit an event without the common envelope fields. */
  send(
    event: Exclude<StreetUIEventType, never>,
    payload: Record<string, unknown> & { event: StreetUIEventType },
    options?: { sessionId?: string },
  ): void;
}

export interface EventLoggerOptions {
  /** Defaults to `console.log` (stdout). */
  readonly write?: (line: string) => void;
  readonly now?: () => Date;
  /** Session ID stamped on every emitted event. */
  readonly sessionId?: string;
}

export function createEventLogger(options: EventLoggerOptions = {}): EventLogger {
  const write = options.write ?? ((line: string) => console.log(line));
  const now = options.now ?? (() => new Date());
  // A missing session id would silently break event correlation, so the
  // logger resolves a real one at the session boundary instead of using ''.
  const sessionId = options.sessionId ?? makeEventId();
  return {
    emit(event) {
      write(JSON.stringify(event));
    },
    send(event, payload, opts) {
      const { event: _ignored, ...rest } = payload;
      const full = {
        schemaVersion: STREETUI_EVENT_SCHEMA_VERSION,
        eventId: makeEventId(),
        sessionId: opts?.sessionId ?? sessionId,
        framework: 'streetui' as const,
        timestamp: now().toISOString(),
        ...rest,
        event,
      };
      write(JSON.stringify(full));
    },
  };
}

/** A logger that discards every human-readable line (used with --json). */
export const silentEventLogger: EventLogger = {
  emit() {},
  send() {},
};