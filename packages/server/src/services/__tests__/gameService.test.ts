// packages/server/src/services/__tests__/gameService.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createGame, getEngine, removeEngine, getAllEngines } from '../gameService.js';
import type { PlayerInfo } from '../../game/game-engine.js';

const players: PlayerInfo[] = [
  { userId: 'u0', nickname: 'P0', avatar: '', seatIndex: 0 },
  { userId: 'u1', nickname: 'P1', avatar: '', seatIndex: 1 },
  { userId: 'u2', nickname: 'P2', avatar: '', seatIndex: 2 },
  { userId: 'u3', nickname: 'P3', avatar: '', seatIndex: 3 },
];

describe('gameService', () => {
  beforeEach(() => {
    for (const [roomId] of getAllEngines()) {
      removeEngine(roomId);
    }
  });

  it('创建并获取游戏引擎', () => {
    const engine = createGame('room1', players);
    expect(engine).toBeDefined();
    expect(getEngine('room1')).toBe(engine);
  });

  it('不存在的游戏返回 undefined', () => {
    expect(getEngine('nonexistent')).toBeUndefined();
  });

  it('移除游戏引擎', () => {
    createGame('room1', players);
    removeEngine('room1');
    expect(getEngine('room1')).toBeUndefined();
  });

  it('创建时自动发牌', () => {
    const engine = createGame('room1', players);
    const state = engine.getState();
    expect(state.phase).toBe('playing');
    for (let i = 0; i < 4; i++) {
      expect(state.players[i].hand).toHaveLength(13);
    }
  });
});
