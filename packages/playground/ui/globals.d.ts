/**
 * Scoped ambient declarations for the Playground UI bundle.
 *
 * Several core StreetUI packages do not yet emit `.d.ts`; the playground is not
 * the place to fix the framework's declaration coverage. These loose ambient
 * declarations let the UI bundle typecheck while using the real runtime
 * modules. They are compile-time only and have no runtime effect.
 */

declare module '@streetui/state' {
  export type Subscriber<T> = (value: T) => void;
  export interface Signal<T> {
    get(): T;
    set(value: T): void;
    update(fn: (v: T) => T): void;
    subscribe(fn: Subscriber<T>): () => void;
    peek(): T;
  }
  export function signal<T>(value: T): Signal<T>;
  export function derived<T>(fn: () => T): Signal<T>;
  export function batch<T>(fn: () => T): T;
  export type ReadonlySignal<T> = Signal<T>;
  export type Unsubscribe = () => void;
}

declare module '@streetui/dsl' {
  export interface PageDSL {
    heading(text: unknown, opts?: Record<string, unknown>): void;
    text(text: unknown, opts?: Record<string, unknown>): void;
    button(text: string, opts?: Record<string, unknown>): void;
    input(opts?: Record<string, unknown>): void;
    container(id: string, fn: (c: unknown) => void, opts?: Record<string, unknown>): void;
    section(id: string, fn: (s: PageDSL) => void, opts?: Record<string, unknown>): void;
    list(id: string, fn: (l: { item: (t: string, f: (i: unknown) => void) => void }) => void, opts?: Record<string, unknown>): void;
    form(id: string, fn: (f: unknown) => void, opts?: Record<string, unknown>): void;
    when(cond: unknown, fn: (s: PageDSL) => void): void;
  }
  export const streetui: {
    app(opts: { name: string; version?: string }): {
      page(name: string, fn: (page: PageDSL) => void): void;
      name: string;
      version: string;
    };
  };
}

declare module '@streetui/compiler' {
  export function compile(app: unknown): { graph: unknown; name: string; version: string };
}

declare module '@streetui/runtime' {
  export function createRuntime(opts: { renderer: unknown }): { mount(compiled: unknown, container: Element): unknown };
}

declare module '@streetui/renderer' {
  export function createRenderer(opts?: unknown): unknown;
}
