// packages/client/src/stores/useGameStore.ts
import { create } from 'zustand';
import type { Card, ClientGameState, HandType, GameResult } from '@tuosan/shared';

interface GameStore {
  gameState: ClientGameState | null;
  selectedCards: Card[];
  gameResult: GameResult | null;
  turnTimer: number;
  timerInterval: ReturnType<typeof setInterval> | null;
  lastEvent: string | null;

  // 操作
  setGameState: (state: ClientGameState) => void;
  updateAfterPlay: (
    seatIndex: number,
    cards: Card[],
    handType: HandType,
    remainingCards: number,
  ) => void;
  updateAfterPass: (seatIndex: number) => void;
  updateRoundEnd: (winnerSeat: number) => void;
  updatePlayerFinished: (seatIndex: number, rank: number) => void;
  setGameResult: (result: GameResult) => void;
  setMyTurn: (timeLimit: number) => void;

  toggleCardSelection: (card: Card) => void;
  clearSelection: () => void;
  setSelection: (cards: Card[]) => void;

  reset: () => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  gameState: null,
  selectedCards: [],
  gameResult: null,
  turnTimer: 0,
  timerInterval: null,
  lastEvent: null,

  setGameState: (gameState) => {
    set({ gameState, selectedCards: [], gameResult: null });
  },

  updateAfterPlay: (seatIndex, cards, handType, remainingCards) => {
    const { gameState } = get();
    if (!gameState) return;

    const newPlayers = { ...gameState.players };
    newPlayers[seatIndex] = { ...newPlayers[seatIndex], cardCount: remainingCards };

    let newHand = gameState.myHand;
    if (seatIndex === gameState.mySeat) {
      newHand = newHand.filter((h) => !cards.some((c) => c.suit === h.suit && c.rank === h.rank));
    }

    set({
      gameState: {
        ...gameState,
        myHand: newHand,
        players: newPlayers,
        lastPlay: { playerSeat: seatIndex, cards, handType },
        isMyTurn: false,
      },
      selectedCards: [],
      lastEvent: `player-${seatIndex}-played`,
    });
  },

  updateAfterPass: (seatIndex) => {
    const { gameState } = get();
    if (!gameState) return;
    set({
      gameState: { ...gameState, isMyTurn: false },
      lastEvent: `player-${seatIndex}-passed`,
    });
  },

  updateRoundEnd: (winnerSeat) => {
    const { gameState } = get();
    if (!gameState) return;
    set({
      gameState: { ...gameState, lastPlay: null },
      lastEvent: `round-end-${winnerSeat}`,
    });
  },

  updatePlayerFinished: (seatIndex, rank) => {
    const { gameState } = get();
    if (!gameState) return;
    const newPlayers = { ...gameState.players };
    newPlayers[seatIndex] = { ...newPlayers[seatIndex], rank };
    set({
      gameState: { ...gameState, players: newPlayers },
      lastEvent: `player-${seatIndex}-finished-${rank}`,
    });
  },

  setGameResult: (result) => {
    set({ gameResult: result });
  },

  setMyTurn: (timeLimit) => {
    const { timerInterval, gameState } = get();
    if (timerInterval) clearInterval(timerInterval);
    if (!gameState) return;

    const interval = setInterval(() => {
      const t = get().turnTimer;
      if (t <= 0) {
        clearInterval(interval);
        return;
      }
      set({ turnTimer: t - 1 });
    }, 1000);

    set({
      gameState: { ...gameState, isMyTurn: true, currentPlayerSeat: gameState.mySeat },
      turnTimer: timeLimit,
      timerInterval: interval,
    });
  },

  toggleCardSelection: (card) => {
    const { selectedCards } = get();
    const exists = selectedCards.some((c) => c.suit === card.suit && c.rank === card.rank);
    if (exists) {
      set({
        selectedCards: selectedCards.filter((c) => !(c.suit === card.suit && c.rank === card.rank)),
      });
    } else {
      set({ selectedCards: [...selectedCards, card] });
    }
  },

  clearSelection: () => set({ selectedCards: [] }),
  setSelection: (cards) => set({ selectedCards: cards }),

  reset: () => {
    const { timerInterval } = get();
    if (timerInterval) clearInterval(timerInterval);
    set({
      gameState: null,
      selectedCards: [],
      gameResult: null,
      turnTimer: 0,
      timerInterval: null,
      lastEvent: null,
    });
  },
}));
