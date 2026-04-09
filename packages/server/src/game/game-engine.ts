// packages/server/src/game/game-engine.ts
import type {
  Card,
  GameState,
  PlayerState,
  ClientGameState,
  ClientPlayerState,
  GameResult,
} from '@tuosan/shared';
import { getTeamIndex } from '@tuosan/shared';
import { createDeck, shuffle, deal } from './deck.js';
import { validatePlay, type ValidationResult } from './play-validator.js';
import { checkTuoSan } from './tuo-san-rule.js';
import { calculateRoundScore, settleGame } from './scorer.js';

export interface PlayerInfo {
  userId: string;
  nickname: string;
  avatar: string;
  seatIndex: number;
}

export class GameEngine {
  private state: GameState;

  constructor(roomId: string, players: PlayerInfo[]) {
    const playerStates: Record<number, PlayerState> = {};
    for (const p of players) {
      playerStates[p.seatIndex] = {
        userId: p.userId,
        nickname: p.nickname,
        avatar: p.avatar,
        seatIndex: p.seatIndex,
        hand: [],
        score: 0,
        rank: null,
        tuoSanCount: 0,
        bieSanCount: 0,
        connected: true,
        isReady: true,
      };
    }

    this.state = {
      id: `game_${Date.now()}`,
      roomId,
      phase: 'waiting',
      players: playerStates,
      currentPlayerSeat: 0,
      turnStartTime: Date.now(),
      currentRound: { leadPlayerSeat: 0, lastPlay: null, passCount: 0, roundScore: 0 },
      teamScores: [0, 0],
      finishedOrder: [],
      isFirstPlay: true,
    };
  }

  getState(): GameState {
    return this.state;
  }

  deal(): void {
    const deck = createDeck();
    const shuffled = shuffle(deck);
    const hands = deal(shuffled);

    for (let i = 0; i < 4; i++) {
      this.state.players[i].hand = hands[i];
    }

    this.state.phase = 'playing';
    this.state.isFirstPlay = true;
    this.state.currentPlayerSeat = 0;
    this.state.turnStartTime = Date.now();
    this.state.currentRound = {
      leadPlayerSeat: 0,
      lastPlay: null,
      passCount: 0,
      roundScore: 0,
    };
  }

  play(seatIndex: number, cards: Card[]): ValidationResult {
    const result = validatePlay(this.state, seatIndex, cards);
    if (!result.valid) return result;

    const handType = result.handType!;
    const player = this.state.players[seatIndex];

    // Remove cards from hand
    for (const card of cards) {
      const idx = player.hand.findIndex((h) => h.suit === card.suit && h.rank === card.rank);
      if (idx !== -1) player.hand.splice(idx, 1);
    }

    // Track round score
    this.state.currentRound.roundScore += calculateRoundScore(cards);

    // Update last play
    this.state.currentRound.lastPlay = { playerSeat: seatIndex, cards, handType };
    this.state.currentRound.passCount = 0;

    // Check if player finished
    if (player.hand.length === 0) {
      this.state.finishedOrder.push(seatIndex);
      const rank = this.state.finishedOrder.length;
      player.rank = rank;

      // Check shuang dai hua: first two finished are on the same team
      if (rank === 2) {
        const first = this.state.finishedOrder[0];
        if (getTeamIndex(first) === getTeamIndex(seatIndex)) {
          this.state.phase = 'finished';
          this.finishRemaining();
          return result;
        }
      }

      // Check if only 1 player left
      if (this.state.finishedOrder.length === 3) {
        const remaining = this.findRemainingSeat();
        this.state.finishedOrder.push(remaining);
        this.state.players[remaining].rank = 4;
        this.state.phase = 'finished';
        return result;
      }
    }

    // Advance to next player
    this.state.currentPlayerSeat = this.getNextActiveSeat(seatIndex);
    this.state.isFirstPlay = false;
    this.state.turnStartTime = Date.now();

    return result;
  }

  pass(seatIndex: number): { valid: boolean; reason?: string } {
    if (this.state.currentPlayerSeat !== seatIndex) {
      return { valid: false, reason: '不是你的回合' };
    }

    if (this.state.currentRound.lastPlay === null) {
      return { valid: false, reason: '你是首出，不能pass' };
    }

    this.state.currentRound.passCount++;

    // Determine how many passes are needed to end the round.
    // Everyone except the player who made the last play needs to pass.
    const lastPlaySeat = this.state.currentRound.lastPlay.playerSeat;
    const activePlayers = this.getActivePlayerCount();
    const lastPlayStillActive = this.state.players[lastPlaySeat].hand.length > 0;
    const passNeeded = lastPlayStillActive ? activePlayers - 1 : activePlayers;

    if (this.state.currentRound.passCount >= passNeeded) {
      this.endRound();
    } else {
      this.state.currentPlayerSeat = this.getNextActiveSeat(seatIndex);
      this.state.turnStartTime = Date.now();
    }

    return { valid: true };
  }

  getPlayerView(seatIndex: number): ClientGameState {
    const state = this.state;
    const myTeam = getTeamIndex(seatIndex);

    const players: Record<number, ClientPlayerState> = {};
    for (const [seat, p] of Object.entries(state.players)) {
      players[Number(seat)] = {
        userId: p.userId,
        nickname: p.nickname,
        avatar: p.avatar,
        seatIndex: p.seatIndex,
        cardCount: p.hand.length,
        score: p.score,
        rank: p.rank,
        isTeammate: getTeamIndex(p.seatIndex) === myTeam && p.seatIndex !== seatIndex,
        connected: p.connected,
      };
    }

    return {
      phase: state.phase,
      myHand: state.players[seatIndex].hand,
      mySeat: seatIndex,
      players,
      currentPlayerSeat: state.currentPlayerSeat,
      isMyTurn: state.currentPlayerSeat === seatIndex,
      lastPlay: state.currentRound.lastPlay,
      teamScores: state.teamScores,
      myTeamIndex: myTeam,
      turnTimer: 0,
    };
  }

  setPlayerConnected(seatIndex: number, connected: boolean): void {
    this.state.players[seatIndex].connected = connected;
  }

  isPlayerConnected(seatIndex: number): boolean {
    return this.state.players[seatIndex].connected;
  }

  settle(): GameResult {
    return settleGame(this.state);
  }

  private endRound(): void {
    const winner = this.state.currentRound.lastPlay!.playerSeat;

    // Award round score to winner
    this.state.players[winner].score += this.state.currentRound.roundScore;

    // Check tuo san
    const tuoSan = checkTuoSan(this.state.currentRound);
    if (tuoSan) {
      this.state.players[tuoSan.playerSeat].tuoSanCount += tuoSan.count;
    }

    // Reset round
    this.state.currentRound = {
      leadPlayerSeat: winner,
      lastPlay: null,
      passCount: 0,
      roundScore: 0,
    };

    // Winner leads next round (or next active player if winner finished)
    if (this.state.players[winner].hand.length === 0) {
      this.state.currentPlayerSeat = this.getNextActiveSeat(winner);
    } else {
      this.state.currentPlayerSeat = winner;
    }
    this.state.turnStartTime = Date.now();
  }

  private getNextActiveSeat(current: number): number {
    let next = (current + 1) % 4;
    while (this.state.players[next].hand.length === 0 && this.state.finishedOrder.includes(next)) {
      next = (next + 1) % 4;
      if (next === current) break;
    }
    return next;
  }

  private getActivePlayerCount(): number {
    return Object.values(this.state.players).filter((p) => p.hand.length > 0).length;
  }

  private findRemainingSeat(): number {
    for (let i = 0; i < 4; i++) {
      if (!this.state.finishedOrder.includes(i)) return i;
    }
    return 0;
  }

  private finishRemaining(): void {
    for (let i = 0; i < 4; i++) {
      if (!this.state.finishedOrder.includes(i)) {
        this.state.finishedOrder.push(i);
        this.state.players[i].rank = this.state.finishedOrder.length;
      }
    }
  }
}
