import { useState } from 'react';
import './RoomCreated.css';

interface RoomCreatedProps {
  roomCode: string;
  nickname: string;
  onEnterRoom: () => void;
  onBack: () => void;
}

export default function RoomCreated({ roomCode, nickname, onEnterRoom, onBack }: RoomCreatedProps) {
  const [copied, setCopied] = useState(false);

  const roomUrl = `${window.location.origin}?join=${roomCode}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const el = document.createElement('textarea');
      el.value = roomCode;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join me on DoomChat',
          text: `Join my DoomChat room with code: ${roomCode}`,
          url: roomUrl,
        });
      } catch {
        // User cancelled or API unavailable — fall back to copy
        handleCopy();
      }
    } else {
      // No Web Share API — copy the link
      try {
        await navigator.clipboard.writeText(roomUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        handleCopy();
      }
    }
  };

  return (
    <main className="room-created-page" role="main">
      <div className="room-created-card animate-slide-up">
        <div className="rc-success-icon" aria-hidden="true">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        </div>

        <h1 className="rc-title">Room Created!</h1>
        <p className="rc-greeting">
          Ready, <strong>{nickname}</strong>. Share this code with others.
        </p>

        <div className="rc-code-block" aria-label={`Room code: ${roomCode}`}>
          <span className="rc-code-label">ROOM CODE</span>
          <div className="rc-code" role="text" aria-label={`Room code ${roomCode.split('').join(' ')}`}>
            {roomCode}
          </div>
        </div>

        <div className="rc-actions">
          <button
            id="rc-copy-btn"
            className="btn btn-secondary"
            onClick={handleCopy}
            aria-label={copied ? 'Code copied' : 'Copy room code'}
          >
            {copied ? (
              <>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Copied!
              </>
            ) : (
              <>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                Copy Code
              </>
            )}
          </button>

          <button
            id="rc-share-btn"
            className="btn btn-secondary"
            onClick={handleShare}
            aria-label="Share room link"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
            Share
          </button>
        </div>

        <button
          id="rc-enter-btn"
          className="btn btn-primary btn-full"
          onClick={onEnterRoom}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
            <polyline points="10 17 15 12 10 7" />
            <line x1="15" y1="12" x2="3" y2="12" />
          </svg>
          Enter Room
        </button>

        <button
          className="back-link"
          onClick={onBack}
          id="rc-back-btn"
        >
          ← Back to Home
        </button>
      </div>
    </main>
  );
}
