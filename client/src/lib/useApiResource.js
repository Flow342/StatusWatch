import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Loads data from the API and re-fetches on an interval so the dashboard stays live.
 *
 * `loader` receives an AbortSignal and must be stable (wrap it in useCallback).
 * Refreshes after the first load do not flip `loading`, so the UI never blanks out
 * while polling — errors from a background refresh surface without dropping the data
 * already on screen.
 */
export function useApiResource(loader, { intervalMs = 0, enabled = true } = {}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(enabled);
  const loadedOnce = useRef(false);

  const load = useCallback(
    async (signal) => {
      try {
        const result = await loader(signal);
        if (signal?.aborted) return;
        setData(result);
        setError(null);
      } catch (err) {
        if (err.name === 'AbortError' || signal?.aborted) return;
        setError(err);
      } finally {
        if (!signal?.aborted) {
          loadedOnce.current = true;
          setLoading(false);
        }
      }
    },
    [loader],
  );

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return undefined;
    }

    const controller = new AbortController();
    if (!loadedOnce.current) setLoading(true);
    load(controller.signal);

    if (!intervalMs) return () => controller.abort();

    const timer = setInterval(() => load(controller.signal), intervalMs);
    return () => {
      clearInterval(timer);
      controller.abort();
    };
  }, [load, intervalMs, enabled]);

  const refresh = useCallback(() => load(), [load]);

  return { data, error, loading, refresh, setData };
}

export default useApiResource;
