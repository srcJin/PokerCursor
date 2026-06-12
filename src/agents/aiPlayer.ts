import type { Action } from '../types/poker';
import {
  AI_AGGRESSIVE_SEAT,
  AI_CONSERVATIVE_SEAT,
  HUMAN_SEAT,
} from '../game/constants';
import type { AgentDecisionTrace, AgentMemorySnapshot, TableView } from '../types/game';

export interface AIDecision {
  action: Action;
  betSize?: number;
  rationale: string;
  thinkingProcess: string[];
  observation: string[];
}

export interface AIDecisionResult {
  decision: AIDecision;
  trace: AgentDecisionTrace;
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

export function summarizeObservation(view: TableView, seat: number, cards: string[]): string[] {
  const pot = view.pots.reduce((sum, p) => sum + p.size, 0);
  const board = view.communityCards.length ? view.communityCards.join(' ') : 'none';
  const player = view.seats.find((item) => item.seat === seat);
  const facing = view.legalActions.includes('call') ? 'facing a bet' : 'not facing a bet';

  return [
    `Hole cards: ${cards.join(' ') || 'unknown'}`,
    `Board: ${board}`,
    `Pot: $${pot}; stack: $${player?.stack ?? 0}; ${facing}`,
    `Legal actions: ${view.legalActions.join(', ')}`,
  ];
}

export function buildAIDecisionTrace(
  decision: AIDecision,
  seat: number,
  view: TableView,
  memory: AgentMemorySnapshot,
  cards: string[],
): AgentDecisionTrace {
  const visibleCards = [
    ...cards,
    ...view.communityCards,
  ];

  return {
    id: `${memory.agentId}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    agentId: memory.agentId,
    label: memory.label,
    seat,
    street: view.street,
    action: decision.action,
    betSize: decision.betSize,
    observation: decision.observation,
    shortTerm: memory.shortTerm,
    rationale: decision.rationale,
    thinkingProcess: decision.thinkingProcess,
    visibleCards,
    timestamp: Date.now(),
  };
}

/** AI player agent with configurable aggression and loss aversion. */
export function pickAIAction(
  seat: number,
  view: TableView,
  memory: AgentMemorySnapshot,
): AIDecisionResult {
  const { legalActions: actions, chipRange } = view;
  const player = view.seats.find((item) => item.seat === seat);
  const cards = player?.holeCards?.filter((card) => card !== 'back') ?? [];
  const stack = player?.stack ?? 0;
  const button = view.seats.find((item) => item.isButton)?.seat ?? HUMAN_SEAT;
  const position = getPosition(seat, button, [
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
  const observation = summarizeObservation(view, seat, cards);

  if (canRaise && score >= raiseThreshold && Math.random() < aggression) {
    const min = chipRange?.min ?? 4;
    const raiseSize = Math.min(
      chipRange?.max ?? min,
      min + (isAggressive ? 6 : 2),
    );
    const decision: AIDecision = {
      action: actions.includes('raise') ? 'raise' : 'bet',
      betSize: raiseSize,
      observation,
      rationale: `${memory.label} rates private hand strength ${score} with ${position} position and chooses pressure.`,
      thinkingProcess: [
        `Scoped cards produce a hand-strength score of ${score}.`,
        `${position} position adds pressure value.`,
        `${memory.label}'s long-term style favors aggression when the raise threshold is met.`,
      ],
    };
    return { decision, trace: buildAIDecisionTrace(decision, seat, view, memory, cards) };
  }

  if (actions.includes('check')) {
    const decision = {
      action: 'check' as const,
      observation,
      rationale: `${memory.label} keeps the pot controlled because no call is required.`,
      thinkingProcess: [
        'No chips are required to continue.',
        'Checking preserves stack and keeps options open for the next street.',
      ],
    };
    return { decision, trace: buildAIDecisionTrace(decision, seat, view, memory, cards) };
  }

  if (actions.includes('call')) {
    const callCost = chipRange?.min ?? 2;
    if (score < 14 && callCost > stack * 0.2 * lossAversion) {
      if (actions.includes('fold')) {
        const decision = {
          action: 'fold' as const,
          observation,
          rationale: `${memory.label} folds weak private cards because the call cost is too high for its risk profile.`,
          thinkingProcess: [
            `Hand-strength score ${score} is below the continue threshold.`,
            `Call cost $${callCost} is too expensive for this memory profile.`,
            'Folding preserves long-term credit.',
          ],
        };
        return { decision, trace: buildAIDecisionTrace(decision, seat, view, memory, cards) };
      }
    }
    const decision = {
      action: 'call' as const,
      observation,
      rationale: `${memory.label} continues because hand score ${score} can still realize equity at this price.`,
      thinkingProcess: [
        `Hand-strength score ${score} is playable at the current price.`,
        `Call cost $${callCost} is acceptable against stack $${stack}.`,
        'Calling keeps the hand alive without escalating the pot.',
      ],
    };
    return { decision, trace: buildAIDecisionTrace(decision, seat, view, memory, cards) };
  }

  if (actions.includes('fold')) {
    const decision = {
      action: 'fold' as const,
      observation,
      rationale: `${memory.label} has no profitable continuing action in its scoped view.`,
      thinkingProcess: [
        'The scoped view does not support check, call, bet, or raise.',
        'Folding is the only low-risk legal action.',
      ],
    };
    return { decision, trace: buildAIDecisionTrace(decision, seat, view, memory, cards) };
  }

  const decision = {
    action: actions[0],
    observation,
    rationale: `${memory.label} takes the first legal fallback action from its scoped view.`,
    thinkingProcess: [
      'No preferred strategic branch matched.',
      `Using legal fallback action ${actions[0]}.`,
    ],
  };
  return { decision, trace: buildAIDecisionTrace(decision, seat, view, memory, cards) };
}
