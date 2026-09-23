/**
 * The interface the runtime uses to communicate with the renderer.
 *
 * The runtime never knows how DOM nodes are created — it delegates to this
 * interface. This keeps the runtime/renderer boundary clean.
 */

import type { CompiledApplication } from '@streetui/compiler';

export interface RenderHandle {
  /** Force a synchronous flush of pending updates. */
  flush(): void;
  /** Unmount and dispose all resources. */
  unmount(): void;
}

export interface StreetRenderer {
  mount(application: CompiledApplication, container: Element): RenderHandle;
}
