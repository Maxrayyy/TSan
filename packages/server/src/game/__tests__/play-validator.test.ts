// packages/server/src/game/__tests__/play-validator.test.ts
import { describe, it, expect } from 'vitest';
import { validatePlay, playerHasCards, containsThree } from '../play-validator.js';
import type { Card, GameState, RoundState, PlayerState } from '@tuosan/shared';
import { HandTypeEnum } from '@tuosan/shared';

function c(s: string): Card {
  const suitMap: Record<string, Card['suit']> = { s: 'spade', h: 'heart', c: 'club', d: 'diamond' };
  const suit = suitMap[s[0]];
  const rankStr = s.slice(1);
  const rankMap: Record<string, number> = { A: 14, K: 13, Q: 12, J: 11, '2': 15 };
  const rank = rankMap[rankStr] ?? Number(rankStr);
  return { suit, rank: rank as Card['rank'] };
}

function makeState(overrides: Partial<GameState> & { playerHand?: Card[] }): GameState {
  const defaultPlayer: PlayerState = {
    userId: 'u1',
    nickname: 'p1',
    avatar: '',
    seatIndex: 0,
    hand: overrides.playerHand || [c('s5'), c('h5'), c('s7'), c('h7'), c('c7')],
    score: 0,
    rank: null,
    tuoSanCount: 0,
    bieSanCount: 0,
    connected: true,
    isReady: true,
  };
  const defaultRound: RoundState = {
    leadPlayerSeat: 0,
    lastPlay: null,
    passCount: 0,
    roundScore: 0,
  };
  return {
    id: 'g1',
    roomId: 'r1',
    phase: 'playing',
    players: {
      0: defaultPlayer,
      1: { ...defaultPlayer, seatIndex: 1, userId: 'u2' },
      2: { ...defaultPlayer, seatIndex: 2, userId: 'u3' },
      3: { ...defaultPlayer, seatIndex: 3, userId: 'u4' },
    },
    currentPlayerSeat: 0,
    turnStartTime: Date.now(),
    currentRound: overrides.currentRound || defaultRound,
    teamScores: [0, 0],
    finishedOrder: [],
    isFirstPlay: overrides.isFirstPlay ?? false,
    ...overrides,
  };
}

describe('containsThree', () => {
  it('returns true if cards contain rank 3', () => {
    expect(containsThree([c('s3'), c('h5')])).toBe(true);
  });
  it('returns false if no rank 3', () => {
    expect(containsThree([c('s5'), c('h7')])).toBe(false);
  });
});

describe('playerHasCards', () => {
  it('returns true when player has all cards', () => {
    expect(playerHasCards([c('s5'), c('h5'), c('s7')], [c('s5'), c('h5')])).toBe(true);
  });
  it('returns false when player lacks a card', () => {
    expect(playerHasCards([c('s5'), c('h5')], [c('s5'), c('c5')])).toBe(false);
  });
});

describe('validatePlay', () => {
  it('rejects when not player turn', () => {
    const state = makeState({ currentPlayerSeat: 1 });
    const result = validatePlay(state, 0, [c('s5')]);
    expect(result.valid).toBe(false);
  });

  it('rejects when player does not have the cards', () => {
    const state = makeState({ playerHand: [c('s5')] });
    const result = validatePlay(state, 0, [c('sA')]);
    expect(result.valid).toBe(false);
  });

  it('rejects invalid hand type', () => {
    const state = makeState({ playerHand: [c('s5'), c('h7')] });
    const result = validatePlay(state, 0, [c('s5'), c('h7')]);
    expect(result.valid).toBe(false);
  });

  it('rejects cards containing 3 on first play', () => {
    const state = makeState({
      isFirstPlay: true,
      playerHand: [c('s3'), c('h3')],
    });
    const result = validatePlay(state, 0, [c('s3'), c('h3')]);
    expect(result.valid).toBe(false);
  });

  it('rejects cards containing 3 when leading (jie feng)', () => {
    const state = makeState({
      playerHand: [c('s3'), c('h3')],
      currentRound: { leadPlayerSeat: 0, lastPlay: null, passCount: 0, roundScore: 0 },
    });
    const result = validatePlay(state, 0, [c('s3'), c('h3')]);
    expect(result.valid).toBe(false);
  });

  it('allows valid leading play', () => {
    const state = makeState({});
    const result = validatePlay(state, 0, [c('s5'), c('h5')]);
    expect(result.valid).toBe(true);
    expect(result.handType?.type).toBe(HandTypeEnum.PAIR);
  });

  it('rejects play that cannot beat last play', () => {
    const state = makeState({
      playerHand: [c('s5'), c('h5')],
      currentRound: {
        leadPlayerSeat: 1,
        lastPlay: {
          playerSeat: 1,
          cards: [c('sA'), c('hA')],
          handType: { type: HandTypeEnum.PAIR, rank: 14 },
        },
        passCount: 0,
        roundScore: 0,
      },
    });
    const result = validatePlay(state, 0, [c('s5'), c('h5')]);
    expect(result.valid).toBe(false);
  });

  it('allows play that beats last play', () => {
    const state = makeState({
      playerHand: [c('s7'), c('h7'), c('c7')],
      currentRound: {
        leadPlayerSeat: 1,
        lastPlay: {
          playerSeat: 1,
          cards: [c('s5'), c('h5'), c('c5')],
          handType: { type: HandTypeEnum.TRIPLE, rank: 5 },
        },
        passCount: 0,
        roundScore: 0,
      },
    });
    const result = validatePlay(state, 0, [c('s7'), c('h7'), c('c7')]);
    expect(result.valid).toBe(true);
  });
});
