import type { TypedIO, TypedSocket } from './index.js';
import { getEngine, removeEngine, persistGameResult } from '../services/gameService.js';
import { logger } from '../utils/logger.js';
import { TURN_TIMEOUT } from '@tuosan/shared';
import type { Card } from '@tuosan/shared';

// 房间计时器映射
const turnTimers = new Map<string, NodeJS.Timeout>();

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
      // 清除计时器
      clearTurnTimer(roomId);

      // 验证出牌
      const result = engine.play(seatIndex, data.cards);
      if (!result.valid) {
        socket.emit('error', {
          code: 'INVALID_PLAY',
          message: result.reason || '无效出牌',
        });
        // 重新启动计时器
        startTurnTimer(io, roomId, seatIndex);
        return;
      }

      const state = engine.getState();
      const player = state.players[seatIndex];

      // 广播出牌结果
      io.to(roomId).emit('game:played', {
        playerId: userId,
        seatIndex,
        cards: data.cards,
        handType: result.handType!,
        remainingCards: player.hand.length,
      });

      // 检查玩家是否打完牌
      if (player.rank !== null) {
        io.to(roomId).emit('game:player-finished', {
          playerId: userId,
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
      const nextSeat = state.currentPlayerSeat;
      await notifyNextPlayer(io, roomId, nextSeat);

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
      // 清除计时器
      clearTurnTimer(roomId);

      const state = engine.getState();

      // 保存回合状态用于检测回合结束
      const prevRound = { ...state.currentRound };

      // 验证 pass
      const result = engine.pass(seatIndex);
      if (!result.valid) {
        socket.emit('error', {
          code: 'INVALID_PASS',
          message: result.reason || '无法 pass',
        });
        // 重新启动计时器
        startTurnTimer(io, roomId, seatIndex);
        return;
      }

      // 广播 pass 事件
      io.to(roomId).emit('game:passed', {
        playerId: userId,
        seatIndex,
      });

      const newState = engine.getState();

      // 检测回合是否结束：如果回合从有 lastPlay 变为 null，说明回合刚结束
      if (newState.currentRound.lastPlay === null && prevRound.lastPlay !== null) {
        const winnerSeat = prevRound.lastPlay.playerSeat;
        const winner = newState.players[winnerSeat];
        const roundScore = winner.score - state.players[winnerSeat].score;

        // 广播回合结束
        io.to(roomId).emit('game:round-end', {
          winnerId: winner.userId,
          winnerSeat,
          score: roundScore,
        });

        // 检测拖三
        const lastPlayCards = prevRound.lastPlay.cards;
        const isAllThrees = lastPlayCards.every((card) => card.rank === 3);
        if (isAllThrees && lastPlayCards.length > 0) {
          const tuoSanCount =
            newState.players[winnerSeat].tuoSanCount - state.players[winnerSeat].tuoSanCount;
          if (tuoSanCount > 0) {
            io.to(roomId).emit('game:tuo-san', {
              playerId: winner.userId,
              seatIndex: winnerSeat,
              count: tuoSanCount,
            });
          }
        }

        logger.debug({ roomId, winnerSeat, roundScore }, '回合结束');
      }

      // 通知下一个玩家出牌
      const nextSeat = newState.currentPlayerSeat;
      await notifyNextPlayer(io, roomId, nextSeat);

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

/** 通知下一个玩家出牌，启动计时器 */
export async function notifyNextPlayer(
  io: TypedIO,
  roomId: string,
  seatIndex: number,
): Promise<void> {
  const sockets = await io.in(roomId).fetchSockets();
  for (const s of sockets) {
    if (s.data.seatIndex === seatIndex) {
      s.emit('game:your-turn', { timeLimit: TURN_TIMEOUT });
      break;
    }
  }
  startTurnTimer(io, roomId, seatIndex);
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
      // 如果是首出，出最小的非3牌
      if (state.currentRound.lastPlay === null) {
        const player = state.players[seatIndex];
        const nonThrees = player.hand.filter((card) => card.rank !== 3);

        if (nonThrees.length > 0) {
          // 找到最小的牌（按 rank 排序）
          const sorted = [...nonThrees].sort((a, b) => a.rank - b.rank);
          const minCard = sorted[0];

          // 出最小的单牌
          const playResult = engine.play(seatIndex, [minCard]);
          if (playResult.valid) {
            const newState = engine.getState();
            const player = newState.players[seatIndex];

            io.to(roomId).emit('game:played', {
              playerId: player.userId,
              seatIndex,
              cards: [minCard],
              handType: playResult.handType!,
              remainingCards: player.hand.length,
            });

            // 检查玩家是否打完牌
            if (player.rank !== null) {
              io.to(roomId).emit('game:player-finished', {
                playerId: player.userId,
                seatIndex,
                rank: player.rank,
              });

              if (newState.phase === 'finished') {
                await handleGameEnd(io, roomId, engine);
                return;
              }
            }

            const nextSeat = newState.currentPlayerSeat;
            await notifyNextPlayer(io, roomId, nextSeat);
          }
        } else {
          // 只有3，出一张3
          if (player.hand.length > 0) {
            const playResult = engine.play(seatIndex, [player.hand[0]]);
            if (playResult.valid) {
              const newState = engine.getState();
              const player = newState.players[seatIndex];

              io.to(roomId).emit('game:played', {
                playerId: player.userId,
                seatIndex,
                cards: [player.hand[0]],
                handType: playResult.handType!,
                remainingCards: player.hand.length,
              });

              if (player.rank !== null) {
                io.to(roomId).emit('game:player-finished', {
                  playerId: player.userId,
                  seatIndex,
                  rank: player.rank,
                });

                if (newState.phase === 'finished') {
                  await handleGameEnd(io, roomId, engine);
                  return;
                }
              }

              const nextSeat = newState.currentPlayerSeat;
              await notifyNextPlayer(io, roomId, nextSeat);
            }
          }
        }
      } else {
        // 跟牌时超时，自动 pass
        const prevRound = { ...state.currentRound };
        const passResult = engine.pass(seatIndex);

        if (passResult.valid) {
          io.to(roomId).emit('game:passed', {
            playerId: state.players[seatIndex].userId,
            seatIndex,
          });

          const newState = engine.getState();

          // 检测回合结束
          if (newState.currentRound.lastPlay === null && prevRound.lastPlay !== null) {
            const winnerSeat = prevRound.lastPlay.playerSeat;
            const winner = newState.players[winnerSeat];
            const roundScore = winner.score - state.players[winnerSeat].score;

            io.to(roomId).emit('game:round-end', {
              winnerId: winner.userId,
              winnerSeat,
              score: roundScore,
            });

            // 检测拖三
            const lastPlayCards = prevRound.lastPlay.cards;
            const isAllThrees = lastPlayCards.every((card) => card.rank === 3);
            if (isAllThrees && lastPlayCards.length > 0) {
              const tuoSanCount =
                newState.players[winnerSeat].tuoSanCount - state.players[winnerSeat].tuoSanCount;
              if (tuoSanCount > 0) {
                io.to(roomId).emit('game:tuo-san', {
                  playerId: winner.userId,
                  seatIndex: winnerSeat,
                  count: tuoSanCount,
                });
              }
            }
          }

          const nextSeat = newState.currentPlayerSeat;
          await notifyNextPlayer(io, roomId, nextSeat);
        }
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
async function handleGameEnd(
  io: TypedIO,
  roomId: string,
  engine: ReturnType<typeof getEngine>,
): Promise<void> {
  if (!engine) return;

  clearTurnTimer(roomId);

  // 结算游戏
  const result = engine.settle();

  // 广播游戏结束
  io.to(roomId).emit('game:end', { result });

  // 持久化结果
  await persistGameResult(engine);

  // 清理引擎
  removeEngine(roomId);

  logger.info({ roomId, result }, '游戏结束');
}
