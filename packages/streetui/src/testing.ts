/**
 * `streetui/testing` — testing utilities for StreetUI applications.
 *
 * A curated entry for the already-implemented testing helpers (render,
 * findByRole, waitFor, renderServerThenHydrate, …). It lives on its own subpath
 * so that test-only helpers stay out of the main runtime barrel — and so the
 * one cross-package name collision (`RenderResult`, shared with the CLI's render
 * types) is resolved cleanly: the testing `RenderResult` is reachable only from
 * here.
 *
 * ```ts
 * import { render, findByRole, waitFor } from 'streetui/testing';
 * ```
 */
export * from '@streetui/testing';

// Opt-in compiler diagnostics (spec §14): static-graph analysis + inspection.
// Exposed on the diagnostic subpath so they stay OUT of the runtime barrel
// (`streetui`), keeping the shipped client bundle lean (§6/§7).
export * from '@streetui/compiler/diagnostics';

// Re-export the framework version for parity with the main entry.
export { VERSION } from './version.js';
