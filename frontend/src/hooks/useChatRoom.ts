import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  ChatMessage,
  ClientEvent,
  ConnectionState,
  DisplayMessage,
  Participant,
  ServerEvent,
  SystemMessage,
} from '../types';
import { deriveRoomKey, encryptMessage, decryptMessage } from '../lib/crypto';
import { useWebSocket } from './useWebSocket';

// ─────────────────────────────────────────────────────────────────────────────
// useChatRoom — manages all chat room state from WebSocket events with E2EE
// ─────────────────────────────────────────────────────────────────────────────

interface UseChatRoomOptions {
  roomCode: string;
  nickname: string;
  onDisbanded: (message: string) => void;
}

interface UseChatRoomReturn {
  connectionState: ConnectionState;
  messages: DisplayMessage[];
  participants: Participant[];
  typingNicknames: string[];
  participantId: string | null;
  isOwner: boolean;
  sendMessage: (text: string) => void;
  sendTypingStart: () => void;
  sendTypingStop: () => void;
  leaveRoom: () => void;
  disbandRoom: () => void;
}

const TYPING_DEBOUNCE_MS = 800;

let systemMsgCounter = 0;
function makeSystemMsg(text: string): SystemMessage {
  return {
    id: `sys-${++systemMsgCounter}-${Date.now()}`,
    text,
    timestamp: Date.now(),
    isSystem: true,
  };
}

export function useChatRoom({
  roomCode,
  nickname,
  onDisbanded,
}: UseChatRoomOptions): UseChatRoomReturn {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [typingNicknames, setTypingNicknames] = useState<string[]>([]);
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);

  // E2EE key for the room
  const roomKeyRef = useRef<CryptoKey | null>(null);

  // Derive E2EE key asynchronously when roomCode is provided
  useEffect(() => {
    let active = true;
    deriveRoomKey(roomCode).then((key) => {
      if (active) {
        roomKeyRef.current = key;
      }
    });
    return () => {
      active = false;
    };
  }, [roomCode]);

  // Use refs to avoid stale closures in event handlers
  const participantIdRef = useRef<string | null>(null);
  const sendRef = useRef<((event: ClientEvent) => void) | null>(null);

  const typingDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  const wsUrl = `/api/rooms/${roomCode}/ws`;

  const addSystemMessage = useCallback((text: string) => {
    setMessages((prev) => [...prev, makeSystemMsg(text)]);
  }, []);

  const handleMessage = useCallback(
    (event: ServerEvent) => {
      switch (event.type) {
        case 'room_state': {
          const e = event as {
            type: 'room_state';
            yourParticipantId: string;
            participants: Participant[];
            isOwner: boolean;
            roomCode: string;
          };
          participantIdRef.current = e.yourParticipantId;
          setParticipantId(e.yourParticipantId);
          setParticipants(e.participants);
          setIsOwner(e.isOwner);
          break;
        }

        case 'participant_joined': {
          const e = event as {
            type: 'participant_joined';
            participant: Participant;
            participants?: Participant[];
            systemMessage: string;
          };
          if (e.participants) {
            setParticipants(e.participants);
          } else {
            setParticipants((prev) => {
              if (prev.find((p) => p.id === e.participant.id)) return prev;
              return [...prev, e.participant];
            });
          }
          addSystemMessage(e.systemMessage);
          break;
        }

        case 'participant_left': {
          const e = event as {
            type: 'participant_left';
            participantId: string;
            nickname: string;
            participants?: Participant[];
            systemMessage: string;
          };
          if (e.participants) {
            setParticipants(e.participants);
          } else {
            setParticipants((prev) => prev.filter((p) => p.id !== e.participantId));
          }
          addSystemMessage(e.systemMessage);
          break;
        }

        case 'message': {
          const e = event as { type: 'message'; message: ChatMessage };
          // Decrypt client-side if E2EE envelope
          if (roomKeyRef.current) {
            decryptMessage(e.message.text, roomKeyRef.current).then((decryptedText) => {
              setMessages((prev) => [...prev, { ...e.message, text: decryptedText }]);
            });
          } else {
            // If key derivation is still in progress, derive and decrypt
            deriveRoomKey(roomCode).then((key) => {
              roomKeyRef.current = key;
              return decryptMessage(e.message.text, key);
            }).then((decryptedText) => {
              setMessages((prev) => [...prev, { ...e.message, text: decryptedText }]);
            });
          }
          break;
        }

        case 'typing': {
          const e = event as { type: 'typing'; typingNicknames: string[] };
          setTypingNicknames(e.typingNicknames);
          break;
        }

        case 'room_disbanded': {
          const e = event as { type: 'room_disbanded'; message: string };
          onDisbanded(e.message);
          break;
        }

        case 'ownership_changed': {
          const e = event as {
            type: 'ownership_changed';
            newOwnerId: string;
            newOwnerNickname: string;
            participants?: Participant[];
            systemMessage: string;
          };
          if (e.participants) {
            setParticipants(e.participants);
          } else {
            setParticipants((prev) =>
              prev.map((p) => ({ ...p, isOwner: p.id === e.newOwnerId }))
            );
          }
          // Use ref to avoid stale closure
          setIsOwner(participantIdRef.current === e.newOwnerId);
          addSystemMessage(e.systemMessage);
          break;
        }

        case 'rate_limited': {
          const e = event as { type: 'rate_limited'; message: string };
          addSystemMessage(`⚠️ ${e.message}`);
          break;
        }

        case 'error': {
          const e = event as { type: 'error'; code: string; message: string };
          console.warn('[Room] Server error:', e.code, e.message);
          break;
        }

        case 'pong':
          break;

        default:
          break;
      }
    },
    [addSystemMessage, onDisbanded, roomCode]
  );

  // onConnect sends the room_join event directly using the open socket send function
  const onConnect = useCallback((sendFn: (event: ClientEvent) => void) => {
    sendFn({ type: 'room_join', nickname, roomCode });
  }, [nickname, roomCode]);

  const { connectionState, send, disconnect } = useWebSocket({
    url: wsUrl,
    onMessage: handleMessage,
    onConnect,
  });

  // Keep sendRef current
  useEffect(() => {
    sendRef.current = send;
  }, [send]);

  // ── Message sending ────────────────────────────────────────────────────────

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || trimmed.length > 1000) return;

      // Encrypt message client-side with AES-GCM before transmitting
      let payloadText = trimmed;
      try {
        let key = roomKeyRef.current;
        if (!key) {
          key = await deriveRoomKey(roomCode);
          roomKeyRef.current = key;
        }
        payloadText = await encryptMessage(trimmed, key);
      } catch (err) {
        console.warn('[E2EE] Encryption error:', err);
      }

      send({ type: 'message', text: payloadText });

      // Stop typing indicator when sending
      if (isTypingRef.current) {
        isTypingRef.current = false;
        send({ type: 'typing_stop' });
      }
      if (typingDebounceRef.current) {
        clearTimeout(typingDebounceRef.current);
        typingDebounceRef.current = null;
      }
    },
    [send, roomCode]
  );

  // ── Typing indicators ──────────────────────────────────────────────────────

  const sendTypingStart = useCallback(() => {
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      send({ type: 'typing_start' });
    }

    // Reset debounce timer
    if (typingDebounceRef.current) {
      clearTimeout(typingDebounceRef.current);
    }
    typingDebounceRef.current = setTimeout(() => {
      if (isTypingRef.current) {
        isTypingRef.current = false;
        send({ type: 'typing_stop' });
      }
    }, TYPING_DEBOUNCE_MS);
  }, [send]);

  const sendTypingStop = useCallback(() => {
    if (typingDebounceRef.current) {
      clearTimeout(typingDebounceRef.current);
      typingDebounceRef.current = null;
    }
    if (isTypingRef.current) {
      isTypingRef.current = false;
      send({ type: 'typing_stop' });
    }
  }, [send]);

  // ── Leave / disband ────────────────────────────────────────────────────────

  const leaveRoom = useCallback(() => {
    send({ type: 'leave' });
    disconnect();
  }, [send, disconnect]);

  const disbandRoom = useCallback(() => {
    send({ type: 'disband' });
  }, [send]);

  // Cleanup typing on unmount
  useEffect(() => {
    return () => {
      if (typingDebounceRef.current) {
        clearTimeout(typingDebounceRef.current);
      }
    };
  }, []);

  return {
    connectionState,
    messages,
    participants,
    typingNicknames,
    participantId,
    isOwner,
    sendMessage,
    sendTypingStart,
    sendTypingStop,
    leaveRoom,
    disbandRoom,
  };
}
