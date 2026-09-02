import { useEffect, useRef, useState } from 'react';
import type { LiveUpdate } from '../types';

export function useLiveData() {
  const [metrics, setMetrics] = useState<Record<string, number>>({});
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let closedByUs = false;
    let retryTimer: ReturnType<typeof setTimeout>;

    function connect() {
      const host = window.location.hostname === 'localhost' ? '127.0.0.1' : window.location.hostname;
      const ws = new WebSocket(`ws://${host}:8000/ws/live`);
      ws.onmessage = (e) => {
        try {
          const p: LiveUpdate = JSON.parse(e.data);
          setMetrics((m) => ({ ...m, ...p.data }));
        } catch {
          /* ignore malformed payload */
        }
      };
      ws.onclose = () => {
        if (!closedByUs) retryTimer = setTimeout(connect, 5000);
      };
      wsRef.current = ws;
    }
    connect();
    return () => {
      closedByUs = true;
      clearTimeout(retryTimer);
      wsRef.current?.close();
    };
  }, []);

  return metrics;
}
