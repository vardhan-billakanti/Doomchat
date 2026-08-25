import { ChatRoom } from './ChatRoom';
import { generateRoomCode, validateRoomCode, validateNickname } from './validation';

// Re-export the Durable Object class so Wrangler can find it
export { ChatRoom };

// ─────────────────────────────────────────────────────────────────────────────
// Cloudflare Worker Environment bindings
// ─────────────────────────────────────────────────────────────────────────────

export interface Env {
  CHAT_ROOM: DurableObjectNamespace;
}

// ─────────────────────────────────────────────────────────────────────────────
// CORS headers for local development
// ─────────────────────────────────────────────────────────────────────────────

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}

function errorResponse(message: string, status = 400): Response {
  return jsonResponse({ error: message }, status);
}

// ─────────────────────────────────────────────────────────────────────────────
// Get a Durable Object stub for a given room code
// ─────────────────────────────────────────────────────────────────────────────

function getRoomStub(env: Env, roomCode: string): DurableObjectStub {
  const id = env.CHAT_ROOM.idFromName(roomCode);
  return env.CHAT_ROOM.get(id);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Worker fetch handler
// ─────────────────────────────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;

    // ── CORS preflight ──────────────────────────────────────────────────────
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    // ── API routes ──────────────────────────────────────────────────────────

    // POST /api/rooms — Create a new room
    if (pathname === '/api/rooms' && request.method === 'POST') {
      let body: { nickname?: string } = {};
      try {
        body = await request.json() as { nickname?: string };
      } catch {
        return errorResponse('Invalid request body.');
      }

      const nameResult = validateNickname(body.nickname);
      if (!nameResult.valid) {
        return errorResponse(nameResult.error!, 400);
      }

      // Try to generate a unique room code (up to 5 attempts)
      let roomCode = '';
      for (let attempt = 0; attempt < 5; attempt++) {
        const candidate = generateRoomCode();
        // Check if room already exists
        const stub = getRoomStub(env, candidate);
        const statusRes = await stub.fetch(
          new Request(`${url.origin}/status`, { method: 'GET' })
        );
        const status = await statusRes.json() as { exists: boolean };
        if (!status.exists) {
          roomCode = candidate;
          break;
        }
      }

      if (!roomCode) {
        return errorResponse('Could not generate a unique room code. Please try again.', 503);
      }

      // Initialize the room
      const stub = getRoomStub(env, roomCode);
      await stub.fetch(
        new Request(`${url.origin}/init`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ creatorNickname: body.nickname }),
        })
      );

      return jsonResponse({ roomCode });
    }

    // GET /api/rooms/:code — Check room status
    const roomStatusMatch = pathname.match(/^\/api\/rooms\/([A-Z2-9]{6})$/);
    if (roomStatusMatch && request.method === 'GET') {
      const code = roomStatusMatch[1];
      const codeResult = validateRoomCode(code);
      if (!codeResult.valid) {
        return errorResponse('Invalid room code format.', 400);
      }

      const stub = getRoomStub(env, code);
      const res = await stub.fetch(new Request(`${url.origin}/status`, { method: 'GET' }));
      const status = await res.json();
      return jsonResponse(status);
    }

    // GET /api/rooms/:code/ws — WebSocket upgrade
    const wsMatch = pathname.match(/^\/api\/rooms\/([A-Z2-9]{6})\/ws$/);
    if (wsMatch) {
      const code = wsMatch[1].toUpperCase();
      const codeResult = validateRoomCode(code);
      if (!codeResult.valid) {
        return new Response('Invalid room code', { status: 400 });
      }

      // Validate upgrade header
      const upgradeHeader = request.headers.get('Upgrade');
      if (upgradeHeader?.toLowerCase() !== 'websocket') {
        return new Response('Expected WebSocket upgrade', { status: 426 });
      }

      const stub = getRoomStub(env, code);
      return stub.fetch(request);
    }

    // ── 404 for unknown API routes ──────────────────────────────────────────
    if (pathname.startsWith('/api/')) {
      return errorResponse('Not found.', 404);
    }

    // ── Everything else is served by Cloudflare's static asset handling ─────
    // (configured via [assets] in wrangler.toml)
    return new Response('Not found', { status: 404 });
  },
};
