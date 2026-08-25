import './TypingIndicator.css';

interface TypingIndicatorProps {
  typingNicknames: string[];
}

function formatTypingText(names: string[]): string {
  if (names.length === 0) return '';
  if (names.length === 1) return `${names[0]} is typing`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing`;
  return `${names[0]}, ${names[1]} and ${names.length - 2} others are typing`;
}

export default function TypingIndicator({ typingNicknames }: TypingIndicatorProps) {
  if (typingNicknames.length === 0) return <div className="typing-indicator-placeholder" aria-hidden="true" />;

  return (
    <div className="typing-indicator" role="status" aria-live="polite" aria-label={formatTypingText(typingNicknames)}>
      <div className="typing-dots" aria-hidden="true">
        <span className="typing-dot" />
        <span className="typing-dot" />
        <span className="typing-dot" />
      </div>
      <span className="typing-text">{formatTypingText(typingNicknames)}</span>
    </div>
  );
}
