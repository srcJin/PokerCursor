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

const ALL_SUITS: Card['suit'][] = ['clubs', 'diamonds', 'hearts', 'spades'];
const ALL_RANKS: Card['rank'][] = [
  '2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A',
];

function cardKey(card: Card): string {
  return `${card.rank}-${card.suit}`;
}

/** Creates a standard 52-card deck. */
export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of ALL_SUITS) {
    for (const rank of ALL_RANKS) {
      deck.push({ suit, rank });
    }
  }
  return deck;
}

/** Fisher–Yates shuffle (mutates deck in place). */
export function shuffle(deck: Card[]): Card[] {
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

/** Removes and returns `count` cards from the deck. */
export function deal(deck: Card[], count: number): Card[] {
  if (count > deck.length) {
    throw new Error(`Cannot deal ${count} cards from deck of ${deck.length}`);
  }
  return deck.splice(0, count);
}

/** Returns true when no card appears more than once across all dealt groups. */
export function hasNoDuplicates(...groups: Card[][]): boolean {
  const seen = new Set<string>();
  for (const group of groups) {
    for (const card of group) {
      const key = cardKey(card);
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
    }
  }
  return true;
}
