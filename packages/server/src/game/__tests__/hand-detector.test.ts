// packages/server/src/game/__tests__/hand-detector.test.ts
import { describe, it, expect } from 'vitest';
import { detectHandType } from '../hand-detector.js';
import type { Card } from '@tuosan/shared';
import { HandTypeEnum } from '@tuosan/shared';

// Helper to create cards quickly: c('s3') = spade 3, c('hA') = heart Ace
function c(s: string): Card {
  const suitMap: Record<string, Card['suit']> = { s: 'spade', h: 'heart', c: 'club', d: 'diamond' };
  const suit = suitMap[s[0]];
  const rankStr = s.slice(1);
  const rankMap: Record<string, number> = { A: 14, K: 13, Q: 12, J: 11, '2': 15 };
  const rank = rankMap[rankStr] ?? Number(rankStr);
  return { suit, rank: rank as Card['rank'] };
}

describe('detectHandType', () => {
  it('should return null for empty cards', () => {
    expect(detectHandType([])).toBeNull();
  });

  // SINGLE
  it('should detect single card', () => {
    const result = detectHandType([c('s3')]);
    expect(result).toEqual({ type: HandTypeEnum.SINGLE, rank: 3 });
  });

  // PAIR
  it('should detect pair', () => {
    const result = detectHandType([c('s5'), c('h5')]);
    expect(result).toEqual({ type: HandTypeEnum.PAIR, rank: 5 });
  });

  it('should reject non-pair of 2 cards', () => {
    expect(detectHandType([c('s5'), c('h6')])).toBeNull();
  });

  // TRIPLE
  it('should detect triple', () => {
    const result = detectHandType([c('s7'), c('h7'), c('c7')]);
    expect(result).toEqual({ type: HandTypeEnum.TRIPLE, rank: 7 });
  });

  // BOMB
  it('should detect bomb', () => {
    const result = detectHandType([c('s8'), c('h8'), c('c8'), c('d8')]);
    expect(result).toEqual({ type: HandTypeEnum.BOMB, rank: 8 });
  });

  // FTK (5-10-K different suits)
  it('should detect FTK', () => {
    const result = detectHandType([c('s5'), c('h10'), c('cK')]);
    expect(result).toEqual({ type: HandTypeEnum.FTK, rank: 0 });
  });

  // PURE_FTK (5-10-K same suit)
  it('should detect pure FTK', () => {
    const result = detectHandType([c('h5'), c('h10'), c('hK')]);
    expect(result).toEqual({ type: HandTypeEnum.PURE_FTK, rank: 0, suit: 'heart' });
  });

  it('should not detect FTK for non-5-10-K triple', () => {
    expect(detectHandType([c('s4'), c('h6'), c('c9')])).toBeNull();
  });

  // THREE_WITH_TWO
  it('should detect three with two', () => {
    const result = detectHandType([c('sA'), c('hA'), c('cA'), c('s9'), c('h9')]);
    expect(result).toEqual({ type: HandTypeEnum.THREE_WITH_TWO, rank: 14 });
  });

  it('should reject 5 cards that are not three-with-two', () => {
    expect(detectHandType([c('sA'), c('hA'), c('cA'), c('dA'), c('s9')])).toBeNull();
  });

  // STRAIGHT (5+ consecutive, no 2)
  it('should detect straight of 5', () => {
    const result = detectHandType([c('s3'), c('h4'), c('c5'), c('d6'), c('s7')]);
    expect(result).toEqual({ type: HandTypeEnum.STRAIGHT, rank: 7, length: 5 });
  });

  it('should detect straight of 7', () => {
    const result = detectHandType([c('s5'), c('h6'), c('c7'), c('d8'), c('s9'), c('h10'), c('cJ')]);
    expect(result).toEqual({ type: HandTypeEnum.STRAIGHT, rank: 11, length: 7 });
  });

  it('should reject straight containing 2', () => {
    expect(detectHandType([c('sQ'), c('hK'), c('cA'), c('d2'), c('s3')])).toBeNull();
  });

  it('should reject non-consecutive 5 cards', () => {
    expect(detectHandType([c('s3'), c('h4'), c('c5'), c('d6'), c('s8')])).toBeNull();
  });

  // PURE_DRAGON (same-suit straight >= 5)
  it('should detect pure dragon (same suit straight)', () => {
    const result = detectHandType([c('s5'), c('s6'), c('s7'), c('s8'), c('s9')]);
    expect(result).toEqual({ type: HandTypeEnum.PURE_DRAGON, rank: 9, suit: 'spade', length: 5 });
  });

  // DOUBLE_STRAIGHT (2+ consecutive pairs, no 2)
  it('should detect double straight of 2 pairs', () => {
    const result = detectHandType([c('s3'), c('h3'), c('c4'), c('d4')]);
    expect(result).toEqual({ type: HandTypeEnum.DOUBLE_STRAIGHT, rank: 4, length: 2 });
  });

  it('should detect double straight of 4 pairs', () => {
    const result = detectHandType([
      c('s5'),
      c('h5'),
      c('c6'),
      c('d6'),
      c('s7'),
      c('h7'),
      c('c8'),
      c('d8'),
    ]);
    expect(result).toEqual({ type: HandTypeEnum.DOUBLE_STRAIGHT, rank: 8, length: 4 });
  });

  it('should reject double straight containing 2', () => {
    expect(detectHandType([c('sA'), c('hA'), c('c2'), c('d2')])).toBeNull();
  });

  // TRIPLE_STRAIGHT (2+ consecutive triples, no 2)
  it('should detect triple straight of 2 groups', () => {
    const result = detectHandType([c('s5'), c('h5'), c('c5'), c('d6'), c('s6'), c('h6')]);
    expect(result).toEqual({ type: HandTypeEnum.TRIPLE_STRAIGHT, rank: 6, length: 2 });
  });

  // GAO_GAO (two three-with-two, consecutive triples)
  it('should detect gao gao', () => {
    const result = detectHandType([
      c('s5'),
      c('h5'),
      c('c5'),
      c('d6'),
      c('s6'),
      c('h6'),
      c('c9'),
      c('d9'),
      c('sJ'),
      c('hJ'),
    ]);
    expect(result).toEqual({ type: HandTypeEnum.GAO_GAO, rank: 6 });
  });

  it('should reject gao gao with non-consecutive triples', () => {
    const result = detectHandType([
      c('s5'),
      c('h5'),
      c('c5'),
      c('d8'),
      c('s8'),
      c('h8'),
      c('c9'),
      c('d9'),
      c('sJ'),
      c('hJ'),
    ]);
    expect(result).toBeNull();
  });

  // TIAN_LONG (3-A, 12 cards)
  it('should detect tian long (3 to A)', () => {
    const result = detectHandType([
      c('s3'),
      c('h4'),
      c('c5'),
      c('d6'),
      c('s7'),
      c('h8'),
      c('c9'),
      c('d10'),
      c('sJ'),
      c('hQ'),
      c('cK'),
      c('dA'),
    ]);
    expect(result).toEqual({ type: HandTypeEnum.TIAN_LONG, rank: 14, length: 12 });
  });

  // PURE_TIAN_LONG (same suit 3-A)
  it('should detect pure tian long (same suit 3 to A)', () => {
    const result = detectHandType([
      c('s3'),
      c('s4'),
      c('s5'),
      c('s6'),
      c('s7'),
      c('s8'),
      c('s9'),
      c('s10'),
      c('sJ'),
      c('sQ'),
      c('sK'),
      c('sA'),
    ]);
    expect(result).toEqual({
      type: HandTypeEnum.PURE_TIAN_LONG,
      rank: 14,
      suit: 'spade',
      length: 12,
    });
  });

  it('should reject 4 consecutive cards (straight needs >= 5)', () => {
    expect(detectHandType([c('s3'), c('h4'), c('c5'), c('d6')])).toBeNull();
  });

  it('should detect single pair as pair, not double straight', () => {
    const result = detectHandType([c('s5'), c('h5')]);
    expect(result?.type).toBe(HandTypeEnum.PAIR);
  });
});
