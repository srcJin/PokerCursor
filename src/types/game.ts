import type { Action } from './poker';

export type Street = 'preflop' | 'flop' | 'turn' | 'river';

export type PlayerRole = 'human' | 'ai_aggressive' | 'ai_conservative';

export interface ActionLogEntry {
  seat: number;
  player: string;
  action: Action;
  betSize?: number;
  street: Street;
  timestamp: number;
}

export interface SeatView {
  seat: number;
  label: string;
  role: PlayerRole;
  stack: number;
  betSize: number;
  holeCards: string[] | null;
  isActive: boolean;
  isToAct: boolean;
  isButton: boolean;
}

export interface TableView {
  handInProgress: boolean;
  street: Street | null;
  communityCards: string[];
  seats: SeatView[];
  pots: { size: number; eligiblePlayers: number[] }[];
  humanToAct: boolean;
  legalActions: Action[];
  chipRange?: { min: number; max: number };
  winners: WinnerView[] | null;
}

export interface WinnerView {
  seat: number;
  label: string;
  handName: string;
  cards: string[];
}

export interface CoachAdvice {
  summary: string;
  options: { action: Action; label: string; rationale: string }[];
  equity?: string;
}

export interface HandReport {
  highlights: string[];
  improvements: string[];
  summary: string;
}
