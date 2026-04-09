# 人机模式与房间管理设计文档

## 概述

本文档描述两个功能模块：

1. **人机模式**：支持单人对战 3 个 AI 机器人，方便测试
2. **房间管理增强**：房间列表、解散房间、踢人

---

## 一、人机模式

### 1.1 机器人身份

- userId 格式：`bot_0`、`bot_1`、`bot_2`
- 昵称：`机器人A`、`机器人B`、`机器人C`
- `RoomPlayer` 接口新增 `isBot: boolean` 字段（默认 false）
- 机器人没有真实 Socket 连接，不参与 JWT 认证

### 1.2 出牌策略（随机策略）

- **首出**：从手牌中随机选一张 rank !== 3 的单牌打出；若全是 3 则出第一张
- **跟牌**：从手牌中随机选一张 rank 大于 lastPlay 的单牌；没有能压的就 pass
- 仅出单牌，不出对子/顺子等复杂牌型
- 每次出牌前加 200-500ms 随机延迟，模拟思考时间

### 1.3 服务端流转

核心改动在 `notifyNextPlayer()`：

```
notifyNextPlayer(io, roomId, seatIndex)
  ├── 该座位是机器人？
  │   ├── 是 → 延迟后调用 botPlay(io, roomId, seatIndex)
  │   │        botPlay 内部：
  │   │          1. 计算出牌/pass
  │   │          2. 调用 engine.play() 或 engine.pass()
  │   │          3. 广播 game:played / game:passed 给真实玩家
  │   │          4. 调用 handlePostPlay() 或 handleRoundEndCheck()
  │   │          5. 上述函数会递归调用 notifyNextPlayer()
  │   │             如果下家也是机器人则继续自动出牌
  │   └── 否 → 原有逻辑：发 game:your-turn + 启动计时器
```

### 1.4 新增文件

- `packages/server/src/game/bot.ts` — 机器人出牌策略 + botPlay 调度函数

### 1.5 入口

#### 首页"人机对战"按钮

- 新增 REST API：`POST /api/room/bot-game`
- 流程：创建房间 → 填充 3 个机器人到空位 → 机器人自动准备 → 设置状态为 playing → 创建 GameEngine → 返回 roomId
- 客户端收到 roomId 后通过 Socket 加入房间，服务端发 `game:start`

#### 房间内"添加机器人"按钮

- 新增 Socket 事件 `room:add-bot`（客户端 → 服务端）
- 仅房主可操作
- 服务端找到第一个空位，填入一个机器人，自动标记为已准备
- 广播 `room:player-joined` 给房间内其他玩家

---

## 二、房间管理增强

### 2.1 房间列表（我的房间）

#### 数据存储

- Redis 新增集合：`tuosan:user-rooms:{userId}`，存储该用户关联的房间 ID
- 创建房间、加入房间时写入；房间销毁时清理

#### REST API

- `GET /api/room/my-rooms` — 返回用户关联的、仍存在的房间列表
- 响应格式：`{ rooms: Array<{ roomId, playerCount, status, createdAt }> }`

#### 客户端

- 首页"我的房间"区域：展示房间列表
- 每项显示：房间号、人数（如 2/4）、状态标签（等待中/游戏中）
- waiting 状态的房间显示"进入"按钮，点击跳转 `/room/{roomId}`

### 2.2 解散房间

#### 权限

- 仅房主可解散

#### 事件流

1. 客户端发送 `room:dissolve`
2. 服务端校验房主身份
3. 清理 Redis 房间数据 + 所有关联用户的 user-rooms 集合
4. 向房间广播 `room:dissolved` 事件
5. 所有客户端收到后跳回首页

#### 客户端

- 房间页面房主可见"解散房间"按钮
- 点击弹出确认对话框
- 收到 `room:dissolved` 后 `reset()` 并 `navigate('/')`

### 2.3 踢人

#### 权限

- 仅房主可踢人
- 不能踢自己，不能踢机器人（机器人用"移除机器人"方式处理）

#### 事件流

1. 客户端发送 `room:kick`，携带 `{ seatIndex: number }`
2. 服务端校验房主身份 + 目标存在
3. 调用 `leaveRoom()` 移除目标玩家
4. 向被踢者的 Socket 发送 `room:kicked` 事件
5. 向房间广播 `room:player-left` + 更新后的 `room:state`
6. 强制被踢者的 Socket 离开房间（`socket.leave(roomId)`）

#### 客户端

- 房间页面中，房主在每个非自己的真实玩家座位上可见"踢出"图标按钮
- 被踢者收到 `room:kicked` 后提示"你已被踢出房间"并跳回首页

### 2.4 退出房间

- 现有"离开房间"行为保持不变
- 非房主退出：房间继续存在，其他玩家收到更新
- 房主退出：房间自动解散（复用解散逻辑），所有人回首页

---

## 三、类型变更

### shared/src/types/room.ts

```typescript
export interface RoomPlayer {
  userId: string;
  nickname: string;
  avatar: string;
  seatIndex: number;
  isReady: boolean;
  isHost: boolean;
  isBot: boolean; // 新增
}
```

### shared/src/types/events.ts

```typescript
// 客户端 → 服务端（新增）
'room:add-bot': () => void;
'room:kick': (data: { seatIndex: number }) => void;
'room:dissolve': () => void;

// 服务端 → 客户端（新增）
'room:kicked': () => void;
'room:dissolved': () => void;
```

### REST API（新增）

```
POST /api/room/bot-game  → { roomId: string }
GET  /api/room/my-rooms  → { rooms: RoomSummary[] }
```

---

## 四、文件影响范围

| 文件                                          | 变更类型 | 说明                                   |
| --------------------------------------------- | -------- | -------------------------------------- |
| `packages/shared/src/types/room.ts`           | 修改     | RoomPlayer 加 isBot                    |
| `packages/shared/src/types/events.ts`         | 修改     | 新增 Socket 事件类型                   |
| `packages/server/src/game/bot.ts`             | 新建     | 机器人出牌策略                         |
| `packages/server/src/services/roomService.ts` | 修改     | addBot、dissolveRoom、用户房间集合管理 |
| `packages/server/src/routes/room.ts`          | 修改     | bot-game、my-rooms API                 |
| `packages/server/src/socket/roomHandler.ts`   | 修改     | add-bot、kick、dissolve 事件处理       |
| `packages/server/src/socket/gameHandler.ts`   | 修改     | notifyNextPlayer 加机器人检测          |
| `packages/client/src/pages/Home.tsx`          | 修改     | 人机对战按钮 + 房间列表                |
| `packages/client/src/pages/Room.tsx`          | 修改     | 添加机器人、踢人、解散按钮             |
| `packages/client/src/stores/useRoomStore.ts`  | 修改     | 新事件监听                             |
