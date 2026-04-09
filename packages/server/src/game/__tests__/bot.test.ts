import { describe, it, expect } from 'vitest';
import { chooseBotPlay } from '../bot.js';
import type { Card, HandType } from '@tuosan/shared';
import { HandTypeEnum } from '@tuosan/shared';

const card = (rank: number, suit = 'spade' as const): Card => ({
  rank: rank as Card['rank'],
  suit,
});

describe('chooseBotPlay', () => {
  it('首出时出一张非3的单牌', () => {
    const hand = [card(3), card(5), card(7), card(10)];
    const result = chooseBotPlay(hand, null);
    expect(result.action).toBe('play');
    expect(result.cards).toHaveLength(1);
    expect(result.cards![0].rank).not.toBe(3);
  });

  it('首出时只有3则出3', () => {
    const hand = [card(3), card(3, 'heart')];
    const result = chooseBotPlay(hand, null);
    expect(result.action).toBe('play');
    expect(result.cards).toHaveLength(1);
    expect(result.cards![0].rank).toBe(3);
  });

  it('跟牌时出一张能压过的单牌', () => {
    const hand = [card(5), card(8), card(12)];
    const lastPlay: { cards: Card[]; handType: HandType } = {
      cards: [card(7)],
      handType: { type: HandTypeEnum.SINGLE, rank: 7 },
    };
    const result = chooseBotPlay(hand, lastPlay);
    expect(result.action).toBe('play');
    expect(result.cards).toHaveLength(1);
    expect(result.cards![0].rank).toBeGreaterThan(7);
  });

  it('跟牌时没有能压过的牌则 pass', () => {
    const hand = [card(4), card(5), card(6)];
    const lastPlay: { cards: Card[]; handType: HandType } = {
      cards: [card(14)],
      handType: { type: HandTypeEnum.SINGLE, rank: 14 },
    };
    const result = chooseBotPlay(hand, lastPlay);
    expect(result.action).toBe('pass');
  });

  it('跟牌时 3 可以压任何牌', () => {
    const hand = [card(3), card(4)];
    const lastPlay: { cards: Card[]; handType: HandType } = {
      cards: [card(15)],
      handType: { type: HandTypeEnum.SINGLE, rank: 15 },
    };
    const result = chooseBotPlay(hand, lastPlay);
    expect(result.action).toBe('play');
    expect(result.cards![0].rank).toBe(3);
  });
});
