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

export const RANK_DISPLAY: Record<number, string> = {
  3: '3',
  4: '4',
  5: '5',
  6: '6',
  7: '7',
  8: '8',
  9: '9',
  10: '10',
  11: 'J',
  12: 'Q',
  13: 'K',
  14: 'A',
  15: '2',
};

export const SUIT_SYMBOL: Record<Suit, string> = {
  spade: '♠',
  heart: '♥',
  club: '♣',
  diamond: '♦',
};

export const SUIT_COLOR: Record<Suit, 'red' | 'black'> = {
  spade: 'black',
  heart: 'red',
  club: 'black',
  diamond: 'red',
};

export const HAND_TYPE_DISPLAY: Record<HandTypeEnum, string> = {
  [HandTypeEnum.SINGLE]: '单牌',
  [HandTypeEnum.PAIR]: '对子',
  [HandTypeEnum.TRIPLE]: '三张',
  [HandTypeEnum.BOMB]: '炸弹',
  [HandTypeEnum.STRAIGHT]: '顺子',
  [HandTypeEnum.DOUBLE_STRAIGHT]: '连对',
  [HandTypeEnum.TRIPLE_STRAIGHT]: '连三',
  [HandTypeEnum.THREE_WITH_TWO]: '三带二',
  [HandTypeEnum.GAO_GAO]: '高高',
  [HandTypeEnum.FTK]: '510K',
  [HandTypeEnum.PURE_FTK]: '纯510K',
  [HandTypeEnum.TIAN_LONG]: '通天龙',
  [HandTypeEnum.PURE_TIAN_LONG]: '纯色通天龙',
  [HandTypeEnum.PURE_DRAGON]: '纯龙',
};
