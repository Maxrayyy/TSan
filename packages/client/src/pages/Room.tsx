import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useRoomStore } from '../stores/useRoomStore.js';
import { useAuthStore } from '../stores/useAuthStore.js';
import { useGameStore } from '../stores/useGameStore.js';
import QuickPhraseBar from '../components/QuickPhraseBar.js';

export default function Room() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
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
  const [chatInput, setChatInput] = useState('');
  const { gameState } = useGameStore();

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }
    if (roomId) {
      joinRoom(roomId);
    }
    return () => {
      leaveRoom();
    };
  }, [roomId, user]);

  useEffect(() => {
    if (gameState && roomId) {
      navigate(`/game/${roomId}`);
    }
  }, [gameState, roomId, navigate]);

  if (!user) return null;

  const handleLeave = () => {
    leaveRoom();
    navigate('/');
  };

  const handleCopyLink = () => {
    const link = `${window.location.origin}/join/${roomId}`;
    navigator.clipboard.writeText(link);
  };

  const handleSendChat = () => {
    if (!chatInput.trim()) return;
    sendChat(chatInput.trim());
    setChatInput('');
  };

  const isHost = room?.hostUserId === user.id;
  const myPlayer = room ? Object.values(room.players).find((p) => p?.userId === user.id) : null;

  const seats = [0, 1, 2, 3];

  return (
    <div className="flex min-h-screen flex-col bg-green-800 text-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-green-700 px-3 py-2 sm:px-6 sm:py-3">
        <button
          onClick={handleLeave}
          className="text-sm sm:text-base text-green-300 hover:text-white"
        >
          &larr; 离开
        </button>
        <div className="text-center">
          <span className="text-sm sm:text-lg font-bold">房间 {roomId}</span>
        </div>
        <div className="flex gap-1 sm:gap-2">
          <button
            onClick={handleCopyLink}
            className="rounded bg-green-700 px-2 py-1 text-xs sm:px-3 sm:text-sm hover:bg-green-600"
          >
            复制链接
          </button>
          {isHost && (
            <button
              onClick={() => {
                if (confirm('确定要解散房间吗？所有玩家将被踢出。')) {
                  dissolveRoom();
                }
              }}
              className="rounded bg-red-700 px-2 py-1 text-xs sm:px-3 sm:text-sm hover:bg-red-600"
            >
              解散
            </button>
          )}
        </div>
      </div>

      {error && <div className="bg-red-900/50 px-6 py-2 text-center text-red-300">{error}</div>}

      {/* Seats */}
      <div className="flex flex-1 items-center justify-center">
        <div className="grid grid-cols-2 gap-3 p-4 sm:gap-8 sm:p-8">
          {seats.map((seatIdx) => {
            const player = room?.players[seatIdx];
            const isTeamA = seatIdx % 2 === 0;

            return (
              <div
                key={seatIdx}
                className={`flex h-28 w-36 sm:h-40 sm:w-48 flex-col items-center justify-center rounded-xl border-2 ${
                  player
                    ? isTeamA
                      ? 'border-blue-400 bg-blue-900/30'
                      : 'border-red-400 bg-red-900/30'
                    : 'border-dashed border-green-600 bg-green-900/30'
                }`}
              >
                {player ? (
                  <>
                    <div className="mb-1 sm:mb-2 flex h-9 w-9 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-green-600 text-sm sm:text-xl">
                      {player.nickname[0]}
                    </div>
                    <p className="text-sm sm:text-base font-semibold">{player.nickname}</p>
                    <div className="mt-1 flex gap-1 sm:gap-2">
                      {player.isHost && (
                        <span className="rounded bg-yellow-600 px-1.5 py-0.5 text-[10px] sm:px-2 sm:text-xs">
                          房主
                        </span>
                      )}
                      {player.isReady ? (
                        <span className="rounded bg-green-500 px-1.5 py-0.5 text-[10px] sm:px-2 sm:text-xs">
                          已准备
                        </span>
                      ) : (
                        <span className="rounded bg-gray-600 px-1.5 py-0.5 text-[10px] sm:px-2 sm:text-xs">
                          未准备
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-[10px] sm:text-xs text-green-400">
                      {isTeamA ? 'A队' : 'B队'} - 座位{seatIdx + 1}
                    </p>
                    {isHost && player.userId !== user.id && (
                      <button
                        onClick={() => kickPlayer(seatIdx)}
                        className="mt-1 rounded bg-red-800 px-2 py-0.5 text-[10px] sm:text-xs text-red-300 hover:bg-red-700"
                      >
                        踢出
                      </button>
                    )}
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <p className="text-sm sm:text-base text-green-500">空座位</p>
                    {isHost && (
                      <button
                        onClick={addBot}
                        className="rounded bg-green-700 px-2 py-1 text-xs hover:bg-green-600"
                      >
                        + 机器人
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-green-700 px-3 py-2 sm:px-6 sm:py-4">
        {/* Chat */}
        <div className="mb-2 sm:mb-3 max-h-24 sm:max-h-32 overflow-y-auto rounded bg-green-900/50 p-2 text-xs sm:text-sm">
          {chatMessages.length === 0 ? (
            <p className="text-green-600">暂无消息</p>
          ) : (
            chatMessages.map((msg, i) => (
              <p key={i}>
                <span className="text-yellow-400">{msg.nickname || '?'}</span>: {msg.message}
              </p>
            ))
          )}
        </div>
        <div className="mb-2">
          <QuickPhraseBar onSend={sendChat} />
        </div>
        <div className="flex gap-1.5 sm:gap-2">
          <input
            type="text"
            placeholder="输入消息..."
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
            className="flex-1 rounded-lg bg-green-700 px-3 py-1.5 sm:px-4 sm:py-2 text-sm sm:text-base text-white placeholder-green-400 outline-none"
            maxLength={200}
          />
          <button
            onClick={handleSendChat}
            className="rounded-lg bg-green-600 px-3 py-1.5 sm:px-4 sm:py-2 text-sm sm:text-base hover:bg-green-500"
          >
            发送
          </button>

          {myPlayer && !isHost && (
            <button
              onClick={toggleReady}
              className={`rounded-lg px-3 py-1.5 sm:px-6 sm:py-2 text-sm sm:text-base font-semibold ${
                myPlayer.isReady
                  ? 'bg-gray-600 hover:bg-gray-500'
                  : 'bg-green-500 hover:bg-green-400'
              }`}
            >
              {myPlayer.isReady ? '取消' : '准备'}
            </button>
          )}

          {isHost && (
            <button
              onClick={startGame}
              className="rounded-lg bg-yellow-500 px-3 py-1.5 sm:px-6 sm:py-2 text-sm sm:text-base font-semibold text-black hover:bg-yellow-400"
            >
              开始
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
