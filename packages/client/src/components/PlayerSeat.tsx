// packages/client/src/components/PlayerSeat.tsx
import { RANK_LABELS } from '@tuosan/shared';
import type { ClientPlayerState } from '@tuosan/shared';

interface PlayerSeatProps {
  player: ClientPlayerState;
  isCurrentTurn: boolean;
  position: 'bottom' | 'left' | 'top' | 'right';
}

export default function PlayerSeat({ player, isCurrentTurn, position }: PlayerSeatProps) {
  // position 参数保留供将来使用，布局由父组件控制
  void position;
  const isDisconnected = player.connected === false;

  return (
    <div
      className={`flex flex-col items-center gap-1 ${isCurrentTurn ? 'scale-105' : ''} ${isDisconnected ? 'opacity-50' : ''}`}
    >
      <div
        className={`relative flex h-9 w-9 sm:h-12 sm:w-12 items-center justify-center rounded-full text-sm sm:text-lg font-bold ${
          isDisconnected
            ? 'bg-red-800'
            : isCurrentTurn
              ? 'animate-pulse ring-2 ring-yellow-400 bg-yellow-600'
              : player.isTeammate
                ? 'bg-blue-600'
                : 'bg-gray-600'
        }`}
      >
        {player.nickname[0]}
        {isDisconnected && (
          <span className="absolute -bottom-1 -right-1 rounded-full bg-red-500 px-1 text-[8px] text-white">
            断线
          </span>
        )}
      </div>
      <span className="text-[10px] sm:text-xs font-medium text-white truncate max-w-16 sm:max-w-none">
        {player.nickname}
      </span>
      {player.rank === null ? (
        <span className="text-[10px] sm:text-xs text-green-300">{player.cardCount} 张</span>
      ) : (
        <span className="text-[10px] sm:text-xs font-bold text-yellow-400">
          {RANK_LABELS[player.rank]}
        </span>
      )}
      <span className="hidden sm:inline text-xs text-gray-400">得分: {player.score}</span>
      {player.isTeammate && (
        <span className="rounded bg-blue-800 px-1 text-[10px] text-blue-300">队友</span>
      )}
    </div>
  );
}
