import type { ErrorType } from '../types';
import './ErrorScreen.css';

interface ErrorScreenProps {
  type: ErrorType;
  message: string;
  roomCode?: string;
  onGoHome: () => void;
  onRetry?: () => void;
}

const errorMeta: Record<ErrorType, { title: string; icon: string }> = {
  room_not_found: { title: 'Room Not Found', icon: '🔍' },
  room_disbanded: { title: 'Room Closed', icon: '🚫' },
  room_full: { title: 'Room Full', icon: '👥' },
  connection_failed: { title: 'Connection Failed', icon: '📡' },
  server_error: { title: 'Server Error', icon: '⚠️' },
  rate_limited: { title: 'Slow Down', icon: '⏱️' },
};

export default function ErrorScreen({
  type,
  message,
  onGoHome,
  onRetry,
}: ErrorScreenProps) {
  const meta = errorMeta[type];

  return (
    <main className="error-screen" role="main">
      <div className="error-card animate-slide-up">
        <div className="error-icon" aria-hidden="true">{meta.icon}</div>
        <h1 className="error-title">{meta.title}</h1>
        <p className="error-message">{message}</p>

        <div className="error-actions">
          {onRetry && (
            <button
              id="error-retry-btn"
              className="btn btn-secondary"
              onClick={onRetry}
            >
              Try Again
            </button>
          )}
          <button
            id="error-home-btn"
            className="btn btn-primary"
            onClick={onGoHome}
          >
            Back to Home
          </button>
        </div>
      </div>
    </main>
  );
}
