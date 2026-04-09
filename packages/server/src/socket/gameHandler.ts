import type { TypedIO, TypedSocket } from './index.js';
import { getEngine, removeEngine, persistGameResult } from '../services/gameService.js';
import * as roomService from '../services/roomService.js';
import { logger } from '../utils/logger.js';
import { TURN_TIMEOUT, RECONNECT_TIMEOUT } from '@tuosan/shared';
import type { Card } from '@tuosan/shared';
import type { GameEngine } from '../game/game-engine.js';
import { chooseBotPlay } from '../game/bot.js';
import { isBotUser } from '../services/roomService.js';

// 房间计时器映射
const turnTimers = new Map<string, NodeJS.Timeout>();

// 断线重连计时器映射: roomId -> Map<seatIndex, timer>
const reconnectTimers = new Map<string, Map<number, NodeJS.Timeout>>();

export function registerGameHandlers(io: TypedIO, socket: TypedSocket): void {
  const userId = socket.data.userId as string;

  socket.on('game:play', async (data: { cards: Card[] }) => {
    const roomId = socket.data.roomId as string;
    const seatIndex = socket.data.seatIndex as number;

    if (!roomId || seatIndex === undefined) {
      socket.emit('error', { code: 'NOT_IN_ROOM', message: '未加入房间' });
      return;
    }

    const engine = getEngine(roomId);
    if (!engine) {
      socket.emit('error', { code: 'GAME_NOT_FOUND', message: '游戏不存在' });
      return;
    }

    try {
      clearTurnTimer(roomId);

      const result = engine.play(seatIndex, data.cards);
      if (!result.valid) {
        socket.emit('error', {
          code: 'INVALID_PLAY',
          message: result.reason || '无效出牌',
        });
        startTurnTimer(io, roomId, seatIndex);
        return;
      }

      const state = engine.getState();
      const player = state.players[seatIndex];

      // 广播出牌结果（包含 nextSeat 供客户端更新回合指示）
      io.to(roomId).emit('game:played', {
        playerId: userId,
        seatIndex,
        cards: data.cards,
        handType: result.handType!,
        remainingCards: player.hand.length,
        nextSeat: state.currentPlayerSeat,
      });

      await handlePostPlay(io, roomId, engine, seatIndex);

      logger.debug({ userId, roomId, seatIndex, cards: data.cards }, '玩家出牌');
    } catch (err: unknown) {
      const e = err as { message?: string };
      logger.error({ err, userId, roomId, seatIndex }, '出牌处理失败');
      socket.emit('error', {
        code: 'INTERNAL_ERROR',
        message: e.message || '出牌失败',
      });
    }
  });

  socket.on('game:reconnect-request', async () => {
    const roomId = socket.data.roomId as string;
    const seatIndex = socket.data.seatIndex as number;

    if (!roomId || seatIndex === undefined) return;

    const engine = getEngine(roomId);
    if (!engine || engine.getState().phase !== 'playing') return;

    // 清除重连计时器
    const roomTimers = reconnectTimers.get(roomId);
    if (roomTimers) {
      const timer = roomTimers.get(seatIndex);
      if (timer) {
        clearTimeout(timer);
        roomTimers.delete(seatIndex);
      }
    }

    // 恢复连接状态
    engine.setPlayerConnected(seatIndex, true);

    // 发送完整游戏状态给重连玩家
    const view = engine.getPlayerView(seatIndex);
    socket.emit('game:reconnect', { gameState: view });

    // 通知其他玩家
    io.to(roomId).emit('game:player-reconnected', { seatIndex });

    // 如果当前轮到重连玩家，重新通知
    if (engine.getState().currentPlayerSeat === seatIndex) {
      await notifyNextPlayer(io, roomId, seatIndex);
    }

    logger.info({ roomId, seatIndex }, '玩家重连成功');
  });

  socket.on('game:pass', async () => {
    const roomId = socket.data.roomId as string;
    const seatIndex = socket.data.seatIndex as number;

    if (!roomId || seatIndex === undefined) {
      socket.emit('error', { code: 'NOT_IN_ROOM', message: '未加入房间' });
      return;
    }

    const engine = getEngine(roomId);
    if (!engine) {
      socket.emit('error', { code: 'GAME_NOT_FOUND', message: '游戏不存在' });
      return;
    }

    try {
      clearTurnTimer(roomId);

      // 显式深拷贝 lastPlay，避免依赖引擎内部实现
      const prevLastPlay = engine.getState().currentRound.lastPlay
        ? {
            ...engine.getState().currentRound.lastPlay!,
            cards: [...engine.getState().currentRound.lastPlay!.cards],
          }
        : null;
      const prevScores = Object.fromEntries(
        Object.entries(engine.getState().players).map(([s, p]) => [s, p.score]),
      );

      const result = engine.pass(seatIndex);
      if (!result.valid) {
        socket.emit('error', {
          code: 'INVALID_PASS',
          message: result.reason || '无法 pass',
        });
        startTurnTimer(io, roomId, seatIndex);
        return;
      }

      const newState = engine.getState();

      // 广播 pass 事件（包含 nextSeat）
      io.to(roomId).emit('game:passed', {
        playerId: userId,
        seatIndex,
        nextSeat: newState.currentPlayerSeat,
      });

      // 检测回合是否结束
      await handleRoundEndCheck(io, roomId, newState, prevLastPlay, prevScores);

      // 通知下一个玩家
      await notifyNextPlayer(io, roomId, newState.currentPlayerSeat);

      logger.debug({ userId, roomId, seatIndex }, '玩家 pass');
    } catch (err: unknown) {
      const e = err as { message?: string };
      logger.error({ err, userId, roomId, seatIndex }, 'Pass 处理失败');
      socket.emit('error', {
        code: 'INTERNAL_ERROR',
        message: e.message || 'Pass 失败',
      });
    }
  });
}

/** 处理玩家断线 */
export function handlePlayerDisconnect(io: TypedIO, roomId: string, seatIndex: number): void {
  const engine = getEngine(roomId);
  if (!engine) return;

  engine.setPlayerConnected(seatIndex, false);
  io.to(roomId).emit('game:player-disconnected', { seatIndex });

  // 启动重连计时器
  if (!reconnectTimers.has(roomId)) reconnectTimers.set(roomId, new Map());
  const roomTimers = reconnectTimers.get(roomId)!;

  // 清除已有计时器
  const existing = roomTimers.get(seatIndex);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(() => {
    roomTimers.delete(seatIndex);
    logger.info({ roomId, seatIndex }, '重连超时，玩家将被自动托管');
    // 超时后如果轮到断线玩家，自动处理
    const eng = getEngine(roomId);
    if (eng && eng.getState().currentPlayerSeat === seatIndex) {
      autoPlayForDisconnected(io, roomId, seatIndex);
    }
  }, RECONNECT_TIMEOUT * 1000);

  roomTimers.set(seatIndex, timer);

  // 如果当前轮到断线玩家，也需要自动处理
  if (engine.getState().currentPlayerSeat === seatIndex) {
    clearTurnTimer(roomId);
    // 给一点时间看是否能快速重连，然后自动处理
    startTurnTimer(io, roomId, seatIndex);
  }

  logger.info({ roomId, seatIndex }, '玩家断线');
}

/** 断线玩家自动出牌/pass */
async function autoPlayForDisconnected(
  io: TypedIO,
  roomId: string,
  seatIndex: number,
): Promise<void> {
  const engine = getEngine(roomId);
  if (!engine) return;

  const state = engine.getState();
  if (state.currentPlayerSeat !== seatIndex || state.phase !== 'playing') return;

  // 和超时逻辑相同：首出出最小牌，跟牌自动pass
  if (state.currentRound.lastPlay === null) {
    const player = state.players[seatIndex];
    const nonThrees = player.hand.filter((card) => card.rank !== 3);
    const cardToPlay =
      nonThrees.length > 0 ? [...nonThrees].sort((a, b) => a.rank - b.rank)[0] : player.hand[0];

    if (!cardToPlay) return;

    const playResult = engine.play(seatIndex, [cardToPlay]);
    if (!playResult.valid) return;

    const newState = engine.getState();
    io.to(roomId).emit('game:played', {
      playerId: state.players[seatIndex].userId,
      seatIndex,
      cards: [cardToPlay],
      handType: playResult.handType!,
      remainingCards: newState.players[seatIndex].hand.length,
      nextSeat: newState.currentPlayerSeat,
    });

    await handlePostPlay(io, roomId, engine, seatIndex);
  } else {
    await executeBotPass(io, roomId, engine, seatIndex);
  }
}

/** 出牌后的公共处理：检查完成 → 检查游戏结束 → 通知下家 */
async function handlePostPlay(
  io: TypedIO,
  roomId: string,
  engine: GameEngine,
  seatIndex: number,
): Promise<void> {
  const state = engine.getState();
  const player = state.players[seatIndex];

  // 检查玩家是否打完牌
  if (player.rank !== null) {
    io.to(roomId).emit('game:player-finished', {
      playerId: player.userId,
      seatIndex,
      rank: player.rank,
    });

    // 检查游戏是否结束
    if (state.phase === 'finished') {
      await handleGameEnd(io, roomId, engine);
      return;
    }
  }

  // 通知下一个玩家出牌
  await notifyNextPlayer(io, roomId, state.currentPlayerSeat);
}

/** 检测回合结束、拖三 */
async function handleRoundEndCheck(
  io: TypedIO,
  roomId: string,
  newState: ReturnType<GameEngine['getState']>,
  prevLastPlay: { playerSeat: number; cards: Card[] } | null,
  prevScores: Record<string, number>,
): Promise<void> {
  if (newState.currentRound.lastPlay === null && prevLastPlay !== null) {
    const winnerSeat = prevLastPlay.playerSeat;
    const winner = newState.players[winnerSeat];
    const roundScore = winner.score - (prevScores[winnerSeat] ?? 0);

    io.to(roomId).emit('game:round-end', {
      winnerId: winner.userId,
      winnerSeat,
      score: roundScore,
    });

    // 检测拖三
    const isAllThrees = prevLastPlay.cards.every((card) => card.rank === 3);
    if (isAllThrees && prevLastPlay.cards.length > 0) {
      const prevTuoSan = newState.players[winnerSeat].tuoSanCount;
      // tuoSanCount 已在 engine.pass -> endRound 中更新
      if (prevTuoSan > 0) {
        io.to(roomId).emit('game:tuo-san', {
          playerId: winner.userId,
          seatIndex: winnerSeat,
          count: prevTuoSan,
        });
      }
    }

    logger.debug({ roomId, winnerSeat, roundScore }, '回合结束');
  }
}

/** 通知下一个玩家出牌，启动计时器。如果是机器人则自动出牌 */
export async function notifyNextPlayer(
  io: TypedIO,
  roomId: string,
  seatIndex: number,
): Promise<void> {
  const engine = getEngine(roomId);
  if (!engine) return;

  const state = engine.getState();
  const player = state.players[seatIndex];

  // 如果是机器人，自动出牌
  if (isBotUser(player.userId)) {
    const delay = 200 + Math.random() * 300;
    setTimeout(() => botPlay(io, roomId, seatIndex), delay);
    return;
  }

  // 如果玩家已断线，自动处理
  if (!player.connected) {
    const delay = 1000; // 给1秒看是否重连
    setTimeout(() => {
      const eng = getEngine(roomId);
      if (!eng) return;
      const s = eng.getState();
      if (s.currentPlayerSeat === seatIndex && !s.players[seatIndex].connected) {
        autoPlayForDisconnected(io, roomId, seatIndex);
      }
    }, delay);
    return;
  }

  // 真实玩家：发 Socket 事件 + 启动计时器
  const sockets = await io.in(roomId).fetchSockets();
  for (const s of sockets) {
    if (s.data.seatIndex === seatIndex) {
      s.emit('game:your-turn', { timeLimit: TURN_TIMEOUT });
      break;
    }
  }
  startTurnTimer(io, roomId, seatIndex);
}

/** 机器人自动出牌 */
async function botPlay(io: TypedIO, roomId: string, seatIndex: number): Promise<void> {
  const engine = getEngine(roomId);
  if (!engine) return;

  const state = engine.getState();
  if (state.phase !== 'playing' || state.currentPlayerSeat !== seatIndex) return;

  const player = state.players[seatIndex];
  const lastPlay = state.currentRound.lastPlay;
  const decision = chooseBotPlay(
    player.hand,
    lastPlay ? { cards: lastPlay.cards, handType: lastPlay.handType } : null,
  );

  try {
    if (decision.action === 'play' && decision.cards) {
      const cardToPlay = decision.cards[0];
      const result = engine.play(seatIndex, [cardToPlay]);
      if (!result.valid) {
        if (lastPlay) {
          await executeBotPass(io, roomId, engine, seatIndex);
        }
        return;
      }

      const newState = engine.getState();
      const updatedPlayer = newState.players[seatIndex];

      io.to(roomId).emit('game:played', {
        playerId: updatedPlayer.userId,
        seatIndex,
        cards: [cardToPlay],
        handType: result.handType!,
        remainingCards: updatedPlayer.hand.length,
        nextSeat: newState.currentPlayerSeat,
      });

      await handlePostPlay(io, roomId, engine, seatIndex);
    } else {
      await executeBotPass(io, roomId, engine, seatIndex);
    }
  } catch (err) {
    logger.error({ err, roomId, seatIndex }, '机器人出牌失败');
  }
}

/** 机器人执行 pass */
async function executeBotPass(
  io: TypedIO,
  roomId: string,
  engine: GameEngine,
  seatIndex: number,
): Promise<void> {
  const state = engine.getState();
  const prevLastPlay = state.currentRound.lastPlay
    ? { ...state.currentRound.lastPlay, cards: [...state.currentRound.lastPlay.cards] }
    : null;
  const prevScores = Object.fromEntries(
    Object.entries(state.players).map(([s, p]) => [s, p.score]),
  );

  const passResult = engine.pass(seatIndex);
  if (!passResult.valid) return;

  const newState = engine.getState();

  io.to(roomId).emit('game:passed', {
    playerId: state.players[seatIndex].userId,
    seatIndex,
    nextSeat: newState.currentPlayerSeat,
  });

  await handleRoundEndCheck(io, roomId, newState, prevLastPlay, prevScores);
  await notifyNextPlayer(io, roomId, newState.currentPlayerSeat);
}

/** 启动出牌倒计时 */
function startTurnTimer(io: TypedIO, roomId: string, seatIndex: number): void {
  clearTurnTimer(roomId);

  const timer = setTimeout(async () => {
    const engine = getEngine(roomId);
    if (!engine) return;

    const state = engine.getState();
    if (state.currentPlayerSeat !== seatIndex) return;

    logger.debug({ roomId, seatIndex }, '出牌超时，自动处理');

    try {
      if (state.currentRound.lastPlay === null) {
        // 首出：出最小的非3牌
        const player = state.players[seatIndex];
        const nonThrees = player.hand.filter((card) => card.rank !== 3);
        const cardToPlay =
          nonThrees.length > 0 ? [...nonThrees].sort((a, b) => a.rank - b.rank)[0] : player.hand[0]; // 只有3则出第一张

        if (!cardToPlay) return;

        const playResult = engine.play(seatIndex, [cardToPlay]);
        if (!playResult.valid) return;

        const newState = engine.getState();
        const updatedPlayer = newState.players[seatIndex];

        io.to(roomId).emit('game:played', {
          playerId: updatedPlayer.userId,
          seatIndex,
          cards: [cardToPlay], // 使用 play 之前保存的牌
          handType: playResult.handType!,
          remainingCards: updatedPlayer.hand.length,
          nextSeat: newState.currentPlayerSeat,
        });

        await handlePostPlay(io, roomId, engine, seatIndex);
      } else {
        // 跟牌超时：自动 pass
        const prevLastPlay = state.currentRound.lastPlay
          ? { ...state.currentRound.lastPlay, cards: [...state.currentRound.lastPlay.cards] }
          : null;
        const prevScores = Object.fromEntries(
          Object.entries(state.players).map(([s, p]) => [s, p.score]),
        );

        const passResult = engine.pass(seatIndex);
        if (!passResult.valid) return;

        const newState = engine.getState();

        io.to(roomId).emit('game:passed', {
          playerId: state.players[seatIndex].userId,
          seatIndex,
          nextSeat: newState.currentPlayerSeat,
        });

        await handleRoundEndCheck(io, roomId, newState, prevLastPlay, prevScores);
        await notifyNextPlayer(io, roomId, newState.currentPlayerSeat);
      }
    } catch (err) {
      logger.error({ err, roomId, seatIndex }, '超时自动处理失败');
    }
  }, TURN_TIMEOUT * 1000);

  turnTimers.set(roomId, timer);
}

/** 清除计时器 */
function clearTurnTimer(roomId: string): void {
  const timer = turnTimers.get(roomId);
  if (timer) {
    clearTimeout(timer);
    turnTimers.delete(roomId);
  }
}

/** 处理游戏结束 */
async function handleGameEnd(io: TypedIO, roomId: string, engine: GameEngine): Promise<void> {
  clearTurnTimer(roomId);

  // 结算游戏（只调用一次）
  const result = engine.settle();

  // 广播游戏结束
  io.to(roomId).emit('game:end', { result });

  // 持久化结果（传入已结算的 result，避免重复调用 settle）
  await persistGameResult(engine, result);

  // 恢复房间状态为 waiting
  try {
    await roomService.setRoomStatus(roomId, 'waiting');
  } catch (err) {
    logger.error({ err, roomId }, '恢复房间状态失败');
  }

  // 清理引擎
  removeEngine(roomId);

  logger.info({ roomId, result }, '游戏结束');
}
