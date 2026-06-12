import type { Card } from '../types/poker';

const SUIT_TO_CHAR: Record<Card['suit'], string> = {
  clubs: 'c',
  diamonds: 'd',
  hearts: 'h',
  spades: 's',
};

const CHAR_TO_SUIT: Record<string, Card['suit']> = {
  c: 'clubs',
  d: 'diamonds',
  h: 'hearts',
  s: 'spades',
};

export function cardToShort(card: Card): string {
  return `${card.rank}${SUIT_TO_CHAR[card.suit]}`;
}

export function cardsToShort(cards: Card[]): string[] {
  return cards.map(cardToShort);
}

export function shortToCard(short: string): Card {
  const rank = short.slice(0, -1) as Card['rank'];
  const suit = CHAR_TO_SUIT[short.slice(-1)];
  return { rank, suit };
}
