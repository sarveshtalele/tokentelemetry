import { useEffect, useRef, useState } from 'react';

interface State<T> {
  data: T | undefined;
  loading: boolean;
  error: Error | null;
}

export function useApi<T>(fetcher: () => Promise<{ data: T }>, deps: unknown[] = []): State<T> & { reload: () => void } {
  const [state, setState] = useState<State<T>>({ data: undefined, loading: true, error: null });
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    fetcherRef
      .current()
      .then((res) => {
        if (!cancelled) setState({ data: res.data, loading: false, error: null });
      })
      .catch((err) => {
        if (!cancelled) setState({ data: undefined, loading: false, error: err instanceof Error ? err : new Error(String(err)) });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  return { ...state, reload: () => setTick((t) => t + 1) };
}
