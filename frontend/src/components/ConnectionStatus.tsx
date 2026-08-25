import type { ConnectionState } from '../types';
import './ConnectionStatus.css';

interface ConnectionStatusProps {
  state: ConnectionState;
  compact?: boolean;
}

const stateConfig: Record<
  ConnectionState,
  { label: string; className: string; icon: string }
> = {
  connected: { label: 'Connected', className: 'status-connected', icon: '●' },
  connecting: { label: 'Connecting...', className: 'status-connecting', icon: '◌' },
  reconnecting: { label: 'Reconnecting...', className: 'status-reconnecting', icon: '◌' },
  disconnected: { label: 'Disconnected', className: 'status-disconnected', icon: '●' },
};

export default function ConnectionStatus({ state, compact = false }: ConnectionStatusProps) {
  const config = stateConfig[state];

  return (
    <div
      className={`connection-status ${config.className}${compact ? ' compact' : ''}`}
      role="status"
      aria-live="polite"
      aria-label={`Connection status: ${config.label}`}
    >
      <span className="status-dot" aria-hidden="true" />
      {!compact && <span className="status-label">{config.label}</span>}
    </div>
  );
}
