import { describe, it, expect } from 'vitest';
import { createDeck, shuffle, deal } from '../deck.js';

describe('createDeck', () => {
  it('should create 52 cards', () => {
    const deck = createDeck();
    expect(deck).toHaveLength(52);
  });

  it('should have 4 suits with 13 cards each', () => {
    const deck = createDeck();
    const suits = ['spade', 'heart', 'club', 'diamond'] as const;
    for (const suit of suits) {
      const suitCards = deck.filter((c) => c.suit === suit);
      expect(suitCards).toHaveLength(13);
    }
  });

  it('should have ranks 3-15 for each suit', () => {
    const deck = createDeck();
    const suits = ['spade', 'heart', 'club', 'diamond'] as const;
    for (const suit of suits) {
      const ranks = deck
        .filter((c) => c.suit === suit)
        .map((c) => c.rank)
        .sort((a, b) => a - b);
      expect(ranks).toEqual([3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
    }
  });

  it('should have no duplicate cards', () => {
    const deck = createDeck();
    const keys = deck.map((c) => `${c.suit}-${c.rank}`);
    expect(new Set(keys).size).toBe(52);
  });
});

describe('shuffle', () => {
  it('should return 52 cards', () => {
    const deck = createDeck();
    const shuffled = shuffle(deck);
    expect(shuffled).toHaveLength(52);
  });

  it('should contain the same cards as the original deck', () => {
    const deck = createDeck();
    const shuffled = shuffle(deck);
    const sortFn = (a: { suit: string; rank: number }, b: { suit: string; rank: number }) =>
      a.suit.localeCompare(b.suit) || a.rank - b.rank;
    expect([...shuffled].sort(sortFn)).toEqual([...deck].sort(sortFn));
  });

  it('should not mutate the original deck', () => {
    const deck = createDeck();
    const original = [...deck];
    shuffle(deck);
    expect(deck).toEqual(original);
  });
});

describe('deal', () => {
  it('should deal 4 hands of 13 cards each', () => {
    const deck = createDeck();
    const shuffled = shuffle(deck);
    const hands = deal(shuffled);
    expect(hands).toHaveLength(4);
    for (const hand of hands) {
      expect(hand).toHaveLength(13);
    }
  });

  it('should distribute all 52 cards with no duplicates', () => {
    const deck = createDeck();
    const shuffled = shuffle(deck);
    const hands = deal(shuffled);
    const allCards = hands.flat();
    expect(allCards).toHaveLength(52);
    const keys = allCards.map((c) => `${c.suit}-${c.rank}`);
    expect(new Set(keys).size).toBe(52);
  });

  it('should sort each hand by rank ascending, then by suit weight', () => {
    const deck = createDeck();
    const shuffled = shuffle(deck);
    const hands = deal(shuffled);
    const SUIT_W: Record<string, number> = { spade: 4, heart: 3, club: 2, diamond: 1 };
    for (const hand of hands) {
      for (let i = 1; i < hand.length; i++) {
        const prev = hand[i - 1];
        const curr = hand[i];
        const cmp = prev.rank - curr.rank || SUIT_W[prev.suit] - SUIT_W[curr.suit];
        expect(cmp).toBeLessThanOrEqual(0);
      }
    }
  });
});
