import type { PokerTableInstance } from '../game/pokerTable';

/** Dealer agent: manages hand lifecycle and button rotation. */
export function startNewHand(table: PokerTableInstance): void {
  if (table.isHandInProgress()) {
    return;
  }
  table.startHand();
}

export function endHand(table: PokerTableInstance): void {
  if (!table.isHandInProgress()) {
    return;
  }

  if (table.areBettingRoundsCompleted()) {
    table.showdown();
  }
}

export function getDealerSeat(table: PokerTableInstance): number {
  return table.button();
}
