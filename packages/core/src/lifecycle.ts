/**
 * Application and component lifecycle primitives.
 *
 * Lifecycle phases:
 *   created → mounted → active ⇄ updating → unmounting → destroyed
 */

export type LifecyclePhase =
  | 'created'
  | 'mounted'
  | 'active'
  | 'updating'
  | 'unmounting'
  | 'destroyed';

export type LifecycleHook = () => void | Promise<void>;

export class Lifecycle {
  private _phase: LifecyclePhase = 'created';
  private readonly _hooks: Map<LifecyclePhase, LifecycleHook[]> = new Map();

  get phase(): LifecyclePhase {
    return this._phase;
  }

  get isMounted(): boolean {
    return this._phase === 'mounted' || this._phase === 'active' || this._phase === 'updating';
  }

  get isDestroyed(): boolean {
    return this._phase === 'destroyed';
  }

  on(phase: LifecyclePhase, hook: LifecycleHook): () => void {
    const hooks = this._hooks.get(phase) ?? [];
    hooks.push(hook);
    this._hooks.set(phase, hooks);
    return () => {
      const current = this._hooks.get(phase);
      if (current !== undefined) {
        const idx = current.indexOf(hook);
        if (idx !== -1) current.splice(idx, 1);
      }
    };
  }

  async transition(to: LifecyclePhase): Promise<void> {
    this._phase = to;
    const hooks = this._hooks.get(to) ?? [];
    for (const hook of hooks) {
      await hook();
    }
  }

  onMount(hook: LifecycleHook): () => void {
    return this.on('mounted', hook);
  }

  onUnmount(hook: LifecycleHook): () => void {
    return this.on('unmounting', hook);
  }

  onDestroy(hook: LifecycleHook): () => void {
    return this.on('destroyed', hook);
  }
}

/** A simple cleanup registry — collect teardown functions and run them all at once. */
export class CleanupRegistry {
  private readonly _fns: Array<() => void> = [];

  add(fn: () => void): void {
    this._fns.push(fn);
  }

  run(): void {
    for (const fn of this._fns) {
      try {
        fn();
      } catch {
        // Best-effort cleanup; don't let one failure block others
      }
    }
    this._fns.length = 0;
  }
}
