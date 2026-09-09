import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { LiveUpdate } from '../types';

interface LiveState {
  metrics: Record<string, number>;
  connected: boolean;
  /** Increments every time a live update is received -- pass into a useApi
   * deps array to auto-refetch that page's data when the backend reports
   * new numbers, instead of requiring a manual Refresh click. */
  version: number;
}

const LiveContext = createContext<LiveState>({ metrics: {}, connected: false, version: 0 });

export function LiveProvider({ children }: { children: ReactNode }) {
  const [metrics, setMetrics] = useState<Record<string, number>>({});
  const [connected, setConnected] = useState(false);
  const [version, setVersion] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let closedByUs = false;
    let retryTimer: ReturnType<typeof setTimeout>;

    function connect() {
      const host = window.location.hostname === 'localhost' ? '127.0.0.1' : window.location.hostname;
      const ws = new WebSocket(`ws://${host}:8000/ws/live`);
      ws.onopen = () => setConnected(true);
      ws.onmessage = (e) => {
        try {
          const p: LiveUpdate = JSON.parse(e.data);
          setMetrics((m) => ({ ...m, ...p.data }));
          setVersion((v) => v + 1);
        } catch {
          /* ignore malformed payload */
        }
      };
      ws.onclose = () => {
        setConnected(false);
        if (!closedByUs) retryTimer = setTimeout(connect, 5000);
      };
      ws.onerror = () => ws.close();
      wsRef.current = ws;
    }
    connect();
    return () => {
      closedByUs = true;
      clearTimeout(retryTimer);
      wsRef.current?.close();
    };
  }, []);

  return <LiveContext.Provider value={{ metrics, connected, version }}>{children}</LiveContext.Provider>;
}

export function useLive() {
  return useContext(LiveContext);
}
