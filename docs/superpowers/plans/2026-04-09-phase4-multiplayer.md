# Phase 4: Multiplayer Online Game Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect the game engine to Socket.IO so 4 players can play a complete TuoSan game through their browsers, with full UI, settlement screen, and play hints.

**Architecture:** Server-side `gameHandler.ts` bridges Socket.IO events to the existing `GameEngine` class. An in-memory `gameService.ts` manages active game instances. Client gets a `useGameStore` (Zustand) driven by `gameSocket.ts` listeners. UI components render the card table with TailwindCSS. On game end, results persist to PostgreSQL via Prisma.

**Tech Stack:** TypeScript, Socket.IO, Zustand, React 18, TailwindCSS v4, Vitest, Prisma

---

## File Structure

### Server — New Files

| File                                                       | Responsibility                                                 |
| ---------------------------------------------------------- | -------------------------------------------------------------- |
| `packages/server/src/services/gameService.ts`              | In-memory game engine store, game creation, persistence to DB  |
| `packages/server/src/socket/gameHandler.ts`                | Socket event handlers for `game:play`, `game:pass`, turn timer |
| `packages/server/src/socket/__tests__/gameHandler.test.ts` | Integration test for game socket flow                          |

### Server — Modified Files

| File                                        | Change                                                               |
| ------------------------------------------- | -------------------------------------------------------------------- |
| `packages/server/src/socket/index.ts`       | Register `gameHandler` alongside `roomHandler`                       |
| `packages/server/src/socket/roomHandler.ts` | Replace `room:start` TODO with real game creation + deal + broadcast |

### Client — New Files

| File                                            | Responsibility                                       |
| ----------------------------------------------- | ---------------------------------------------------- |
| `packages/client/src/stores/useGameStore.ts`    | Game state (Zustand), tracks hand, table, scores     |
| `packages/client/src/services/gameSocket.ts`    | Binds server→client game events to the Zustand store |
| `packages/client/src/components/Card.tsx`       | Single card rendering (rank + suit, selected state)  |
| `packages/client/src/components/CardHand.tsx`   | Fan of cards at bottom, click to select/deselect     |
| `packages/client/src/components/PlayerSeat.tsx` | Player avatar, name, card count, turn indicator      |
| `packages/client/src/components/CardPile.tsx`   | Center area showing last played cards                |
| `packages/client/src/components/ScoreBoard.tsx` | Team scores display                                  |
| `packages/client/src/components/ActionBar.tsx`  | Play / Pass / Hint buttons                           |
| `packages/client/src/components/Timer.tsx`      | Countdown timer ring                                 |
| `packages/client/src/game/hints.ts`             | Client-side play hint generation                     |

### Client — Modified Files

| File                                         | Change                                         |
| -------------------------------------------- | ---------------------------------------------- |
| `packages/client/src/pages/Game.tsx`         | Full game UI using above components            |
| `packages/client/src/pages/Result.tsx`       | Settlement page with rankings and scores       |
| `packages/client/src/stores/useRoomStore.ts` | Listen for `game:start`, navigate to game page |

### Shared — Modified Files

| File                                | Change                                                     |
| ----------------------------------- | ---------------------------------------------------------- |
| `packages/shared/src/types/card.ts` | Add `RANK_DISPLAY` and `SUIT_SYMBOL` maps for UI rendering |
| `packages/shared/src/index.ts`      | Re-export new constants                                    |

---

## Task 1: Shared Card Display Constants

**Files:**

- Modify: `packages/shared/src/types/card.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Add display constants to card.ts**

Add at the end of `packages/shared/src/types/card.ts`:

```ts
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
```

- [ ] **Step 2: Re-export from shared/index.ts**

Add to `packages/shared/src/index.ts`:

```ts
export { RANK_DISPLAY, SUIT_SYMBOL, SUIT_COLOR, HAND_TYPE_DISPLAY } from './types/card.js';
```

- [ ] **Step 3: Build shared package and verify**

Run: `cd packages/shared && pnpm build`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/types/card.ts packages/shared/src/index.ts
git commit -m "feat(P3-0): add card display constants to shared package"
```

---

## Task 2: Game Service (P3-1 backend)

**Files:**

- Create: `packages/server/src/services/gameService.ts`
- Create: `packages/server/src/services/__tests__/gameService.test.ts`

- [ ] **Step 1: Write failing test for gameService**

```ts
// packages/server/src/services/__tests__/gameService.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createGame, getEngine, removeEngine, getAllEngines } from '../gameService.js';
import type { PlayerInfo } from '../../game/game-engine.js';

const players: PlayerInfo[] = [
  { userId: 'u0', nickname: 'P0', avatar: '', seatIndex: 0 },
  { userId: 'u1', nickname: 'P1', avatar: '', seatIndex: 1 },
  { userId: 'u2', nickname: 'P2', avatar: '', seatIndex: 2 },
  { userId: 'u3', nickname: 'P3', avatar: '', seatIndex: 3 },
];

describe('gameService', () => {
  beforeEach(() => {
    // Clear all engines
    for (const [roomId] of getAllEngines()) {
      removeEngine(roomId);
    }
  });

  it('creates and retrieves a game engine', () => {
    const engine = createGame('room1', players);
    expect(engine).toBeDefined();
    expect(getEngine('room1')).toBe(engine);
  });

  it('returns undefined for non-existent game', () => {
    expect(getEngine('nonexistent')).toBeUndefined();
  });

  it('removes a game engine', () => {
    createGame('room1', players);
    removeEngine('room1');
    expect(getEngine('room1')).toBeUndefined();
  });

  it('deals cards on creation', () => {
    const engine = createGame('room1', players);
    const state = engine.getState();
    expect(state.phase).toBe('playing');
    for (let i = 0; i < 4; i++) {
      expect(state.players[i].hand).toHaveLength(13);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/server && npx vitest run src/services/__tests__/gameService.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement gameService.ts**

```ts
// packages/server/src/services/gameService.ts
import { GameEngine, type PlayerInfo } from '../game/game-engine.js';
import { prisma } from '../config/database.js';
import { getTeamIndex } from '@tuosan/shared';
import { logger } from '../utils/logger.js';

const engines = new Map<string, GameEngine>();

export function createGame(roomId: string, players: PlayerInfo[]): GameEngine {
  const engine = new GameEngine(roomId, players);
  engine.deal();
  engines.set(roomId, engine);
  logger.info({ roomId, players: players.map((p) => p.userId) }, 'Game created');
  return engine;
}

export function getEngine(roomId: string): GameEngine | undefined {
  return engines.get(roomId);
}

export function removeEngine(roomId: string): void {
  engines.delete(roomId);
}

export function getAllEngines(): Map<string, GameEngine> {
  return engines;
}

export async function persistGameResult(engine: GameEngine): Promise<void> {
  const state = engine.getState();
  const result = engine.settle();

  try {
    await prisma.$transaction(async (tx) => {
      // Create game record
      const gameRecord = await tx.gameRecord.create({
        data: {
          roomId: state.roomId,
          startedAt: new Date(Number(state.id.split('_')[1])),
          endedAt: new Date(),
          totalRounds: 0, // We don't track round count yet
          teamAScore: result.teamScores[0],
          teamBScore: result.teamScores[1],
          isShuangDaiHua: result.isShuangDaiHua,
        },
      });

      // Create player records
      for (const ranking of result.rankings) {
        await tx.gamePlayer.create({
          data: {
            gameRecordId: gameRecord.id,
            userId: ranking.userId,
            seatIndex: ranking.seatIndex,
            teamIndex: getTeamIndex(ranking.seatIndex),
            rank: ranking.rank,
            capturedScore: ranking.capturedScore,
            tuoSanCount: ranking.tuoSanCount,
            bieSanCount: ranking.bieSanCount,
            tuoSanScore: ranking.tuoSanCount,
            bieSanScore: ranking.bieSanCount,
            rankScore: 0,
            totalScore: ranking.totalScore,
          },
        });

        // Update user stats
        await tx.userStats.upsert({
          where: { userId: ranking.userId },
          create: {
            userId: ranking.userId,
            totalGames: 1,
            totalWins:
              result.teamScores[getTeamIndex(ranking.seatIndex)] >
              result.teamScores[1 - getTeamIndex(ranking.seatIndex)]
                ? 1
                : 0,
            totalFirstPlace: ranking.rank === 1 ? 1 : 0,
            totalTuoSan: ranking.tuoSanCount,
            totalBieSan: ranking.bieSanCount,
            totalScore: ranking.totalScore,
            totalShuangDaiHua:
              result.isShuangDaiHua &&
              getTeamIndex(ranking.seatIndex) === getTeamIndex(state.finishedOrder[0])
                ? 1
                : 0,
          },
          update: {
            totalGames: { increment: 1 },
            totalWins: {
              increment:
                result.teamScores[getTeamIndex(ranking.seatIndex)] >
                result.teamScores[1 - getTeamIndex(ranking.seatIndex)]
                  ? 1
                  : 0,
            },
            totalFirstPlace: { increment: ranking.rank === 1 ? 1 : 0 },
            totalTuoSan: { increment: ranking.tuoSanCount },
            totalBieSan: { increment: ranking.bieSanCount },
            totalScore: { increment: ranking.totalScore },
            totalShuangDaiHua: {
              increment:
                result.isShuangDaiHua &&
                getTeamIndex(ranking.seatIndex) === getTeamIndex(state.finishedOrder[0])
                  ? 1
                  : 0,
            },
          },
        });
      }

      logger.info({ gameRecordId: gameRecord.id, roomId: state.roomId }, 'Game result persisted');
    });
  } catch (err) {
    logger.error({ err, roomId: state.roomId }, 'Failed to persist game result');
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/server && npx vitest run src/services/__tests__/gameService.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/services/gameService.ts packages/server/src/services/__tests__/gameService.test.ts
git commit -m "feat(P3-1a): implement game service with engine management and persistence"
```

---

## Task 3: Game Socket Handler (P3-1 backend)

**Files:**

- Create: `packages/server/src/socket/gameHandler.ts`
- Modify: `packages/server/src/socket/index.ts`
- Modify: `packages/server/src/socket/roomHandler.ts`

- [ ] **Step 1: Create gameHandler.ts**

```ts
// packages/server/src/socket/gameHandler.ts
import type { TypedIO, TypedSocket } from './index.js';
import type { Card } from '@tuosan/shared';
import { TURN_TIMEOUT } from '@tuosan/shared';
import { getEngine, removeEngine, persistGameResult } from '../services/gameService.js';
import { setRoomStatus } from '../services/roomService.js';
import { logger } from '../utils/logger.js';

const turnTimers = new Map<string, ReturnType<typeof setTimeout>>();

function clearTurnTimer(roomId: string) {
  const timer = turnTimers.get(roomId);
  if (timer) {
    clearTimeout(timer);
    turnTimers.delete(roomId);
  }
}

function startTurnTimer(roomId: string, io: TypedIO) {
  clearTurnTimer(roomId);

  const timer = setTimeout(async () => {
    const engine = getEngine(roomId);
    if (!engine) return;

    const state = engine.getState();
    if (state.phase !== 'playing') return;

    const seat = state.currentPlayerSeat;

    // Auto-pass if following, or auto-play smallest non-3 card if leading
    if (state.currentRound.lastPlay !== null) {
      const passResult = engine.pass(seat);
      if (passResult.valid) {
        io.to(roomId).emit('game:passed', {
          playerId: state.players[seat].userId,
          seatIndex: seat,
        });
        handlePostAction(roomId, engine, io);
      }
    } else {
      // Leading — play smallest non-3 card
      const hand = state.players[seat].hand;
      const card = hand.find((c) => c.rank !== 3);
      if (card) {
        const playResult = engine.play(seat, [card]);
        if (playResult.valid) {
          io.to(roomId).emit('game:played', {
            playerId: state.players[seat].userId,
            seatIndex: seat,
            cards: [card],
            handType: playResult.handType!,
            remainingCards: engine.getState().players[seat].hand.length,
          });
          handlePostAction(roomId, engine, io);
        }
      }
    }
  }, TURN_TIMEOUT * 1000);

  turnTimers.set(roomId, timer);
}

async function handlePostAction(
  roomId: string,
  engine: ReturnType<typeof getEngine> & {},
  io: TypedIO,
) {
  const state = engine.getState();

  // Check round end (lastPlay is null means a new round started)
  if (state.currentRound.lastPlay === null && state.phase === 'playing') {
    // Round just ended via engine.pass() or engine.play() internal logic
    const leadSeat = state.currentRound.leadPlayerSeat;
    io.to(roomId).emit('game:round-end', {
      winnerId: state.players[leadSeat].userId,
      winnerSeat: leadSeat,
      score: 0, // round score was already added to player
    });
  }

  // Check player finished
  for (const seat of state.finishedOrder) {
    const player = state.players[seat];
    if (player.rank !== null) {
      // Broadcast player finished (will be sent each time, client should deduplicate)
    }
  }

  // Check game end
  if (state.phase === 'finished') {
    clearTurnTimer(roomId);
    const result = engine.settle();
    io.to(roomId).emit('game:end', { result });

    // Persist and cleanup
    await persistGameResult(engine);
    await setRoomStatus(roomId, 'waiting');
    removeEngine(roomId);
    return;
  }

  // Send your-turn to current player
  const nextSeat = state.currentPlayerSeat;
  const sockets = await io.in(roomId).fetchSockets();
  for (const s of sockets) {
    if (s.data.seatIndex === nextSeat) {
      s.emit('game:your-turn', { timeLimit: TURN_TIMEOUT });
      break;
    }
  }

  startTurnTimer(roomId, io);
}

export function registerGameHandlers(io: TypedIO, socket: TypedSocket) {
  const userId = socket.data.userId as string;

  socket.on('game:play', async (data: { cards: Card[] }) => {
    const roomId = socket.data.roomId as string;
    const seatIndex = socket.data.seatIndex as number;
    if (!roomId || seatIndex === undefined) return;

    const engine = getEngine(roomId);
    if (!engine) {
      socket.emit('error', { code: 'NO_GAME', message: '游戏不存在' });
      return;
    }

    const result = engine.play(seatIndex, data.cards);
    if (!result.valid) {
      socket.emit('error', { code: 'INVALID_PLAY', message: result.reason || '出牌无效' });
      return;
    }

    clearTurnTimer(roomId);

    const state = engine.getState();

    // Broadcast played
    io.to(roomId).emit('game:played', {
      playerId: userId,
      seatIndex,
      cards: data.cards,
      handType: result.handType!,
      remainingCards: state.players[seatIndex].hand.length,
    });

    // Check if player finished
    if (state.players[seatIndex].rank !== null) {
      io.to(roomId).emit('game:player-finished', {
        playerId: userId,
        seatIndex,
        rank: state.players[seatIndex].rank!,
      });
    }

    await handlePostAction(roomId, engine, io);

    logger.debug({ userId, roomId, seatIndex, cards: data.cards.length }, 'Player played');
  });

  socket.on('game:pass', async () => {
    const roomId = socket.data.roomId as string;
    const seatIndex = socket.data.seatIndex as number;
    if (!roomId || seatIndex === undefined) return;

    const engine = getEngine(roomId);
    if (!engine) {
      socket.emit('error', { code: 'NO_GAME', message: '游戏不存在' });
      return;
    }

    const prevRound = { ...engine.getState().currentRound };
    const result = engine.pass(seatIndex);
    if (!result.valid) {
      socket.emit('error', { code: 'INVALID_PASS', message: result.reason || '不能pass' });
      return;
    }

    clearTurnTimer(roomId);

    // Broadcast passed
    io.to(roomId).emit('game:passed', {
      playerId: userId,
      seatIndex,
    });

    // Check if round ended (lastPlay became null = new round)
    const newState = engine.getState();
    if (newState.currentRound.lastPlay === null && prevRound.lastPlay !== null) {
      const winnerSeat = prevRound.lastPlay.playerSeat;
      io.to(roomId).emit('game:round-end', {
        winnerId: newState.players[winnerSeat].userId,
        winnerSeat,
        score: prevRound.roundScore,
      });

      // Check tuo san
      const lastCards = prevRound.lastPlay.cards;
      const allThrees = lastCards.every((c) => c.rank === 3);
      if (allThrees) {
        io.to(roomId).emit('game:tuo-san', {
          playerId: newState.players[winnerSeat].userId,
          seatIndex: winnerSeat,
          count: lastCards.length,
        });
      }
    }

    await handlePostAction(roomId, engine, io);

    logger.debug({ userId, roomId, seatIndex }, 'Player passed');
  });
}
```

- [ ] **Step 2: Register game handlers in socket/index.ts**

In `packages/server/src/socket/index.ts`, add import and registration:

Add import:

```ts
import { registerGameHandlers } from './gameHandler.js';
```

Inside the `io.on('connection', ...)` callback, after `registerRoomHandlers(io, socket);`, add:

```ts
registerGameHandlers(io, socket);
```

- [ ] **Step 3: Wire room:start to game creation in roomHandler.ts**

Replace the `room:start` handler in `packages/server/src/socket/roomHandler.ts` (lines 99-116). Replace the `// TODO` block with actual game creation:

```ts
socket.on('room:start', async () => {
  const roomId = socket.data.roomId as string;
  if (!roomId) return;

  try {
    await roomService.canStartGame(roomId, userId);
    await roomService.setRoomStatus(roomId, 'playing');

    // Get room to build player list
    const room = await roomService.getRoom(roomId);
    if (!room) return;

    const playerInfos: PlayerInfo[] = [];
    for (let i = 0; i < 4; i++) {
      const p = room.players[i];
      if (p) {
        playerInfos.push({
          userId: p.userId,
          nickname: p.nickname,
          avatar: p.avatar,
          seatIndex: i,
        });
      }
    }

    // Create game engine, deal cards
    const engine = createGame(roomId, playerInfos);

    // Send game:start to each player with their own view
    const sockets = await io.in(roomId).fetchSockets();
    for (const s of sockets) {
      const seat = s.data.seatIndex as number;
      if (seat !== undefined) {
        const view = engine.getPlayerView(seat);
        s.emit('game:start', { gameState: view });
      }
    }

    // Send your-turn to current player
    const state = engine.getState();
    for (const s of sockets) {
      if (s.data.seatIndex === state.currentPlayerSeat) {
        s.emit('game:your-turn', { timeLimit: TURN_TIMEOUT });
        break;
      }
    }

    logger.info({ userId, roomId }, 'Game started');
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string };
    socket.emit('error', {
      code: e.code || 'INTERNAL_ERROR',
      message: e.message || '无法开始游戏',
    });
  }
});
```

Add the imports at the top of `roomHandler.ts`:

```ts
import { createGame } from '../services/gameService.js';
import type { PlayerInfo } from '../game/game-engine.js';
import { TURN_TIMEOUT } from '@tuosan/shared';
```

- [ ] **Step 4: Verify server compiles**

Run: `cd packages/server && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 5: Run existing tests to ensure no regression**

Run: `cd packages/server && npx vitest run`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/socket/gameHandler.ts packages/server/src/socket/index.ts packages/server/src/socket/roomHandler.ts
git commit -m "feat(P3-1b): implement game socket handler with play, pass, and turn timer"
```

---

## Task 4: Client Game Store + Socket Listener (P3-4 partial)

**Files:**

- Create: `packages/client/src/stores/useGameStore.ts`
- Create: `packages/client/src/services/gameSocket.ts`
- Modify: `packages/client/src/stores/useRoomStore.ts`

- [ ] **Step 1: Create useGameStore.ts**

```ts
// packages/client/src/stores/useGameStore.ts
import { create } from 'zustand';
import type {
  Card,
  ClientGameState,
  ClientPlayerState,
  HandType,
  GameResult,
} from '@tuosan/shared';

interface GameStore {
  gameState: ClientGameState | null;
  selectedCards: Card[];
  gameResult: GameResult | null;
  turnTimer: number;
  timerInterval: ReturnType<typeof setInterval> | null;
  lastEvent: string | null;

  // Actions
  setGameState: (state: ClientGameState) => void;
  updateAfterPlay: (
    seatIndex: number,
    cards: Card[],
    handType: HandType,
    remainingCards: number,
  ) => void;
  updateAfterPass: (seatIndex: number) => void;
  updateRoundEnd: (winnerSeat: number, score: number) => void;
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

  updateRoundEnd: (winnerSeat, score) => {
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
```

- [ ] **Step 2: Create gameSocket.ts**

```ts
// packages/client/src/services/gameSocket.ts
import type { TypedSocket } from './socket.js';
import { useGameStore } from '../stores/useGameStore.js';

export function bindGameSocketListeners(socket: TypedSocket) {
  const store = useGameStore.getState;

  socket.on('game:start', (data) => {
    useGameStore.getState().setGameState(data.gameState);
  });

  socket.on('game:your-turn', (data) => {
    useGameStore.getState().setMyTurn(data.timeLimit);
  });

  socket.on('game:played', (data) => {
    useGameStore
      .getState()
      .updateAfterPlay(data.seatIndex, data.cards, data.handType, data.remainingCards);
  });

  socket.on('game:passed', (data) => {
    useGameStore.getState().updateAfterPass(data.seatIndex);
  });

  socket.on('game:round-end', (data) => {
    useGameStore.getState().updateRoundEnd(data.winnerSeat, data.score);
  });

  socket.on('game:player-finished', (data) => {
    useGameStore.getState().updatePlayerFinished(data.seatIndex, data.rank);
  });

  socket.on('game:end', (data) => {
    useGameStore.getState().setGameResult(data.result);
  });
}

export function unbindGameSocketListeners(socket: TypedSocket) {
  socket.off('game:start');
  socket.off('game:your-turn');
  socket.off('game:played');
  socket.off('game:passed');
  socket.off('game:round-end');
  socket.off('game:player-finished');
  socket.off('game:end');
}
```

- [ ] **Step 3: Modify useRoomStore.ts to bind game listeners and handle game:start navigation**

In `packages/client/src/stores/useRoomStore.ts`, add game socket binding inside the `joinRoom` method. After the existing socket listener registrations, add:

Add import at top:

```ts
import { bindGameSocketListeners, unbindGameSocketListeners } from '../services/gameSocket.js';
```

Inside `joinRoom`, after the line `socket.on('error', ...)`, add:

```ts
// Bind game socket listeners
bindGameSocketListeners(socket);
```

In the `leaveRoom` method, before `socket.removeAllListeners()`, add:

```ts
unbindGameSocketListeners(socket);
```

In the `reset` method, before `if (socket) socket.removeAllListeners()`, add:

```ts
if (socket) unbindGameSocketListeners(socket);
```

- [ ] **Step 4: Verify client compiles**

Run: `cd packages/client && npx tsc --noEmit`
Expected: no errors (or only unused-variable warnings)

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/stores/useGameStore.ts packages/client/src/services/gameSocket.ts packages/client/src/stores/useRoomStore.ts
git commit -m "feat(P3-4a): implement client game store and socket listener bindings"
```

---

## Task 5: Card & CardHand Components (P3-3)

**Files:**

- Create: `packages/client/src/components/Card.tsx`
- Create: `packages/client/src/components/CardHand.tsx`

- [ ] **Step 1: Create Card.tsx**

```tsx
// packages/client/src/components/Card.tsx
import type { Card as CardType } from '@tuosan/shared';
import { RANK_DISPLAY, SUIT_SYMBOL, SUIT_COLOR } from '@tuosan/shared';

interface CardProps {
  card: CardType;
  selected?: boolean;
  onClick?: () => void;
  size?: 'sm' | 'md' | 'lg';
  faceDown?: boolean;
}

export default function Card({ card, selected, onClick, size = 'md', faceDown }: CardProps) {
  const sizeClasses = {
    sm: 'w-8 h-12 text-xs',
    md: 'w-12 h-18 text-sm',
    lg: 'w-16 h-24 text-base',
  };

  if (faceDown) {
    return (
      <div
        className={`${sizeClasses[size]} flex items-center justify-center rounded-lg border border-gray-600 bg-blue-800`}
      >
        <span className="text-blue-400">🂠</span>
      </div>
    );
  }

  const color = SUIT_COLOR[card.suit];
  const textColor = color === 'red' ? 'text-red-600' : 'text-gray-900';

  return (
    <div
      onClick={onClick}
      className={`${sizeClasses[size]} relative flex cursor-pointer flex-col items-center justify-between rounded-lg border bg-white p-0.5 shadow-sm transition-transform ${
        selected
          ? '-translate-y-3 border-yellow-400 ring-2 ring-yellow-400'
          : 'border-gray-300 hover:-translate-y-1'
      }`}
    >
      <div className={`self-start text-left font-bold leading-none ${textColor}`}>
        <div>{RANK_DISPLAY[card.rank]}</div>
        <div>{SUIT_SYMBOL[card.suit]}</div>
      </div>
      <div className={`text-xl leading-none ${textColor}`}>{SUIT_SYMBOL[card.suit]}</div>
    </div>
  );
}
```

- [ ] **Step 2: Create CardHand.tsx**

```tsx
// packages/client/src/components/CardHand.tsx
import type { Card as CardType } from '@tuosan/shared';
import Card from './Card.js';

interface CardHandProps {
  cards: CardType[];
  selectedCards: CardType[];
  onToggleCard: (card: CardType) => void;
  disabled?: boolean;
}

export default function CardHand({ cards, selectedCards, onToggleCard, disabled }: CardHandProps) {
  const isSelected = (card: CardType) =>
    selectedCards.some((c) => c.suit === card.suit && c.rank === card.rank);

  return (
    <div className="flex justify-center gap-0.5">
      {cards.map((card, i) => (
        <div
          key={`${card.suit}-${card.rank}`}
          style={{ marginLeft: i === 0 ? 0 : '-12px', zIndex: i }}
        >
          <Card
            card={card}
            selected={isSelected(card)}
            onClick={disabled ? undefined : () => onToggleCard(card)}
            size="md"
          />
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Verify client compiles**

Run: `cd packages/client && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/components/Card.tsx packages/client/src/components/CardHand.tsx
git commit -m "feat(P3-3a): implement Card and CardHand components"
```

---

## Task 6: Game Table Components (P3-3 continued)

**Files:**

- Create: `packages/client/src/components/PlayerSeat.tsx`
- Create: `packages/client/src/components/CardPile.tsx`
- Create: `packages/client/src/components/ScoreBoard.tsx`
- Create: `packages/client/src/components/Timer.tsx`
- Create: `packages/client/src/components/ActionBar.tsx`

- [ ] **Step 1: Create PlayerSeat.tsx**

```tsx
// packages/client/src/components/PlayerSeat.tsx
import type { ClientPlayerState } from '@tuosan/shared';

interface PlayerSeatProps {
  player: ClientPlayerState;
  isCurrentTurn: boolean;
  position: 'bottom' | 'left' | 'top' | 'right';
}

const RANK_LABELS = ['', '头游', '二游', '三游', '末游'];

export default function PlayerSeat({ player, isCurrentTurn, position }: PlayerSeatProps) {
  return (
    <div className={`flex flex-col items-center gap-1 ${isCurrentTurn ? 'scale-105' : ''}`}>
      {/* Avatar */}
      <div
        className={`flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold ${
          isCurrentTurn
            ? 'animate-pulse ring-2 ring-yellow-400 bg-yellow-600'
            : player.isTeammate
              ? 'bg-blue-600'
              : 'bg-gray-600'
        }`}
      >
        {player.nickname[0]}
      </div>
      {/* Name */}
      <span className="text-xs font-medium text-white">{player.nickname}</span>
      {/* Card count */}
      {player.rank === null ? (
        <span className="text-xs text-green-300">{player.cardCount} 张</span>
      ) : (
        <span className="text-xs font-bold text-yellow-400">{RANK_LABELS[player.rank]}</span>
      )}
      {/* Score */}
      <span className="text-xs text-gray-400">得分: {player.score}</span>
      {/* Teammate indicator */}
      {player.isTeammate && (
        <span className="rounded bg-blue-800 px-1 text-[10px] text-blue-300">队友</span>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create CardPile.tsx**

```tsx
// packages/client/src/components/CardPile.tsx
import type { Card as CardType, HandType } from '@tuosan/shared';
import { HAND_TYPE_DISPLAY } from '@tuosan/shared';
import Card from './Card.js';

interface CardPileProps {
  cards: CardType[] | null;
  handType: HandType | null;
  playerName?: string;
}

export default function CardPile({ cards, handType, playerName }: CardPileProps) {
  if (!cards || cards.length === 0) {
    return (
      <div className="flex h-28 w-64 items-center justify-center rounded-xl border border-dashed border-green-600 text-green-600">
        等待出牌
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1">
      {playerName && <span className="text-xs text-green-300">{playerName}</span>}
      <div className="flex gap-0.5">
        {cards.map((card, i) => (
          <Card key={`${card.suit}-${card.rank}`} card={card} size="sm" />
        ))}
      </div>
      {handType && (
        <span className="text-xs text-yellow-400">{HAND_TYPE_DISPLAY[handType.type]}</span>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create ScoreBoard.tsx**

```tsx
// packages/client/src/components/ScoreBoard.tsx
interface ScoreBoardProps {
  teamScores: [number, number];
  myTeamIndex: 0 | 1;
}

export default function ScoreBoard({ teamScores, myTeamIndex }: ScoreBoardProps) {
  return (
    <div className="flex gap-4 rounded-lg bg-black/30 px-4 py-2 text-sm">
      <div className={`${myTeamIndex === 0 ? 'text-yellow-400 font-bold' : 'text-gray-300'}`}>
        A队: {teamScores[0]} 分
      </div>
      <div className="text-gray-600">|</div>
      <div className={`${myTeamIndex === 1 ? 'text-yellow-400 font-bold' : 'text-gray-300'}`}>
        B队: {teamScores[1]} 分
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create Timer.tsx**

```tsx
// packages/client/src/components/Timer.tsx
interface TimerProps {
  seconds: number;
  total: number;
}

export default function Timer({ seconds, total }: TimerProps) {
  const pct = total > 0 ? (seconds / total) * 100 : 0;
  const isUrgent = seconds <= 5;

  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-24 overflow-hidden rounded-full bg-gray-700">
        <div
          className={`h-full rounded-full transition-all ${isUrgent ? 'bg-red-500' : 'bg-green-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span
        className={`text-sm font-mono ${isUrgent ? 'text-red-400 animate-pulse' : 'text-gray-300'}`}
      >
        {seconds}s
      </span>
    </div>
  );
}
```

- [ ] **Step 5: Create ActionBar.tsx**

```tsx
// packages/client/src/components/ActionBar.tsx
import type { Card } from '@tuosan/shared';

interface ActionBarProps {
  isMyTurn: boolean;
  selectedCards: Card[];
  canPass: boolean;
  onPlay: () => void;
  onPass: () => void;
  onHint: () => void;
  onClear: () => void;
}

export default function ActionBar({
  isMyTurn,
  selectedCards,
  canPass,
  onPlay,
  onPass,
  onHint,
  onClear,
}: ActionBarProps) {
  if (!isMyTurn) {
    return (
      <div className="flex items-center justify-center py-3 text-green-400">等待其他玩家...</div>
    );
  }

  return (
    <div className="flex items-center justify-center gap-3 py-3">
      {canPass && (
        <button
          onClick={onPass}
          className="rounded-lg bg-gray-600 px-6 py-2 font-semibold text-white hover:bg-gray-500"
        >
          不要
        </button>
      )}
      <button
        onClick={onHint}
        className="rounded-lg bg-blue-600 px-6 py-2 font-semibold text-white hover:bg-blue-500"
      >
        提示
      </button>
      <button
        onClick={onClear}
        className="rounded-lg bg-gray-600 px-4 py-2 text-sm text-white hover:bg-gray-500"
      >
        清空
      </button>
      <button
        onClick={onPlay}
        disabled={selectedCards.length === 0}
        className="rounded-lg bg-yellow-500 px-8 py-2 font-bold text-black hover:bg-yellow-400 disabled:opacity-40"
      >
        出牌
      </button>
    </div>
  );
}
```

- [ ] **Step 6: Verify client compiles**

Run: `cd packages/client && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add packages/client/src/components/PlayerSeat.tsx packages/client/src/components/CardPile.tsx packages/client/src/components/ScoreBoard.tsx packages/client/src/components/Timer.tsx packages/client/src/components/ActionBar.tsx
git commit -m "feat(P3-3b): implement PlayerSeat, CardPile, ScoreBoard, Timer, ActionBar components"
```

---

## Task 7: Game Page Assembly (P3-3 + P3-4)

**Files:**

- Modify: `packages/client/src/pages/Game.tsx`

- [ ] **Step 1: Implement the full Game page**

Replace `packages/client/src/pages/Game.tsx` with:

```tsx
// packages/client/src/pages/Game.tsx
import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { TURN_TIMEOUT } from '@tuosan/shared';
import { useGameStore } from '../stores/useGameStore.js';
import { useRoomStore } from '../stores/useRoomStore.js';
import { getSocket } from '../services/socket.js';
import CardHand from '../components/CardHand.js';
import PlayerSeat from '../components/PlayerSeat.js';
import CardPile from '../components/CardPile.js';
import ScoreBoard from '../components/ScoreBoard.js';
import Timer from '../components/Timer.js';
import ActionBar from '../components/ActionBar.js';

export default function Game() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const {
    gameState,
    selectedCards,
    gameResult,
    turnTimer,
    toggleCardSelection,
    clearSelection,
    reset,
  } = useGameStore();

  useEffect(() => {
    if (!gameState) {
      // If no game state, go back to room
      if (roomId) navigate(`/room/${roomId}`);
      else navigate('/');
    }
  }, [gameState, roomId, navigate]);

  useEffect(() => {
    // Navigate to result when game ends
    if (gameResult && roomId) {
      navigate(`/result/${roomId}`);
    }
  }, [gameResult, roomId, navigate]);

  useEffect(() => {
    return () => {
      // Don't reset on unmount — result page needs the data
    };
  }, []);

  if (!gameState) return null;

  const {
    myHand,
    mySeat,
    players,
    currentPlayerSeat,
    isMyTurn,
    lastPlay,
    teamScores,
    myTeamIndex,
  } = gameState;

  // Map seats to positions relative to current player
  // bottom = me, right = next, top = across, left = previous
  const seatOrder = [mySeat, (mySeat + 1) % 4, (mySeat + 2) % 4, (mySeat + 3) % 4];
  const [bottomSeat, rightSeat, topSeat, leftSeat] = seatOrder;

  const handlePlay = () => {
    if (selectedCards.length === 0) return;
    try {
      const socket = getSocket();
      socket.emit('game:play', { cards: selectedCards });
    } catch {
      // Socket error
    }
  };

  const handlePass = () => {
    try {
      const socket = getSocket();
      socket.emit('game:pass');
    } catch {
      // Socket error
    }
  };

  const handleHint = () => {
    // TODO: Task 9 will implement this
  };

  const canPass = isMyTurn && lastPlay !== null;

  const lastPlayPlayerName = lastPlay ? players[lastPlay.playerSeat]?.nickname : undefined;

  return (
    <div className="flex h-screen flex-col bg-green-900">
      {/* Top bar: scores + timer */}
      <div className="flex items-center justify-between px-4 py-2">
        <ScoreBoard teamScores={teamScores} myTeamIndex={myTeamIndex} />
        {isMyTurn && <Timer seconds={turnTimer} total={TURN_TIMEOUT} />}
        <div className="text-xs text-green-600">房间 {roomId}</div>
      </div>

      {/* Game table */}
      <div className="relative flex flex-1 items-center justify-center">
        {/* Top player */}
        <div className="absolute top-4">
          <PlayerSeat
            player={players[topSeat]}
            isCurrentTurn={currentPlayerSeat === topSeat}
            position="top"
          />
        </div>

        {/* Left player */}
        <div className="absolute left-4">
          <PlayerSeat
            player={players[leftSeat]}
            isCurrentTurn={currentPlayerSeat === leftSeat}
            position="left"
          />
        </div>

        {/* Right player */}
        <div className="absolute right-4">
          <PlayerSeat
            player={players[rightSeat]}
            isCurrentTurn={currentPlayerSeat === rightSeat}
            position="right"
          />
        </div>

        {/* Center pile */}
        <CardPile
          cards={lastPlay?.cards ?? null}
          handType={lastPlay?.handType ?? null}
          playerName={lastPlayPlayerName}
        />
      </div>

      {/* Bottom: my hand + actions */}
      <div className="border-t border-green-700 bg-green-800 px-4 pb-4 pt-2">
        {/* My player info */}
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-yellow-600 text-sm font-bold">
              {players[mySeat]?.nickname?.[0]}
            </div>
            <span className="text-sm text-white">{players[mySeat]?.nickname}</span>
            <span className="text-xs text-green-400">{myHand.length} 张</span>
          </div>
          <ActionBar
            isMyTurn={isMyTurn}
            selectedCards={selectedCards}
            canPass={canPass}
            onPlay={handlePlay}
            onPass={handlePass}
            onHint={handleHint}
            onClear={clearSelection}
          />
        </div>

        {/* My cards */}
        <CardHand
          cards={myHand}
          selectedCards={selectedCards}
          onToggleCard={toggleCardSelection}
          disabled={!isMyTurn}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify client compiles**

Run: `cd packages/client && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Manual test — start dev servers and verify the game page renders**

Run in separate terminals:

1. `docker compose up -d`
2. `pnpm dev:server`
3. `pnpm dev:client`

Open browser to `http://localhost:5173`. Verify the page loads without console errors.

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/pages/Game.tsx
git commit -m "feat(P3-3c): implement Game page with full table layout"
```

---

## Task 8: Room → Game Navigation (P3-4 continued)

**Files:**

- Modify: `packages/client/src/pages/Room.tsx`

- [ ] **Step 1: Add game:start listener for navigation**

In `packages/client/src/pages/Room.tsx`, add an effect that navigates to the game page when game state appears:

Add import:

```ts
import { useGameStore } from '../stores/useGameStore.js';
```

Inside the `Room` component, after existing hooks:

```ts
const { gameState } = useGameStore();

useEffect(() => {
  if (gameState && roomId) {
    navigate(`/game/${roomId}`);
  }
}, [gameState, roomId, navigate]);
```

- [ ] **Step 2: Verify the flow compiles**

Run: `cd packages/client && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/pages/Room.tsx
git commit -m "feat(P3-4b): navigate from room to game on game:start"
```

---

## Task 9: Result Page (P3-5)

**Files:**

- Modify: `packages/client/src/pages/Result.tsx`

- [ ] **Step 1: Implement the full Result page**

Replace `packages/client/src/pages/Result.tsx` with:

```tsx
// packages/client/src/pages/Result.tsx
import { useNavigate, useParams } from 'react-router-dom';
import { useGameStore } from '../stores/useGameStore.js';
import { getTeamIndex } from '@tuosan/shared';

const RANK_LABELS = ['', '头游', '二游', '三游', '末游'];

export default function Result() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { gameResult, reset } = useGameStore();

  if (!gameResult) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-green-800 text-white">
        <div className="text-center">
          <p className="mb-4 text-xl">无结算数据</p>
          <button
            onClick={() => navigate('/')}
            className="rounded-lg bg-green-600 px-6 py-2 hover:bg-green-500"
          >
            返回首页
          </button>
        </div>
      </div>
    );
  }

  const { rankings, teamScores, isShuangDaiHua } = gameResult;
  const winningTeam = teamScores[0] >= teamScores[1] ? 0 : 1;

  const handlePlayAgain = () => {
    reset();
    navigate(`/room/${roomId}`);
  };

  const handleGoHome = () => {
    reset();
    navigate('/');
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-green-800 p-4 text-white">
      {/* Title */}
      <h1 className="mb-2 text-4xl font-bold">{isShuangDaiHua ? '双带花!' : '游戏结束'}</h1>

      {/* Team scores */}
      <div className="mb-6 flex gap-8 text-xl">
        <div
          className={`rounded-lg px-6 py-3 ${winningTeam === 0 ? 'bg-yellow-600 font-bold' : 'bg-gray-700'}`}
        >
          A队: {teamScores[0]} 分
        </div>
        <div
          className={`rounded-lg px-6 py-3 ${winningTeam === 1 ? 'bg-yellow-600 font-bold' : 'bg-gray-700'}`}
        >
          B队: {teamScores[1]} 分
        </div>
      </div>

      {/* Rankings table */}
      <div className="mb-8 w-full max-w-lg rounded-xl bg-green-900 p-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-green-700 text-green-400">
              <th className="py-2 text-left">排名</th>
              <th className="text-left">玩家</th>
              <th className="text-left">队伍</th>
              <th className="text-right">抓分</th>
              <th className="text-right">拖三</th>
              <th className="text-right">憋三</th>
              <th className="text-right">总分</th>
            </tr>
          </thead>
          <tbody>
            {rankings.map((r) => (
              <tr key={r.seatIndex} className="border-b border-green-800">
                <td className="py-2 text-yellow-400 font-bold">{RANK_LABELS[r.rank]}</td>
                <td>{r.nickname}</td>
                <td className="text-gray-400">{getTeamIndex(r.seatIndex) === 0 ? 'A' : 'B'}队</td>
                <td className="text-right">{r.capturedScore}</td>
                <td className="text-right text-green-400">
                  {r.tuoSanCount > 0 ? `+${r.tuoSanCount}` : '-'}
                </td>
                <td className="text-right text-red-400">
                  {r.bieSanCount > 0 ? `-${r.bieSanCount}` : '-'}
                </td>
                <td className="text-right font-bold">{r.totalScore}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Actions */}
      <div className="flex gap-4">
        <button
          onClick={handlePlayAgain}
          className="rounded-lg bg-yellow-500 px-8 py-3 font-bold text-black hover:bg-yellow-400"
        >
          再来一局
        </button>
        <button
          onClick={handleGoHome}
          className="rounded-lg border border-white px-8 py-3 hover:bg-white/10"
        >
          返回首页
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify client compiles**

Run: `cd packages/client && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/pages/Result.tsx
git commit -m "feat(P3-5): implement game result/settlement page"
```

---

## Task 10: Play Hints (P3-6)

**Files:**

- Create: `packages/client/src/game/hints.ts`
- Modify: `packages/client/src/pages/Game.tsx`

This task requires hand detection and comparison logic on the client side. We import the shared types and implement a simplified version for hint generation.

- [ ] **Step 1: Create hints.ts**

```ts
// packages/client/src/game/hints.ts
import type { Card, HandType } from '@tuosan/shared';
import { HandTypeEnum, SUIT_ORDER } from '@tuosan/shared';

// ---- Minimal hand detector (client-side for hints) ----

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

  // FTK / Pure FTK
  if (n === 3 && ranks.includes(5) && ranks.includes(10) && ranks.includes(13)) {
    const allSameSuit = new Set(suits).size === 1;
    if (allSameSuit) return { type: HandTypeEnum.PURE_FTK, rank: 0, suit: suits[0] };
    return { type: HandTypeEnum.FTK, rank: 0 };
  }

  // Three with two
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

  // Straight / Pure Dragon (>= 5 consecutive, no 2)
  if (n >= 5 && isConsecutive(ranks) && !ranks.includes(15)) {
    const allSameSuit = new Set(suits).size === 1;
    const topRank = ranks[ranks.length - 1];
    if (allSameSuit)
      return { type: HandTypeEnum.PURE_DRAGON, rank: topRank, suit: suits[0], length: n };
    return { type: HandTypeEnum.STRAIGHT, rank: topRank, length: n };
  }

  // Double straight (>= 4 cards, even, all pairs, consecutive, no 2)
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

  // Triple straight (>= 6, divisible by 3, all triples, consecutive, no 2)
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

// ---- Minimal comparator ----

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

// ---- Hint generation ----

function combinations<T>(arr: T[], size: number): T[][] {
  if (size === 0) return [[]];
  if (arr.length < size) return [];
  const [first, ...rest] = arr;
  const withFirst = combinations(rest, size - 1).map((c) => [first, ...c]);
  const withoutFirst = combinations(rest, size);
  return [...withFirst, ...withoutFirst];
}

/**
 * Get all valid plays from a hand that can beat the current table play.
 * If currentPlay is null, return all valid leading plays (excluding cards with rank 3 if isLeading).
 */
export function getHints(
  hand: Card[],
  currentPlay: { cards: Card[]; handType: HandType } | null,
  isLeading: boolean,
): Card[][] {
  const hints: Card[][] = [];
  const containsThree = (cards: Card[]) => cards.some((c) => c.rank === 3);

  // Try all possible subset sizes
  const maxSize = Math.min(hand.length, 13);
  for (let size = 1; size <= maxSize; size++) {
    // Optimization: for large hands, limit combinations
    if (size > 5 && combinations(hand, size).length > 5000) break;

    for (const combo of combinations(hand, size)) {
      const ht = detectHandType(combo);
      if (!ht) continue;

      // Leading: no 3s allowed
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

  // Sort hints: prefer smaller plays, then by rank
  hints.sort((a, b) => a.length - b.length || a[0].rank - b[0].rank);

  // Deduplicate and limit
  return hints.slice(0, 50);
}
```

- [ ] **Step 2: Wire hint button in Game.tsx**

In `packages/client/src/pages/Game.tsx`, add hint state and wire the button:

Add import:

```ts
import { getHints } from '../game/hints.js';
```

Add state inside the component:

```ts
const [hintIndex, setHintIndex] = useState(0);
const [hints, setHints] = useState<Card[][]>([]);
```

Add import for `useState` (already present from React).

Replace the `handleHint` function:

```ts
const handleHint = () => {
  if (hints.length > 0) {
    // Cycle through hints
    const nextIndex = (hintIndex + 1) % hints.length;
    setHintIndex(nextIndex);
    useGameStore.getState().setSelection(hints[nextIndex]);
    return;
  }

  const isLeading = lastPlay === null;
  const newHints = getHints(myHand, lastPlay, isLeading);
  setHints(newHints);
  if (newHints.length > 0) {
    setHintIndex(0);
    useGameStore.getState().setSelection(newHints[0]);
  }
};
```

Reset hints when turn changes — add an effect:

```ts
useEffect(() => {
  setHints([]);
  setHintIndex(0);
}, [isMyTurn, lastPlay]);
```

- [ ] **Step 3: Verify client compiles**

Run: `cd packages/client && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/game/hints.ts packages/client/src/pages/Game.tsx
git commit -m "feat(P3-6): implement client-side play hints with combination search"
```

---

## Task 11: Integration Test for Game Flow

**Files:**

- Create: `packages/server/src/socket/__tests__/gameHandler.test.ts`

- [ ] **Step 1: Write integration test**

```ts
// packages/server/src/socket/__tests__/gameHandler.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createGame, getEngine, removeEngine, getAllEngines } from '../../services/gameService.js';
import type { PlayerInfo } from '../../game/game-engine.js';

const players: PlayerInfo[] = [
  { userId: 'u0', nickname: 'P0', avatar: '', seatIndex: 0 },
  { userId: 'u1', nickname: 'P1', avatar: '', seatIndex: 1 },
  { userId: 'u2', nickname: 'P2', avatar: '', seatIndex: 2 },
  { userId: 'u3', nickname: 'P3', avatar: '', seatIndex: 3 },
];

describe('Game flow integration', () => {
  beforeEach(() => {
    for (const [roomId] of getAllEngines()) {
      removeEngine(roomId);
    }
  });

  it('creates a game, plays cards, and reaches game end', () => {
    const engine = createGame('room-test', players);
    const state = engine.getState();
    expect(state.phase).toBe('playing');

    // Simulate a simple game: each player leads their smallest non-3, others pass
    let moves = 0;
    while (engine.getState().phase === 'playing' && moves < 300) {
      const gs = engine.getState();
      const seat = gs.currentPlayerSeat;
      const hand = gs.players[seat].hand;

      if (hand.length === 0) break;

      if (gs.currentRound.lastPlay === null) {
        // Leading: play smallest non-3 card
        const card = hand.find((c) => c.rank !== 3);
        if (card) {
          engine.play(seat, [card]);
        } else {
          break; // only 3s left
        }
      } else {
        engine.pass(seat);
      }
      moves++;
    }

    // Game should have finished
    const final = engine.getState();
    expect(final.phase).toBe('finished');
    expect(final.finishedOrder).toHaveLength(4);

    // Settle should produce valid result
    const result = engine.settle();
    expect(result.rankings).toHaveLength(4);
    expect(result.teamScores).toHaveLength(2);
  });

  it('validates player view hides other hands', () => {
    const engine = createGame('room-view', players);
    const view = engine.getPlayerView(0);

    expect(view.myHand).toHaveLength(13);
    expect(view.mySeat).toBe(0);

    for (const [seat, player] of Object.entries(view.players)) {
      if (Number(seat) !== 0) {
        expect(player.cardCount).toBe(13);
        // ClientPlayerState should not have a 'hand' property
        expect('hand' in player).toBe(false);
      }
    }
  });
});
```

- [ ] **Step 2: Run test**

Run: `cd packages/server && npx vitest run src/socket/__tests__/gameHandler.test.ts`
Expected: All tests PASS

- [ ] **Step 3: Run full test suite**

Run: `cd packages/server && npx vitest run`
Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
git add packages/server/src/socket/__tests__/gameHandler.test.ts
git commit -m "test(P3): add integration test for complete game flow"
```

---

## Summary of Commits

| #   | Commit message                                                                         | Task    |
| --- | -------------------------------------------------------------------------------------- | ------- |
| 1   | `feat(P3-0): add card display constants to shared package`                             | Task 1  |
| 2   | `feat(P3-1a): implement game service with engine management and persistence`           | Task 2  |
| 3   | `feat(P3-1b): implement game socket handler with play, pass, and turn timer`           | Task 3  |
| 4   | `feat(P3-4a): implement client game store and socket listener bindings`                | Task 4  |
| 5   | `feat(P3-3a): implement Card and CardHand components`                                  | Task 5  |
| 6   | `feat(P3-3b): implement PlayerSeat, CardPile, ScoreBoard, Timer, ActionBar components` | Task 6  |
| 7   | `feat(P3-3c): implement Game page with full table layout`                              | Task 7  |
| 8   | `feat(P3-4b): navigate from room to game on game:start`                                | Task 8  |
| 9   | `feat(P3-5): implement game result/settlement page`                                    | Task 9  |
| 10  | `feat(P3-6): implement client-side play hints with combination search`                 | Task 10 |
| 11  | `test(P3): add integration test for complete game flow`                                | Task 11 |
