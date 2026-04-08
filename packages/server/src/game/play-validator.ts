// packages/server/src/game/play-validator.ts
import type { Card, GameState, HandType } from '@tuosan/shared';
import { detectHandType } from './hand-detector.js';
import { compareHands } from './hand-comparator.js';

export interface ValidationResult {
  valid: boolean;
  reason?: string;
  handType?: HandType;
}

export function containsThree(cards: Card[]): boolean {
  return cards.some((c) => c.rank === 3);
}

export function playerHasCards(hand: Card[], cards: Card[]): boolean {
  const handCopy = [...hand];
  for (const card of cards) {
    const idx = handCopy.findIndex((h) => h.suit === card.suit && h.rank === card.rank);
    if (idx === -1) return false;
    handCopy.splice(idx, 1);
  }
  return true;
}

export function validatePlay(state: GameState, seatIndex: number, cards: Card[]): ValidationResult {
  // 1. Turn check
  if (state.currentPlayerSeat !== seatIndex) {
    return { valid: false, reason: '不是你的回合' };
  }

  // 2. Possession check
  const hand = state.players[seatIndex].hand;
  if (!playerHasCards(hand, cards)) {
    return { valid: false, reason: '你没有这些牌' };
  }

  // 3. Hand type check
  const handType = detectHandType(cards);
  if (!handType) {
    return { valid: false, reason: '不是合法牌型' };
  }

  // 4. Leading / first play: no 3s allowed
  const isLeading = state.currentRound.lastPlay === null;
  if ((isLeading || state.isFirstPlay) && containsThree(cards)) {
    return { valid: false, reason: '接风/首出时不能出含3的牌' };
  }

  // 5. Must beat last play if following
  if (!isLeading) {
    const lastHandType = state.currentRound.lastPlay!.handType;
    const comparison = compareHands(handType, lastHandType);
    if (comparison === null || comparison <= 0) {
      return { valid: false, reason: '无法压制场上的牌' };
    }
  }

  return { valid: true, handType };
}
