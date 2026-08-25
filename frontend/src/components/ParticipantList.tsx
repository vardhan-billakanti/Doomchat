import type { Participant } from '../types';
import './ParticipantList.css';

interface ParticipantListProps {
  participants: Participant[];
  currentParticipantId: string | null;
}

export default function ParticipantList({
  participants,
  currentParticipantId,
}: ParticipantListProps) {
  const sorted = [...participants].sort((a, b) => {
    if (a.isOwner) return -1;
    if (b.isOwner) return 1;
    return a.joinedAt - b.joinedAt;
  });

  return (
    <aside className="participant-list" aria-label="Room participants">
      <div className="participant-list-header">
        <span className="participant-list-title">
          Participants
        </span>
        <span className="participant-count-badge" aria-label={`${participants.length} participants`}>
          {participants.length}
        </span>
      </div>

      <ul className="participant-items" role="list">
        {sorted.map((p) => {
          const isYou = p.id === currentParticipantId;
          return (
            <li
              key={p.id}
              className={`participant-item${isYou ? ' participant-item-you' : ''}`}
              aria-label={`${p.nickname}${p.isOwner ? ', room owner' : ''}${isYou ? ', you' : ''}`}
            >
              <span className="participant-avatar" aria-hidden="true">
                {p.isOwner ? '👑' : <span className="online-dot" />}
              </span>
              <span className="participant-name">
                {p.nickname}
                {isYou && <span className="you-label"> (you)</span>}
              </span>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
