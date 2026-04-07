# 宿松拖三 - API 接口设计文档

> 版本: v1.0 | 日期: 2026-04-07

---

## 1. 通用约定

### 1.1 基础URL
```
开发环境: http://localhost:3000/api
生产环境: https://api.tuosan.example.com/api
```

### 1.2 请求/响应格式
- Content-Type: `application/json`
- 字符编码: UTF-8

### 1.3 统一响应结构

```typescript
// 成功
{
  "success": true,
  "data": { ... }
}

// 失败
{
  "success": false,
  "error": {
    "code": "ROOM_NOT_FOUND",
    "message": "房间不存在或已解散"
  }
}
```

### 1.4 认证
- 需要认证的接口在 Header 中携带: `Authorization: Bearer <access_token>`
- 标记 `[Auth]` 的接口需要认证
- 标记 `[Guest]` 的接口游客token也可访问

### 1.5 错误码

| HTTP状态码 | 错误码 | 说明 |
|-----------|--------|------|
| 400 | INVALID_PARAMS | 请求参数错误 |
| 401 | UNAUTHORIZED | 未登录或token过期 |
| 403 | FORBIDDEN | 无权限 |
| 404 | NOT_FOUND | 资源不存在 |
| 409 | CONFLICT | 冲突（如已在房间中） |
| 429 | RATE_LIMITED | 请求过于频繁 |
| 500 | INTERNAL_ERROR | 服务器内部错误 |

---

## 2. 认证接口

### 2.1 游客登录

最简登录方式，MVP核心。

```
POST /api/auth/guest
```

**请求体:**
```json
{
  "nickname": "张三"
}
```

**响应:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "clxyz123456",
      "nickname": "张三",
      "avatar": "default_01",
      "isGuest": true
    },
    "accessToken": "eyJhbGciOi...",
    "refreshToken": "eyJhbGciOi...",
    "expiresIn": 86400
  }
}
```

**验证规则:**
- nickname: 1-20字符，不能为空白

---

### 2.2 注册

```
POST /api/auth/register
```

**请求体:**
```json
{
  "nickname": "张三",
  "email": "zhangsan@example.com",
  "password": "SecurePass123"
}
```

**响应:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "clxyz123456",
      "nickname": "张三",
      "avatar": "default_01",
      "isGuest": false
    },
    "accessToken": "eyJhbGciOi...",
    "refreshToken": "eyJhbGciOi...",
    "expiresIn": 7200
  }
}
```

**验证规则:**
- nickname: 1-20字符
- email: 合法邮箱格式，唯一
- password: 至少8字符，包含字母和数字

**错误:**
- `EMAIL_EXISTS`: 邮箱已被注册

---

### 2.3 登录

```
POST /api/auth/login
```

**请求体:**
```json
{
  "email": "zhangsan@example.com",
  "password": "SecurePass123"
}
```

**响应:** 同注册

**错误:**
- `INVALID_CREDENTIALS`: 邮箱或密码错误

---

### 2.4 刷新Token

```
POST /api/auth/refresh
```

**请求体:**
```json
{
  "refreshToken": "eyJhbGciOi..."
}
```

**响应:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOi...(new)",
    "expiresIn": 7200
  }
}
```

---

## 3. 用户接口

### 3.1 获取个人信息 [Auth] [Guest]

```
GET /api/user/profile
```

**响应:**
```json
{
  "success": true,
  "data": {
    "id": "clxyz123456",
    "nickname": "张三",
    "avatar": "default_01",
    "isGuest": true,
    "createdAt": "2026-04-07T10:00:00.000Z"
  }
}
```

---

### 3.2 更新个人信息 [Auth]

```
PUT /api/user/profile
```

**请求体:**
```json
{
  "nickname": "李四",
  "avatar": "default_05"
}
```

**响应:**
```json
{
  "success": true,
  "data": {
    "id": "clxyz123456",
    "nickname": "李四",
    "avatar": "default_05"
  }
}
```

---

### 3.3 获取战绩统计 [Auth] [Guest]

```
GET /api/user/stats
```

**响应:**
```json
{
  "success": true,
  "data": {
    "totalGames": 156,
    "totalWins": 89,
    "winRate": 0.5705,
    "totalFirstPlace": 42,
    "totalTuoSan": 78,
    "totalBieSan": 31,
    "totalScore": 12450,
    "maxWinStreak": 7,
    "currentStreak": 3,
    "totalShuangDaiHua": 5
  }
}
```

---

### 3.4 获取对局历史 [Auth] [Guest]

```
GET /api/user/games?page=1&limit=20
```

**响应:**
```json
{
  "success": true,
  "data": {
    "games": [
      {
        "id": "game_abc123",
        "startedAt": "2026-04-07T14:30:00.000Z",
        "endedAt": "2026-04-07T14:45:00.000Z",
        "gameVersion": "one_deck",
        "myRank": 1,
        "myRankTitle": "头游",
        "myScore": 85,
        "myTuoSan": 2,
        "myBieSan": 0,
        "teamWon": true,
        "isShuangDaiHua": false,
        "teamAScore": 95,
        "teamBScore": 55,
        "players": [
          { "nickname": "张三", "seatIndex": 0, "rank": 1 },
          { "nickname": "李四", "seatIndex": 1, "rank": 3 },
          { "nickname": "王五", "seatIndex": 2, "rank": 2 },
          { "nickname": "赵六", "seatIndex": 3, "rank": 4 }
        ]
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 156,
      "totalPages": 8
    }
  }
}
```

---

## 4. 房间接口

### 4.1 创建房间 [Auth] [Guest]

```
POST /api/room/create
```

**请求体:**
```json
{
  "gameVersion": "one_deck",
  "targetScore": 2000,
  "allowWatch": false
}
```

**响应:**
```json
{
  "success": true,
  "data": {
    "roomId": "ABC123",
    "inviteLink": "https://tuosan.example.com/join/ABC123"
  }
}
```

**验证规则:**
- gameVersion: "one_deck" | "three_deck"
- targetScore: 正整数，100-10000
- allowWatch: boolean

**错误:**
- `ALREADY_IN_ROOM`: 用户已在其他房间中

---

### 4.2 查询房间信息

```
GET /api/room/:roomId
```

**响应:**
```json
{
  "success": true,
  "data": {
    "id": "ABC123",
    "status": "waiting",
    "config": {
      "gameVersion": "one_deck",
      "targetScore": 2000,
      "allowWatch": false
    },
    "seats": [
      { "userId": "u1", "nickname": "张三", "avatar": "default_01", "ready": true },
      null,
      { "userId": "u3", "nickname": "王五", "avatar": "default_03", "ready": false },
      null
    ],
    "hostUserId": "u1",
    "playerCount": 2,
    "createdAt": 1712505600000
  }
}
```

**错误:**
- `ROOM_NOT_FOUND`: 房间不存在

---

## 5. Socket.IO 事件详细规格

### 5.1 连接

```typescript
// 客户端连接时携带认证信息
const socket = io('wss://api.tuosan.example.com', {
  auth: {
    token: accessToken
  }
});

// 服务端中间件验证
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  // 验证JWT...
  next();
});
```

---

### 5.2 房间事件

#### `room:join` (C→S)

加入房间并入座。

```typescript
// 发送
socket.emit('room:join', { 
  roomId: 'ABC123', 
  seatIndex: 1  // 可选，不传则自动分配空座位
});

// 成功回调
socket.on('room:state', (state: RoomState) => {
  // 收到完整房间状态
});

// 失败
socket.on('error', (err) => {
  // err.code: 'ROOM_NOT_FOUND' | 'ROOM_FULL' | 'SEAT_TAKEN' | 'ALREADY_IN_ROOM'
});
```

#### `room:leave` (C→S)

离开房间。

```typescript
socket.emit('room:leave');
// 其他人收到:
socket.on('room:player-left', ({ userId, seatIndex }) => { ... });
```

#### `room:ready` (C→S)

切换准备状态。

```typescript
socket.emit('room:ready');
// 所有人收到:
socket.on('room:player-ready', ({ userId, seatIndex }) => { ... });
```

#### `room:start` (C→S)

房主开始游戏（需4人全部准备）。

```typescript
socket.emit('room:start');

// 错误:
// 'NOT_HOST': 不是房主
// 'NOT_ENOUGH_PLAYERS': 人数不足
// 'NOT_ALL_READY': 有人未准备
```

---

### 5.3 游戏事件

#### `game:start` (S→C)

游戏开始，每个玩家收到自己的手牌。

```typescript
socket.on('game:start', (data) => {
  // data.hand: Card[]          — 自己的13张牌（已排序）
  // data.mySeat: number        — 自己的座位号
  // data.firstPlayerSeat: number — 谁先出牌
  // data.playerInfo: Array<{   — 所有玩家信息（不含手牌）
  //   seatIndex, userId, nickname, avatar, cardCount
  // }>
});
```

#### `game:your-turn` (S→C)

轮到你出牌。

```typescript
socket.on('game:your-turn', (data) => {
  // data.timeLimit: number      — 剩余秒数
  // data.isLeading: boolean     — 是否接风（接风不能出3）
  // data.lastPlay: {            — 场上当前最大牌（接风时为null）
  //   cards: Card[],
  //   handType: HandType
  // } | null
});
```

#### `game:play` (C→S)

出牌。

```typescript
socket.emit('game:play', {
  cards: [
    { suit: 'heart', rank: 10 },
    { suit: 'spade', rank: 10 }
  ]
});

// 成功 → 所有人收到 game:played
// 失败 → 发送者收到 error
```

#### `game:played` (S→C)

有人出牌（广播给所有人）。

```typescript
socket.on('game:played', (data) => {
  // data.playerSeat: number
  // data.cards: Card[]         — 打出的牌
  // data.handType: HandType    — 牌型
  // data.remainingCards: number — 该玩家剩余手牌数
});
```

#### `game:pass` (C→S)

不要。

```typescript
socket.emit('game:pass');
// 所有人收到 game:passed
```

#### `game:passed` (S→C)

```typescript
socket.on('game:passed', (data) => {
  // data.playerSeat: number
});
```

#### `game:round-end` (S→C)

一个回合结束（所有人pass后）。

```typescript
socket.on('game:round-end', (data) => {
  // data.winnerSeat: number     — 赢家座位
  // data.scoreGained: number    — 本回合得分
  // data.teamScores: [number, number] — 队伍总分
});
```

#### `game:tuo-san` (S→C)

拖三触发。

```typescript
socket.on('game:tuo-san', (data) => {
  // data.playerSeat: number
  // data.count: number          — 拖了几个3
  // data.score: number          — 得分
});
```

#### `game:bie-san` (S→C)

憋三触发（游戏结束时）。

```typescript
socket.on('game:bie-san', (data) => {
  // data.playerSeat: number
  // data.count: number
  // data.score: number          — 扣分（正数表示扣多少）
});
```

#### `game:player-finished` (S→C)

某人出完牌。

```typescript
socket.on('game:player-finished', (data) => {
  // data.playerSeat: number
  // data.rank: number           — 1=头游, 2=二游, 3=三游
  // data.rankTitle: string      — "头游" | "二游" | "三游"
});
```

#### `game:end` (S→C)

游戏结束。

```typescript
socket.on('game:end', (data) => {
  // data.result: GameResult     — 完整结算结果
  // GameResult 结构见数据模型文档
});
```

#### `game:reconnect` (S→C)

断线重连时恢复游戏状态。

```typescript
socket.on('game:reconnect', (data) => {
  // data.phase: GamePhase
  // data.hand: Card[]           — 自己当前手牌
  // data.mySeat: number
  // data.currentPlayerSeat: number
  // data.lastPlay: { ... } | null
  // data.teamScores: [number, number]
  // data.players: Array<{
  //   seatIndex, nickname, cardCount, rank, connected
  // }>
});
```

---

### 5.4 聊天事件

#### `room:chat` (C→S)

```typescript
socket.emit('room:chat', { message: '快点啊！' });
```

#### `room:chat` (S→C)

```typescript
socket.on('room:chat', (data) => {
  // data.userId: string
  // data.message: string
  // data.timestamp: number
});
```

**限制:**
- 消息长度: 1-200字符
- 频率限制: 每秒最多2条

---

## 6. 错误码速查表

| 错误码 | HTTP | 说明 |
|--------|------|------|
| `INVALID_PARAMS` | 400 | 请求参数不合法 |
| `UNAUTHORIZED` | 401 | 未登录 |
| `TOKEN_EXPIRED` | 401 | Token过期 |
| `FORBIDDEN` | 403 | 无权操作 |
| `NOT_HOST` | 403 | 不是房主 |
| `ROOM_NOT_FOUND` | 404 | 房间不存在 |
| `ROOM_FULL` | 409 | 房间已满 |
| `SEAT_TAKEN` | 409 | 座位已被占 |
| `ALREADY_IN_ROOM` | 409 | 已在其他房间中 |
| `NOT_ENOUGH_PLAYERS` | 400 | 人数不足4人 |
| `NOT_ALL_READY` | 400 | 有人未准备 |
| `NOT_YOUR_TURN` | 400 | 不是你的回合 |
| `INVALID_PLAY` | 400 | 出牌不合法 |
| `CARDS_NOT_IN_HAND` | 400 | 你没有这些牌 |
| `CANNOT_PLAY_THREE` | 400 | 接风时不能出3 |
| `CANNOT_BEAT` | 400 | 你的牌不够大 |
| `GAME_NOT_STARTED` | 400 | 游戏未开始 |
| `EMAIL_EXISTS` | 409 | 邮箱已注册 |
| `INVALID_CREDENTIALS` | 401 | 账号或密码错误 |
| `RATE_LIMITED` | 429 | 请求过于频繁 |
| `INTERNAL_ERROR` | 500 | 服务器内部错误 |
