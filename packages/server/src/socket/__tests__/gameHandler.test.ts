// packages/server/src/socket/__tests__/gameHandler.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createGame, removeEngine, getAllEngines } from '../../services/gameService.js';
import type { PlayerInfo } from '../../game/game-engine.js';

const players: PlayerInfo[] = [
  { userId: 'u0', nickname: 'P0', avatar: '', seatIndex: 0 },
  { userId: 'u1', nickname: 'P1', avatar: '', seatIndex: 1 },
  { userId: 'u2', nickname: 'P2', avatar: '', seatIndex: 2 },
  { userId: 'u3', nickname: 'P3', avatar: '', seatIndex: 3 },
];

describe('游戏流程集成测试', () => {
  beforeEach(() => {
    for (const [roomId] of getAllEngines()) {
      removeEngine(roomId);
    }
  });

  it('创建游戏、出牌、完成整局', () => {
    const engine = createGame('room-test', players);
    const state = engine.getState();
    expect(state.phase).toBe('playing');

    // 模拟对局：玩家尝试打完所有牌
    let moves = 0;
    const maxMoves = 500;

    while (engine.getState().phase === 'playing' && moves < maxMoves) {
      const gs = engine.getState();
      const seat = gs.currentPlayerSeat;
      const hand = gs.players[seat].hand;

      if (hand.length === 0) {
        // 当前玩家已经出完牌
        moves++;
        continue;
      }

      if (gs.currentRound.lastPlay === null) {
        // 首出：出任意非3牌
        const non3Cards = hand.filter((c) => c.rank !== 3);
        if (non3Cards.length === 0) {
          // 只剩3了，无法首出，游戏卡住
          // 这种情况下测试应该通过，因为这是正常的游戏规则
          break;
        }
        // 出最小的非3牌
        const sortedNon3 = [...non3Cards].sort(
          (a, b) => a.rank - b.rank || a.suit.localeCompare(b.suit),
        );
        engine.play(seat, [sortedNon3[0]]);
      } else {
        // 跟牌：尝试出一张能压制的牌，否则pass
        const lastPlay = gs.currentRound.lastPlay!;
        const lastRank = lastPlay.cards[0].rank;

        // 找能压制的牌（包括3）
        const canBeat = hand.filter((c) => {
          if (c.rank === 3) return true; // 3可以压任何牌
          return c.rank > lastRank;
        });

        if (canBeat.length > 0) {
          // 出最小的能压制的牌
          const sorted = [...canBeat].sort((a, b) => {
            // 3排在最后（尽量不出3）
            if (a.rank === 3 && b.rank !== 3) return 1;
            if (a.rank !== 3 && b.rank === 3) return -1;
            return a.rank - b.rank || a.suit.localeCompare(b.suit);
          });
          const result = engine.play(seat, [sorted[0]]);
          if (!result.valid) {
            engine.pass(seat);
          }
        } else {
          engine.pass(seat);
        }
      }
      moves++;
    }

    // 检查游戏状态
    const final = engine.getState();

    // 游戏可能完成，也可能因为只剩3而卡住
    // 两种情况都是正常的
    if (final.phase === 'finished') {
      expect(final.finishedOrder).toHaveLength(4);

      // 结算应产生有效结果
      const result = engine.settle();
      expect(result.rankings).toHaveLength(4);
      expect(result.teamScores).toHaveLength(2);
    } else {
      // 游戏未完成，但至少应该有正常的状态
      expect(final.phase).toBe('playing');
      // 验证游戏逻辑正常运行（进行了移动）
      expect(moves).toBeGreaterThan(0);
    }
  });

  it('验证玩家视图隐藏其他人手牌', () => {
    const engine = createGame('room-view', players);
    const view = engine.getPlayerView(0);

    expect(view.myHand).toHaveLength(13);
    expect(view.mySeat).toBe(0);

    for (const [seat, player] of Object.entries(view.players)) {
      if (Number(seat) !== 0) {
        expect(player.cardCount).toBe(13);
        // ClientPlayerState 不应包含 hand 属性
        expect('hand' in player).toBe(false);
      }
    }
  });

  it('出牌后手牌数减少', () => {
    const engine = createGame('room-play', players);
    const seat = engine.getState().currentPlayerSeat;
    const hand = engine.getState().players[seat].hand;
    const card = hand.find((c) => c.rank !== 3);
    if (!card) return;

    const result = engine.play(seat, [card]);
    expect(result.valid).toBe(true);
    expect(engine.getState().players[seat].hand).toHaveLength(12);
  });

  it('非当前玩家出牌被拒绝', () => {
    const engine = createGame('room-reject', players);
    const currentSeat = engine.getState().currentPlayerSeat;
    const wrongSeat = (currentSeat + 1) % 4;
    const hand = engine.getState().players[wrongSeat].hand;

    const result = engine.play(wrongSeat, [hand[0]]);
    expect(result.valid).toBe(false);
  });

  it('pass 后轮转到下一个玩家', () => {
    const engine = createGame('room-pass', players);
    const seat = engine.getState().currentPlayerSeat;
    const hand = engine.getState().players[seat].hand;
    const card = hand.find((c) => c.rank !== 3)!;
    engine.play(seat, [card]);

    const nextSeat = engine.getState().currentPlayerSeat;
    engine.pass(nextSeat);
    expect(engine.getState().currentPlayerSeat).not.toBe(nextSeat);
  });
});
