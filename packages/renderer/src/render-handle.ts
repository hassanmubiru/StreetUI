/**
 * StreetRenderHandle — the live handle returned by both `mount` and `hydrate`.
 *
 * Owns teardown for a mounted/hydrated application: disposes every NodeInstance
 * (removing event listeners and signal subscriptions) and clears the container
 * through the DOM adapter (never raw browser globals), so the same handle works
 * for browser and — in principle — server-driven teardown.
 */

import type { RenderHandle } from '@streetui/runtime';
import type { RenderContext } from './render-context.js';
import type { NodeInstance } from './node-instance.js';

export class StreetRenderHandle implements RenderHandle {
  private _disposed = false;
  private readonly _ctx: RenderContext;
  private readonly _rootInstance: NodeInstance;

  constructor(ctx: RenderContext, rootInstance: NodeInstance) {
    this._ctx = ctx;
    this._rootInstance = rootInstance;
  }

  flush(): void {
    if (this._disposed) return;
    // Signal subscriptions fire synchronously in StreetUI's state system;
    // flush() is a no-op at the renderer level — the DOM is already up to date
    // unless the scheduler is batching, in which case the scheduler calls
    // flush() after draining its queue.
  }

  unmount(): void {
    if (this._disposed) return;
    this._disposed = true;

    // Dispose all node instances (removes event listeners, signal subscriptions).
    this._rootInstance.dispose();

    // Remove all children from the container. Routed through the DOM adapter
    // (never `container.firstChild`/`removeChild`) so the teardown path is
    // server-safe.
    const dom = this._ctx.dom;
    const container = this._ctx.container;
    for (const child of dom.childNodes(container)) {
      dom.removeChild(container, child);
    }

    this._ctx.instances.clear();
  }
}
