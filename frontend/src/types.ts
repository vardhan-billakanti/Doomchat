// ─────────────────────────────────────────────────────────────────────────────
// Frontend-specific type definitions
// Re-exports from worker types with frontend-specific additions
// ─────────────────────────────────────────────────────────────────────────────

export interface Participant {
  id: string;
  nickname: string;
  isOwner: boolean;
  joinedAt: number;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  nickname: string;
  text: string;
  timestamp: number;
}

export interface SystemMessage {
  id: string;
  text: string;
  timestamp: number;
  isSystem: true;
}

export type DisplayMessage = ChatMessage | SystemMessage;

export function isSystemMessage(msg: DisplayMessage): msg is SystemMessage {
  return (msg as SystemMessage).isSystem === true;
}

// ── App state machine ─────────────────────────────────────────────────────────

export type AppView =
  | 'landing'
  | 'create_form'
  | 'room_created'
  | 'join_form'
  | 'chat_room'
  | 'error';

export interface RoomCreatedState {
  roomCode: string;
  nickname: string;
}

export interface ChatRoomState {
  roomCode: string;
  nickname: string;
  participantId: string;
  isOwner: boolean;
}

export type ErrorType =
  | 'room_not_found'
  | 'room_disbanded'
  | 'room_full'
  | 'connection_failed'
  | 'server_error'
  | 'rate_limited';

export interface ErrorState {
  type: ErrorType;
  message: string;
  roomCode?: string;
}

// ── WebSocket events (from server) ────────────────────────────────────────────

export type ServerEventType =
  | 'room_state'
  | 'participant_joined'
  | 'participant_left'
  | 'message'
  | 'typing'
  | 'room_disbanded'
  | 'ownership_changed'
  | 'error'
  | 'pong'
  | 'rate_limited'
  | 'system_message';

export interface ServerEvent {
  type: ServerEventType;
  [key: string]: unknown;
}

// ── WebSocket events (from client) ────────────────────────────────────────────

export interface ClientRoomJoin {
  type: 'room_join';
  nickname: string;
  roomCode: string;
  participantId?: string;
  token?: string;
}

export interface ClientMessage {
  type: 'message';
  text: string;
}

export interface ClientTypingStart {
  type: 'typing_start';
}

export interface ClientTypingStop {
  type: 'typing_stop';
}

export interface ClientLeave {
  type: 'leave';
}

export interface ClientDisband {
  type: 'disband';
}

export interface ClientPing {
  type: 'ping';
}

export type ClientEvent =
  | ClientRoomJoin
  | ClientMessage
  | ClientTypingStart
  | ClientTypingStop
  | ClientLeave
  | ClientDisband
  | ClientPing;

// ── Connection state ──────────────────────────────────────────────────────────

export type ConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

// ── API ───────────────────────────────────────────────────────────────────────

export interface CreateRoomResponse {
  roomCode: string;
  creatorToken?: string;
  participantId?: string;
}

export interface RoomStatusResponse {
  exists: boolean;
  disbanded: boolean;
  participantCount: number;
}
