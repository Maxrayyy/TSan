export type Suit = 'spade' | 'heart' | 'club' | 'diamond';

// 3~14 = 3~A, 15 = 2
export type Rank = 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15;

export interface Card {
  suit: Suit;
  rank: Rank;
}

export enum HandTypeEnum {
  SINGLE = 'single',
  PAIR = 'pair',
  TRIPLE = 'triple',
  BOMB = 'bomb',
  STRAIGHT = 'straight',
  DOUBLE_STRAIGHT = 'double_straight',
  TRIPLE_STRAIGHT = 'triple_straight',
  THREE_WITH_TWO = 'three_with_two',
  GAO_GAO = 'gao_gao',
  FTK = 'ftk',
  PURE_FTK = 'pure_ftk',
  TIAN_LONG = 'tian_long',
  PURE_TIAN_LONG = 'pure_tian_long',
  PURE_DRAGON = 'pure_dragon',
}

export interface HandType {
  type: HandTypeEnum;
  rank: number;
  length?: number;
  suit?: Suit;
}
