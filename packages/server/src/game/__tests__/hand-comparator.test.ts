// packages/server/src/game/__tests__/hand-comparator.test.ts
import { describe, it, expect } from 'vitest';
import { compareHands, canBeat } from '../hand-comparator.js';
import type { HandType } from '@tuosan/shared';
import { HandTypeEnum } from '@tuosan/shared';

function h(
  type: HandTypeEnum,
  rank: number,
  opts?: { length?: number; suit?: 'spade' | 'heart' | 'club' | 'diamond' },
): HandType {
  return { type, rank, ...opts };
}

describe('compareHands - same type', () => {
  it('larger single beats smaller single', () => {
    expect(compareHands(h(HandTypeEnum.SINGLE, 10), h(HandTypeEnum.SINGLE, 5))).toBeGreaterThan(0);
  });

  it('larger pair beats smaller pair', () => {
    expect(compareHands(h(HandTypeEnum.PAIR, 14), h(HandTypeEnum.PAIR, 13))).toBeGreaterThan(0);
  });

  it('same rank straight of same length is equal', () => {
    expect(
      compareHands(
        h(HandTypeEnum.STRAIGHT, 9, { length: 5 }),
        h(HandTypeEnum.STRAIGHT, 9, { length: 5 }),
      ),
    ).toBe(0);
  });

  it('straights of different lengths are incomparable', () => {
    expect(
      compareHands(
        h(HandTypeEnum.STRAIGHT, 9, { length: 5 }),
        h(HandTypeEnum.STRAIGHT, 10, { length: 6 }),
      ),
    ).toBeNull();
  });

  it('larger bomb beats smaller bomb', () => {
    expect(compareHands(h(HandTypeEnum.BOMB, 14), h(HandTypeEnum.BOMB, 10))).toBeGreaterThan(0);
  });
});

describe('compareHands - cross type', () => {
  it('FTK beats any normal type', () => {
    expect(compareHands(h(HandTypeEnum.FTK, 0), h(HandTypeEnum.SINGLE, 14))).toBeGreaterThan(0);
    expect(compareHands(h(HandTypeEnum.FTK, 0), h(HandTypeEnum.PAIR, 14))).toBeGreaterThan(0);
    expect(
      compareHands(h(HandTypeEnum.FTK, 0), h(HandTypeEnum.STRAIGHT, 14, { length: 5 })),
    ).toBeGreaterThan(0);
  });

  it('pure FTK beats FTK', () => {
    expect(
      compareHands(h(HandTypeEnum.PURE_FTK, 0, { suit: 'heart' }), h(HandTypeEnum.FTK, 0)),
    ).toBeGreaterThan(0);
  });

  it('bomb beats pure FTK', () => {
    expect(
      compareHands(h(HandTypeEnum.BOMB, 3), h(HandTypeEnum.PURE_FTK, 0, { suit: 'heart' })),
    ).toBeGreaterThan(0);
  });

  it('pure dragon beats bomb', () => {
    expect(
      compareHands(
        h(HandTypeEnum.PURE_DRAGON, 9, { length: 5, suit: 'spade' }),
        h(HandTypeEnum.BOMB, 14),
      ),
    ).toBeGreaterThan(0);
  });

  it('tian long beats pure dragon', () => {
    expect(
      compareHands(
        h(HandTypeEnum.TIAN_LONG, 14, { length: 12 }),
        h(HandTypeEnum.PURE_DRAGON, 14, { length: 11, suit: 'spade' }),
      ),
    ).toBeGreaterThan(0);
  });

  it('pure tian long beats tian long', () => {
    expect(
      compareHands(
        h(HandTypeEnum.PURE_TIAN_LONG, 14, { length: 12, suit: 'spade' }),
        h(HandTypeEnum.TIAN_LONG, 14, { length: 12 }),
      ),
    ).toBeGreaterThan(0);
  });

  it('different normal types are incomparable', () => {
    expect(compareHands(h(HandTypeEnum.SINGLE, 14), h(HandTypeEnum.PAIR, 3))).toBeNull();
  });
});

describe('compareHands - pure dragon vs double straight', () => {
  it('8-card pure dragon beats 4-pair double straight', () => {
    expect(
      compareHands(
        h(HandTypeEnum.PURE_DRAGON, 10, { length: 8, suit: 'spade' }),
        h(HandTypeEnum.DOUBLE_STRAIGHT, 8, { length: 4 }),
      ),
    ).toBeGreaterThan(0);
  });

  it('9-card pure dragon beats 4-pair double straight', () => {
    expect(
      compareHands(
        h(HandTypeEnum.PURE_DRAGON, 11, { length: 9, suit: 'spade' }),
        h(HandTypeEnum.DOUBLE_STRAIGHT, 8, { length: 4 }),
      ),
    ).toBeGreaterThan(0);
  });

  it('10-card pure dragon beats 5-pair double straight', () => {
    expect(
      compareHands(
        h(HandTypeEnum.PURE_DRAGON, 12, { length: 10, suit: 'spade' }),
        h(HandTypeEnum.DOUBLE_STRAIGHT, 9, { length: 5 }),
      ),
    ).toBeGreaterThan(0);
  });

  it('5-card pure dragon does NOT beat 4-pair double straight', () => {
    expect(
      compareHands(
        h(HandTypeEnum.PURE_DRAGON, 9, { length: 5, suit: 'spade' }),
        h(HandTypeEnum.DOUBLE_STRAIGHT, 8, { length: 4 }),
      ),
    ).toBeNull();
  });
});

describe('canBeat', () => {
  it('returns true when play can beat target', () => {
    expect(canBeat(h(HandTypeEnum.PAIR, 10), h(HandTypeEnum.PAIR, 5))).toBe(true);
  });

  it('returns false when play cannot beat target', () => {
    expect(canBeat(h(HandTypeEnum.PAIR, 3), h(HandTypeEnum.PAIR, 5))).toBe(false);
  });

  it('returns false for incomparable types', () => {
    expect(canBeat(h(HandTypeEnum.SINGLE, 14), h(HandTypeEnum.PAIR, 3))).toBe(false);
  });
});
