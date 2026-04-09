# 人机模式与房间管理实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 支持单人对战 3 个 AI 机器人 + 房间列表/解散/踢人功能

**Architecture:** 机器人作为虚拟玩家在服务端运行，没有真实 Socket 连接。`notifyNextPlayer()` 检测到下家是机器人时自动调用 `botPlay()` 执行出牌。房间管理通过新增 Socket 事件和 REST API 实现。

**Tech Stack:** TypeScript, Socket.IO, Redis, React, Zustand, Vitest

---

## 文件结构

| 文件                                                         | 操作 | 职责                                 |
| ------------------------------------------------------------ | ---- | ------------------------------------ |
| `packages/shared/src/types/room.ts`                          | 修改 | RoomPlayer 加 `isBot` 字段           |
| `packages/shared/src/types/events.ts`                        | 修改 | 新增 Socket 事件类型                 |
| `packages/shared/src/index.ts`                               | 修改 | 导出新增类型                         |
| `packages/server/src/game/bot.ts`                            | 新建 | 机器人出牌策略                       |
| `packages/server/src/game/__tests__/bot.test.ts`             | 新建 | 机器人策略测试                       |
| `packages/server/src/services/roomService.ts`                | 修改 | addBot / dissolveRoom / 用户房间集合 |
| `packages/server/src/services/__tests__/roomService.test.ts` | 新建 | 房间服务新功能测试                   |
| `packages/server/src/routes/room.ts`                         | 修改 | bot-game / my-rooms API              |
| `packages/server/src/socket/roomHandler.ts`                  | 修改 | add-bot / kick / dissolve 事件       |
| `packages/server/src/socket/gameHandler.ts`                  | 修改 | notifyNextPlayer 加机器人检测        |
| `packages/client/src/pages/Home.tsx`                         | 修改 | 人机对战按钮 + 房间列表              |
| `packages/client/src/pages/Room.tsx`                         | 修改 | 添加机器人/踢人/解散按钮             |
| `packages/client/src/stores/useRoomStore.ts`                 | 修改 | 新增事件监听和操作方法               |

---

### Task 1: 类型基础 — RoomPlayer 加 isBot + 新增 Socket 事件

**Files:**

- Modify: `packages/shared/src/types/room.ts`
- Modify: `packages/shared/src/types/events.ts`

- [ ] **Step 1: 修改 RoomPlayer 接口，添加 isBot 字段**

在 `packages/shared/src/types/room.ts` 的 `RoomPlayer` 接口中添加：

```typescript
export interface RoomPlayer {
  userId: string;
  nickname: string;
  avatar: string;
  seatIndex: number;
  isReady: boolean;
  isHost: boolean;
  isBot: boolean;
}
```

- [ ] **Step 2: 在 events.ts 中添加新的 Socket 事件类型**

在 `packages/shared/src/types/events.ts` 的 `ClientToServerEvents` 中添加：

```typescript
'room:add-bot': () => void;
'room:kick': (data: { seatIndex: number }) => void;
'room:dissolve': () => void;
```

在 `ServerToClientEvents` 中添加：

```typescript
'room:kicked': () => void;
'room:dissolved': () => void;
```

- [ ] **Step 3: 构建 shared 包验证编译**

Run: `pnpm -C packages/shared run build`
Expected: Build success

- [ ] **Step 4: 提交**

```bash
git add packages/shared/src/types/room.ts packages/shared/src/types/events.ts
git commit -m "feat(P4-1): RoomPlayer 添加 isBot 字段，新增房间管理事件类型"
```

---

### Task 2: 房间服务扩展 — addBot / dissolveRoom / 用户房间集合

**Files:**

- Modify: `packages/server/src/services/roomService.ts`

- [ ] **Step 1: 在 roomService.ts 顶部添加用户房间集合的 key 函数**

在 `userRoomKey` 下方添加：

```typescript
const USER_ROOMS_PREFIX = 'tuosan:user-rooms:';

function userRoomsKey(userId: string) {
  return `${USER_ROOMS_PREFIX}${userId}`;
}
```

- [ ] **Step 2: 修改 createRoom，写入用户房间集合**

在 `createRoom` 函数中，`await redis.set(userRoomKey(userId), roomId, 'EX', ROOM_TTL);` 之后添加：

```typescript
await redis.sadd(userRoomsKey(userId), roomId);
await redis.expire(userRoomsKey(userId), ROOM_TTL);
```

同时修改 `createRoom` 中创建 `player` 对象，加上 `isBot: false`：

```typescript
const player: RoomPlayer = {
  userId,
  nickname,
  avatar,
  seatIndex: 0,
  isReady: false,
  isHost: true,
  isBot: false,
};
```

- [ ] **Step 3: 修改 joinRoom，写入用户房间集合 + isBot**

在 `joinRoom` 函数中，`await redis.set(userRoomKey(userId), roomId, 'EX', ROOM_TTL);` 之后添加：

```typescript
await redis.sadd(userRoomsKey(userId), roomId);
await redis.expire(userRoomsKey(userId), ROOM_TTL);
```

同时修改 `joinRoom` 中创建 `player` 对象，加上 `isBot: false`：

```typescript
const player: RoomPlayer = {
  userId,
  nickname,
  avatar,
  seatIndex,
  isReady: false,
  isHost: false,
  isBot: false,
};
```

- [ ] **Step 4: 添加 addBot 函数**

在 `roomService.ts` 文件末尾添加：

```typescript
const BOT_NAMES = ['机器人A', '机器人B', '机器人C'];

export function isBotUser(userId: string): boolean {
  return userId.startsWith('bot_');
}

export async function addBot(
  roomId: string,
  requestUserId: string,
): Promise<{ seatIndex: number; bot: RoomPlayer }> {
  const room = await getRoom(roomId);
  if (!room) throw new AppError(404, '房间不存在', 'ROOM_NOT_FOUND');
  if (room.hostUserId !== requestUserId)
    throw new AppError(403, '只有房主可以添加机器人', 'NOT_HOST');
  if (room.status !== 'waiting') throw new AppError(409, '游戏已开始', 'GAME_IN_PROGRESS');

  // 找空位
  let seatIndex = -1;
  for (let i = 0; i < 4; i++) {
    if (!room.players[i]) {
      seatIndex = i;
      break;
    }
  }
  if (seatIndex === -1) throw new AppError(409, '房间已满', 'ROOM_FULL');

  // 计算机器人编号
  const existingBots = Object.values(room.players).filter((p) => p?.isBot).length;
  const botId = `bot_${seatIndex}`;
  const botName = BOT_NAMES[existingBots] || `机器人${existingBots + 1}`;

  const bot: RoomPlayer = {
    userId: botId,
    nickname: botName,
    avatar: '',
    seatIndex,
    isReady: true,
    isHost: false,
    isBot: true,
  };

  await redis.hset(roomKey(roomId), `seat_${seatIndex}`, JSON.stringify(bot));

  return { seatIndex, bot };
}
```

- [ ] **Step 5: 添加 dissolveRoom 函数**

在 `addBot` 下方添加：

```typescript
export async function dissolveRoom(roomId: string, requestUserId: string): Promise<void> {
  const room = await getRoom(roomId);
  if (!room) throw new AppError(404, '房间不存在', 'ROOM_NOT_FOUND');
  if (room.hostUserId !== requestUserId)
    throw new AppError(403, '只有房主可以解散房间', 'NOT_HOST');

  // 清理所有真实玩家的 user-room 映射
  for (let i = 0; i < 4; i++) {
    const player = room.players[i];
    if (player && !player.isBot) {
      await redis.del(userRoomKey(player.userId));
      await redis.srem(userRoomsKey(player.userId), roomId);
    }
  }

  await redis.del(roomKey(roomId));
}
```

- [ ] **Step 6: 添加 getUserRooms 函数**

在 `dissolveRoom` 下方添加：

```typescript
export async function getUserRooms(
  userId: string,
): Promise<Array<{ roomId: string; playerCount: number; status: string; createdAt: number }>> {
  const roomIds = await redis.smembers(userRoomsKey(userId));
  const rooms: Array<{ roomId: string; playerCount: number; status: string; createdAt: number }> =
    [];

  for (const rid of roomIds) {
    const room = await getRoom(rid);
    if (!room) {
      // 房间已过期，清理集合
      await redis.srem(userRoomsKey(userId), rid);
      continue;
    }
    const playerCount = Object.values(room.players).filter(Boolean).length;
    rooms.push({
      roomId: room.roomId,
      playerCount,
      status: room.status,
      createdAt: room.createdAt,
    });
  }

  return rooms;
}
```

- [ ] **Step 7: 修改 leaveRoom，清理用户房间集合 + 处理房主离开解散逻辑**

修改 `leaveRoom` 函数。在 `await redis.del(userRoomKey(userId));` 之后添加：

```typescript
await redis.srem(userRoomsKey(userId), roomId);
```

同时修改房主离开逻辑：不再转让房主，而是直接解散房间。将从 `// If host left, transfer to next player` 到函数末尾替换为：

```typescript
// 房主离开，解散房间
if (room.hostUserId === userId) {
  // 清理所有其他真实玩家
  for (let i = 0; i < 4; i++) {
    const p = room.players[i];
    if (p && p.userId !== userId && !p.isBot) {
      await redis.del(userRoomKey(p.userId));
      await redis.srem(userRoomsKey(p.userId), roomId);
    }
  }
  await redis.del(roomKey(roomId));
  return { seatIndex, dissolved: true };
}

return { seatIndex, dissolved: false };
```

- [ ] **Step 8: 验证编译**

Run: `pnpm -C packages/server exec tsc --noEmit`
Expected: 无错误（或仅预已存在的测试文件错误）

- [ ] **Step 9: 提交**

```bash
git add packages/server/src/services/roomService.ts
git commit -m "feat(P4-2): 房间服务扩展 - addBot/dissolveRoom/getUserRooms"
```

---

### Task 3: 机器人出牌策略

**Files:**

- Create: `packages/server/src/game/bot.ts`
- Create: `packages/server/src/game/__tests__/bot.test.ts`

- [ ] **Step 1: 编写机器人策略测试**

创建 `packages/server/src/game/__tests__/bot.test.ts`：

```typescript
import { describe, it, expect } from 'vitest';
import { chooseBotPlay } from '../bot.js';
import type { Card, HandType } from '@tuosan/shared';
import { HandTypeEnum } from '@tuosan/shared';

const card = (rank: number, suit = 'spade' as const): Card => ({
  rank: rank as Card['rank'],
  suit,
});

describe('chooseBotPlay', () => {
  it('首出时出一张非3的单牌', () => {
    const hand = [card(3), card(5), card(7), card(10)];
    const result = chooseBotPlay(hand, null);
    expect(result.action).toBe('play');
    expect(result.cards).toHaveLength(1);
    expect(result.cards![0].rank).not.toBe(3);
  });

  it('首出时只有3则出3', () => {
    const hand = [card(3), card(3, 'heart')];
    const result = chooseBotPlay(hand, null);
    expect(result.action).toBe('play');
    expect(result.cards).toHaveLength(1);
    expect(result.cards![0].rank).toBe(3);
  });

  it('跟牌时出一张能压过的单牌', () => {
    const hand = [card(5), card(8), card(12)];
    const lastPlay: { cards: Card[]; handType: HandType } = {
      cards: [card(7)],
      handType: { type: HandTypeEnum.SINGLE, rank: 7 },
    };
    const result = chooseBotPlay(hand, lastPlay);
    expect(result.action).toBe('play');
    expect(result.cards).toHaveLength(1);
    expect(result.cards![0].rank).toBeGreaterThan(7);
  });

  it('跟牌时没有能压过的牌则 pass', () => {
    const hand = [card(4), card(5), card(6)];
    const lastPlay: { cards: Card[]; handType: HandType } = {
      cards: [card(14)],
      handType: { type: HandTypeEnum.SINGLE, rank: 14 },
    };
    const result = chooseBotPlay(hand, lastPlay);
    expect(result.action).toBe('pass');
  });

  it('跟牌时 3 可以压任何牌', () => {
    const hand = [card(3), card(4)];
    const lastPlay: { cards: Card[]; handType: HandType } = {
      cards: [card(15)],
      handType: { type: HandTypeEnum.SINGLE, rank: 15 },
    };
    const result = chooseBotPlay(hand, lastPlay);
    expect(result.action).toBe('play');
    // 应该优先出非3（rank 4 < 15 压不过），所以出 3
    expect(result.cards![0].rank).toBe(3);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm -C packages/server test -- src/game/__tests__/bot.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现机器人策略**

创建 `packages/server/src/game/bot.ts`：

```typescript
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
    // 随机选一张
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
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm -C packages/server test -- src/game/__tests__/bot.test.ts`
Expected: 5 passed

- [ ] **Step 5: 提交**

```bash
git add packages/server/src/game/bot.ts packages/server/src/game/__tests__/bot.test.ts
git commit -m "feat(P4-3): 实现机器人随机出牌策略"
```

---

### Task 4: gameHandler 集成机器人自动出牌

**Files:**

- Modify: `packages/server/src/socket/gameHandler.ts`

- [ ] **Step 1: 在 gameHandler.ts 顶部添加导入**

在现有 import 后添加：

```typescript
import { chooseBotPlay } from '../game/bot.js';
import { isBotUser } from '../services/roomService.js';
```

- [ ] **Step 2: 修改 notifyNextPlayer 函数**

将现有的 `notifyNextPlayer` 替换为：

```typescript
/** 通知下一个玩家出牌，启动计时器。如果是机器人则自动出牌 */
export async function notifyNextPlayer(
  io: TypedIO,
  roomId: string,
  seatIndex: number,
): Promise<void> {
  const engine = getEngine(roomId);
  if (!engine) return;

  const state = engine.getState();
  const player = state.players[seatIndex];

  // 如果是机器人，自动出牌
  if (isBotUser(player.userId)) {
    const delay = 200 + Math.random() * 300;
    setTimeout(() => botPlay(io, roomId, seatIndex), delay);
    return;
  }

  // 真实玩家：发 Socket 事件 + 启动计时器
  const sockets = await io.in(roomId).fetchSockets();
  for (const s of sockets) {
    if (s.data.seatIndex === seatIndex) {
      s.emit('game:your-turn', { timeLimit: TURN_TIMEOUT });
      break;
    }
  }
  startTurnTimer(io, roomId, seatIndex);
}
```

- [ ] **Step 3: 添加 botPlay 函数**

在 `notifyNextPlayer` 下方、`startTurnTimer` 之前添加：

```typescript
/** 机器人自动出牌 */
async function botPlay(io: TypedIO, roomId: string, seatIndex: number): Promise<void> {
  const engine = getEngine(roomId);
  if (!engine) return;

  const state = engine.getState();
  if (state.phase !== 'playing' || state.currentPlayerSeat !== seatIndex) return;

  const player = state.players[seatIndex];
  const lastPlay = state.currentRound.lastPlay;
  const decision = chooseBotPlay(
    player.hand,
    lastPlay ? { cards: lastPlay.cards, handType: lastPlay.handType } : null,
  );

  try {
    if (decision.action === 'play' && decision.cards) {
      const cardToPlay = decision.cards[0];
      const result = engine.play(seatIndex, [cardToPlay]);
      if (!result.valid) {
        // 出牌失败，改为 pass（如果不是首出）
        if (lastPlay) {
          executeBotPass(io, roomId, engine, seatIndex);
        }
        return;
      }

      const newState = engine.getState();
      const updatedPlayer = newState.players[seatIndex];

      io.to(roomId).emit('game:played', {
        playerId: updatedPlayer.userId,
        seatIndex,
        cards: [cardToPlay],
        handType: result.handType!,
        remainingCards: updatedPlayer.hand.length,
        nextSeat: newState.currentPlayerSeat,
      });

      await handlePostPlay(io, roomId, engine, seatIndex);
    } else {
      executeBotPass(io, roomId, engine, seatIndex);
    }
  } catch (err) {
    logger.error({ err, roomId, seatIndex }, '机器人出牌失败');
  }
}

/** 机器人执行 pass */
async function executeBotPass(
  io: TypedIO,
  roomId: string,
  engine: ReturnType<typeof getEngine> & {},
  seatIndex: number,
): Promise<void> {
  const state = engine.getState();
  const prevLastPlay = state.currentRound.lastPlay
    ? { ...state.currentRound.lastPlay, cards: [...state.currentRound.lastPlay.cards] }
    : null;
  const prevScores = Object.fromEntries(
    Object.entries(state.players).map(([s, p]) => [s, p.score]),
  );

  const passResult = engine.pass(seatIndex);
  if (!passResult.valid) return;

  const newState = engine.getState();

  io.to(roomId).emit('game:passed', {
    playerId: state.players[seatIndex].userId,
    seatIndex,
    nextSeat: newState.currentPlayerSeat,
  });

  await handleRoundEndCheck(io, roomId, newState, prevLastPlay, prevScores);
  await notifyNextPlayer(io, roomId, newState.currentPlayerSeat);
}
```

- [ ] **Step 4: 验证编译**

Run: `pnpm -C packages/server exec tsc --noEmit`
Expected: 无新增错误

- [ ] **Step 5: 运行全部测试确认不破坏现有功能**

Run: `pnpm -C packages/server test`
Expected: 所有测试通过

- [ ] **Step 6: 提交**

```bash
git add packages/server/src/socket/gameHandler.ts
git commit -m "feat(P4-4): gameHandler 集成机器人自动出牌"
```

---

### Task 5: 房间 Socket 事件 — add-bot / kick / dissolve

**Files:**

- Modify: `packages/server/src/socket/roomHandler.ts`

- [ ] **Step 1: 在 roomHandler.ts 顶部添加导入**

在现有的 `import * as roomService` 之后确保能使用新函数。不需要额外导入（已通过 `roomService.*` 访问）。

- [ ] **Step 2: 在 `room:chat` 事件处理之前添加 `room:add-bot` 事件**

```typescript
socket.on('room:add-bot', async () => {
  const roomId = socket.data.roomId as string;
  if (!roomId) return;

  try {
    const { seatIndex, bot } = await roomService.addBot(roomId, userId);
    io.to(roomId).emit('room:player-joined', { player: bot, seatIndex });

    // 发送更新后的完整房间状态
    const updatedRoom = await roomService.getRoom(roomId);
    if (updatedRoom) {
      io.to(roomId).emit('room:state', updatedRoom);
    }

    logger.info({ userId, roomId, botSeat: seatIndex }, '添加机器人');
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string };
    socket.emit('error', {
      code: e.code || 'INTERNAL_ERROR',
      message: e.message || '添加机器人失败',
    });
  }
});
```

- [ ] **Step 3: 添加 `room:kick` 事件**

在 `room:add-bot` 之后添加：

```typescript
socket.on('room:kick', async (data: { seatIndex: number }) => {
  const roomId = socket.data.roomId as string;
  if (!roomId) return;

  try {
    const room = await roomService.getRoom(roomId);
    if (!room) {
      socket.emit('error', { code: 'ROOM_NOT_FOUND', message: '房间不存在' });
      return;
    }
    if (room.hostUserId !== userId) {
      socket.emit('error', { code: 'NOT_HOST', message: '只有房主可以踢人' });
      return;
    }

    const target = room.players[data.seatIndex];
    if (!target) {
      socket.emit('error', { code: 'SEAT_EMPTY', message: '该座位没有玩家' });
      return;
    }

    if (target.isBot) {
      // 机器人直接从座位移除
      await roomService.removeBot(roomId, data.seatIndex);
    } else {
      // 踢真实玩家
      await roomService.leaveRoom(roomId, target.userId);

      // 通知被踢者
      const sockets = await io.in(roomId).fetchSockets();
      for (const s of sockets) {
        if (s.data.userId === target.userId) {
          s.emit('room:kicked');
          s.leave(roomId);
          s.data.roomId = undefined;
          s.data.seatIndex = undefined;
          break;
        }
      }
    }

    // 广播更新
    io.to(roomId).emit('room:player-left', { playerId: target.userId });
    const updatedRoom = await roomService.getRoom(roomId);
    if (updatedRoom) {
      io.to(roomId).emit('room:state', updatedRoom);
    }

    logger.info({ userId, roomId, kickedSeat: data.seatIndex }, '踢出玩家');
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string };
    socket.emit('error', {
      code: e.code || 'INTERNAL_ERROR',
      message: e.message || '踢人失败',
    });
  }
});
```

- [ ] **Step 4: 添加 `room:dissolve` 事件**

在 `room:kick` 之后添加：

```typescript
socket.on('room:dissolve', async () => {
  const roomId = socket.data.roomId as string;
  if (!roomId) return;

  try {
    await roomService.dissolveRoom(roomId, userId);

    // 通知所有房间成员
    io.to(roomId).emit('room:dissolved');

    // 让所有 socket 离开房间
    const sockets = await io.in(roomId).fetchSockets();
    for (const s of sockets) {
      s.leave(roomId);
      s.data.roomId = undefined;
      s.data.seatIndex = undefined;
    }

    logger.info({ userId, roomId }, '解散房间');
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string };
    socket.emit('error', {
      code: e.code || 'INTERNAL_ERROR',
      message: e.message || '解散房间失败',
    });
  }
});
```

- [ ] **Step 5: 添加 removeBot 到 roomService**

在 `packages/server/src/services/roomService.ts` 的 `addBot` 函数之后添加：

```typescript
export async function removeBot(roomId: string, seatIndex: number): Promise<void> {
  await redis.hset(roomKey(roomId), `seat_${seatIndex}`, '');
}
```

注意：`roomKey` 是 roomService 内部的函数，所以 `removeBot` 必须定义在 roomService 内部。

- [ ] **Step 6: 修改 disconnect 处理——房主断开时解散房间并通知**

将 `roomHandler.ts` 中 `socket.on('disconnect', ...)` 替换为：

```typescript
socket.on('disconnect', async () => {
  const roomId = socket.data.roomId as string;
  if (!roomId) return;

  try {
    const room = await roomService.getRoom(roomId);
    if (!room) return;

    // 房主断开：解散房间
    if (room.hostUserId === userId) {
      await roomService.dissolveRoom(roomId, userId);
      io.to(roomId).emit('room:dissolved');
      const sockets = await io.in(roomId).fetchSockets();
      for (const s of sockets) {
        s.leave(roomId);
        s.data.roomId = undefined;
        s.data.seatIndex = undefined;
      }
    } else {
      const { dissolved } = await roomService.leaveRoom(roomId, userId);
      if (!dissolved) {
        io.to(roomId).emit('room:player-left', { playerId: userId });
        const updatedRoom = await roomService.getRoom(roomId);
        if (updatedRoom) {
          io.to(roomId).emit('room:state', updatedRoom);
        }
      }
    }
  } catch {
    // 忽略断开清理中的错误
  }
});
```

- [ ] **Step 7: 验证编译**

Run: `pnpm -C packages/server exec tsc --noEmit`
Expected: 无新增错误

- [ ] **Step 8: 提交**

```bash
git add packages/server/src/socket/roomHandler.ts packages/server/src/services/roomService.ts
git commit -m "feat(P4-5): 实现 add-bot/kick/dissolve Socket 事件处理"
```

---

### Task 6: REST API — bot-game / my-rooms

**Files:**

- Modify: `packages/server/src/routes/room.ts`

- [ ] **Step 1: 添加 POST /api/room/bot-game 端点**

在 `router.get('/api/room/:roomId', ...)` 之前添加：

```typescript
router.post(
  '/api/room/bot-game',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user!.userId },
        select: { id: true, nickname: true, avatar: true },
      });
      if (!user) throw new AppError(401, '用户不存在', 'UNAUTHORIZED');

      // 创建房间
      const { roomId } = await roomService.createRoom(user.id, user.nickname, user.avatar);

      // 添加 3 个机器人
      await roomService.addBot(roomId, user.id);
      await roomService.addBot(roomId, user.id);
      await roomService.addBot(roomId, user.id);

      res.json({ success: true, data: { roomId } });
    } catch (err) {
      next(err);
    }
  },
);
```

- [ ] **Step 2: 添加 GET /api/room/my-rooms 端点**

在 `bot-game` 端点之后添加：

```typescript
router.get(
  '/api/room/my-rooms',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const rooms = await roomService.getUserRooms(req.user!.userId);
      res.json({ success: true, data: { rooms } });
    } catch (err) {
      next(err);
    }
  },
);
```

- [ ] **Step 3: 验证编译**

Run: `pnpm -C packages/server exec tsc --noEmit`
Expected: 无新增错误

- [ ] **Step 4: 提交**

```bash
git add packages/server/src/routes/room.ts
git commit -m "feat(P4-6): 添加 bot-game 和 my-rooms REST API"
```

---

### Task 7: 客户端 — useRoomStore 新增事件和操作

**Files:**

- Modify: `packages/client/src/stores/useRoomStore.ts`

- [ ] **Step 1: 在 RoomStore 接口中添加新方法**

```typescript
interface RoomStore {
  room: RoomState | null;
  socket: TypedSocket | null;
  chatMessages: ChatMessage[];
  error: string | null;

  joinRoom: (roomId: string, seatIndex?: number) => void;
  leaveRoom: () => void;
  toggleReady: () => void;
  startGame: () => void;
  sendChat: (message: string) => void;
  addBot: () => void;
  kickPlayer: (seatIndex: number) => void;
  dissolveRoom: () => void;
  reset: () => void;
}
```

- [ ] **Step 2: 在 joinRoom 的事件监听中添加 `room:kicked` 和 `room:dissolved`**

在 `socket.on('error', ...)` 之后、`bindGameSocketListeners(socket)` 之前添加：

```typescript
socket.on('room:kicked', () => {
  alert('你已被踢出房间');
  get().leaveRoom();
  window.location.href = '/';
});

socket.on('room:dissolved', () => {
  alert('房间已被解散');
  get().leaveRoom();
  window.location.href = '/';
});
```

- [ ] **Step 3: 添加 addBot / kickPlayer / dissolveRoom 方法实现**

在 `sendChat` 之后、`reset` 之前添加：

```typescript
addBot: () => {
  get().socket?.emit('room:add-bot');
},

kickPlayer: (seatIndex: number) => {
  get().socket?.emit('room:kick', { seatIndex });
},

dissolveRoom: () => {
  get().socket?.emit('room:dissolve');
},
```

- [ ] **Step 4: 在 unbindGameSocketListeners 调用时也解绑新事件**

修改 `leaveRoom` 中 `socket.removeAllListeners()` 之前的逻辑。由于 `removeAllListeners()` 已经清除所有监听器，无需额外修改。

- [ ] **Step 5: 验证编译**

Run: `pnpm -C packages/client exec tsc --noEmit`
Expected: 无错误

- [ ] **Step 6: 提交**

```bash
git add packages/client/src/stores/useRoomStore.ts
git commit -m "feat(P4-7): 客户端 store 添加 addBot/kick/dissolve 操作"
```

---

### Task 8: 客户端 — Home.tsx 人机对战按钮 + 房间列表

**Files:**

- Modify: `packages/client/src/pages/Home.tsx`

- [ ] **Step 1: 添加状态和数据请求**

在 Home 组件内部，现有 state 声明之后添加：

```typescript
const [myRooms, setMyRooms] = useState<
  Array<{ roomId: string; playerCount: number; status: string; createdAt: number }>
>([]);

useEffect(() => {
  if (user) {
    api
      .get<{ rooms: typeof myRooms }>('/api/room/my-rooms')
      .then((data) => setMyRooms(data.rooms))
      .catch(() => {});
  }
}, [user]);
```

- [ ] **Step 2: 添加 handleBotGame 函数**

在 `handleJoinRoom` 之后添加：

```typescript
const handleBotGame = async () => {
  setError('');
  try {
    const data = await api.post<{ roomId: string }>('/api/room/bot-game');
    navigate(`/room/${data.roomId}`);
  } catch (err: unknown) {
    setError((err as { message?: string }).message || '创建人机对战失败');
  }
};
```

- [ ] **Step 3: 在已登录用户的按钮区域添加"人机对战"按钮**

在"创建房间"按钮之后添加：

```tsx
<button
  onClick={handleBotGame}
  className="w-64 rounded-lg bg-green-600 px-8 py-3 text-lg font-semibold text-white hover:bg-green-500"
>
  人机对战
</button>
```

- [ ] **Step 4: 在按钮区域下方添加"我的房间"列表**

在 `{error && ...}` 之后、退出登录按钮之前添加：

```tsx
{
  myRooms.length > 0 && (
    <div className="mt-4 w-80">
      <h3 className="mb-2 text-center text-sm text-green-300">我的房间</h3>
      <div className="flex flex-col gap-2">
        {myRooms.map((r) => (
          <div
            key={r.roomId}
            className="flex items-center justify-between rounded-lg bg-green-800 px-4 py-2"
          >
            <div>
              <span className="font-mono text-yellow-400">{r.roomId}</span>
              <span className="ml-2 text-sm text-green-400">{r.playerCount}/4</span>
              <span
                className={`ml-2 text-xs ${r.status === 'waiting' ? 'text-green-300' : 'text-orange-400'}`}
              >
                {r.status === 'waiting' ? '等待中' : '游戏中'}
              </span>
            </div>
            {r.status === 'waiting' && (
              <button
                onClick={() => navigate(`/room/${r.roomId}`)}
                className="rounded bg-yellow-500 px-3 py-1 text-sm font-semibold text-black hover:bg-yellow-400"
              >
                进入
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: 验证编译**

Run: `pnpm -C packages/client exec tsc --noEmit`
Expected: 无错误

- [ ] **Step 6: 提交**

```bash
git add packages/client/src/pages/Home.tsx
git commit -m "feat(P4-8): 首页添加人机对战按钮和房间列表"
```

---

### Task 9: 客户端 — Room.tsx 添加机器人/踢人/解散按钮

**Files:**

- Modify: `packages/client/src/pages/Room.tsx`

- [ ] **Step 1: 从 useRoomStore 解构新方法**

将现有的解构改为：

```typescript
const {
  room,
  chatMessages,
  error,
  joinRoom,
  leaveRoom,
  toggleReady,
  startGame,
  sendChat,
  addBot,
  kickPlayer,
  dissolveRoom,
} = useRoomStore();
```

- [ ] **Step 2: 在 Header 的"离开房间"按钮旁添加"解散房间"按钮（仅房主可见）**

在 Header 区域，`handleCopyLink` 按钮之后添加解散按钮。将整个 Header `div` 替换为：

```tsx
<div className="flex items-center justify-between border-b border-green-700 px-6 py-3">
  <button onClick={handleLeave} className="text-green-300 hover:text-white">
    &larr; 离开房间
  </button>
  <div className="text-center">
    <span className="text-lg font-bold">房间 {roomId}</span>
  </div>
  <div className="flex gap-2">
    <button
      onClick={handleCopyLink}
      className="rounded bg-green-700 px-3 py-1 text-sm hover:bg-green-600"
    >
      复制邀请链接
    </button>
    {isHost && (
      <button
        onClick={() => {
          if (confirm('确定要解散房间吗？所有玩家将被踢出。')) {
            dissolveRoom();
          }
        }}
        className="rounded bg-red-700 px-3 py-1 text-sm hover:bg-red-600"
      >
        解散房间
      </button>
    )}
  </div>
</div>
```

- [ ] **Step 3: 在座位卡片上添加"踢出"按钮（房主可见）**

在座位渲染的 `{player ? (` 分支内，`<p className="mt-1 text-xs text-green-400">` 之后添加踢出按钮：

```tsx
{
  isHost && player.userId !== user.id && (
    <button
      onClick={() => kickPlayer(seatIdx)}
      className="mt-1 rounded bg-red-800 px-2 py-0.5 text-xs text-red-300 hover:bg-red-700"
    >
      踢出
    </button>
  );
}
```

- [ ] **Step 4: 在空座位区域添加"添加机器人"按钮（房主可见）**

将空座位的渲染从：

```tsx
) : (
  <p className="text-green-500">空座位</p>
)}
```

替换为：

```tsx
) : (
  <div className="flex flex-col items-center gap-2">
    <p className="text-green-500">空座位</p>
    {isHost && (
      <button
        onClick={addBot}
        className="rounded bg-green-700 px-3 py-1 text-xs hover:bg-green-600"
      >
        + 机器人
      </button>
    )}
  </div>
)}
```

- [ ] **Step 5: 验证编译**

Run: `pnpm -C packages/client exec tsc --noEmit`
Expected: 无错误

- [ ] **Step 6: 提交**

```bash
git add packages/client/src/pages/Room.tsx
git commit -m "feat(P4-9): 房间页面添加机器人/踢人/解散按钮"
```

---

### Task 10: 端到端验证

**Files:** 无新建文件

- [ ] **Step 1: 构建 shared 包**

Run: `pnpm -C packages/shared run build`
Expected: Build success

- [ ] **Step 2: 运行服务端全量测试**

Run: `pnpm -C packages/server test`
Expected: 所有测试通过（包括新增的 bot 测试）

- [ ] **Step 3: TypeScript 全量类型检查**

Run: `pnpm -C packages/server exec tsc --noEmit && pnpm -C packages/client exec tsc --noEmit`
Expected: 无错误

- [ ] **Step 4: 提交最终状态（如有格式化修改）**

```bash
git add -A
git status
# 如果有变更则提交
git commit -m "chore(P4): 人机模式与房间管理最终验证"
```
