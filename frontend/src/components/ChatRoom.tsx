import { useState, useCallback } from 'react';
import { useChatRoom } from '../hooks/useChatRoom';
import ConnectionStatus from './ConnectionStatus';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import ParticipantList from './ParticipantList';
import TypingIndicator from './TypingIndicator';
import ConfirmModal from './ConfirmModal';
import './ChatRoom.css';

interface ChatRoomProps {
  roomCode: string;
  nickname: string;
  onLeave: () => void;
  onDisbanded: (message: string) => void;
}

type Modal = 'leave' | 'disband' | null;

export default function ChatRoom({
  roomCode,
  nickname,
  onLeave,
  onDisbanded,
}: ChatRoomProps) {
  const [activeModal, setActiveModal] = useState<Modal>(null);
  const [showParticipants, setShowParticipants] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const handleDisbanded = useCallback(
    (message: string) => {
      setActiveModal(null);
      onDisbanded(message);
    },
    [onDisbanded]
  );

  const {
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
  } = useChatRoom({ roomCode, nickname, onDisbanded: handleDisbanded });

  const handleLeaveConfirm = () => {
    setActiveModal(null);
    leaveRoom();
    onLeave();
  };

  const handleDisbandConfirm = () => {
    setActiveModal(null);
    disbandRoom();
  };

  const isDisconnected = connectionState === 'disconnected';

  // Filter out current user from typing names
  const visibleTypingNames = typingNicknames.filter((n) => {
    // Find our own nickname to exclude from typing indicator
    const us = participants.find((p) => p.id === participantId);
    return n !== us?.nickname;
  });

  return (
    <div className="chat-room" role="main">
      {/* ── Header ── */}
      <header className="chat-header" role="banner">
        <div className="chat-header-left">
          <span className="chat-wordmark">
            <span className="wordmark">DOOM</span>
            <span className="wordmark wordmark-accent">CHAT</span>
          </span>
          <div className="room-info">
            <span className="room-code-label">Room:</span>
            <span
              className="room-code-value font-mono"
              aria-label={`Room code ${roomCode.split('').join(' ')}`}
            >
              {roomCode}
            </span>
          </div>
        </div>

        <div className="chat-header-center" aria-hidden="true">
          <ConnectionStatus state={connectionState} />
        </div>

        <div className="chat-header-right">
          <button
            id="toggle-participants-btn"
            className={`header-btn${showParticipants ? ' header-btn-active' : ''}`}
            onClick={() => setShowParticipants((v) => !v)}
            aria-label={`${showParticipants ? 'Hide' : 'Show'} participants. ${participants.length} online`}
            aria-pressed={showParticipants}
          >
            <span className="online-indicator" aria-hidden="true" />
            <span>{participants.length}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </button>

          {/* Menu */}
          <div className="header-menu-wrapper">
            <button
              id="room-menu-btn"
              className={`header-btn${showMenu ? ' header-btn-active' : ''}`}
              onClick={() => setShowMenu((v) => !v)}
              aria-label="Room options menu"
              aria-expanded={showMenu}
              aria-haspopup="menu"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="5" r="1" fill="currentColor" />
                <circle cx="12" cy="12" r="1" fill="currentColor" />
                <circle cx="12" cy="19" r="1" fill="currentColor" />
              </svg>
            </button>

            {showMenu && (
              <>
                <div
                  className="menu-backdrop"
                  onClick={() => setShowMenu(false)}
                  aria-hidden="true"
                />
                <div className="header-menu" role="menu" aria-label="Room options">
                  <div className="menu-section">
                    <div className="menu-room-info">
                      <span className="menu-room-code font-mono">{roomCode}</span>
                      {isOwner && (
                        <span className="menu-owner-badge">
                          👑 Owner
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="menu-divider" aria-hidden="true" />

                  <button
                    id="leave-room-btn"
                    className="menu-item"
                    role="menuitem"
                    onClick={() => {
                      setShowMenu(false);
                      setActiveModal('leave');
                    }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <polyline points="16 17 21 12 16 7" />
                      <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                    Leave Room
                  </button>

                  {isOwner && (
                    <button
                      id="disband-room-btn"
                      className="menu-item menu-item-danger"
                      role="menuitem"
                      onClick={() => {
                        setShowMenu(false);
                        setActiveModal('disband');
                      }}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                      Disband Room
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="chat-body">
        {/* Message area */}
        <div className="chat-main">
          <MessageList
            messages={messages}
            currentParticipantId={participantId}
          />
          <TypingIndicator typingNicknames={visibleTypingNames} />
          <MessageInput
            onSend={sendMessage}
            onTypingStart={sendTypingStart}
            onTypingStop={sendTypingStop}
            disabled={isDisconnected}
          />
        </div>

        {/* Participant sidebar (desktop always, mobile toggled) */}
        {showParticipants && (
          <ParticipantList
            participants={participants}
            currentParticipantId={participantId}
          />
        )}
      </div>

      {/* ── Modals ── */}
      {activeModal === 'leave' && (
        <ConfirmModal
          title="Leave Room?"
          description={
            isOwner && participants.length > 1
              ? 'You are the owner. Leaving will transfer ownership to the next participant.'
              : 'You will be disconnected from this room.'
          }
          confirmLabel="Leave Room"
          onConfirm={handleLeaveConfirm}
          onCancel={() => setActiveModal(null)}
        />
      )}

      {activeModal === 'disband' && (
        <ConfirmModal
          title="Disband this room?"
          description="This will disconnect everyone and permanently close the room. This action cannot be undone."
          confirmLabel="Disband Room"
          variant="danger"
          onConfirm={handleDisbandConfirm}
          onCancel={() => setActiveModal(null)}
        />
      )}
    </div>
  );
}
