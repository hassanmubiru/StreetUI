/**
 * StreetUI Renderer — framework-owned DOM renderer.
 *
 * No React. No Vue. No virtual-dom. No external rendering library.
 *
 * Pipeline:
 *   CompiledApplication
 *     → mountGraph (creates all DOM nodes)
 *     → signal subscriptions drive patchNode (targeted updates)
 *     → flush() propagates any pending scheduler jobs
 *     → unmount() disposes everything
 */

import type { DOMAdapter } from '@streetui/dom';
import { BrowserDOMAdapter } from '@streetui/dom';
import type { CompiledApplication } from '@streetui/compiler';
import type { StreetRenderer, RenderHandle } from '@streetui/runtime';
import { createRenderContext } from './render-context.js';
import { mountGraph } from './mount.js';
import { hydrateGraph } from './hydrate.js';
import { StreetRenderHandle } from './render-handle.js';
import type { NodeInstance } from './node-instance.js';
import type { HydrationDiagnosticSink } from './hydration-diagnostics.js';

export interface StreetRendererOptions {
  /** Override the DOM adapter (e.g. for testing). Defaults to BrowserDOMAdapter. */
  readonly domAdapter?: DOMAdapter;
  /**
   * Optional dev-only sink that observes hydration mismatch repairs. Attach one
   * to surface server/client divergences during development; leave it unset in
   * production so hydration does no extra work.
   */
  readonly hydrationDiagnostics?: HydrationDiagnosticSink;
}

export class StreetRendererImpl implements StreetRenderer {
  private readonly _dom: DOMAdapter;
  private readonly _hydrationDiagnostics?: HydrationDiagnosticSink;

  constructor(options: StreetRendererOptions = {}) {
    this._dom = options.domAdapter ?? new BrowserDOMAdapter();
    if (options.hydrationDiagnostics !== undefined) {
      this._hydrationDiagnostics = options.hydrationDiagnostics;
    }
  }

  mount(compiled: CompiledApplication, container: Element): RenderHandle {
    const ctx = createRenderContext(this._dom, compiled.graph, container);

    // Initial mount — creates the full DOM tree
    const rootInstance = mountGraph(ctx);

    // Wire all signal subscriptions so that signal → DOM patches happen automatically
    this._wireSignals(ctx, rootInstance);

    return new StreetRenderHandle(ctx, rootInstance);
  }

  /**
   * Hydrate a container that already holds server-rendered HTML for this
   * application. Instead of recreating the DOM, it walks the semantic graph
   * against the existing nodes, adopting matching elements and attaching
   * behavior (events + signal subscriptions). Mismatched subtrees are locally
   * replaced. Returns the same handle type as `mount`.
   */
  hydrate(compiled: CompiledApplication, container: Element): RenderHandle {
    const ctx = createRenderContext(
      this._dom,
      compiled.graph,
      container,
      this._hydrationDiagnostics,
    );
    const rootInstance = hydrateGraph(ctx);
    this._wireSignals(ctx, rootInstance);
    return new StreetRenderHandle(ctx, rootInstance);
  }

  private _wireSignals(
    ctx: ReturnType<typeof createRenderContext>,
    rootInstance: NodeInstance,
  ): void {
    // Each NodeInstance already wired its own signals in mountNode via wireSignalBindings.
    // This method is a hook for any cross-cutting signal concerns at the renderer level.
    // Currently no-op — individual mount calls handle their own subscriptions.
    void ctx;
    void rootInstance;
  }
}

/**
 * Create the default StreetUI renderer using the browser's DOM APIs.
 */
export function createRenderer(options?: StreetRendererOptions): StreetRendererImpl {
  return new StreetRendererImpl(options);
}
