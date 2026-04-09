// packages/server/src/services/gameService.ts
import { GameEngine, type PlayerInfo } from '../game/game-engine.js';
import { prisma } from '../config/database.js';
import { getTeamIndex } from '@tuosan/shared';
import type { GameResult } from '@tuosan/shared';
import { logger } from '../utils/logger.js';

// 内存中存储活跃的游戏引擎
const engines = new Map<string, GameEngine>();

/** 创建游戏，自动发牌 */
export function createGame(roomId: string, players: PlayerInfo[]): GameEngine {
  const engine = new GameEngine(roomId, players);
  engine.deal();
  engines.set(roomId, engine);
  logger.info({ roomId, players: players.map((p) => p.userId) }, '游戏已创建');
  return engine;
}

/** 获取游戏引擎 */
export function getEngine(roomId: string): GameEngine | undefined {
  return engines.get(roomId);
}

/** 移除游戏引擎 */
export function removeEngine(roomId: string): void {
  engines.delete(roomId);
}

/** 获取所有活跃游戏引擎 */
export function getAllEngines(): Map<string, GameEngine> {
  return engines;
}

/** 持久化游戏结果到 PostgreSQL（接受预计算的 result，避免重复调用 settle） */
export async function persistGameResult(engine: GameEngine, result: GameResult): Promise<void> {
  const state = engine.getState();

  try {
    await prisma.$transaction(async (tx) => {
      // 创建对局记录
      const gameRecord = await tx.gameRecord.create({
        data: {
          roomId: state.roomId,
          startedAt: new Date(Number(state.id.split('_')[1])),
          endedAt: new Date(),
          totalRounds: 0,
          teamAScore: result.teamScores[0],
          teamBScore: result.teamScores[1],
          isShuangDaiHua: result.isShuangDaiHua,
        },
      });

      // 创建玩家记录并更新统计
      for (const ranking of result.rankings) {
        const teamIdx = getTeamIndex(ranking.seatIndex);
        const opponentTeamIdx = 1 - teamIdx;
        const isWin = result.teamScores[teamIdx] > result.teamScores[opponentTeamIdx] ? 1 : 0;

        await tx.gamePlayer.create({
          data: {
            gameRecordId: gameRecord.id,
            userId: ranking.userId,
            seatIndex: ranking.seatIndex,
            teamIndex: teamIdx,
            rank: ranking.rank,
            capturedScore: ranking.capturedScore,
            tuoSanCount: ranking.tuoSanCount,
            bieSanCount: ranking.bieSanCount,
            tuoSanScore: ranking.tuoSanCount,
            bieSanScore: ranking.bieSanCount,
            rankScore: 0,
            totalScore: ranking.totalScore,
          },
        });

        // 更新用户统计
        await tx.userStats.upsert({
          where: { userId: ranking.userId },
          create: {
            userId: ranking.userId,
            totalGames: 1,
            totalWins: isWin,
            totalFirstPlace: ranking.rank === 1 ? 1 : 0,
            totalTuoSan: ranking.tuoSanCount,
            totalBieSan: ranking.bieSanCount,
            totalScore: ranking.totalScore,
            totalShuangDaiHua:
              result.isShuangDaiHua && teamIdx === getTeamIndex(state.finishedOrder[0]) ? 1 : 0,
          },
          update: {
            totalGames: { increment: 1 },
            totalWins: { increment: isWin },
            totalFirstPlace: { increment: ranking.rank === 1 ? 1 : 0 },
            totalTuoSan: { increment: ranking.tuoSanCount },
            totalBieSan: { increment: ranking.bieSanCount },
            totalScore: { increment: ranking.totalScore },
            totalShuangDaiHua: {
              increment:
                result.isShuangDaiHua && teamIdx === getTeamIndex(state.finishedOrder[0]) ? 1 : 0,
            },
          },
        });
      }

      logger.info({ gameRecordId: gameRecord.id, roomId: state.roomId }, '对局结果已保存');
    });
  } catch (err) {
    logger.error({ err, roomId: state.roomId }, '保存对局结果失败');
  }
}
