// packages/client/src/pages/Game.tsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { TURN_TIMEOUT } from '@tuosan/shared';
import type { Card } from '@tuosan/shared';
import { useGameStore } from '../stores/useGameStore.js';
import { getSocket } from '../services/socket.js';
import CardHand from '../components/CardHand.js';
import PlayerSeat from '../components/PlayerSeat.js';
import CardPile from '../components/CardPile.js';
import ScoreBoard from '../components/ScoreBoard.js';
import Timer from '../components/Timer.js';
import ActionBar from '../components/ActionBar.js';
import { getHints } from '../game/hints.js';
import { useSound } from '../hooks/useSound.js';

export default function Game() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { gameState, selectedCards, gameResult, turnTimer, toggleCardSelection, clearSelection } =
    useGameStore();

  const [hintIndex, setHintIndex] = useState(0);
  const [hints, setHints] = useState<Card[][]>([]);
  const { playCard, playPass, playBomb, playTick, playButton } = useSound();
  const lastEventRef = useGameStore((s) => s.lastEvent);

  // 断线自动重连
  useEffect(() => {
    try {
      const socket = getSocket();
      const handleReconnect = () => {
        // Socket.IO 重连后，请求恢复游戏状态
        socket.emit('game:reconnect-request');
      };
      socket.on('connect', handleReconnect);
      return () => {
        socket.off('connect', handleReconnect);
      };
    } catch {
      // Socket 未初始化
    }
  }, []);

  useEffect(() => {
    if (!gameState) {
      if (roomId) navigate(`/room/${roomId}`);
      else navigate('/');
    }
  }, [gameState, roomId, navigate]);

  useEffect(() => {
    if (gameResult && roomId) {
      navigate(`/result/${roomId}`);
    }
  }, [gameResult, roomId, navigate]);

  // 音效触发
  useEffect(() => {
    if (!lastEventRef) return;
    if (lastEventRef.includes('played')) {
      // 检查是否是炸弹等特殊牌型
      const ht = gameState?.lastPlay?.handType;
      if (ht && ['bomb', 'pure_tian_long', 'tian_long'].includes(ht.type)) {
        playBomb();
      } else {
        playCard();
      }
    } else if (lastEventRef.includes('passed')) {
      playPass();
    }
  }, [lastEventRef, playCard, playPass, playBomb, gameState?.lastPlay?.handType]);

  // 倒计时警告音
  useEffect(() => {
    if (turnTimer > 0 && turnTimer <= 5 && gameState?.isMyTurn) {
      playTick();
    }
  }, [turnTimer, gameState?.isMyTurn, playTick]);

  // 重置提示
  useEffect(() => {
    setHints([]);
    setHintIndex(0);
  }, [gameState?.isMyTurn, gameState?.lastPlay]);

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

  // 将座位映射为相对位置：bottom=自己, right=下家, top=对面, left=上家
  const seatOrder = [mySeat, (mySeat + 1) % 4, (mySeat + 2) % 4, (mySeat + 3) % 4];
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_bottomSeat, rightSeat, topSeat, leftSeat] = seatOrder;

  const handlePlay = () => {
    if (selectedCards.length === 0) return;
    playButton();
    try {
      const socket = getSocket();
      socket.emit('game:play', { cards: selectedCards });
    } catch {
      // Socket 错误
    }
  };

  const handlePass = () => {
    playButton();
    try {
      const socket = getSocket();
      socket.emit('game:pass');
    } catch {
      // Socket 错误
    }
  };

  const handleHint = () => {
    if (hints.length > 0) {
      // 循环切换提示
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

  const canPass = isMyTurn && lastPlay !== null;
  const lastPlayPlayerName = lastPlay ? players[lastPlay.playerSeat]?.nickname : undefined;

  return (
    <div className="flex h-screen flex-col bg-green-900">
      {/* 顶部栏：分数 + 计时器 */}
      <div className="flex items-center justify-between px-4 py-2">
        <ScoreBoard teamScores={teamScores} myTeamIndex={myTeamIndex} />
        {isMyTurn && <Timer seconds={turnTimer} total={TURN_TIMEOUT} />}
        <div className="text-xs text-green-600">房间 {roomId}</div>
      </div>

      {/* 牌桌 */}
      <div className="relative flex flex-1 items-center justify-center">
        {/* 对面玩家 */}
        <div className="absolute top-4">
          <PlayerSeat
            player={players[topSeat]}
            isCurrentTurn={currentPlayerSeat === topSeat}
            position="top"
          />
        </div>

        {/* 左边玩家 */}
        <div className="absolute left-4">
          <PlayerSeat
            player={players[leftSeat]}
            isCurrentTurn={currentPlayerSeat === leftSeat}
            position="left"
          />
        </div>

        {/* 右边玩家 */}
        <div className="absolute right-4">
          <PlayerSeat
            player={players[rightSeat]}
            isCurrentTurn={currentPlayerSeat === rightSeat}
            position="right"
          />
        </div>

        {/* 中央出牌区 */}
        <CardPile
          cards={lastPlay?.cards ?? null}
          handType={lastPlay?.handType ?? null}
          playerName={lastPlayPlayerName}
        />
      </div>

      {/* 底部：我的手牌 + 操作按钮 */}
      <div className="border-t border-green-700 bg-green-800 px-4 pb-4 pt-2">
        {/* 我的信息 + 操作按钮 */}
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

        {/* 我的手牌 */}
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
