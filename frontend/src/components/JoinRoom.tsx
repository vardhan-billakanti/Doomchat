import { useState, useRef } from 'react';
import { apiUrl } from '../lib/api';
import type { RoomStatusResponse } from '../types';
import './FormPage.css';

interface JoinRoomProps {
  onJoined: (roomCode: string, nickname: string) => void;
  onBack: () => void;
  prefillCode?: string;
}

const ROOM_CODE_REGEX = /^[A-Z2-9]{6}$/;

export default function JoinRoom({ onJoined, onBack, prefillCode = '' }: JoinRoomProps) {
  const [nickname, setNickname] = useState('');
  const [roomCode, setRoomCode] = useState(prefillCode);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const nicknameRef = useRef<HTMLInputElement>(null);

  const handleRoomCodeChange = (value: string) => {
    // Allow only valid characters, uppercase
    const cleaned = value
      .toUpperCase()
      .replace(/[^A-Z2-9]/g, '')
      .slice(0, 6);
    setRoomCode(cleaned);
    if (error) setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedNick = nickname.trim();
    const upperCode = roomCode.toUpperCase().trim();

    if (!trimmedNick) {
      setError('Please enter a nickname.');
      nicknameRef.current?.focus();
      return;
    }
    if (trimmedNick.length > 32) {
      setError('Nickname must be 32 characters or fewer.');
      return;
    }
    if (!ROOM_CODE_REGEX.test(upperCode)) {
      setError('Room code must be 6 characters (letters and numbers).');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const res = await fetch(apiUrl(`/api/rooms/${upperCode}`));
      const status = await res.json() as RoomStatusResponse;

      if (!status.exists) {
        setError('Room not found. Check the code and try again.');
        setLoading(false);
        return;
      }

      if (status.disbanded) {
        setError('This room has been closed.');
        setLoading(false);
        return;
      }

      onJoined(upperCode, trimmedNick);
    } catch {
      setError('Could not connect to the server. Please try again.');
      setLoading(false);
    }
  };

  return (
    <main className="form-page" role="main">
      <div className="form-card animate-slide-up">
        <button
          className="back-btn"
          onClick={onBack}
          aria-label="Go back to home"
          id="join-back-btn"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          Back
        </button>

        <div className="form-header">
          <div className="form-icon" aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
              <polyline points="10 17 15 12 10 7" />
              <line x1="15" y1="12" x2="3" y2="12" />
            </svg>
          </div>
          <h1 className="form-title">Join a Room</h1>
          <p className="form-subtitle">Enter your nickname and the room code to join</p>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="join-nickname">
                Your Nickname
              </label>
              <input
                ref={nicknameRef}
                id="join-nickname"
                type="text"
                className="input"
                placeholder="e.g. Rahul"
                value={nickname}
                onChange={(e) => {
                  setNickname(e.target.value);
                  if (error) setError('');
                }}
                maxLength={32}
                autoComplete="off"
                autoFocus
                spellCheck={false}
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="join-room-code">
                Room Code
              </label>
              <input
                id="join-room-code"
                type="text"
                className="input input-code"
                placeholder="K7X4P9"
                value={roomCode}
                onChange={(e) => handleRoomCodeChange(e.target.value)}
                maxLength={6}
                autoComplete="off"
                spellCheck={false}
                inputMode="text"
                disabled={loading}
                aria-describedby={error ? 'join-error' : undefined}
                aria-invalid={!!error}
              />
            </div>

            {error && (
              <span id="join-error" className="form-error" role="alert">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" stroke="white" strokeWidth="2" strokeLinecap="round" />
                  <circle cx="12" cy="16" r="1" fill="white" />
                </svg>
                {error}
              </span>
            )}
          </div>

          <button
            id="join-room-submit-btn"
            type="submit"
            className="btn btn-primary btn-full"
            style={{ marginTop: 'var(--space-6)' }}
            disabled={loading || !nickname.trim() || roomCode.length !== 6}
            aria-busy={loading}
          >
            {loading ? (
              <>
                <span className="spinner" aria-hidden="true" />
                Joining...
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                  <polyline points="10 17 15 12 10 7" />
                  <line x1="15" y1="12" x2="3" y2="12" />
                </svg>
                Join Room
              </>
            )}
          </button>
        </form>
      </div>
    </main>
  );
}
