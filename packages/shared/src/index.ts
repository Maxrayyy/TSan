// Types
export type { Card, Suit, Rank, HandType } from './types/card.js';
export { HandTypeEnum } from './types/card.js';
export type {
  GamePhase,
  PlayerState,
  RoundState,
  GameState,
  ClientPlayerState,
  ClientGameState,
  GameResult,
} from './types/game.js';
export type { RoomPlayer, RoomState } from './types/room.js';
export type { ClientToServerEvents, ServerToClientEvents } from './types/events.js';

// Constants
export {
  SUIT_ORDER,
  SCORE_CARDS,
  HEART_FIVE_SCORE,
  TOTAL_SCORE_PER_GAME,
  TUO_SAN_SCORE,
  BIE_SAN_SCORE,
  SHUANG_DAI_HUA_SCORE,
  TURN_TIMEOUT,
  RECONNECT_TIMEOUT,
  MAX_PLAYERS,
  TEAM_SEATS,
  getTeamIndex,
} from './constants/game.js';
