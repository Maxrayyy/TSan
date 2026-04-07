import type { Card, HandType } from './card.js';

export type GamePhase = 'waiting' | 'dealing' | 'declaring' | 'playing' | 'settling' | 'finished';

export interface PlayerState {
  userId: string;
  nickname: string;
  avatar: string;
  seatIndex: number;
  hand: Card[];
  score: number;
  rank: number | null;
  tuoSanCount: number;
  bieSanCount: number;
  connected: boolean;
  isReady: boolean;
}

export interface RoundState {
  leadPlayerSeat: number;
  lastPlay: {
    playerSeat: number;
    cards: Card[];
    handType: HandType;
  } | null;
  passCount: number;
  roundScore: number;
}

export interface GameState {
  id: string;
  roomId: string;
  phase: GamePhase;
  players: Record<number, PlayerState>;
  currentPlayerSeat: number;
  turnStartTime: number;
  currentRound: RoundState;
  teamScores: [number, number];
  finishedOrder: number[];
  isFirstPlay: boolean;
}

export interface ClientPlayerState {
  userId: string;
  nickname: string;
  avatar: string;
  seatIndex: number;
  cardCount: number;
  score: number;
  rank: number | null;
  isTeammate: boolean;
}

export interface ClientGameState {
  phase: GamePhase;
  myHand: Card[];
  mySeat: number;
  players: Record<number, ClientPlayerState>;
  currentPlayerSeat: number;
  isMyTurn: boolean;
  lastPlay: {
    playerSeat: number;
    cards: Card[];
    handType: HandType;
  } | null;
  teamScores: [number, number];
  myTeamIndex: 0 | 1;
  turnTimer: number;
}

export interface GameResult {
  rankings: {
    seatIndex: number;
    userId: string;
    nickname: string;
    rank: number;
    capturedScore: number;
    tuoSanCount: number;
    bieSanCount: number;
    totalScore: number;
  }[];
  teamScores: [number, number];
  isShuangDaiHua: boolean;
}
