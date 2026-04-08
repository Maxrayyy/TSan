// packages/server/src/game/tuo-san-rule.ts
import type { Card, RoundState, PlayerState } from '@tuosan/shared';

export interface TuoSanResult {
  playerSeat: number;
  count: number;
}

export interface BieSanResult {
  playerSeat: number;
  count: number;
}

export function checkTuoSan(round: RoundState): TuoSanResult | null {
  const lastPlay = round.lastPlay;
  if (!lastPlay) return null;

  const cards = lastPlay.cards;
  const allThrees = cards.every((c: Card) => c.rank === 3);
  if (!allThrees) return null;

  return {
    playerSeat: lastPlay.playerSeat,
    count: cards.length,
  };
}

export function checkBieSan(players: Record<number, PlayerState>): BieSanResult[] {
  const results: BieSanResult[] = [];

  for (const [seatStr, player] of Object.entries(players)) {
    const seat = Number(seatStr);
    const threes = player.hand.filter((c: Card) => c.rank === 3);

    if (threes.length > 0 && threes.length < 4) {
      results.push({ playerSeat: seat, count: threes.length });
    }
  }

  return results;
}
