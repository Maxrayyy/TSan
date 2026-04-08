// packages/server/src/game/__tests__/tuo-san-rule.test.ts
import { describe, it, expect } from 'vitest';
import { checkTuoSan, checkBieSan } from '../tuo-san-rule.js';
import type { Card, RoundState, PlayerState } from '@tuosan/shared';
import { HandTypeEnum } from '@tuosan/shared';

function c(s: string): Card {
  const suitMap: Record<string, Card['suit']> = { s: 'spade', h: 'heart', c: 'club', d: 'diamond' };
  const suit = suitMap[s[0]];
  const rankStr = s.slice(1);
  const rankMap: Record<string, number> = { A: 14, K: 13, Q: 12, J: 11, '2': 15 };
  const rank = rankMap[rankStr] ?? Number(rankStr);
  return { suit, rank: rank as Card['rank'] };
}

function makePlayer(seat: number, hand: Card[]): PlayerState {
  return {
    userId: `u${seat}`,
    nickname: `p${seat}`,
    avatar: '',
    seatIndex: seat,
    hand,
    score: 0,
    rank: null,
    tuoSanCount: 0,
    bieSanCount: 0,
    connected: true,
    isReady: true,
  };
}

describe('checkTuoSan', () => {
  it('returns tuo san when last play is pure 3s and all others passed', () => {
    const round: RoundState = {
      leadPlayerSeat: 0,
      lastPlay: {
        playerSeat: 0,
        cards: [c('s3'), c('h3')],
        handType: { type: HandTypeEnum.PAIR, rank: 3 },
      },
      passCount: 3,
      roundScore: 0,
    };
    const result = checkTuoSan(round);
    expect(result).toEqual({ playerSeat: 0, count: 2 });
  });

  it('returns tuo san for single 3', () => {
    const round: RoundState = {
      leadPlayerSeat: 0,
      lastPlay: {
        playerSeat: 0,
        cards: [c('s3')],
        handType: { type: HandTypeEnum.SINGLE, rank: 3 },
      },
      passCount: 3,
      roundScore: 0,
    };
    const result = checkTuoSan(round);
    expect(result).toEqual({ playerSeat: 0, count: 1 });
  });

  it('returns null when last play contains non-3 cards', () => {
    const round: RoundState = {
      leadPlayerSeat: 0,
      lastPlay: {
        playerSeat: 0,
        cards: [c('s3'), c('h5')],
        handType: { type: HandTypeEnum.PAIR, rank: 3 },
      },
      passCount: 3,
      roundScore: 0,
    };
    expect(checkTuoSan(round)).toBeNull();
  });

  it('returns null when no last play', () => {
    const round: RoundState = {
      leadPlayerSeat: 0,
      lastPlay: null,
      passCount: 0,
      roundScore: 0,
    };
    expect(checkTuoSan(round)).toBeNull();
  });
});

describe('checkBieSan', () => {
  it('detects bie san for players with 3s in hand', () => {
    const players: Record<number, PlayerState> = {
      0: makePlayer(0, [c('s3')]),
      1: makePlayer(1, [c('h5')]),
      2: makePlayer(2, [c('h3'), c('c3')]),
      3: makePlayer(3, []),
    };
    const results = checkBieSan(players);
    expect(results).toEqual([
      { playerSeat: 0, count: 1 },
      { playerSeat: 2, count: 2 },
    ]);
  });

  it('exempts 4 threes (bomb) from bie san', () => {
    const players: Record<number, PlayerState> = {
      0: makePlayer(0, [c('s3'), c('h3'), c('c3'), c('d3')]),
      1: makePlayer(1, []),
      2: makePlayer(2, []),
      3: makePlayer(3, []),
    };
    const results = checkBieSan(players);
    expect(results).toEqual([]);
  });

  it('returns empty when no player has 3s', () => {
    const players: Record<number, PlayerState> = {
      0: makePlayer(0, [c('s5')]),
      1: makePlayer(1, []),
      2: makePlayer(2, []),
      3: makePlayer(3, []),
    };
    expect(checkBieSan(players)).toEqual([]);
  });
});
