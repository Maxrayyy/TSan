// packages/server/src/game/__tests__/scorer.test.ts
import { describe, it, expect } from 'vitest';
import { calculateRoundScore, settleGame } from '../scorer.js';
import type { Card, GameState, PlayerState } from '@tuosan/shared';

function c(s: string): Card {
  const suitMap: Record<string, Card['suit']> = { s: 'spade', h: 'heart', c: 'club', d: 'diamond' };
  const suit = suitMap[s[0]];
  const rankStr = s.slice(1);
  const rankMap: Record<string, number> = { A: 14, K: 13, Q: 12, J: 11, '2': 15 };
  const rank = rankMap[rankStr] ?? Number(rankStr);
  return { suit, rank: rank as Card['rank'] };
}

describe('calculateRoundScore', () => {
  it('scores normal 5 as 5 points', () => {
    expect(calculateRoundScore([c('s5')])).toBe(5);
  });

  it('scores heart 5 as 55 points', () => {
    expect(calculateRoundScore([c('h5')])).toBe(55);
  });

  it('scores 10 as 10 points', () => {
    expect(calculateRoundScore([c('s10')])).toBe(10);
  });

  it('scores K as 10 points', () => {
    expect(calculateRoundScore([c('sK')])).toBe(10);
  });

  it('scores non-scoring cards as 0', () => {
    expect(calculateRoundScore([c('s3'), c('h7'), c('cJ')])).toBe(0);
  });

  it('scores mixed hand correctly', () => {
    // s5(5) + h5(55) + s10(10) + sK(10) = 80
    expect(calculateRoundScore([c('s5'), c('h5'), c('s10'), c('sK')])).toBe(80);
  });

  it('total score of all scoring cards is 150', () => {
    const allScoring = [
      c('s5'),
      c('c5'),
      c('d5'),
      c('h5'), // 5+5+5+55 = 70
      c('s10'),
      c('h10'),
      c('c10'),
      c('d10'), // 40
      c('sK'),
      c('hK'),
      c('cK'),
      c('dK'), // 40
    ];
    expect(calculateRoundScore(allScoring)).toBe(150);
  });
});

describe('settleGame', () => {
  function makePlayer(
    seat: number,
    score: number,
    hand: Card[] = [],
    tuoSan = 0,
    bieSan = 0,
  ): PlayerState {
    return {
      userId: `u${seat}`,
      nickname: `p${seat}`,
      avatar: '',
      seatIndex: seat,
      hand,
      score,
      rank: null,
      tuoSanCount: tuoSan,
      bieSanCount: bieSan,
      connected: true,
      isReady: true,
    };
  }

  it('assigns last player score to first player team', () => {
    // Team A: seats 0, 2. Team B: seats 1, 3
    // Finish order: 0(A), 1(B), 2(A), 3(B-last)
    // Seat 3 (last) score goes to team A (first player's team)
    const state: GameState = {
      id: 'g1',
      roomId: 'r1',
      phase: 'finished',
      players: {
        0: makePlayer(0, 30),
        1: makePlayer(1, 40),
        2: makePlayer(2, 20),
        3: makePlayer(3, 60, []),
      },
      currentPlayerSeat: 0,
      turnStartTime: 0,
      currentRound: { leadPlayerSeat: 0, lastPlay: null, passCount: 0, roundScore: 0 },
      teamScores: [0, 0],
      finishedOrder: [0, 1, 2, 3],
      isFirstPlay: false,
    };
    const result = settleGame(state);
    // Team A (0,2): 30 + 20 + 60(last) = 110
    // Team B (1): 40
    expect(result.teamScores[0]).toBe(110);
    expect(result.teamScores[1]).toBe(40);
    expect(result.isShuangDaiHua).toBe(false);
  });

  it('detects shuang dai hua when same team finishes 1st and 2nd', () => {
    const state: GameState = {
      id: 'g1',
      roomId: 'r1',
      phase: 'finished',
      players: {
        0: makePlayer(0, 30),
        1: makePlayer(1, 40),
        2: makePlayer(2, 20),
        3: makePlayer(3, 60),
      },
      currentPlayerSeat: 0,
      turnStartTime: 0,
      currentRound: { leadPlayerSeat: 0, lastPlay: null, passCount: 0, roundScore: 0 },
      teamScores: [0, 0],
      finishedOrder: [0, 2, 1, 3], // 0 and 2 both team A
      isFirstPlay: false,
    };
    const result = settleGame(state);
    expect(result.isShuangDaiHua).toBe(true);
    expect(result.teamScores[0]).toBe(2); // winning team gets +2
    expect(result.teamScores[1]).toBe(-2); // losing team gets -2
  });

  it('includes tuo san and bie san in results', () => {
    const state: GameState = {
      id: 'g1',
      roomId: 'r1',
      phase: 'finished',
      players: {
        0: makePlayer(0, 50, [], 2, 0), // 2 tuo san
        1: makePlayer(1, 40, [c('s3')], 0, 0), // has a 3 = bie san
        2: makePlayer(2, 30, []),
        3: makePlayer(3, 30, []),
      },
      currentPlayerSeat: 0,
      turnStartTime: 0,
      currentRound: { leadPlayerSeat: 0, lastPlay: null, passCount: 0, roundScore: 0 },
      teamScores: [0, 0],
      finishedOrder: [0, 1, 2, 3],
      isFirstPlay: false,
    };
    const result = settleGame(state);
    const p0 = result.rankings.find((r) => r.seatIndex === 0)!;
    const p1 = result.rankings.find((r) => r.seatIndex === 1)!;
    expect(p0.tuoSanCount).toBe(2);
    expect(p1.bieSanCount).toBe(1);
  });
});
