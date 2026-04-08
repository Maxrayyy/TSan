// packages/server/src/game/hand-detector.ts
import type { Card, HandType } from '@tuosan/shared';
import { HandTypeEnum } from '@tuosan/shared';

export function detectHandType(cards: Card[]): HandType | null {
  const n = cards.length;
  if (n === 0) return null;

  const sorted = [...cards].sort((a, b) => a.rank - b.rank);
  const ranks = sorted.map((c) => c.rank);
  const suits = sorted.map((c) => c.suit);

  const rankCount = new Map<number, number>();
  for (const r of ranks) {
    rankCount.set(r, (rankCount.get(r) || 0) + 1);
  }

  // SINGLE
  if (n === 1) {
    return { type: HandTypeEnum.SINGLE, rank: ranks[0] };
  }

  // PAIR
  if (n === 2 && ranks[0] === ranks[1]) {
    return { type: HandTypeEnum.PAIR, rank: ranks[0] };
  }

  // TRIPLE (check before FTK — 3 same rank)
  if (n === 3 && ranks[0] === ranks[1] && ranks[1] === ranks[2]) {
    return { type: HandTypeEnum.TRIPLE, rank: ranks[0] };
  }

  // BOMB (4 same rank)
  if (n === 4 && new Set(ranks).size === 1) {
    return { type: HandTypeEnum.BOMB, rank: ranks[0] };
  }

  // FTK / PURE_FTK (3 cards: 5, 10, K)
  if (n === 3) {
    const ftk = detectFTK(sorted);
    if (ftk) return ftk;
  }

  // THREE_WITH_TWO (5 cards: 3+2)
  if (n === 5) {
    const twt = detectThreeWithTwo(rankCount);
    if (twt) return twt;
  }

  // GAO_GAO (10 cards: 3+3+2+2 with consecutive triples)
  if (n === 10) {
    const gg = detectGaoGao(rankCount);
    if (gg) return gg;
  }

  // TIAN_LONG / PURE_TIAN_LONG (12 consecutive 3-A)
  if (n === 12) {
    const tl = detectTianLong(sorted);
    if (tl) return tl;
  }

  // STRAIGHT / PURE_DRAGON (>= 5 consecutive, no 2)
  if (n >= 5 && isConsecutive(ranks) && !ranks.includes(15)) {
    const allSameSuit = new Set(suits).size === 1;
    const topRank = ranks[ranks.length - 1];
    if (allSameSuit) {
      return { type: HandTypeEnum.PURE_DRAGON, rank: topRank, suit: suits[0], length: n };
    }
    return { type: HandTypeEnum.STRAIGHT, rank: topRank, length: n };
  }

  // DOUBLE_STRAIGHT (>= 4 cards, even, all counts=2, consecutive, no 2)
  if (n >= 4 && n % 2 === 0) {
    const ds = detectDoubleStraight(rankCount);
    if (ds) return ds;
  }

  // TRIPLE_STRAIGHT (>= 6 cards, divisible by 3, all counts=3, consecutive, no 2)
  if (n >= 6 && n % 3 === 0) {
    const ts = detectTripleStraight(rankCount);
    if (ts) return ts;
  }

  return null;
}

function detectFTK(sorted: Card[]): HandType | null {
  const ranks = sorted.map((c) => c.rank);
  const suits = sorted.map((c) => c.suit);
  if (!(ranks.includes(5) && ranks.includes(10) && ranks.includes(13))) return null;

  const allSameSuit = new Set(suits).size === 1;
  if (allSameSuit) {
    return { type: HandTypeEnum.PURE_FTK, rank: 0, suit: suits[0] };
  }
  return { type: HandTypeEnum.FTK, rank: 0 };
}

function detectThreeWithTwo(rankCount: Map<number, number>): HandType | null {
  let tripleRank: number | null = null;
  let pairRank: number | null = null;

  for (const [rank, count] of rankCount) {
    if (count === 3) tripleRank = rank;
    else if (count === 2) pairRank = rank;
    else return null;
  }

  if (tripleRank !== null && pairRank !== null) {
    return { type: HandTypeEnum.THREE_WITH_TWO, rank: tripleRank };
  }
  return null;
}

function detectGaoGao(rankCount: Map<number, number>): HandType | null {
  const triples: number[] = [];
  const pairs: number[] = [];

  for (const [rank, count] of rankCount) {
    if (count === 3) triples.push(rank);
    else if (count === 2) pairs.push(rank);
    else return null;
  }

  if (triples.length !== 2 || pairs.length !== 2) return null;

  triples.sort((a, b) => a - b);
  if (triples[1] - triples[0] !== 1) return null;
  if (triples.includes(15) || pairs.includes(15)) return null;

  return { type: HandTypeEnum.GAO_GAO, rank: triples[1] };
}

function detectTianLong(sorted: Card[]): HandType | null {
  const ranks = sorted.map((c) => c.rank);
  const suits = sorted.map((c) => c.suit);

  if (ranks[0] !== 3 || ranks[11] !== 14) return null;
  if (!isConsecutive(ranks)) return null;

  const allSameSuit = new Set(suits).size === 1;
  if (allSameSuit) {
    return { type: HandTypeEnum.PURE_TIAN_LONG, rank: 14, suit: suits[0], length: 12 };
  }
  return { type: HandTypeEnum.TIAN_LONG, rank: 14, length: 12 };
}

function detectDoubleStraight(rankCount: Map<number, number>): HandType | null {
  for (const count of rankCount.values()) {
    if (count !== 2) return null;
  }

  const uniqueRanks = [...rankCount.keys()].sort((a, b) => a - b);
  if (uniqueRanks.includes(15)) return null;
  if (uniqueRanks.length < 2) return null;
  if (!isConsecutive(uniqueRanks)) return null;

  return {
    type: HandTypeEnum.DOUBLE_STRAIGHT,
    rank: uniqueRanks[uniqueRanks.length - 1],
    length: uniqueRanks.length,
  };
}

function detectTripleStraight(rankCount: Map<number, number>): HandType | null {
  for (const count of rankCount.values()) {
    if (count !== 3) return null;
  }

  const uniqueRanks = [...rankCount.keys()].sort((a, b) => a - b);
  if (uniqueRanks.includes(15)) return null;
  if (uniqueRanks.length < 2) return null;
  if (!isConsecutive(uniqueRanks)) return null;

  return {
    type: HandTypeEnum.TRIPLE_STRAIGHT,
    rank: uniqueRanks[uniqueRanks.length - 1],
    length: uniqueRanks.length,
  };
}

function isConsecutive(sorted: number[]): boolean {
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] !== sorted[i - 1] + 1) return false;
  }
  return true;
}
