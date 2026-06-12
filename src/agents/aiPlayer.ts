import type { Action } from '../types/poker';
import type { PokerTableInstance } from '../game/pokerTable';
import { cardsToShort } from '../game/cards';
import {
  AI_AGGRESSIVE_SEAT,
  AI_CONSERVATIVE_SEAT,
  HUMAN_SEAT,
} from '../game/constants';

export interface AIDecision {
  action: Action;
  betSize?: number;
}

type Position = 'button' | 'small_blind' | 'big_blind';

function getPosition(seat: number, button: number, activeSeats: number[]): Position {
  const ordered = [...activeSeats].sort((a, b) => a - b);
  const buttonIdx = ordered.indexOf(button);
  const sb = ordered[(buttonIdx + 1) % ordered.length];

  if (seat === button) return 'button';
  if (seat === sb) return 'small_blind';
  return 'big_blind';
}

function handStrength(holeCards: string[]): number {
  const ranks = holeCards.map((c) => c[0]);
  const suited = holeCards[0][1] === holeCards[1][1];
  const rankValues: Record<string, number> = {
    '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
    T: 10, J: 11, Q: 12, K: 13, A: 14,
  };
  const v1 = rankValues[ranks[0]] ?? 0;
  const v2 = rankValues[ranks[1]] ?? 0;
  const high = Math.max(v1, v2);
  const low = Math.min(v1, v2);
  let score = high * 2 + low;
  if (ranks[0] === ranks[1]) score += 20;
  if (suited) score += 4;
  if (high - low === 1) score += 3;
  return score;
}

/** AI player agent with configurable aggression and loss aversion. */
export function pickAIAction(seat: number, table: PokerTableInstance): AIDecision {
  const legal = table.legalActions();
  const { actions, chipRange } = legal;
  const hole = table.holeCards()[seat];
  const cards = hole ? cardsToShort(hole) : [];
  const stack = table.seats()[seat]?.stack ?? 0;
  const position = getPosition(seat, table.button(), [
    HUMAN_SEAT,
    AI_AGGRESSIVE_SEAT,
    AI_CONSERVATIVE_SEAT,
  ]);

  const isAggressive = seat === AI_AGGRESSIVE_SEAT;
  const aggression = isAggressive ? 0.75 : 0.25;
  const lossAversion = isAggressive ? 0.3 : 0.7;
  const strength = handStrength(cards);
  const positionBonus = position === 'button' ? 8 : position === 'small_blind' ? 4 : 0;
  const stackPressure = stack < 30 ? -6 : 0;
  const score = strength + positionBonus + stackPressure;

  const canRaise = actions.includes('raise') || actions.includes('bet');
  const raiseThreshold = isAggressive ? 22 : 30;

  if (canRaise && score >= raiseThreshold && Math.random() < aggression) {
    const min = chipRange?.min ?? 4;
    const raiseSize = Math.min(
      chipRange?.max ?? min,
      min + (isAggressive ? 6 : 2),
    );
    return {
      action: actions.includes('raise') ? 'raise' : 'bet',
      betSize: raiseSize,
    };
  }

  if (actions.includes('check')) {
    return { action: 'check' };
  }

  if (actions.includes('call')) {
    const callCost = chipRange?.min ?? 2;
    if (score < 14 && callCost > stack * 0.2 * lossAversion) {
      if (actions.includes('fold')) return { action: 'fold' };
    }
    return { action: 'call' };
  }

  if (actions.includes('fold')) {
    return { action: 'fold' };
  }

  return { action: actions[0] };
}
