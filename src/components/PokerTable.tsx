import type { TableView } from '../types/game';
import { CardDisplay } from './CardDisplay';
import { PlayerSeat } from './PlayerSeat';

const SEAT_POSITIONS = [
  'seat-pos--0',
  'seat-pos--1',
  'seat-pos--2',
  'seat-pos--3',
  'seat-pos--4',
  'seat-pos--5',
];

interface PokerTableProps {
  view: TableView;
}

export function PokerTable({ view }: PokerTableProps) {
  const potTotal = view.pots.reduce((sum, p) => sum + p.size, 0);

  return (
    <div className="poker-table-wrap">
      <div className="poker-table">
        <div className="poker-table__felt">
          <div className="poker-table__info">
            <span className="poker-table__street">
              {view.street ? view.street.toUpperCase() : '—'}
            </span>
            <span className="poker-table__pot">Pot ${potTotal}</span>
          </div>

          <div className="poker-table__board">
            {view.communityCards.length === 0 ? (
              <span className="poker-table__board-placeholder">Community cards</span>
            ) : (
              view.communityCards.map((card, i) => (
                <CardDisplay key={`board-${i}`} card={card} size={64} />
              ))
            )}
          </div>
        </div>

        {view.seats
          .filter((s) => s.isActive)
          .map((seat) => (
            <PlayerSeat
              key={seat.seat}
              seat={seat}
              className={SEAT_POSITIONS[seat.seat]}
            />
          ))}
      </div>
    </div>
  );
}
