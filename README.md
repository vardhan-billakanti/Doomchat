# DoomChat

> Temporary real-time group chat. No account required.

**Create a room → share the code → start talking → leave → room is gone.**

Built with:
- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Cloudflare Workers + Durable Objects
- **Realtime**: WebSockets (Hibernation API)
- **Styling**: Vanilla CSS with CSS custom properties

---

## Architecture

```
Browser ──HTTPS──▶ Cloudflare Worker (serves SPA + API)
                     │
                     └── /api/rooms/:code/ws ──▶ ChatRoom Durable Object
                                                  (one instance per room code)
                                                  - participant list
                                                  - WebSocket broadcasting
                                                  - ownership management
                                                  - inactivity alarms
```

The entire backend is a **single Cloudflare Worker** deployed once. Rooms are created dynamically — no new deployment required.

---

## Prerequisites

- Node.js 18+
- npm 8+
- A [Cloudflare account](https://dash.cloudflare.com/sign-up) (**paid plan required** for Durable Objects)
- Wrangler CLI (installed as dev dependency)

> ⚠️ **Cloudflare Durable Objects require a paid Workers plan (~$5/mo).**
> The free tier does NOT include Durable Objects.

---

## Local Development

### 1. Install dependencies

```bash
# From the project root
npm install
```

### 2. Build the frontend once (for wrangler dev to serve)

```bash
npm run build
```

### 3. Start the development server

```bash
npm run dev
```

This runs `wrangler dev` which serves:
- The React SPA at `/`
- The Worker API at `/api/`
- WebSocket connections at `/api/rooms/:code/ws`

Open **http://localhost:8787** in two browser tabs to test locally.

### Alternative: Frontend hot-reload dev

For frontend development with hot module replacement:

```bash
# Terminal 1: Start wrangler dev (the backend)
npm run dev

# Terminal 2: Start Vite dev server (frontend only, proxies to wrangler)
cd frontend && npm run dev
```

Then open **http://localhost:5173**.

---

## Deployment

### 1. Login to Cloudflare

```bash
npx wrangler login
```

### 2. Build the frontend

```bash
npm run build
```

### 3. Deploy

```bash
npm run deploy
```

Wrangler will:
1. Build the Worker
2. Upload the frontend static assets
3. Create/update the Durable Object namespace
4. Output your public URL

### 4. Share the URL

Give users your worker URL (e.g. `https://doomchat.yourname.workers.dev`).

---

## Environment & Bindings

No environment variables or secrets are required.

The Durable Object binding is configured in `wrangler.toml`:

```toml
[[durable_objects.bindings]]
name = "CHAT_ROOM"
class_name = "ChatRoom"

[[migrations]]
tag = "v1"
new_sqlite_classes = ["ChatRoom"]
```

---

## End-to-End Testing

### Acceptance Test (Section 30)

1. **Device/Tab A**: Open DoomChat → CREATE → enter `Vardhan` → create room → receive room code (e.g. `K7X4P9`)
2. **Device/Tab B**: Open same URL → JOIN → enter `Rahul` + code `K7X4P9` → join
3. **Tab A** should immediately show: `"Rahul joined the room"`
4. **Tab B** should see the participant list with Vardhan (👑) and Rahul (🟢)
5. Vardhan sends `"Hello"` → Rahul receives it immediately
6. Rahul types → Vardhan sees `"Rahul is typing..."`
7. Rahul sends a reply → Vardhan receives it
8. Rahul clicks ⋮ → Leave Room → confirms → Tab B returns to landing
9. Tab A shows `"Rahul left the room"`
10. Vardhan clicks ⋮ → Disband Room → confirms
11. Room is closed, all connected clients see the disbanded message
12. Trying to join `K7X4P9` shows `"This room has been closed."`
13. Create a new room — works independently ✓

---

## Project Structure

```
doomchat/
├── package.json           # Root workspace (wrangler scripts)
├── wrangler.toml          # Cloudflare Worker + DO + assets config
├── tsconfig.json          # Root TypeScript config
│
├── frontend/              # React SPA
│   ├── package.json
│   ├── vite.config.ts     # Vite config (proxies /api to wrangler)
│   ├── index.html
│   └── src/
│       ├── App.tsx        # State machine (landing/create/join/chat/error)
│       ├── main.tsx
│       ├── types.ts       # Frontend TypeScript types
│       ├── hooks/
│       │   ├── useWebSocket.ts   # WS connection with reconnection
│       │   └── useChatRoom.ts    # Room state from WS events
│       ├── components/
│       │   ├── LandingPage.tsx/css
│       │   ├── CreateRoom.tsx
│       │   ├── JoinRoom.tsx
│       │   ├── FormPage.css
│       │   ├── RoomCreated.tsx/css
│       │   ├── ChatRoom.tsx/css
│       │   ├── MessageList.tsx/css
│       │   ├── MessageInput.tsx/css
│       │   ├── ParticipantList.tsx/css
│       │   ├── TypingIndicator.tsx/css
│       │   ├── ConnectionStatus.tsx/css
│       │   ├── ConfirmModal.tsx/css
│       │   └── ErrorScreen.tsx/css
│       └── styles/
│           ├── variables.css     # Design tokens
│           └── global.css        # Reset + utilities
│
└── worker/                # Cloudflare Worker
    ├── package.json
    ├── tsconfig.json
    └── src/
        ├── index.ts       # Worker entrypoint + routing
        ├── ChatRoom.ts    # Durable Object (room lifecycle)
        ├── validation.ts  # Server-side validation + sanitization
        ├── rateLimit.ts   # Token bucket rate limiter
        └── types.ts       # Shared WS event types
```

---

## Security Notes

- All input validated server-side (never trust the client)
- Room ownership verified by Durable Object (never from client flags)  
- Message text sanitized (HTML entities escaped)
- Per-connection rate limiting (token bucket: 8 burst, 1/s sustained)
- Max message length: 1000 chars
- Max nickname length: 32 chars
- Max participants per room: 50
- Malformed JSON payloads close the connection
- Room codes use rejection-sampling random generation (no modulo bias)
- React renders all user content as text nodes (no innerHTML)

---

## Limitations & Notes

- **Rooms don't persist across Durable Object evictions**: If a DO is evicted and restarted, in-memory participant state is lost. Persisted state (owner, disbanded flag) survives. In practice, DO eviction rarely happens during active use.
- **No message history for late joiners**: By design — DoomChat is ephemeral.
- **Cloudflare free tier**: Durable Objects are NOT available on the free tier.
- **Room codes are not passwords**: They are short and shareable by design. Don't use DoomChat for sensitive information.
- **WebSocket reconnection**: The client retries up to 5 times with exponential backoff. After that, it shows as disconnected.
