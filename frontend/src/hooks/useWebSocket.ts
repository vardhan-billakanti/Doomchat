import { useCallback, useEffect, useRef, useState } from 'react';
import type { ClientEvent, ConnectionState, ServerEvent } from '../types';
import { wsUrl } from '../lib/api';

// ─────────────────────────────────────────────────────────────────────────────
// WebSocket connection hook with exponential backoff reconnection
// ─────────────────────────────────────────────────────────────────────────────

interface UseWebSocketOptions {
  url: string | null;
  onMessage: (event: ServerEvent) => void;
  onConnect?: (send: (event: ClientEvent) => void) => void;
  onDisconnect?: () => void;
  enabled?: boolean;
}

interface UseWebSocketReturn {
  connectionState: ConnectionState;
  send: (event: ClientEvent) => void;
  disconnect: () => void;
}

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 16000;
const PING_INTERVAL_MS = 25000;

function getBackoffDelay(attempt: number): number {
  const delay = BASE_DELAY_MS * Math.pow(2, attempt);
  return Math.min(delay, MAX_DELAY_MS) + Math.random() * 500;
}

// URL construction is handled by lib/api.ts → wsUrl()

export function useWebSocket({
  url,
  onMessage,
  onConnect,
  onDisconnect,
  enabled = true,
}: UseWebSocketOptions): UseWebSocketReturn {
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting');
  const wsRef = useRef<WebSocket | null>(null);
  const retriesRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const intentionalCloseRef = useRef(false);
  const onMessageRef = useRef(onMessage);
  const onConnectRef = useRef(onConnect);
  const onDisconnectRef = useRef(onDisconnect);

  // Keep callbacks fresh without re-running the effect
  useEffect(() => { onMessageRef.current = onMessage; }, [onMessage]);
  useEffect(() => { onConnectRef.current = onConnect; }, [onConnect]);
  useEffect(() => { onDisconnectRef.current = onDisconnect; }, [onDisconnect]);

  const clearPingInterval = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
  }, []);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const connect = useCallback((path: string) => {
    if (intentionalCloseRef.current) return;

    // Prevent duplicate connections if current socket is open or in flight
    if (
      wsRef.current &&
      (wsRef.current.readyState === WebSocket.OPEN ||
        wsRef.current.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    // Clean up any lingering socket
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {
        // ignore
      }
      wsRef.current = null;
    }

    setConnectionState(retriesRef.current === 0 ? 'connecting' : 'reconnecting');

    try {
      const fullUrl = wsUrl(path);
      const ws = new WebSocket(fullUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        retriesRef.current = 0;
        setConnectionState('connected');
        const sendFn = (event: ClientEvent) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(event));
          }
        };
        onConnectRef.current?.(sendFn);

        // Start ping interval to keep connection alive
        clearPingInterval();
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, PING_INTERVAL_MS);
      };

      ws.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data as string) as ServerEvent;
          onMessageRef.current(event);
        } catch {
          console.warn('[WS] Failed to parse message:', e.data);
        }
      };

      ws.onclose = (e) => {
        clearPingInterval();
        wsRef.current = null;

        if (intentionalCloseRef.current) {
          setConnectionState('disconnected');
          onDisconnectRef.current?.();
          return;
        }

        // Don't reconnect on clean server-side close with specific codes
        if (e.code === 1008 || e.code === 410) {
          setConnectionState('disconnected');
          onDisconnectRef.current?.();
          return;
        }

        if (retriesRef.current < MAX_RETRIES) {
          const delay = getBackoffDelay(retriesRef.current);
          retriesRef.current++;
          setConnectionState('reconnecting');
          reconnectTimerRef.current = setTimeout(() => {
            connect(path);
          }, delay);
        } else {
          setConnectionState('disconnected');
          onDisconnectRef.current?.();
        }
      };

      ws.onerror = () => {
        // onerror is followed by onclose
      };
    } catch {
      setConnectionState('disconnected');
    }
  }, [clearPingInterval]);

  // Main connection effect
  useEffect(() => {
    if (!url || !enabled) return;

    intentionalCloseRef.current = false;
    retriesRef.current = 0;
    connect(url);

    // Mobile backgrounding & network change lifecycle listeners
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !intentionalCloseRef.current) {
        const state = wsRef.current?.readyState;
        if (state === WebSocket.OPEN) {
          wsRef.current?.send(JSON.stringify({ type: 'ping' }));
        } else if (state !== WebSocket.CONNECTING) {
          clearReconnectTimer();
          retriesRef.current = 0;
          connect(url);
        }
      }
    };

    const handlePageShow = (e: PageTransitionEvent) => {
      if ((e.persisted || !wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) && !intentionalCloseRef.current) {
        clearReconnectTimer();
        retriesRef.current = 0;
        connect(url);
      }
    };

    const handleOnline = () => {
      if (!intentionalCloseRef.current) {
        clearReconnectTimer();
        retriesRef.current = 0;
        connect(url);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pageshow', handlePageShow);
    window.addEventListener('online', handleOnline);

    return () => {
      intentionalCloseRef.current = true;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pageshow', handlePageShow);
      window.removeEventListener('online', handleOnline);
      clearReconnectTimer();
      clearPingInterval();
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmounted');
        wsRef.current = null;
      }
    };
  }, [url, enabled, connect, clearReconnectTimer, clearPingInterval]);

  const send = useCallback((event: ClientEvent) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(event));
    } else {
      console.warn('[WS] Cannot send, not connected:', connectionState);
    }
  }, [connectionState]);

  const disconnect = useCallback(() => {
    intentionalCloseRef.current = true;
    clearReconnectTimer();
    clearPingInterval();
    if (wsRef.current) {
      wsRef.current.close(1000, 'User disconnected');
      wsRef.current = null;
    }
    setConnectionState('disconnected');
  }, [clearReconnectTimer, clearPingInterval]);

  return { connectionState, send, disconnect };
}
