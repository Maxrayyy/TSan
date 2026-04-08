// packages/server/src/game/hand-comparator.ts
import type { HandType } from '@tuosan/shared';
import { HandTypeEnum, SUIT_ORDER } from '@tuosan/shared';

// Power levels: 0 = normal, higher = stronger special type
const HAND_TYPE_POWER: Record<HandTypeEnum, number> = {
  [HandTypeEnum.SINGLE]: 0,
  [HandTypeEnum.PAIR]: 0,
  [HandTypeEnum.TRIPLE]: 0,
  [HandTypeEnum.STRAIGHT]: 0,
  [HandTypeEnum.DOUBLE_STRAIGHT]: 0,
  [HandTypeEnum.TRIPLE_STRAIGHT]: 0,
  [HandTypeEnum.THREE_WITH_TWO]: 0,
  [HandTypeEnum.GAO_GAO]: 0,
  [HandTypeEnum.FTK]: 1,
  [HandTypeEnum.PURE_FTK]: 2,
  [HandTypeEnum.BOMB]: 3,
  [HandTypeEnum.PURE_DRAGON]: 4,
  [HandTypeEnum.TIAN_LONG]: 6,
  [HandTypeEnum.PURE_TIAN_LONG]: 7,
};

export function compareHands(play: HandType, target: HandType): number | null {
  const powerPlay = HAND_TYPE_POWER[play.type];
  const powerTarget = HAND_TYPE_POWER[target.type];

  // Both normal types: must be same type and same length
  if (powerPlay === 0 && powerTarget === 0) {
    if (play.type !== target.type) return null;
    if (play.length !== undefined && play.length !== target.length) return null;
    return play.rank - target.rank;
  }

  // Pure dragon vs double straight: special rule
  if (play.type === HandTypeEnum.PURE_DRAGON && target.type === HandTypeEnum.DOUBLE_STRAIGHT) {
    return comparePureDragonVsDoubleStraight(play, target);
  }
  if (play.type === HandTypeEnum.DOUBLE_STRAIGHT && target.type === HandTypeEnum.PURE_DRAGON) {
    const r = comparePureDragonVsDoubleStraight(target, play);
    return r !== null ? -r : null;
  }

  // Different power levels
  if (powerPlay !== powerTarget) {
    return powerPlay - powerTarget;
  }

  // Same special type
  if (play.type === HandTypeEnum.BOMB) {
    return play.rank - target.rank;
  }

  if (play.type === HandTypeEnum.PURE_DRAGON) {
    if (play.length !== target.length) return (play.length || 0) - (target.length || 0);
    return play.rank - target.rank;
  }

  // Same type special (FTK vs FTK, pure FTK vs pure FTK, tian long vs tian long)
  if (play.suit && target.suit) {
    return SUIT_ORDER[play.suit] - SUIT_ORDER[target.suit];
  }

  return play.rank - target.rank;
}

function comparePureDragonVsDoubleStraight(
  pureDragon: HandType,
  doubleStraight: HandType,
): number | null {
  const pdLen = pureDragon.length || 0;
  const dsLen = doubleStraight.length || 0;

  // 8-9 card pure dragon > 4-pair double straight
  if (pdLen >= 8 && pdLen <= 9 && dsLen === 4) return 1;
  // 10-11 card pure dragon > 5-pair double straight
  if (pdLen >= 10 && pdLen <= 11 && dsLen === 5) return 1;

  return null;
}

export function canBeat(play: HandType, target: HandType): boolean {
  const result = compareHands(play, target);
  return result !== null && result > 0;
}
