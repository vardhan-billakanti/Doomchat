// ─────────────────────────────────────────────────────────────────────────────
// Central API & WebSocket URL configuration
//
// In development (Vite dev server / Wrangler local):
//   VITE_API_URL is undefined → relative paths → proxied to localhost:8787
//
// In production (Vercel):
//   VITE_API_URL=https://doomchat.doomchat.workers.dev
//   → absolute URLs pointing at the Cloudflare Worker
// ─────────────────────────────────────────────────────────────────────────────

const RAW_API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.trim();

/**
 * Normalized HTTP base origin (e.g. "https://doomchat.doomchat.workers.dev")
 */
function getHttpOrigin(): string {
  if (!RAW_API_URL) return '';
  let url = RAW_API_URL.replace(/\/+$/, '');
  if (url.startsWith('ws://')) {
    url = url.replace(/^ws:\/\//, 'http://');
  } else if (url.startsWith('wss://')) {
    url = url.replace(/^wss:\/\//, 'https://');
  } else if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`;
  }
  return url;
}

/**
 * Normalized WebSocket base origin (e.g. "wss://doomchat.doomchat.workers.dev")
 */
function getWsOrigin(): string {
  if (!RAW_API_URL) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}`;
  }
  let url = RAW_API_URL.replace(/\/+$/, '');
  if (url.startsWith('https://')) {
    url = url.replace(/^https:\/\//, 'wss://');
  } else if (url.startsWith('http://')) {
    url = url.replace(/^http:\/\//, 'ws://');
  } else if (!url.startsWith('ws://') && !url.startsWith('wss://')) {
    url = `wss://${url}`;
  }
  return url;
}

export const API_ORIGIN = getHttpOrigin();

/**
 * Build an HTTP API URL.
 * e.g. apiUrl('/api/rooms')
 */
export function apiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${getHttpOrigin()}${normalizedPath}`;
}

/**
 * Build a WebSocket URL from a path.
 * e.g. wsUrl('/api/rooms/K7X4P9/ws')
 */
export function wsUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${getWsOrigin()}${normalizedPath}`;
}
