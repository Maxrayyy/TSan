import { redis } from '../config/redis.js';
import { AppError } from '../utils/errors.js';
import type { RoomPlayer, RoomState } from '@tuosan/shared';

const ROOM_TTL = 4 * 60 * 60; // 4 hours
const ROOM_PREFIX = 'tuosan:room:';
const USER_ROOM_PREFIX = 'tuosan:user-room:';

function roomKey(roomId: string) {
  return `${ROOM_PREFIX}${roomId}`;
}

function userRoomKey(userId: string) {
  return `${USER_ROOM_PREFIX}${userId}`;
}

const USER_ROOMS_PREFIX = 'tuosan:user-rooms:';

function userRoomsKey(userId: string) {
  return `${USER_ROOMS_PREFIX}${userId}`;
}

async function generateRoomId(): Promise<string> {
  const counter = await redis.incr('tuosan:room-counter');
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = '';
  let n = counter;
  for (let i = 0; i < 6; i++) {
    id = chars[n % chars.length] + id;
    n = Math.floor(n / chars.length);
  }
  // Pad with random chars if needed
  while (id.length < 6) {
    id = chars[Math.floor(Math.random() * chars.length)] + id;
  }
  return id;
}

export async function createRoom(
  userId: string,
  nickname: string,
  avatar: string,
): Promise<{ roomId: string }> {
  // Check if user is already in a room
  const existingRoom = await redis.get(userRoomKey(userId));
  if (existingRoom) {
    throw new AppError(409, '你已在其他房间中', 'ALREADY_IN_ROOM');
  }

  const roomId = await generateRoomId();
  const now = Date.now();

  const player: RoomPlayer = {
    userId,
    nickname,
    avatar,
    seatIndex: 0,
    isReady: false,
    isHost: true,
    isBot: false,
  };

  const roomData: Record<string, string> = {
    id: roomId,
    hostUserId: userId,
    status: 'waiting',
    createdAt: String(now),
    seat_0: JSON.stringify(player),
    seat_1: '',
    seat_2: '',
    seat_3: '',
  };

  await redis.hset(roomKey(roomId), roomData);
  await redis.expire(roomKey(roomId), ROOM_TTL);
  await redis.set(userRoomKey(userId), roomId, 'EX', ROOM_TTL);
  await redis.sadd(userRoomsKey(userId), roomId);
  await redis.expire(userRoomsKey(userId), ROOM_TTL);

  return { roomId };
}

export async function getRoom(roomId: string): Promise<RoomState | null> {
  const data = await redis.hgetall(roomKey(roomId));
  if (!data || !data.id) return null;

  const seats: Record<number, RoomPlayer | null> = {};
  for (let i = 0; i < 4; i++) {
    const raw = data[`seat_${i}`];
    seats[i] = raw ? JSON.parse(raw) : null;
  }

  return {
    roomId: data.id,
    hostUserId: data.hostUserId,
    players: seats,
    maxPlayers: 4,
    status: data.status as 'waiting' | 'playing',
    createdAt: Number(data.createdAt),
  };
}

export async function joinRoom(
  roomId: string,
  userId: string,
  nickname: string,
  avatar: string,
  preferredSeat?: number,
): Promise<{ seatIndex: number; room: RoomState }> {
  const existingRoom = await redis.get(userRoomKey(userId));
  if (existingRoom && existingRoom !== roomId) {
    throw new AppError(409, '你已在其他房间中', 'ALREADY_IN_ROOM');
  }

  const room = await getRoom(roomId);
  if (!room) {
    throw new AppError(404, '房间不存在', 'ROOM_NOT_FOUND');
  }
  if (room.status !== 'waiting') {
    throw new AppError(409, '游戏已开始', 'GAME_IN_PROGRESS');
  }

  // Check if user already in this room
  for (let i = 0; i < 4; i++) {
    if (room.players[i]?.userId === userId) {
      return { seatIndex: i, room };
    }
  }

  // Find available seat
  let seatIndex = -1;
  if (
    preferredSeat !== undefined &&
    preferredSeat >= 0 &&
    preferredSeat < 4 &&
    !room.players[preferredSeat]
  ) {
    seatIndex = preferredSeat;
  } else {
    for (let i = 0; i < 4; i++) {
      if (!room.players[i]) {
        seatIndex = i;
        break;
      }
    }
  }

  if (seatIndex === -1) {
    throw new AppError(409, '房间已满', 'ROOM_FULL');
  }

  const player: RoomPlayer = {
    userId,
    nickname,
    avatar,
    seatIndex,
    isReady: false,
    isHost: false,
    isBot: false,
  };

  await redis.hset(roomKey(roomId), `seat_${seatIndex}`, JSON.stringify(player));
  await redis.set(userRoomKey(userId), roomId, 'EX', ROOM_TTL);
  await redis.sadd(userRoomsKey(userId), roomId);
  await redis.expire(userRoomsKey(userId), ROOM_TTL);

  room.players[seatIndex] = player;
  return { seatIndex, room };
}

export async function leaveRoom(
  roomId: string,
  userId: string,
): Promise<{ seatIndex: number; dissolved: boolean }> {
  const room = await getRoom(roomId);
  if (!room) {
    await redis.del(userRoomKey(userId));
    return { seatIndex: -1, dissolved: true };
  }

  let seatIndex = -1;
  for (let i = 0; i < 4; i++) {
    if (room.players[i]?.userId === userId) {
      seatIndex = i;
      break;
    }
  }

  if (seatIndex === -1) {
    await redis.del(userRoomKey(userId));
    return { seatIndex: -1, dissolved: false };
  }

  await redis.hset(roomKey(roomId), `seat_${seatIndex}`, '');
  await redis.del(userRoomKey(userId));
  await redis.srem(userRoomsKey(userId), roomId);

  // Check if room is empty
  const remaining = Object.values(room.players).filter((p, i) => p && i !== seatIndex);
  if (remaining.length === 0) {
    await redis.del(roomKey(roomId));
    return { seatIndex, dissolved: true };
  }

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
}

export async function setReady(
  roomId: string,
  userId: string,
): Promise<{ seatIndex: number; isReady: boolean }> {
  const room = await getRoom(roomId);
  if (!room) throw new AppError(404, '房间不存在', 'ROOM_NOT_FOUND');

  for (let i = 0; i < 4; i++) {
    const p = room.players[i];
    if (p?.userId === userId) {
      p.isReady = !p.isReady;
      await redis.hset(roomKey(roomId), `seat_${i}`, JSON.stringify(p));
      return { seatIndex: i, isReady: p.isReady };
    }
  }

  throw new AppError(400, '你不在这个房间中', 'NOT_IN_ROOM');
}

export async function canStartGame(roomId: string, userId: string): Promise<void> {
  const room = await getRoom(roomId);
  if (!room) throw new AppError(404, '房间不存在', 'ROOM_NOT_FOUND');
  if (room.hostUserId !== userId) throw new AppError(403, '只有房主可以开始游戏', 'NOT_HOST');

  const players = Object.values(room.players).filter(Boolean) as RoomPlayer[];
  if (players.length < 4) throw new AppError(400, '需要4名玩家', 'NOT_ENOUGH_PLAYERS');

  const allReady = players.every((p) => p.isHost || p.isReady);
  if (!allReady) throw new AppError(400, '有玩家未准备', 'NOT_ALL_READY');
}

export async function setRoomStatus(roomId: string, status: 'waiting' | 'playing') {
  await redis.hset(roomKey(roomId), 'status', status);
}

export async function getUserRoom(userId: string): Promise<string | null> {
  return redis.get(userRoomKey(userId));
}

export async function clearUserRoom(userId: string): Promise<void> {
  await redis.del(userRoomKey(userId));
}

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

  let seatIndex = -1;
  for (let i = 0; i < 4; i++) {
    if (!room.players[i]) {
      seatIndex = i;
      break;
    }
  }
  if (seatIndex === -1) throw new AppError(409, '房间已满', 'ROOM_FULL');

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

export async function removeBot(roomId: string, seatIndex: number): Promise<void> {
  await redis.hset(roomKey(roomId), `seat_${seatIndex}`, '');
}

export async function dissolveRoom(roomId: string, requestUserId: string): Promise<void> {
  const room = await getRoom(roomId);
  if (!room) throw new AppError(404, '房间不存在', 'ROOM_NOT_FOUND');
  if (room.hostUserId !== requestUserId)
    throw new AppError(403, '只有房主可以解散房间', 'NOT_HOST');

  for (let i = 0; i < 4; i++) {
    const player = room.players[i];
    if (player && !player.isBot) {
      await redis.del(userRoomKey(player.userId));
      await redis.srem(userRoomsKey(player.userId), roomId);
    }
  }
  await redis.del(roomKey(roomId));
}

export async function getUserRooms(
  userId: string,
): Promise<Array<{ roomId: string; playerCount: number; status: string; createdAt: number }>> {
  const roomIds = await redis.smembers(userRoomsKey(userId));
  const rooms: Array<{ roomId: string; playerCount: number; status: string; createdAt: number }> =
    [];

  for (const rid of roomIds) {
    const room = await getRoom(rid);
    if (!room) {
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
