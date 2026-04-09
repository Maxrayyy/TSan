// packages/client/src/game/hints.ts
import type { Card, HandType } from '@tuosan/shared';
import { HandTypeEnum, SUIT_ORDER } from '@tuosan/shared';

// ---- 简化版牌型检测（客户端用于提示） ----

function isConsecutive(sorted: number[]): boolean {
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] !== sorted[i - 1] + 1) return false;
  }
  return true;
}

function detectHandType(cards: Card[]): HandType | null {
  const n = cards.length;
  if (n === 0) return null;

  const sorted = [...cards].sort((a, b) => a.rank - b.rank);
  const ranks = sorted.map((c) => c.rank);
  const suits = sorted.map((c) => c.suit);

  const rankCount = new Map<number, number>();
  for (const r of ranks) rankCount.set(r, (rankCount.get(r) || 0) + 1);

  if (n === 1) return { type: HandTypeEnum.SINGLE, rank: ranks[0] };

  if (n === 2 && ranks[0] === ranks[1]) return { type: HandTypeEnum.PAIR, rank: ranks[0] };

  if (n === 3 && ranks[0] === ranks[1] && ranks[1] === ranks[2])
    return { type: HandTypeEnum.TRIPLE, rank: ranks[0] };

  if (n === 4 && new Set(ranks).size === 1) return { type: HandTypeEnum.BOMB, rank: ranks[0] };

  // 510K / 纯510K
  if (n === 3 && ranks.includes(5) && ranks.includes(10) && ranks.includes(13)) {
    const allSameSuit = new Set(suits).size === 1;
    if (allSameSuit) return { type: HandTypeEnum.PURE_FTK, rank: 0, suit: suits[0] };
    return { type: HandTypeEnum.FTK, rank: 0 };
  }

  // 三带二
  if (n === 5) {
    let tripleRank: number | null = null;
    let pairRank: number | null = null;
    let valid = true;
    for (const [rank, count] of rankCount) {
      if (count === 3) tripleRank = rank;
      else if (count === 2) pairRank = rank;
      else valid = false;
    }
    if (valid && tripleRank !== null && pairRank !== null)
      return { type: HandTypeEnum.THREE_WITH_TWO, rank: tripleRank };
  }

  // 顺子 / 纯龙 (>=5连续，不含2)
  if (n >= 5 && isConsecutive(ranks) && !ranks.includes(15)) {
    const allSameSuit = new Set(suits).size === 1;
    const topRank = ranks[ranks.length - 1];
    if (allSameSuit)
      return { type: HandTypeEnum.PURE_DRAGON, rank: topRank, suit: suits[0], length: n };
    return { type: HandTypeEnum.STRAIGHT, rank: topRank, length: n };
  }

  // 连对 (>=4张，偶数，全是对子，连续，不含2)
  if (n >= 4 && n % 2 === 0) {
    let allPairs = true;
    for (const count of rankCount.values()) {
      if (count !== 2) {
        allPairs = false;
        break;
      }
    }
    if (allPairs) {
      const uniqueRanks = [...rankCount.keys()].sort((a, b) => a - b);
      if (!uniqueRanks.includes(15) && uniqueRanks.length >= 2 && isConsecutive(uniqueRanks)) {
        return {
          type: HandTypeEnum.DOUBLE_STRAIGHT,
          rank: uniqueRanks[uniqueRanks.length - 1],
          length: uniqueRanks.length,
        };
      }
    }
  }

  // 连三 (>=6张，3的倍数，全是三张，连续，不含2)
  if (n >= 6 && n % 3 === 0) {
    let allTriples = true;
    for (const count of rankCount.values()) {
      if (count !== 3) {
        allTriples = false;
        break;
      }
    }
    if (allTriples) {
      const uniqueRanks = [...rankCount.keys()].sort((a, b) => a - b);
      if (!uniqueRanks.includes(15) && uniqueRanks.length >= 2 && isConsecutive(uniqueRanks)) {
        return {
          type: HandTypeEnum.TRIPLE_STRAIGHT,
          rank: uniqueRanks[uniqueRanks.length - 1],
          length: uniqueRanks.length,
        };
      }
    }
  }

  return null;
}

// ---- 简化版比较器 ----

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

function canBeat(play: HandType, target: HandType): boolean {
  const pp = HAND_TYPE_POWER[play.type];
  const pt = HAND_TYPE_POWER[target.type];

  if (pp === 0 && pt === 0) {
    if (play.type !== target.type) return false;
    if (play.length !== undefined && play.length !== target.length) return false;
    return play.rank > target.rank;
  }

  if (pp !== pt) return pp > pt;

  if (play.type === HandTypeEnum.BOMB) return play.rank > target.rank;
  if (play.type === HandTypeEnum.PURE_DRAGON) {
    if (play.length !== target.length) return (play.length || 0) > (target.length || 0);
    return play.rank > target.rank;
  }
  if (play.suit && target.suit) return SUIT_ORDER[play.suit] > SUIT_ORDER[target.suit];
  return play.rank > target.rank;
}

// ---- 组合生成 ----

function combinations<T>(arr: T[], size: number): T[][] {
  if (size === 0) return [[]];
  if (arr.length < size) return [];
  const [first, ...rest] = arr;
  const withFirst = combinations(rest, size - 1).map((c) => [first, ...c]);
  const withoutFirst = combinations(rest, size);
  return [...withFirst, ...withoutFirst];
}

// ---- 提示生成 ----

/**
 * 获取所有能压过当前出牌的合法组合。
 * 如果 currentPlay 为 null，返回所有合法的首出组合（不含3）。
 */
export function getHints(
  hand: Card[],
  currentPlay: { cards: Card[]; handType: HandType } | null,
  isLeading: boolean,
): Card[][] {
  const hints: Card[][] = [];
  const containsThree = (cards: Card[]) => cards.some((c) => c.rank === 3);

  const maxSize = Math.min(hand.length, 13);
  for (let size = 1; size <= maxSize; size++) {
    // 优化：限制组合数量
    if (size > 5 && combinations(hand, size).length > 5000) break;

    for (const combo of combinations(hand, size)) {
      const ht = detectHandType(combo);
      if (!ht) continue;

      // 首出不能含3
      if (isLeading && containsThree(combo)) continue;

      if (currentPlay) {
        if (canBeat(ht, currentPlay.handType)) {
          hints.push(combo);
        }
      } else {
        hints.push(combo);
      }
    }
  }

  // 排序：优先小牌组合
  hints.sort((a, b) => a.length - b.length || a[0].rank - b[0].rank);

  return hints.slice(0, 50);
}
