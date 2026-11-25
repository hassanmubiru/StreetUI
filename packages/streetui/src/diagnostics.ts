/**
 * `streetui/diagnostics` — opt-in compiler diagnostics.
 *
 * Static-graph analysis + inspection, re-exported from
 * `@streetui/compiler/diagnostics` so they stay OUT of the runtime barrel
 * (`streetui`) and only load when a consumer asks for them.
 *
 * ```ts
 * import { inspectApplication, formatDiagnostic } from 'streetui/diagnostics';
 * ```
 */
export * from '@streetui/compiler/diagnostics';
