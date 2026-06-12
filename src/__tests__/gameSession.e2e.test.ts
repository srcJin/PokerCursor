import assert from 'node:assert/strict';

import { GameSession, type AIDecisionProvider } from '../game/GameSession';
import { HUMAN_SEAT } from '../game/constants';
import type { Action } from '../types/poker';

const alwaysFold: AIDecisionProvider = async (_seat, view, _memory, fallback) =>
  view.legalActions.includes('fold')
    ? {
        decision: { ...fallback.decision, action: 'fold', betSize: undefined },
        trace: fallback.trace,
      }
    : fallback;

async function playUntilComplete(session: GameSession): Promise<void> {
  let result = await session.advanceUntilHumanOrComplete();
  let guard = 0;

  while (result === 'human_turn' && guard < 100) {
    guard += 1;
    const view = session.getView(false);
    const action: Action = view.legalActions.includes('check')
      ? 'check'
      : view.legalActions.includes('call')
        ? 'call'
        : 'fold';
    session.act(HUMAN_SEAT, action);
    result = await session.advanceUntilHumanOrComplete();
  }

  assert.equal(result, 'hand_complete');
}

export async function runGameSessionE2ETests(): Promise<void> {
  const session = new GameSession([], true);
  session.startHand();

  const liveView = session.getView(false);
  assert.equal(liveView.handInProgress, true);
  assert.ok(
    liveView.seats.filter((seat) => seat.holeCards?.length === 2).length > 0,
  );

  await playUntilComplete(session);

  const completed = session.getView(true);
  assert.equal(completed.handInProgress, false);
  assert.ok(session.getActionLog().length > 0);

  const report = session.finalizeHandReport();
  assert.match(report.summary, /Hand complete/);
  assert.ok(report.highlights.length > 0);

  const memorySession = new GameSession([], true);
  memorySession.startHand();
  await playUntilComplete(memorySession);
  assert.ok(memorySession.getAgentMemories().length > 0);
  assert.ok(memorySession.getDecisionTraces().length > 0);
  assert.ok(memorySession.getPlayerRecords().every((record) => record.handsPlayed === 1));

  // Regression: a hand ending entirely by folds must complete cleanly
  // (poker-ts forbids pots()/holeCards() reads once the hand is over).
  // Both AIs fold while the human stays in, so the pot goes uncontested.
  const foldSession = new GameSession([], true);
  foldSession.startHand();
  let foldResult = await foldSession.advanceUntilHumanOrComplete(alwaysFold);
  let foldGuard = 0;
  while (foldResult === 'human_turn' && foldGuard < 10) {
    foldGuard += 1;
    const foldTurnView = foldSession.getView(false);
    foldSession.act(
      HUMAN_SEAT,
      foldTurnView.legalActions.includes('check') ? 'check' : 'call',
    );
    foldResult = await foldSession.advanceUntilHumanOrComplete(alwaysFold);
  }
  assert.equal(foldResult, 'hand_complete');
  const foldView = foldSession.getView(true);
  assert.equal(foldView.handInProgress, false);
  assert.ok(foldView.winners, 'fold-out hand should still report a winner');
  assert.equal(foldView.winners?.[0]?.handName, 'Won uncontested');
  assert.equal(foldView.winners?.[0]?.seat, HUMAN_SEAT);
  const foldReport = foldSession.finalizeHandReport();
  assert.match(foldReport.summary, /Hand complete/);
}
