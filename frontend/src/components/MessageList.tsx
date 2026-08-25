import { useEffect, useRef } from 'react';
import type { DisplayMessage } from '../types';
import { isSystemMessage } from '../types';
import './MessageList.css';

interface MessageListProps {
  messages: DisplayMessage[];
  currentParticipantId: string | null;
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function MessageList({ messages, currentParticipantId }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const shouldScrollRef = useRef(true);

  // Track if the user has scrolled up (to avoid forcing scroll to bottom)
  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    shouldScrollRef.current = atBottom;
  };

  useEffect(() => {
    if (shouldScrollRef.current && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="message-list message-list-empty" role="log" aria-live="polite" aria-label="Chat messages">
        <div className="empty-state">
          <div className="empty-icon" aria-hidden="true">💬</div>
          <p className="empty-title">No messages yet</p>
          <p className="empty-subtitle">Be the first to say something.</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="message-list"
      role="log"
      aria-live="polite"
      aria-label="Chat messages"
      onScroll={handleScroll}
    >
      {messages.map((msg, index) => {
        if (isSystemMessage(msg)) {
          return (
            <div key={msg.id} className="system-message" role="status">
              <span className="system-message-text">{msg.text}</span>
              <span className="system-message-time" aria-label={`at ${formatTime(msg.timestamp)}`}>
                {formatTime(msg.timestamp)}
              </span>
            </div>
          );
        }

        const isOwn = msg.senderId === currentParticipantId;

        // Group consecutive messages from same sender
        const prevMsg = messages[index - 1];
        const isGrouped =
          prevMsg &&
          !isSystemMessage(prevMsg) &&
          prevMsg.senderId === msg.senderId &&
          msg.timestamp - prevMsg.timestamp < 60000;

        return (
          <div
            key={msg.id}
            className={`message-wrapper${isOwn ? ' message-wrapper-own' : ''}${isGrouped ? ' message-grouped' : ''}`}
          >
            {!isGrouped && (
              <div className={`message-meta${isOwn ? ' message-meta-own' : ''}`}>
                <span className="message-author">
                  {isOwn ? 'You' : msg.nickname}
                </span>
                <span className="message-time" aria-label={`sent at ${formatTime(msg.timestamp)}`}>
                  {formatTime(msg.timestamp)}
                </span>
              </div>
            )}
            <div
              className={`message-bubble${isOwn ? ' message-bubble-own' : ''}`}
              aria-label={`${isOwn ? 'You' : msg.nickname}: ${msg.text}`}
            >
              {msg.text}
            </div>
          </div>
        );
      })}
      <div ref={bottomRef} aria-hidden="true" />
    </div>
  );
}
