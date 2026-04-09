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
  return (
    <div className={`flex flex-col items-center gap-1 ${isCurrentTurn ? 'scale-105' : ''}`}>
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
      <span className="text-xs font-medium text-white">{player.nickname}</span>
      {player.rank === null ? (
        <span className="text-xs text-green-300">{player.cardCount} 张</span>
      ) : (
        <span className="text-xs font-bold text-yellow-400">{RANK_LABELS[player.rank]}</span>
      )}
      <span className="text-xs text-gray-400">得分: {player.score}</span>
      {player.isTeammate && (
        <span className="rounded bg-blue-800 px-1 text-[10px] text-blue-300">队友</span>
      )}
    </div>
  );
}
