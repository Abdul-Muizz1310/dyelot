// A lazy load that runs once per page: the first call starts it and every later call gets the same
// promise, except after a failure, which is forgotten so that the next call loads again (a chunk
// that did not arrive). The studio's lazy dialogs and tools share it.

/** Wraps `load` (an `import()`, for example): it runs once per page, and again after a failure. */
export function loadOnce<T>(load: () => Promise<T>): () => Promise<T> {
  let loading: Promise<T> | null = null;
  return () => {
    loading ??= load().catch((error: unknown) => {
      loading = null;
      throw error;
    });
    return loading;
  };
}
