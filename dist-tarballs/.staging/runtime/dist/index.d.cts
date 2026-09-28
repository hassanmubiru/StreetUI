import { CleanupRegistry } from '@streetui/core';
import { GraphNode } from '@streetui/graph';
import { Signal, ReadonlySignal } from '@streetui/state';
import { CompiledApplication } from '@streetui/compiler';
import { Scheduler } from '@streetui/scheduler';

/**
 * RuntimeNodeInstance — the runtime's live representation of a GraphNode.
 *
 * Each GraphNode in the compiled application gets a corresponding
 * RuntimeNodeInstance during mounting. The instance owns:
 *  - the DOM node(s) produced for this graph node
 *  - all signal subscriptions that drive updates
 *  - all DOM event listeners
 *  - child instances
 */

interface NodeInstanceOptions {
    readonly graphNode: GraphNode;
    readonly domNode: Node;
}
declare class RuntimeNodeInstance {
    readonly graphNode: GraphNode;
    domNode: Node;
    readonly children: RuntimeNodeInstance[];
    readonly cleanup: CleanupRegistry;
    private _mounted;
    constructor(options: NodeInstanceOptions);
    get isMounted(): boolean;
    mount(): void;
    unmount(): void;
    addChild(instance: RuntimeNodeInstance): void;
    /** Subscribe to a signal and register the unsubscribe for cleanup. */
    trackSignal<T>(signal: Signal<T> | ReadonlySignal<T>, handler: (value: T) => void): void;
    /** Register an arbitrary cleanup function (e.g. DOM event removal). */
    trackCleanup(fn: () => void): void;
}

/**
 * The interface the runtime uses to communicate with the renderer.
 *
 * The runtime never knows how DOM nodes are created — it delegates to this
 * interface. This keeps the runtime/renderer boundary clean.
 */

interface RenderHandle {
    /** Force a synchronous flush of pending updates. */
    flush(): void;
    /** Unmount and dispose all resources. */
    unmount(): void;
}
interface StreetRenderer {
    mount(application: CompiledApplication, container: Element): RenderHandle;
    /**
     * Optional: attach behavior to server-rendered HTML already present in
     * `container` instead of recreating it. Renderers that cannot hydrate may
     * omit this; callers fall back to `mount`.
     */
    hydrate?(application: CompiledApplication, container: Element): RenderHandle;
}

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

interface RuntimeOptions {
    readonly renderer: StreetRenderer;
    readonly scheduler?: Scheduler;
}
interface MountedApplication {
    readonly renderHandle: RenderHandle;
    readonly runtime: Runtime;
    unmount(): void;
    flush(): void;
}
declare class Runtime {
    private readonly _renderer;
    private readonly _scheduler;
    private readonly _cleanup;
    private _renderHandle;
    private _mounted;
    constructor(options: RuntimeOptions);
    get isMounted(): boolean;
    /**
     * Mount the compiled application into the given DOM container.
     */
    mount(compiled: CompiledApplication, container: Element): MountedApplication;
    unmount(): void;
    /**
     * Hydrate a container that already holds server-rendered HTML for this
     * application. Delegates to the renderer's `hydrate` (adopting the existing
     * DOM instead of recreating it) and falls back to `mount` for renderers that
     * cannot hydrate. Signal binding is identical to `mount`, so the live client
     * lifecycle is established the same way.
     */
    hydrate(compiled: CompiledApplication, container: Element): MountedApplication;
    /**
     * Walk the graph and subscribe to all signal-bound nodes.
     * When a signal changes, schedule a renderer update for that node.
     */
    private _bindSignals;
}
/**
 * Convenience factory — create a runtime, mount, and return the handle.
 */
declare function createRuntime(options: RuntimeOptions): Runtime;

export { type MountedApplication, type NodeInstanceOptions, type RenderHandle, Runtime, RuntimeNodeInstance, type RuntimeOptions, type StreetRenderer, createRuntime };
