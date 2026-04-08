// packages/server/src/game/scorer.ts
import type { Card, GameState, GameResult } from '@tuosan/shared';
import {
  HEART_FIVE_SCORE,
  SHUANG_DAI_HUA_SCORE,
  TUO_SAN_SCORE,
  BIE_SAN_SCORE,
  getTeamIndex,
} from '@tuosan/shared';
import { checkBieSan } from './tuo-san-rule.js';

export function calculateRoundScore(cards: Card[]): number {
  let score = 0;
  for (const card of cards) {
    if (card.rank === 5) {
      score += card.suit === 'heart' ? HEART_FIVE_SCORE : 5;
    } else if (card.rank === 10) {
      score += 10;
    } else if (card.rank === 13) {
      score += 10;
    }
  }
  return score;
}

export function settleGame(state: GameState): GameResult {
  const finishedOrder = state.finishedOrder;
  const firstSeat = finishedOrder[0];
  const secondSeat = finishedOrder[1];
  const firstTeam = getTeamIndex(firstSeat);
  const secondTeam = getTeamIndex(secondSeat);
  const isShuangDaiHua = firstTeam === secondTeam;

  // Bie san check
  const bieSanResults = checkBieSan(state.players);
  for (const bs of bieSanResults) {
    state.players[bs.playerSeat].bieSanCount = bs.count;
  }

  const teamScores: [number, number] = [0, 0];

  if (isShuangDaiHua) {
    teamScores[firstTeam] = SHUANG_DAI_HUA_SCORE;
    teamScores[1 - firstTeam] = -SHUANG_DAI_HUA_SCORE;
  } else {
    const lastSeat = finishedOrder[3];
    for (const [seatStr, player] of Object.entries(state.players)) {
      const seat = Number(seatStr);
      const team = getTeamIndex(seat);
      if (seat === lastSeat) {
        teamScores[firstTeam] += player.score;
      } else {
        teamScores[team] += player.score;
      }
    }
  }

  const rankings = finishedOrder.map((seat, idx) => {
    const player = state.players[seat];
    return {
      seatIndex: seat,
      userId: player.userId,
      nickname: player.nickname,
      rank: idx + 1,
      capturedScore: player.score,
      tuoSanCount: player.tuoSanCount,
      bieSanCount: player.bieSanCount,
      totalScore:
        player.score + player.tuoSanCount * TUO_SAN_SCORE - player.bieSanCount * BIE_SAN_SCORE,
    };
  });

  return { rankings, teamScores, isShuangDaiHua };
}
