import { DurableObject } from 'cloudflare:workers';
import type {
  ClientEvent,
  Participant,
  ServerEvent,
  ServerRoomState,
  ChatMessage,
  Env,
} from './types';
import { ErrorCodes } from './types';
import {
  validateNickname,
  validateMessage,
  sanitizeText,
  generateParticipantId,
  generateMessageId,
  MAX_PARTICIPANTS,
} from './validation';
import { RateLimiter } from './rateLimit';

// ─────────────────────────────────────────────────────────────────────────────
// Persisted room state (survives DO eviction/restart)
// ─────────────────────────────────────────────────────────────────────────────

interface PersistedState {
  createdAt: number;
  ownerId: string | null;
  creatorId: string | null;
  creatorNickname: string | null;
  creatorToken: string | null;
  disbanded: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// In-memory participant state (rebuilt from live WebSocket connections)
// ─────────────────────────────────────────────────────────────────────────────

interface ParticipantState {
  id: string;
  nickname: string;
  joinedAt: number;
  rateLimiter: RateLimiter;
  isTyping: boolean;
  typingTimeout: ReturnType<typeof setTimeout> | null;
}

// How long (ms) a room can be inactive before the alarm cleans it up
const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
// How long (ms) after all users leave to clean up an empty room
const EMPTY_ROOM_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
// How long (ms) before auto-clearing a typing indicator
const TYPING_CLEAR_TIMEOUT_MS = 5000;

// ─────────────────────────────────────────────────────────────────────────────
// ChatRoom Durable Object
// One instance per room code. Manages all WebSocket connections for a room.
// ─────────────────────────────────────────────────────────────────────────────

export class ChatRoom extends DurableObject {
  // in-memory participant map: participantId → state
  private participants: Map<string, ParticipantState> = new Map();
  // recent participant cache for idempotent reconnects within 60s
  private recentParticipants: Map<string, { nickname: string; joinedAt: number; expiry: number }> = new Map();
  // persisted state loaded lazily
  private persisted: PersistedState | null = null;
  // initialization flag
  private initialized = false;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
  }

  // ── Initialization ─────────────────────────────────────────────────────────

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) {
      this.syncParticipantsFromSockets();
      return;
    }
    const stored = await this.ctx.storage.get<PersistedState>('state');
    this.persisted = stored ?? {
      ownerId: null,
      creatorId: null,
      creatorNickname: null,
      creatorToken: null,
      disbanded: false,
      createdAt: 0,
    };
    this.initialized = true;
    this.syncParticipantsFromSockets();
  }

  private async saveState(): Promise<void> {
    if (this.persisted) {
      await this.ctx.storage.put('state', this.persisted);
    }
  }

  /**
   * Synchronizes the in-memory participant map with all currently live WebSockets
   * via Cloudflare WebSocket Hibernation attachments.
   */
  private syncParticipantsFromSockets(): void {
    const activeSockets = this.ctx.getWebSockets();
    for (const ws of activeSockets) {
      const att = ws.deserializeAttachment() as {
        id: string;
        nickname: string;
        joinedAt: number;
      } | null;

      if (att && att.id && att.nickname) {
        const existing = this.participants.get(att.id);
        if (!existing) {
          this.participants.set(att.id, {
            id: att.id,
            nickname: att.nickname,
            joinedAt: att.joinedAt || Date.now(),
            rateLimiter: new RateLimiter(),
            isTyping: false,
            typingTimeout: null,
          });
        }
      }
    }
  }

  // ── fetch() — handles HTTP upgrade and API requests ────────────────────────

  async fetch(request: Request): Promise<Response> {
    await this.ensureInitialized();

    const url = new URL(request.url);

    // HTTP GET /status — check room info
    if (request.method === 'GET' && url.pathname.endsWith('/status')) {
      if (this.persisted!.disbanded) {
        return Response.json({ exists: true, disbanded: true, participantCount: 0 });
      }
      // A room exists if it has been created
      if (!this.persisted!.createdAt) {
        return Response.json({ exists: false, disbanded: false, participantCount: 0 });
      }
      return Response.json({
        exists: true,
        disbanded: false,
        participantCount: this.participants.size,
      });
    }

    // HTTP POST /init — initialize a new room
    if (request.method === 'POST' && url.pathname.endsWith('/init')) {
      if (this.persisted!.createdAt > 0) {
        // Room already exists
        return Response.json({ ok: true });
      }
      try {
        const initBody = (await request.json()) as {
          creatorId?: string;
          creatorToken?: string;
          creatorNickname?: string;
        };
        if (initBody?.creatorNickname) {
          this.persisted!.creatorNickname = sanitizeText(initBody.creatorNickname.trim());
        }
        if (initBody?.creatorId) {
          this.persisted!.creatorId = initBody.creatorId;
          this.persisted!.ownerId = initBody.creatorId;
        }
        if (initBody?.creatorToken) {
          this.persisted!.creatorToken = initBody.creatorToken;
        }
      } catch {
        // ignore parse error if no body
      }
      this.persisted!.createdAt = Date.now();
      await this.saveState();
      await this.resetInactivityAlarm();
      return Response.json({ ok: true });
    }

    // WebSocket upgrade
    const upgradeHeader = request.headers.get('Upgrade');
    if (upgradeHeader?.toLowerCase() !== 'websocket') {
      return new Response('Expected WebSocket upgrade', { status: 426 });
    }

    if (this.persisted!.disbanded) {
      return new Response('Room has been disbanded', { status: 410 });
    }

    if (this.participants.size >= MAX_PARTICIPANTS) {
      return new Response('Room is full', { status: 503 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    // Read query params for stable participant identity
    const pidParam = url.searchParams.get('pid');
    const tokenParam = url.searchParams.get('token');
    const isCreator =
      (tokenParam && tokenParam === this.persisted!.creatorToken) ||
      (pidParam && pidParam === this.persisted!.creatorId);

    const participantId = isCreator
      ? (this.persisted!.creatorId || pidParam || generateParticipantId())
      : (pidParam || generateParticipantId());

    this.ctx.acceptWebSocket(server, [participantId]);

    return new Response(null, { status: 101, webSocket: client });
  }

  // ── WebSocket Hibernation API handlers ─────────────────────────────────────

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    await this.ensureInitialized();

    const tags = this.ctx.getTags(ws);
    const participantId = tags[0];

    if (!participantId) {
      ws.close(1008, 'No participant ID');
      return;
    }

    let parsed: ClientEvent;
    try {
      const raw = typeof message === 'string' ? message : new TextDecoder().decode(message);
      parsed = JSON.parse(raw) as ClientEvent;
    } catch {
      this.sendTo(ws, {
        type: 'error',
        code: ErrorCodes.MALFORMED_PAYLOAD,
        message: 'Invalid JSON payload.',
      });
      return;
    }

    await this.handleClientEvent(ws, participantId, parsed);
    await this.resetInactivityAlarm();
  }

  async webSocketClose(ws: WebSocket, code: number, _reason: string, _wasClean: boolean): Promise<void> {
    await this.ensureInitialized();
    const tags = this.ctx.getTags(ws);
    const participantId = tags[0];
    const att = ws.deserializeAttachment() as { id: string; nickname: string } | null;
    const effectiveId = att?.id || participantId;

    if (!effectiveId) return;

    // Check if this participant has any other active sockets
    const userSockets = this.ctx.getWebSockets(effectiveId);
    if (userSockets.length <= 1) {
      const participant = this.participants.get(effectiveId);
      const nickname = att?.nickname || participant?.nickname || 'A user';

      this.recentParticipants.set(effectiveId, {
        nickname,
        joinedAt: participant?.joinedAt || Date.now(),
        expiry: Date.now() + 60000,
      });

      this.participants.delete(effectiveId);

      // If owner left, transfer ownership if other participants remain
      if (this.persisted!.ownerId === effectiveId) {
        await this.transferOwnership();
      }

      // Broadcast authoritative updated participant list
      const remaining = this.getParticipantList();
      if (remaining.length > 0) {
        this.broadcast({
          type: 'participant_left',
          participantId: effectiveId,
          nickname,
          participants: remaining,
          systemMessage: `${nickname} left the room`,
        });
        this.broadcastTyping();
      } else {
        await this.ctx.storage.setAlarm(Date.now() + EMPTY_ROOM_TIMEOUT_MS);
      }
    }
  }

  async webSocketError(ws: WebSocket, _error: unknown): Promise<void> {
    await this.ensureInitialized();
    const tags = this.ctx.getTags(ws);
    const participantId = tags[0];
    const att = ws.deserializeAttachment() as { id: string; nickname: string } | null;
    const effectiveId = att?.id || participantId;

    if (!effectiveId) return;

    const userSockets = this.ctx.getWebSockets(effectiveId);
    if (userSockets.length <= 1) {
      this.participants.delete(effectiveId);
      if (this.persisted!.ownerId === effectiveId) {
        await this.transferOwnership();
      }
      const remaining = this.getParticipantList();
      if (remaining.length > 0) {
        this.broadcast({
          type: 'participant_left',
          participantId: effectiveId,
          nickname: att?.nickname || 'A user',
          participants: remaining,
          systemMessage: `${att?.nickname || 'A user'} left the room`,
        });
      }
    }
  }

  // ── Alarm handler — inactivity cleanup ─────────────────────────────────────

  async alarm(): Promise<void> {
    await this.ensureInitialized();
    // Close all active WebSockets
    for (const ws of this.ctx.getWebSockets()) {
      try {
        this.sendTo(ws, {
          type: 'room_disbanded',
          message: 'Room was closed due to inactivity.',
        });
        ws.close(1000, 'Inactivity cleanup');
      } catch {
        // ignore errors on already-closed sockets
      }
    }
    // Clean up all storage
    await this.ctx.storage.deleteAll();
  }

  // ── Event dispatcher ───────────────────────────────────────────────────────

  private async handleClientEvent(
    ws: WebSocket,
    participantId: string,
    event: ClientEvent
  ): Promise<void> {
    const att = ws.deserializeAttachment() as { id: string } | null;
    const effectiveId = att?.id || participantId;

    switch (event.type) {
      case 'room_join':
        await this.handleRoomJoin(
          ws,
          participantId,
          event.nickname,
          event.roomCode,
          event.participantId,
          event.token
        );
        break;
      case 'message':
        await this.handleMessage(ws, effectiveId, event.text);
        break;
      case 'typing_start':
        this.handleTypingStart(effectiveId);
        break;
      case 'typing_stop':
        this.handleTypingStop(effectiveId);
        break;
      case 'leave':
        await this.handleParticipantLeave(effectiveId);
        ws.close(1000, 'User left');
        break;
      case 'disband':
        await this.handleDisband(ws, effectiveId);
        break;
      case 'ping':
        this.sendTo(ws, { type: 'pong', timestamp: Date.now() });
        break;
      default:
        this.sendTo(ws, {
          type: 'error',
          code: ErrorCodes.MALFORMED_PAYLOAD,
          message: 'Unknown event type.',
        });
    }
  }

  // ── room_join ──────────────────────────────────────────────────────────────

  private async handleRoomJoin(
    ws: WebSocket,
    participantId: string,
    nickname: unknown,
    _roomCode: unknown,
    clientProvidedPid?: string,
    token?: string
  ): Promise<void> {
    // Validate nickname
    const nameResult = validateNickname(nickname);
    if (!nameResult.valid) {
      this.sendTo(ws, {
        type: 'error',
        code: ErrorCodes.INVALID_NICKNAME,
        message: nameResult.error!,
      });
      ws.close(1008, 'Invalid nickname');
      return;
    }

    if (this.persisted!.disbanded) {
      this.sendTo(ws, {
        type: 'error',
        code: ErrorCodes.ROOM_DISBANDED,
        message: 'This room has been disbanded.',
      });
      ws.close(1008, 'Room disbanded');
      return;
    }

    const sanitizedNickname = sanitizeText((nickname as string).trim());
    const now = Date.now();

    // Authoritative check for Creator
    const isCreator =
      (token && token === this.persisted!.creatorToken) ||
      (this.persisted!.creatorId && (clientProvidedPid === this.persisted!.creatorId || participantId === this.persisted!.creatorId)) ||
      (this.persisted!.creatorNickname && sanitizedNickname === this.persisted!.creatorNickname);

    const effectiveId = isCreator
      ? (this.persisted!.creatorId || clientProvidedPid || participantId)
      : (clientProvidedPid || participantId);

    if (isCreator) {
      this.persisted!.ownerId = effectiveId;
      if (!this.persisted!.creatorId) {
        this.persisted!.creatorId = effectiveId;
      }
      await this.saveState();
    }

    // Check if this participant already existed in active map or recent cache
    const recent = clientProvidedPid ? this.recentParticipants.get(clientProvidedPid) : null;
    const isRecentReconnect = !!recent && recent.expiry > Date.now();
    const existing = this.participants.get(effectiveId);
    const isReconnect = !!existing || isRecentReconnect;

    if (isRecentReconnect && clientProvidedPid) {
      this.recentParticipants.delete(clientProvidedPid);
    }

    if (!isReconnect && this.participants.size >= MAX_PARTICIPANTS) {
      this.sendTo(ws, {
        type: 'error',
        code: ErrorCodes.ROOM_FULL,
        message: 'This room is full.',
      });
      ws.close(1008, 'Room full');
      return;
    }

    const isOwner = this.persisted!.ownerId === effectiveId;
    const joinedAt = existing ? existing.joinedAt : (recent ? recent.joinedAt : now);

    // Attach participant metadata to the WebSocket so it survives DO hibernation
    try {
      ws.serializeAttachment({
        id: effectiveId,
        nickname: sanitizedNickname,
        joinedAt,
      });
    } catch {
      // ignore
    }

    // Add/update in-memory map
    this.participants.set(effectiveId, {
      id: effectiveId,
      nickname: sanitizedNickname,
      joinedAt,
      rateLimiter: existing ? existing.rateLimiter : new RateLimiter(),
      isTyping: false,
      typingTimeout: null,
    });

    // Send authoritative current room state to the participant
    const roomStateMsg: ServerRoomState = {
      type: 'room_state',
      yourParticipantId: effectiveId,
      roomCode: _roomCode as string,
      isOwner,
      participants: this.getParticipantList(),
    };
    this.sendTo(ws, roomStateMsg);

    // Only broadcast participant_joined if this is a genuinely new joiner
    if (!isReconnect) {
      const joinedParticipant: Participant = {
        id: effectiveId,
        nickname: sanitizedNickname,
        isOwner,
        joinedAt,
      };
      this.broadcast(
        {
          type: 'participant_joined',
          participant: joinedParticipant,
          participants: this.getParticipantList(),
          systemMessage: `${sanitizedNickname} joined the room`,
        },
        effectiveId
      );
    }
  }

  // ── message ────────────────────────────────────────────────────────────────

  private async handleMessage(
    ws: WebSocket,
    participantId: string,
    text: unknown
  ): Promise<void> {
    const participant = this.participants.get(participantId);
    const att = ws.deserializeAttachment() as { id: string; nickname: string } | null;
    const senderNickname = att?.nickname || participant?.nickname || 'Participant';

    // Rate limiting
    if (participant && !participant.rateLimiter.consume()) {
      const retryMs = participant.rateLimiter.msUntilNextToken();
      this.sendTo(ws, {
        type: 'rate_limited',
        message: 'You are sending messages too fast. Please slow down.',
        retryAfterMs: retryMs,
      });
      return;
    }

    // Validate message
    const msgResult = validateMessage(text);
    if (!msgResult.valid) {
      this.sendTo(ws, {
        type: 'error',
        code: ErrorCodes.INVALID_MESSAGE,
        message: msgResult.error!,
      });
      return;
    }

    const sanitized = sanitizeText((text as string).trim());

    // Auto-clear typing indicator when they send a message
    this.clearTyping(participantId);

    // Broadcast to ALL connected WebSockets in the room (including sender)
    this.broadcast({
      type: 'message',
      message: {
        id: generateMessageId(),
        senderId: participantId,
        nickname: senderNickname,
        text: sanitized,
        timestamp: Date.now(),
      },
    });
  }

  // ── typing_start / typing_stop ─────────────────────────────────────────────

  private handleTypingStart(participantId: string): void {
    const participant = this.participants.get(participantId);
    if (!participant) return;

    if (!participant.isTyping) {
      participant.isTyping = true;
      this.broadcastTyping();
    }

    // Reset auto-clear timeout
    if (participant.typingTimeout) {
      clearTimeout(participant.typingTimeout);
    }
    participant.typingTimeout = setTimeout(() => {
      this.clearTyping(participantId);
    }, TYPING_CLEAR_TIMEOUT_MS);
  }

  private handleTypingStop(participantId: string): void {
    this.clearTyping(participantId);
  }

  private clearTyping(participantId: string): void {
    const participant = this.participants.get(participantId);
    if (!participant) return;
    if (participant.typingTimeout) {
      clearTimeout(participant.typingTimeout);
      participant.typingTimeout = null;
    }
    if (participant.isTyping) {
      participant.isTyping = false;
      this.broadcastTyping();
    }
  }

  private broadcastTyping(): void {
    const typingNicknames = Array.from(this.participants.values())
      .filter((p) => p.isTyping)
      .map((p) => p.nickname);
    this.broadcast({ type: 'typing', typingNicknames });
  }

  // ── leave ──────────────────────────────────────────────────────────────────

  private async handleParticipantLeave(participantId: string): Promise<void> {
    const participant = this.participants.get(participantId);
    const sockets = this.ctx.getWebSockets();
    let leavingNickname = participant?.nickname || 'A user';

    // Clear attachment on all sockets associated with this participant
    for (const s of sockets) {
      const att = s.deserializeAttachment() as { id: string; nickname?: string } | null;
      const tags = this.ctx.getTags(s);
      if (att?.id === participantId || tags[0] === participantId) {
        if (att?.nickname) leavingNickname = att.nickname;
        try {
          s.serializeAttachment(null);
        } catch {
          // ignore
        }
      }
    }

    // Clear typing status
    if (participant?.typingTimeout) {
      clearTimeout(participant.typingTimeout);
      participant.typingTimeout = null;
    }

    this.participants.delete(participantId);

    // If the owner left explicitly, transfer ownership first
    if (this.persisted!.ownerId === participantId) {
      await this.transferOwnership();
    }

    // Broadcast departure to remaining participants with authoritative participant list
    const remaining = this.getParticipantList();
    if (remaining.length > 0) {
      this.broadcast({
        type: 'participant_left',
        participantId,
        nickname: leavingNickname,
        participants: remaining,
        systemMessage: `${leavingNickname} left the room`,
      });
      this.broadcastTyping();
    }

    // If room is empty, set a shorter cleanup alarm
    if (remaining.length === 0) {
      await this.ctx.storage.setAlarm(Date.now() + EMPTY_ROOM_TIMEOUT_MS);
    }
  }

  // ── disband ────────────────────────────────────────────────────────────────

  private async handleDisband(ws: WebSocket, participantId: string): Promise<void> {
    if (this.persisted!.ownerId !== participantId) {
      this.sendTo(ws, {
        type: 'error',
        code: ErrorCodes.NOT_OWNER,
        message: 'Only the room owner can disband the room.',
      });
      return;
    }

    this.persisted!.disbanded = true;
    await this.saveState();

    // Notify everyone
    this.broadcast({
      type: 'room_disbanded',
      message: 'The room owner has disbanded this room.',
    });

    // Close all connections
    for (const socket of this.ctx.getWebSockets()) {
      try {
        socket.close(1000, 'Room disbanded');
      } catch {
        // ignore
      }
    }

    // Clear participants
    this.participants.clear();

    // Schedule immediate cleanup
    await this.ctx.storage.setAlarm(Date.now() + 5000);
  }

  // ── Ownership transfer ─────────────────────────────────────────────────────

  private async transferOwnership(): Promise<void> {
    const activeList = this.getParticipantList();
    if (activeList.length === 0) {
      this.persisted!.ownerId = null;
      await this.saveState();
      return;
    }

    // Assign to the earliest-joined remaining participant
    const next = Array.from(this.participants.values()).sort(
      (a, b) => a.joinedAt - b.joinedAt
    )[0];

    this.persisted!.ownerId = next.id;
    await this.saveState();

    this.broadcast({
      type: 'ownership_changed',
      newOwnerId: next.id,
      newOwnerNickname: next.nickname,
      participants: this.getParticipantList(),
      systemMessage: `${next.nickname} is now the room owner`,
    });
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private getParticipantList(): Participant[] {
    this.syncParticipantsFromSockets();
    return Array.from(this.participants.values())
      .sort((a, b) => a.joinedAt - b.joinedAt)
      .map((p) => ({
        id: p.id,
        nickname: p.nickname,
        isOwner: p.id === this.persisted!.ownerId,
        joinedAt: p.joinedAt,
      }));
  }

  /** Send a message to a specific WebSocket */
  private sendTo(ws: WebSocket, event: ServerEvent): void {
    try {
      ws.send(JSON.stringify(event));
    } catch {
      // Socket might be closing
    }
  }

  /** Broadcast to all connected WebSockets, optionally excluding one */
  private broadcast(event: ServerEvent, excludeParticipantId?: string): void {
    const sockets = this.ctx.getWebSockets();
    for (const ws of sockets) {
      const tags = this.ctx.getTags(ws);
      if (excludeParticipantId && tags[0] === excludeParticipantId) continue;
      this.sendTo(ws, event);
    }
  }

  /** Reset the inactivity alarm to INACTIVITY_TIMEOUT_MS from now */
  private async resetInactivityAlarm(): Promise<void> {
    await this.ctx.storage.setAlarm(Date.now() + INACTIVITY_TIMEOUT_MS);
  }
}
