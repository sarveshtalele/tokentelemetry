import { useEffect } from 'react';

export function useAutoRefresh(callback: () => void, intervalMs = 10000) {
  useEffect(() => {
    const id = setInterval(callback, intervalMs);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs]);
}
