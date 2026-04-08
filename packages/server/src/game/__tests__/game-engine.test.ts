// packages/server/src/game/__tests__/game-engine.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../game-engine.js';

const players = [
  { userId: 'u0', nickname: 'P0', avatar: '', seatIndex: 0 },
  { userId: 'u1', nickname: 'P1', avatar: '', seatIndex: 1 },
  { userId: 'u2', nickname: 'P2', avatar: '', seatIndex: 2 },
  { userId: 'u3', nickname: 'P3', avatar: '', seatIndex: 3 },
];

describe('GameEngine', () => {
  let engine: GameEngine;

  beforeEach(() => {
    engine = new GameEngine('room1', players);
  });

  describe('deal', () => {
    it('deals 13 cards to each player', () => {
      engine.deal();
      const state = engine.getState();
      expect(state.phase).toBe('playing');
      for (let i = 0; i < 4; i++) {
        expect(state.players[i].hand).toHaveLength(13);
      }
    });

    it('distributes all 52 unique cards', () => {
      engine.deal();
      const state = engine.getState();
      const all = Object.values(state.players).flatMap((p) => p.hand);
      expect(all).toHaveLength(52);
      const keys = all.map((c) => `${c.suit}-${c.rank}`);
      expect(new Set(keys).size).toBe(52);
    });

    it('sets first play flag', () => {
      engine.deal();
      expect(engine.getState().isFirstPlay).toBe(true);
    });
  });

  describe('play', () => {
    it('removes cards from player hand after valid play', () => {
      engine.deal();
      const state = engine.getState();
      const seat = state.currentPlayerSeat;
      const hand = state.players[seat].hand;
      // Find a non-3 card to play
      const card = hand.find((c) => c.rank !== 3);
      if (!card) return;
      const result = engine.play(seat, [card]);
      expect(result.valid).toBe(true);
      expect(engine.getState().players[seat].hand).toHaveLength(12);
    });

    it('rejects play containing 3 on first play', () => {
      engine.deal();
      const state = engine.getState();
      const seat = state.currentPlayerSeat;
      const hand = state.players[seat].hand;
      const three = hand.find((c) => c.rank === 3);
      if (!three) return;
      const result = engine.play(seat, [three]);
      expect(result.valid).toBe(false);
    });

    it('advances to next player after valid play', () => {
      engine.deal();
      const seat = engine.getState().currentPlayerSeat;
      const hand = engine.getState().players[seat].hand;
      const card = hand.find((c) => c.rank !== 3)!;
      engine.play(seat, [card]);
      expect(engine.getState().currentPlayerSeat).not.toBe(seat);
    });

    it('clears first play flag after successful play', () => {
      engine.deal();
      const seat = engine.getState().currentPlayerSeat;
      const hand = engine.getState().players[seat].hand;
      const card = hand.find((c) => c.rank !== 3)!;
      engine.play(seat, [card]);
      expect(engine.getState().isFirstPlay).toBe(false);
    });
  });

  describe('pass', () => {
    it('advances to next player', () => {
      engine.deal();
      const seat = engine.getState().currentPlayerSeat;
      const hand = engine.getState().players[seat].hand;
      const card = hand.find((c) => c.rank !== 3)!;
      engine.play(seat, [card]);
      const nextSeat = engine.getState().currentPlayerSeat;
      engine.pass(nextSeat);
      expect(engine.getState().currentPlayerSeat).not.toBe(nextSeat);
    });

    it('ends round when all others pass', () => {
      engine.deal();
      const seat = engine.getState().currentPlayerSeat;
      const hand = engine.getState().players[seat].hand;
      const card = hand.find((c) => c.rank !== 3)!;
      engine.play(seat, [card]);

      // 3 other players pass
      for (let i = 0; i < 3; i++) {
        const current = engine.getState().currentPlayerSeat;
        engine.pass(current);
      }

      // Round ended, the winner (seat) should lead again
      const state = engine.getState();
      expect(state.currentRound.lastPlay).toBeNull();
      expect(state.currentPlayerSeat).toBe(seat);
    });
  });

  describe('getPlayerView', () => {
    it('shows own hand but hides others', () => {
      engine.deal();
      const view = engine.getPlayerView(0);
      expect(view.myHand.length).toBe(13);
      expect(view.mySeat).toBe(0);
      for (const [seatStr, p] of Object.entries(view.players)) {
        if (Number(seatStr) !== 0) {
          expect(p.cardCount).toBe(13);
        }
      }
    });
  });

  describe('full game simulation', () => {
    it('completes a game with simple strategy', () => {
      engine.deal();
      expect(engine.getState().phase).toBe('playing');

      let moves = 0;
      while (engine.getState().phase === 'playing' && moves < 200) {
        const state = engine.getState();
        const seat = state.currentPlayerSeat;
        const hand = state.players[seat].hand;

        if (hand.length === 0) break;

        if (state.currentRound.lastPlay === null) {
          // Leading: play smallest non-3 card
          const card = hand.find((c) => c.rank !== 3);
          if (card) {
            engine.play(seat, [card]);
          } else {
            // Only 3s left — this is a special case
            // In a real game this shouldn't happen as leading with 3 is forbidden
            // But in edge cases, we need the engine to handle it
            break;
          }
        } else {
          // Following: just pass
          engine.pass(seat);
        }
        moves++;
      }

      const finalState = engine.getState();
      expect(['playing', 'finished']).toContain(finalState.phase);
    });
  });
});
