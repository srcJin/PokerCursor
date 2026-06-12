import assert from 'node:assert/strict';

import { GameSession } from '../game/GameSession';
import { HUMAN_SEAT } from '../game/constants';
import type { Action } from '../types/poker';

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
}
