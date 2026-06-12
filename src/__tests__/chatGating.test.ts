import assert from 'node:assert/strict';

import { gateAssistantMessage } from '../agents/assistant';
import { gateCoachReview } from '../agents/coachReview';
import type { TableView } from '../types/game';

function makeView(handInProgress: boolean, humanToAct = false): TableView {
  return {
    handInProgress,
    street: handInProgress ? 'preflop' : 'river',
    communityCards: [],
    seats: [],
    pots: [{ size: 4, eligiblePlayers: [0, 2, 4] }],
    humanToAct,
    legalActions: handInProgress ? ['fold', 'call', 'raise'] : [],
    winners: handInProgress ? null : [],
  };
}

export function runChatGatingTests(): void {
  const idleAssistant = gateAssistantMessage(makeView(false), 'help');
  assert.equal(idleAssistant.allowed, false);
  if (!idleAssistant.allowed) {
    assert.match(idleAssistant.reply, /Pro Coach/);
  }

  const blockedAssistant = gateAssistantMessage(makeView(true, false), 'help');
  assert.equal(blockedAssistant.allowed, false);

  const allowedAssistant = gateAssistantMessage(makeView(true, true), 'help');
  assert.equal(allowedAssistant.allowed, true);

  const liveCoach = gateCoachReview(makeView(true));
  assert.equal(liveCoach.allowed, false);
  if (!liveCoach.allowed) {
    assert.match(liveCoach.reply, /Hand is still live/);
  }

  assert.equal(gateCoachReview(makeView(false)).allowed, true);
}
