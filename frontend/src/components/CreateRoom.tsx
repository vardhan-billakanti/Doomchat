import { useState, useRef } from 'react';
import { apiUrl } from '../lib/api';
import type { CreateRoomResponse } from '../types';
import './FormPage.css';

interface CreateRoomProps {
  onRoomCreated: (roomCode: string, nickname: string) => void;
  onBack: () => void;
}

export default function CreateRoom({ onRoomCreated, onBack }: CreateRoomProps) {
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = nickname.trim();

    if (!trimmed) {
      setError('Please enter a nickname.');
      inputRef.current?.focus();
      return;
    }
    if (trimmed.length > 32) {
      setError('Nickname must be 32 characters or fewer.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const res = await fetch(apiUrl('/api/rooms'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: trimmed }),
      });

      if (!res.ok) {
        const body = await res.json() as { error?: string };
        throw new Error(body.error ?? 'Failed to create room.');
      }

      const data = await res.json() as CreateRoomResponse;
      onRoomCreated(data.roomCode, trimmed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create room. Please try again.');
    } finally {
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
          id="create-back-btn"
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
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
              <line x1="12" y1="8" x2="12" y2="16" />
              <line x1="8" y1="12" x2="16" y2="12" />
            </svg>
          </div>
          <h1 className="form-title">Create a Room</h1>
          <p className="form-subtitle">Choose a nickname — you'll appear as this in the chat</p>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label className="form-label" htmlFor="create-nickname">
              Your Nickname
            </label>
            <input
              ref={inputRef}
              id="create-nickname"
              type="text"
              className={`input${error ? ' input-error' : ''}`}
              placeholder="e.g. Vardhan"
              value={nickname}
              onChange={(e) => {
                setNickname(e.target.value);
                if (error) setError('');
              }}
              maxLength={32}
              autoComplete="off"
              autoFocus
              spellCheck={false}
              aria-describedby={error ? 'create-nickname-error' : undefined}
              aria-invalid={!!error}
              disabled={loading}
            />
            {error && (
              <span id="create-nickname-error" className="form-error" role="alert">
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
            id="create-room-submit-btn"
            type="submit"
            className="btn btn-primary btn-full"
            disabled={loading || !nickname.trim()}
            aria-busy={loading}
          >
            {loading ? (
              <>
                <span className="spinner" aria-hidden="true" />
                Creating room...
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                Create Room
              </>
            )}
          </button>
        </form>

        <p className="form-footnote">
          You'll receive a shareable room code after creation.
        </p>
      </div>
    </main>
  );
}
