import assert from 'node:assert/strict';

import { createDeck, deal, hasNoDuplicates, shuffle } from '../game/cards';

export function runCardsTests(): void {
  const deck = createDeck();
  assert.equal(deck.length, 52);

  const original = deck.map((card) => `${card.rank}${card.suit}`).join(',');
  shuffle(deck);
  const shuffled = deck.map((card) => `${card.rank}${card.suit}`).join(',');
  assert.equal(deck.length, 52);
  assert.equal(shuffled.split(',').sort().join(','), original.split(',').sort().join(','));

  const fresh = createDeck();
  const hole = deal(fresh, 2);
  const flop = deal(fresh, 3);
  assert.equal(hole.length, 2);
  assert.equal(flop.length, 3);
  assert.equal(hasNoDuplicates(hole, flop), true);
  assert.equal(hasNoDuplicates(hole, [...flop, hole[0]]), false);
}
