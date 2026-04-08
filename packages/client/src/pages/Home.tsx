import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/useAuthStore.js';
import { api } from '../services/api.js';

export default function Home() {
  const navigate = useNavigate();
  const { user, guestLogin, logout, loadUser, isLoading } = useAuthStore();
  const [guestNickname, setGuestNickname] = useState('');
  const [showGuestInput, setShowGuestInput] = useState(false);
  const [roomId, setRoomId] = useState('');
  const [showJoinInput, setShowJoinInput] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const handleGuestStart = async () => {
    if (!showGuestInput) {
      setShowGuestInput(true);
      return;
    }
    if (!guestNickname.trim()) return;
    try {
      await guestLogin(guestNickname.trim());
    } catch {
      // error handled by store
    }
  };

  const handleCreateRoom = async () => {
    setError('');
    try {
      const data = await api.post<{ roomId: string }>('/api/room/create');
      navigate(`/room/${data.roomId}`);
    } catch (err: unknown) {
      setError((err as { message?: string }).message || '创建房间失败');
    }
  };

  const handleJoinRoom = () => {
    if (!showJoinInput) {
      setShowJoinInput(true);
      return;
    }
    if (!roomId.trim()) return;
    navigate(`/room/${roomId.trim().toUpperCase()}`);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-green-900 text-white">
      <h1 className="mb-2 text-5xl font-bold">宿松拖三</h1>
      <p className="mb-8 text-green-300">经典地方扑克牌游戏</p>

      {user ? (
        <div className="flex flex-col items-center gap-4">
          <p className="text-lg">
            欢迎，<span className="font-semibold text-yellow-400">{user.nickname}</span>
            {user.isGuest && <span className="ml-2 text-sm text-green-400">(游客)</span>}
          </p>

          <button
            onClick={handleCreateRoom}
            className="w-64 rounded-lg bg-yellow-500 px-8 py-3 text-lg font-semibold text-black hover:bg-yellow-400"
          >
            创建房间
          </button>

          {showJoinInput ? (
            <div className="flex w-64 gap-2">
              <input
                type="text"
                placeholder="输入房间号"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                className="flex-1 rounded-lg bg-green-700 px-4 py-2 text-white placeholder-green-400 outline-none focus:ring-2 focus:ring-yellow-500"
                maxLength={6}
                onKeyDown={(e) => e.key === 'Enter' && handleJoinRoom()}
              />
              <button
                onClick={handleJoinRoom}
                className="rounded-lg bg-yellow-500 px-4 py-2 font-semibold text-black hover:bg-yellow-400"
              >
                加入
              </button>
            </div>
          ) : (
            <button
              onClick={handleJoinRoom}
              className="w-64 rounded-lg border border-white px-8 py-3 text-lg hover:bg-white/10"
            >
              加入房间
            </button>
          )}

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button onClick={logout} className="mt-4 text-sm text-green-400 hover:text-white">
            退出登录
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4">
          {showGuestInput ? (
            <div className="flex w-64 flex-col gap-2">
              <input
                type="text"
                placeholder="输入昵称"
                value={guestNickname}
                onChange={(e) => setGuestNickname(e.target.value)}
                className="rounded-lg bg-green-700 px-4 py-3 text-center text-white placeholder-green-400 outline-none focus:ring-2 focus:ring-yellow-500"
                maxLength={20}
                onKeyDown={(e) => e.key === 'Enter' && handleGuestStart()}
                autoFocus
              />
              <button
                onClick={handleGuestStart}
                disabled={isLoading || !guestNickname.trim()}
                className="rounded-lg bg-yellow-500 px-8 py-3 text-lg font-semibold text-black hover:bg-yellow-400 disabled:opacity-50"
              >
                {isLoading ? '进入中...' : '开始游戏'}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowGuestInput(true)}
              className="w-64 rounded-lg bg-yellow-500 px-8 py-3 text-lg font-semibold text-black hover:bg-yellow-400"
            >
              快速开始
            </button>
          )}

          <button
            onClick={() => navigate('/login')}
            className="w-64 rounded-lg border border-white px-8 py-3 text-lg hover:bg-white/10"
          >
            登录 / 注册
          </button>
        </div>
      )}
    </div>
  );
}
