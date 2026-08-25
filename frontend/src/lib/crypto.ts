// ─────────────────────────────────────────────────────────────────────────────
// DoomChat Client-Side End-to-End Encryption (E2EE)
//
// Implemented via browser Web Crypto API:
// - Key Derivation: PBKDF2 (SHA-256, 100,000 iterations, room-scoped salt)
// - Cipher: Authenticated AES-GCM (256-bit key, 96-bit random IV per message)
// - Server (Cloudflare Worker/DO) only ever sees the opaque ciphertext envelope
// ─────────────────────────────────────────────────────────────────────────────

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

const E2EE_PREFIX = 'e2ee:v1:';

/**
 * Derives a 256-bit AES-GCM CryptoKey from the room code using PBKDF2.
 */
export async function deriveRoomKey(roomCode: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const normalizedCode = roomCode.toUpperCase().trim();

  // Import raw room passphrase
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    encoder.encode(normalizedCode),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  // Derive AES-GCM 256-bit key using PBKDF2 with a room-specific salt
  const salt = encoder.encode(`doomchat-e2ee-salt-v1-${normalizedCode}`);

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    {
      name: 'AES-GCM',
      length: 256,
    },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts a plaintext message using AES-GCM with a unique 96-bit IV.
 * Returns an envelope string: "e2ee:v1:<iv_b64>:<ciphertext_b64>"
 */
export async function encryptMessage(text: string, key: CryptoKey): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);

  // 96-bit (12 bytes) IV standard for AES-GCM
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    key,
    data
  );

  const ivB64 = bytesToBase64(iv);
  const cipherB64 = bytesToBase64(new Uint8Array(ciphertextBuffer));

  return `${E2EE_PREFIX}${ivB64}:${cipherB64}`;
}

/**
 * Decrypts an encrypted message envelope using AES-GCM.
 * If the text is not an E2EE envelope (e.g. legacy/plaintext), returns as-is.
 */
export async function decryptMessage(envelope: string, key: CryptoKey | null): Promise<string> {
  if (!envelope.startsWith(E2EE_PREFIX) || !key) {
    return envelope;
  }

  try {
    const rawPayload = envelope.slice(E2EE_PREFIX.length);
    const parts = rawPayload.split(':');
    if (parts.length !== 2) return envelope;

    const [ivB64, cipherB64] = parts;
    const iv = base64ToBytes(ivB64);
    const ciphertext = base64ToBytes(cipherB64);

    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv as unknown as BufferSource,
      },
      key,
      ciphertext as unknown as BufferSource
    );

    return new TextDecoder().decode(decryptedBuffer);
  } catch {
    // If decryption fails (e.g. wrong key), return placeholder
    return '🔒 [Encrypted message — decryption failed]';
  }
}
