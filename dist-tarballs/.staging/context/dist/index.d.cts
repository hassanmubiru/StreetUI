/**
 * @streetui/context — build-time provider/consumer scoping.
 *
 * StreetUI builds its semantic tree synchronously, top-down, when the DSL
 * builders run. A `Context` mirrors that shape: `provide(value, run)` pushes a
 * value for the duration of the synchronous `run()` (during which the child
 * DSL builders execute and may `consume()`), then pops it. Consumers resolve
 * the *nearest* enclosing provider, falling back to the context default.
 *
 * This is deliberately NOT a second reactive system. A context value can be a
 * signal (see @streetui/state); reactivity then belongs to that signal and is
 * torn down by the normal node lifecycle when the consuming subtree unmounts —
 * the context itself holds no subscriptions and leaves no refs behind after a
 * `provide()` call returns.
 */
interface Context<T> {
    /** Unique identity for this context (useful for debugging/inspection). */
    readonly id: symbol;
    /** The value returned by {@link consume} when no provider is active. */
    readonly defaultValue: T;
    /**
     * Provide `value` to any `consume()` calls made synchronously inside `run`.
     * The value is popped again as soon as `run` returns (even if it throws),
     * so nesting resolves to the nearest active provider.
     */
    provide<R>(value: T, run: () => R): R;
    /** Read the nearest active provider's value, or {@link defaultValue}. */
    consume(): T;
    /** True while at least one provider is active for this context. */
    hasProvider(): boolean;
}
/**
 * Create a typed context with a required default value, so `consume()` always
 * returns a `T` (never `undefined` unless `T` itself permits it).
 */
declare function createContext<T>(defaultValue: T, description?: string): Context<T>;

export { type Context, createContext };
