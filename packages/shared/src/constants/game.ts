import type { Suit } from '../types/card.js';

// 花色权重（用于排序）：♠ > ♥ > ♣ > ♦
export const SUIT_ORDER: Record<Suit, number> = {
  spade: 4,
  heart: 3,
  club: 2,
  diamond: 1,
};

// 分数牌分值
export const SCORE_CARDS: Record<string, number> = {
  '5': 5, // 普通5 = 5分
  '10': 10, // 10 = 10分
  '13': 10, // K = 10分
};

// 红桃5特殊分值
export const HEART_FIVE_SCORE = 55;

// 每局总分
export const TOTAL_SCORE_PER_GAME = 150;

// 拖三/憋三分值
export const TUO_SAN_SCORE = 1;
export const BIE_SAN_SCORE = 1;

// 双带花加/扣分
export const SHUANG_DAI_HUA_SCORE = 2;

// 出牌超时时间（秒）
export const TURN_TIMEOUT = 30;

// 断线重连超时（秒）
export const RECONNECT_TIMEOUT = 60;

// 房间最大人数
export const MAX_PLAYERS = 4;

// 队伍分配：座位 0,2 为队伍A，座位 1,3 为队伍B
export const TEAM_SEATS: [number[], number[]] = [
  [0, 2],
  [1, 3],
];

export function getTeamIndex(seatIndex: number): 0 | 1 {
  return TEAM_SEATS[0].includes(seatIndex) ? 0 : 1;
}
