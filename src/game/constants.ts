import type { PlayerRole } from '../types/game';

export const HUMAN_SEAT = 0;
export const AI_AGGRESSIVE_SEAT = 2;
export const AI_CONSERVATIVE_SEAT = 4;

export const TABLE_SEATS = 6;
export const STARTING_STACK = 100;

export const SEAT_CONFIG: Record<
  number,
  { label: string; role: PlayerRole }
> = {
  [HUMAN_SEAT]: { label: 'You', role: 'human' },
  [AI_AGGRESSIVE_SEAT]: { label: 'Ace (Aggro)', role: 'ai_aggressive' },
  [AI_CONSERVATIVE_SEAT]: { label: 'Rock (Tight)', role: 'ai_conservative' },
};

export const ACTIVE_SEATS = [
  HUMAN_SEAT,
  AI_AGGRESSIVE_SEAT,
  AI_CONSERVATIVE_SEAT,
] as const;

export const HAND_RANKING_NAMES = [
  'High Card',
  'Pair',
  'Two Pair',
  'Three of a Kind',
  'Straight',
  'Flush',
  'Full House',
  'Four of a Kind',
  'Straight Flush',
  'Royal Flush',
] as const;
