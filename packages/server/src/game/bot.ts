import type { Card, HandType } from '@tuosan/shared';

interface BotPlayResult {
  action: 'play' | 'pass';
  cards?: Card[];
}

/** 机器人出牌决策（随机策略，仅出单牌） */
export function chooseBotPlay(
  hand: Card[],
  lastPlay: { cards: Card[]; handType: HandType } | null,
): BotPlayResult {
  if (!lastPlay) {
    // 首出：随机选一张非3单牌
    const nonThrees = hand.filter((c) => c.rank !== 3);
    if (nonThrees.length > 0) {
      const card = nonThrees[Math.floor(Math.random() * nonThrees.length)];
      return { action: 'play', cards: [card] };
    }
    // 只有3，出第一张
    return { action: 'play', cards: [hand[0]] };
  }

  // 跟牌：只处理单牌
  if (lastPlay.handType.type !== 'single') {
    return { action: 'pass' };
  }

  const lastRank = lastPlay.cards[0].rank;

  // 找能压过的非3牌（rank > lastRank）
  const beatable = hand.filter((c) => c.rank !== 3 && c.rank > lastRank);
  if (beatable.length > 0) {
    const card = beatable[Math.floor(Math.random() * beatable.length)];
    return { action: 'play', cards: [card] };
  }

  // 没有非3能压，用3压（3可以压任何牌）
  const threes = hand.filter((c) => c.rank === 3);
  if (threes.length > 0) {
    return { action: 'play', cards: [threes[0]] };
  }

  return { action: 'pass' };
}
