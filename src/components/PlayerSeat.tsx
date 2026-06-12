import type { SeatView } from '../types/game';
import { CardDisplay } from './CardDisplay';

interface PlayerSeatProps {
  seat: SeatView;
  className?: string;
}

export function PlayerSeat({ seat, className = '' }: PlayerSeatProps) {
  return (
    <div
      className={`player-seat ${seat.isToAct ? 'player-seat--active' : ''} ${seat.isButton ? 'player-seat--button' : ''} ${className}`}
    >
      <div className="player-seat__name">{seat.label}</div>
      <div className="player-seat__stack">${seat.stack}</div>
      {seat.betSize > 0 && (
        <div className="player-seat__bet">Bet ${seat.betSize}</div>
      )}
      {seat.isButton && <div className="player-seat__dealer">D</div>}
      {seat.holeCards && (
        <div className="player-seat__cards">
          {seat.holeCards.map((card, i) => (
            <CardDisplay key={`${seat.seat}-${i}`} card={card} size={56} />
          ))}
        </div>
      )}
    </div>
  );
}
