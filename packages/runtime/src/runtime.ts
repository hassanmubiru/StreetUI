/**
 * StreetUI Runtime.
 *
 * Owns:
 *  - Signal binding — wires signal subscriptions to renderer update calls
 *  - Event dispatch — calls registered handlers from graph events
 *  - Lifecycle — orchestrates mount, update cycles, unmount
 *
 * The runtime does NOT create DOM nodes. It calls into StreetRenderer
 * for all DOM operations.
 */

import { CleanupRegistry } from '@streetui/core';
import type { GraphNode, ApplicationGraph } from '@streetui/graph';
import type { Signal, ReadonlySignal } from '@streetui/state';
import { Scheduler } from '@streetui/scheduler';
import type { CompiledApplication } from '@streetui/compiler';
import type { StreetRenderer, RenderHandle } from './renderer-interface.js';

export interface RuntimeOptions {
  readonly renderer: StreetRenderer;
  readonly scheduler?: Scheduler;
}

export interface MountedApplication {
  readonly renderHandle: RenderHandle;
  readonly runtime: Runtime;
  unmount(): void;
  flush(): void;
}

export class Runtime {
  private readonly _renderer: StreetRenderer;
  private readonly _scheduler: Scheduler;
  private readonly _cleanup: CleanupRegistry = new CleanupRegistry();
  private _renderHandle: RenderHandle | null = null;
  private _mounted = false;

  constructor(options: RuntimeOptions) {
    this._renderer = options.renderer;
    this._scheduler = options.scheduler ?? new Scheduler();
  }

  get isMounted(): boolean {
    return this._mounted;
  }

  /**
   * Mount the compiled application into the given DOM container.
   */
  mount(compiled: CompiledApplication, container: Element): MountedApplication {
    if (this._mounted) {
      throw new Error('[Runtime] Already mounted. Call unmount() first.');
    }

    // Hand off to renderer — it creates all DOM nodes
    this._renderHandle = this._renderer.mount(compiled, container);
    this._mounted = true;

    // Wire signal subscriptions from the graph
    this._bindSignals(compiled.graph);

    const self = this;
    return {
      renderHandle: this._renderHandle,
      runtime: this,
      unmount() { self.unmount(); },
      flush() { self._scheduler.flush(); },
    };
  }

  unmount(): void {
    if (!this._mounted) return;
    this._mounted = false;
    this._renderHandle?.unmount();
    this._renderHandle = null;
    this._cleanup.run();
  }

  /**
   * Walk the graph and subscribe to all signal-bound nodes.
   * When a signal changes, schedule a renderer update for that node.
   */
  private _bindSignals(graph: ApplicationGraph): void {
    graph.walk((node) => {
      for (const stateRef of node.stateRefs) {
        const signalKey = `__signal__${stateRef.signalId}`;
        const maybeSignal = graph.getHandler(signalKey) as
          | (Signal<unknown> & ReadonlySignal<unknown>)
          | undefined;

        if (maybeSignal === undefined || typeof maybeSignal.subscribe !== 'function') continue;

        const unsub = maybeSignal.subscribe(() => {
          // Schedule a re-render update keyed to this node+prop
          this._scheduler.schedule({
            key: `update:${node.id}:${stateRef.propKey}`,
            priority: 'normal',
            fn: () => {
              // The renderer handles the actual DOM update
              this._renderHandle?.flush();
            },
          });
        });
        this._cleanup.add(unsub);
      }
    });
  }
}

/**
 * Convenience factory — create a runtime, mount, and return the handle.
 */
export function createRuntime(options: RuntimeOptions): Runtime {
  return new Runtime(options);
}
