import { TexasHoldem } from 'poker-odds-calc';

import { HUMAN_SEAT } from '../game/constants';
import type { CoachAdvice, TableView } from '../types/game';

const ACTION_LABELS: Record<string, string> = {
  fold: 'Fold — exit the hand and lose your current bet',
  check: 'Check — pass action without putting more chips in',
  call: 'Call — match the current bet to stay in',
  bet: 'Bet — open the betting on this street',
  raise: 'Raise — increase the bet and apply pressure',
};

function tryCalculateEquity(
  humanCards: string[],
  opponents: string[][],
  board: string[],
): string | undefined {
  try {
    const calc = new TexasHoldem();
    calc.addPlayer(humanCards);
    for (const opp of opponents) {
      calc.addPlayer(opp);
    }
    if (board.length > 0) {
      calc.setBoard(board);
    }
    const result = calc.calculate();
    const players = result.getPlayers();
    const human = players[0];
    if (!human) return undefined;
    return `${human.getWinsPercentageString()} win / ${human.getTiesPercentageString()} tie`;
  } catch {
    return undefined;
  }
}

function buildRationale(
  action: string,
  view: TableView,
  equity?: string,
): string {
  const pot = view.pots.reduce((sum, p) => sum + p.size, 0);
  const street = view.street ?? 'preflop';

  switch (action) {
    case 'fold':
      return equity
        ? `Your equity is ${equity}. Folding saves chips when you're behind.`
        : 'Folding is correct when pot odds do not justify continuing.';
    case 'check':
      return 'Checking lets you see the next card for free when no bet is facing you.';
    case 'call':
      return pot > 0
        ? `Pot is $${pot} on the ${street}. Calling keeps you in to realize your equity.`
        : 'Calling matches the bet and keeps your hand alive.';
    case 'bet':
    case 'raise':
      return equity
        ? `With ${equity} equity, betting builds the pot or folds out weaker hands.`
        : 'Aggression can win the pot immediately or charge draws.';
    default:
      return 'Consider position, stack size, and opponent tendencies.';
  }
}

/** Coach agent: explains legal options before the player acts. */
export function getCoachAdvice(view: TableView): CoachAdvice {
  const human = view.seats.find((s) => s.seat === HUMAN_SEAT);
  const humanCards = human?.holeCards?.filter((c) => c !== 'back') ?? [];
  const opponentCards = view.seats
    .filter((s) => s.seat !== HUMAN_SEAT && s.holeCards)
    .map((s) => s.holeCards!.filter((c) => c !== 'back'));

  const equity =
    humanCards.length === 2
      ? tryCalculateEquity(humanCards, opponentCards, view.communityCards)
      : undefined;

  const options = view.legalActions.map((action) => ({
    action,
    label: ACTION_LABELS[action] ?? action,
    rationale: buildRationale(action, view, equity),
  }));

  const street = view.street ?? 'preflop';
  const pot = view.pots.reduce((sum, p) => sum + p.size, 0);

  let summary = `You're on the ${street} with ${humanCards.join(' ') || 'your hand'}.`;
  if (view.communityCards.length > 0) {
    summary += ` Board: ${view.communityCards.join(' ')}.`;
  }
  summary += ` Pot: $${pot}.`;
  if (equity) {
    summary += ` Estimated equity: ${equity}.`;
  }
  summary += ` Legal actions: ${view.legalActions.join(', ')}.`;

  return { summary, options, equity };
}

/** Immediate feedback after the player acts. */
export function getCoachFeedback(
  action: string,
  view: TableView,
): string {
  const advice = getCoachAdvice({
    ...view,
    legalActions: view.legalActions.length ? view.legalActions : [action as typeof view.legalActions[number]],
  });

  const recommended = advice.options.find((o) =>
    o.action === 'raise' || o.action === 'bet'
      ? advice.equity && parseFloat(advice.equity) > 40
      : o.action === 'call',
  );

  if (!recommended) {
    return `You chose to ${action}. Reasonable line — stay aware of position and pot size.`;
  }

  if (recommended.action === action) {
    return `Good ${action}! ${recommended.rationale}`;
  }

  return `You ${action}ed. Coach note: ${recommended.action} was also strong here — ${recommended.rationale}`;
}
