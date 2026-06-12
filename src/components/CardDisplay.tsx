interface CardDisplayProps {
  card: string;
  size?: number;
}

const SUIT_SYMBOL: Record<string, string> = {
  c: '♣',
  d: '♦',
  h: '♥',
  s: '♠',
};

const SUIT_COLOR: Record<string, string> = {
  c: '#1a1a1a',
  d: '#c0392b',
  h: '#c0392b',
  s: '#1a1a1a',
};

export function CardDisplay({ card, size = 72 }: CardDisplayProps) {
  if (card === 'back') {
    return (
      <div
        className="card card--back"
        style={{ width: size * 0.72, height: size }}
        aria-label="Hidden card"
      />
    );
  }

  const rank = card.slice(0, -1);
  const suitKey = card.slice(-1);
  const suit = SUIT_SYMBOL[suitKey] ?? suitKey;

  return (
    <div
      className="card"
      style={{
        width: size * 0.72,
        height: size,
        color: SUIT_COLOR[suitKey] ?? '#1a1a1a',
      }}
      aria-label={`${rank} of ${suitKey}`}
    >
      <span className="card__rank">{rank}</span>
      <span className="card__suit">{suit}</span>
    </div>
  );
}
