import { useState, useRef, useCallback } from 'react';
import './MessageInput.css';

interface MessageInputProps {
  onSend: (text: string) => void;
  onTypingStart: () => void;
  onTypingStop: () => void;
  disabled?: boolean;
  placeholder?: string;
}

const MAX_LENGTH = 1000;

export default function MessageInput({
  onSend,
  onTypingStart,
  onTypingStop,
  disabled = false,
  placeholder = 'Type a message…',
}: MessageInputProps) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const maxHeight = 120;
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    if (value.length > MAX_LENGTH) return;
    setText(value);
    adjustHeight();
    if (value.trim()) {
      onTypingStart();
    } else {
      onTypingStop();
    }
  };

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText('');
    onTypingStop();
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.focus();
    }
  }, [text, disabled, onSend, onTypingStop]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const remaining = MAX_LENGTH - text.length;
  const showCounter = remaining < 100;

  return (
    <div className="message-input-wrapper">
      <div className={`message-input-container${disabled ? ' disabled' : ''}`}>
        <textarea
          ref={textareaRef}
          id="message-input"
          className="message-textarea"
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={onTypingStop}
          placeholder={disabled ? 'Disconnected from room' : placeholder}
          disabled={disabled}
          rows={1}
          maxLength={MAX_LENGTH}
          aria-label="Message input"
          aria-describedby="message-input-hint"
          autoComplete="off"
          spellCheck
        />

        {showCounter && (
          <span
            className={`char-counter${remaining < 20 ? ' char-counter-warning' : ''}`}
            aria-live="polite"
            aria-label={`${remaining} characters remaining`}
          >
            {remaining}
          </span>
        )}

        <button
          id="send-message-btn"
          className={`send-btn${!text.trim() || disabled ? ' send-btn-disabled' : ''}`}
          onClick={handleSend}
          onMouseDown={(e) => {
            // Prevent textarea from losing focus on mouse/touch
            e.preventDefault();
          }}
          disabled={!text.trim() || disabled}
          aria-label="Send message"
          type="button"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>

      <p id="message-input-hint" className="message-input-hint">
        Enter to send · Shift+Enter for new line
      </p>
    </div>
  );
}
