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
import type { NodeInstance } from './node-instance.js';

export interface StreetRendererOptions {
  /** Override the DOM adapter (e.g. for testing). Defaults to BrowserDOMAdapter. */
  readonly domAdapter?: DOMAdapter;
}

export class StreetRendererImpl implements StreetRenderer {
  private readonly _dom: DOMAdapter;

  constructor(options: StreetRendererOptions = {}) {
    this._dom = options.domAdapter ?? new BrowserDOMAdapter();
  }

  mount(compiled: CompiledApplication, container: Element): RenderHandle {
    const ctx = createRenderContext(this._dom, compiled.graph, container);

    // Initial mount — creates the full DOM tree
    const rootInstance = mountGraph(ctx);

    // Wire all signal subscriptions so that signal → DOM patches happen automatically
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

class StreetRenderHandle implements RenderHandle {
  private _disposed = false;
  private readonly _ctx: ReturnType<typeof createRenderContext>;
  private readonly _rootInstance: NodeInstance;

  constructor(
    ctx: ReturnType<typeof createRenderContext>,
    rootInstance: NodeInstance,
  ) {
    this._ctx = ctx;
    this._rootInstance = rootInstance;
  }

  flush(): void {
    if (this._disposed) return;
    // Signal subscriptions fire synchronously in StreetUI's state system;
    // flush() is a no-op at the renderer level — DOM is already up to date
    // unless the scheduler is batching. The scheduler calls flush() after
    // draining its queue.
  }

  unmount(): void {
    if (this._disposed) return;
    this._disposed = true;

    // Dispose all node instances (removes event listeners, signal subscriptions)
    this._rootInstance.dispose();

    // Remove all renderer-created children from the container
    const container = this._ctx.container;
    while (container.firstChild !== null) {
      container.removeChild(container.firstChild);
    }

    this._ctx.instances.clear();
  }
}

/**
 * Create the default StreetUI renderer using the browser's DOM APIs.
 */
export function createRenderer(options?: StreetRendererOptions): StreetRendererImpl {
  return new StreetRendererImpl(options);
}
