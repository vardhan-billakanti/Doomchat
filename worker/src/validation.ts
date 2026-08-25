// ─────────────────────────────────────────────────────────────────────────────
// Validation utilities for server-side input sanitization
// ─────────────────────────────────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

// Room code character set — excludes ambiguous chars O, 0, I, 1
const ROOM_CODE_CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ROOM_CODE_LENGTH = 6;
const ROOM_CODE_REGEX = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;

export const MAX_NICKNAME_LENGTH = 32;
export const MIN_NICKNAME_LENGTH = 1;
export const MAX_MESSAGE_LENGTH = 1000;
export const MAX_PARTICIPANTS = 50;

// ── Nickname validation ───────────────────────────────────────────────────────

export function validateNickname(name: unknown): ValidationResult {
  if (typeof name !== 'string') {
    return { valid: false, error: 'Nickname must be a string.' };
  }
  const trimmed = name.trim();
  if (trimmed.length < MIN_NICKNAME_LENGTH) {
    return { valid: false, error: 'Nickname cannot be empty.' };
  }
  if (trimmed.length > MAX_NICKNAME_LENGTH) {
    return { valid: false, error: `Nickname must be ${MAX_NICKNAME_LENGTH} characters or fewer.` };
  }
  return { valid: true };
}

// ── Room code validation ──────────────────────────────────────────────────────

export function validateRoomCode(code: unknown): ValidationResult {
  if (typeof code !== 'string') {
    return { valid: false, error: 'Room code must be a string.' };
  }
  const upper = code.toUpperCase().trim();
  if (!ROOM_CODE_REGEX.test(upper)) {
    return { valid: false, error: 'Room code must be 6 alphanumeric characters.' };
  }
  return { valid: true };
}

// ── Message validation ────────────────────────────────────────────────────────

export function validateMessage(text: unknown): ValidationResult {
  if (typeof text !== 'string') {
    return { valid: false, error: 'Message must be a string.' };
  }
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: 'Message cannot be empty.' };
  }
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    return { valid: false, error: `Message must be ${MAX_MESSAGE_LENGTH} characters or fewer.` };
  }
  return { valid: true };
}

// ── Text sanitization ─────────────────────────────────────────────────────────
// Escapes HTML entities to prevent XSS when content is ever inserted as HTML.
// Frontend renders as text nodes only (React's default), but we sanitize here
// as a defense-in-depth measure.

export function sanitizeText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── Room code generation ──────────────────────────────────────────────────────

export function generateRoomCode(): string {
  let code = '';
  const charsetLength = ROOM_CODE_CHARSET.length;
  const randomBytes = new Uint8Array(ROOM_CODE_LENGTH * 2); // extra bytes for rejection sampling
  crypto.getRandomValues(randomBytes);
  let byteIdx = 0;
  while (code.length < ROOM_CODE_LENGTH) {
    const byte = randomBytes[byteIdx++];
    // Rejection sampling to avoid modulo bias
    if (byte < 256 - (256 % charsetLength)) {
      code += ROOM_CODE_CHARSET[byte % charsetLength];
    }
    if (byteIdx >= randomBytes.length) {
      // Refill if needed (very rare)
      crypto.getRandomValues(randomBytes);
      byteIdx = 0;
    }
  }
  return code;
}

// ── Participant ID generation ─────────────────────────────────────────────────

export function generateParticipantId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ── Message ID generation ─────────────────────────────────────────────────────

export function generateMessageId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
