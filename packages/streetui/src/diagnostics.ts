/**
 * `streetui/diagnostics` — opt-in compiler diagnostics.
 *
 * Static-graph analysis + inspection, re-exported from
 * `@streetui/compiler/diagnostics` so they stay OUT of the runtime barrel
 * (`streetui`) and only load when a consumer asks for them.
 *
 * ```ts
 * import { streetui, compile } from 'streetui';
 * import { inspectCompilation, formatInspection } from 'streetui/diagnostics';
 *
 * const app = streetui.app({ name: 'diagnostics-example' });
 * app.page('home', (page) => page.heading('Diagnostics'));
 * const { graph } = compile(app);
 * console.log(formatInspection(inspectCompilation(graph)));
 * ```
 */
export * from '@streetui/compiler/diagnostics';
