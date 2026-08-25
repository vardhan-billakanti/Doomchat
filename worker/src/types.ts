// ─────────────────────────────────────────────────────────────────────────────
// Shared WebSocket event types between Worker and Frontend
// All events are JSON-serialized over the WebSocket connection
// ─────────────────────────────────────────────────────────────────────────────

export interface Env {
  CHAT_ROOM: DurableObjectNamespace;
}

// ── Participant ──────────────────────────────────────────────────────────────

export interface Participant {
  id: string;
  nickname: string;
  isOwner: boolean;
  joinedAt: number;
}

// ── Message ──────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  senderId: string;
  nickname: string;
  text: string;
  timestamp: number;
}

// ── Room Info ─────────────────────────────────────────────────────────────────

export interface RoomInfo {
  code: string;
  participantCount: number;
  exists: boolean;
  disbanded: boolean;
}

// ── Client → Server events ────────────────────────────────────────────────────

export type ClientEventType =
  | 'room_join'
  | 'message'
  | 'typing_start'
  | 'typing_stop'
  | 'leave'
  | 'disband'
  | 'ping';

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

// ── Server → Client events ────────────────────────────────────────────────────

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

export interface ServerRoomState {
  type: 'room_state';
  yourParticipantId: string;
  participants: Participant[];
  roomCode: string;
  isOwner: boolean;
}

export interface ServerParticipantJoined {
  type: 'participant_joined';
  participant: Participant;
  participants: Participant[];
  systemMessage: string;
}

export interface ServerParticipantLeft {
  type: 'participant_left';
  participantId: string;
  nickname: string;
  participants: Participant[];
  systemMessage: string;
}

export interface ServerMessage {
  type: 'message';
  message: ChatMessage;
}

export interface ServerTyping {
  type: 'typing';
  typingNicknames: string[];
}

export interface ServerRoomDisbanded {
  type: 'room_disbanded';
  message: string;
}

export interface ServerOwnershipChanged {
  type: 'ownership_changed';
  newOwnerId: string;
  newOwnerNickname: string;
  participants: Participant[];
  systemMessage: string;
}

export interface ServerError {
  type: 'error';
  code: string;
  message: string;
}

export interface ServerPong {
  type: 'pong';
  timestamp: number;
}

export interface ServerRateLimited {
  type: 'rate_limited';
  message: string;
  retryAfterMs: number;
}

export interface ServerSystemMessage {
  type: 'system_message';
  text: string;
  timestamp: number;
}

export type ServerEvent =
  | ServerRoomState
  | ServerParticipantJoined
  | ServerParticipantLeft
  | ServerMessage
  | ServerTyping
  | ServerRoomDisbanded
  | ServerOwnershipChanged
  | ServerError
  | ServerPong
  | ServerRateLimited
  | ServerSystemMessage;

// ── API response types ────────────────────────────────────────────────────────

export interface CreateRoomResponse {
  roomCode: string;
}

export interface RoomStatusResponse {
  exists: boolean;
  disbanded: boolean;
  participantCount: number;
}

// ── Error codes ───────────────────────────────────────────────────────────────

export const ErrorCodes = {
  INVALID_NICKNAME: 'INVALID_NICKNAME',
  INVALID_ROOM_CODE: 'INVALID_ROOM_CODE',
  ROOM_NOT_FOUND: 'ROOM_NOT_FOUND',
  ROOM_DISBANDED: 'ROOM_DISBANDED',
  ROOM_FULL: 'ROOM_FULL',
  NOT_OWNER: 'NOT_OWNER',
  RATE_LIMITED: 'RATE_LIMITED',
  INVALID_MESSAGE: 'INVALID_MESSAGE',
  MALFORMED_PAYLOAD: 'MALFORMED_PAYLOAD',
  ALREADY_JOINED: 'ALREADY_JOINED',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];
