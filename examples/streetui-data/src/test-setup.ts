/**
 * Vitest's happy-dom environment combines its DOM constructors with Node's
 * native fetch. Those APIs use different AbortSignal realms, so passing the
 * framework's cancellation signal to native fetch fails before the local HTTP
 * server is contacted. Keep the real HTTP behavior but omit only the
 * incompatible signal in this test environment.
 */
if (typeof window !== 'undefined') {
  const nativeFetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = (input, init) => {
    if (init === undefined) return nativeFetch(input);
    const { signal: _signal, ...safeInit } = init;
    return nativeFetch(input, safeInit);
  };
}
