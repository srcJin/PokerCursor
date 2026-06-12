import type { Action } from './poker';

export type Street = 'preflop' | 'flop' | 'turn' | 'river';

export type PlayerRole = 'human' | 'ai_aggressive' | 'ai_conservative';

export type AgentId =
  | 'dealer'
  | 'coach'
  | 'report'
  | 'ai_aggressive'
  | 'ai_conservative';

export type VisibilityScope =
  | 'visible_table'
  | 'human_and_visible_table'
  | 'own_hand_and_visible_table'
  | 'full_history';

export interface ActionLogEntry {
  seat: number;
  player: string;
  action: Action;
  betSize?: number;
  street: Street;
  timestamp: number;
  rationale?: string;
  thinkingProcess?: string[];
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

export interface AgentCharacteristic {
  label: string;
  value: string;
  score: number;
}

export interface AgentMemorySnapshot {
  agentId: AgentId;
  label: string;
  scope: VisibilityScope;
  shortTerm: string[];
  longTerm: string[];
  characteristics: AgentCharacteristic[];
  decisionsThisHand: number;
}

export interface AgentDecisionTrace {
  id: string;
  agentId: AgentId;
  label: string;
  seat?: number;
  street: Street | null;
  action?: Action;
  betSize?: number;
  observation: string[];
  shortTerm: string[];
  rationale: string;
  thinkingProcess: string[];
  visibleCards: string[];
  timestamp: number;
}

export interface PlayerRecord {
  seat: number;
  label: string;
  role: PlayerRole;
  startingCredit: number;
  credits: number;
  handsPlayed: number;
  wins: number;
  voluntaryActions: number;
  aggressiveActions: number;
  folds: number;
  net: number;
  recentResults: number[];
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
  thinkingProcess: string[];
}

export interface HandReport {
  highlights: string[];
  improvements: string[];
  summary: string;
  timeline: string[];
  decisionReviews: string[];
  thinkingProcess: string[];
}

export type PlayerAction = 'fold' | 'check' | 'call' | 'raise';

export interface AgentProfile {
  stackSize: number;
  aggression: number;
  lossAversion: number;
  bluffIndex: number;
  position: 'early' | 'middle' | 'late' | 'blinds';
  recentHistory: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}
