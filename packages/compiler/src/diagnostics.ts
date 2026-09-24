/**
 * `@streetui/compiler/diagnostics` — opt-in, build/dev-time compiler diagnostics.
 *
 * The static-graph analysis (`analyzeGraph`) and the human/machine-readable
 * compiler-inspection report (`inspectCompilation` / `formatInspection`) live on
 * this dedicated subpath — deliberately NOT re-exported from the compiler's main
 * barrel — so they never enter the runtime bundle (`streetui`'s `dist/index.js`).
 * They are reached only via the diagnostic subpath (`streetui/testing`), keeping
 * the shipped runtime lean (spec §6/§7/§14).
 */
export * from './analysis/analyze.js';
export * from './analysis/inspect.js';
