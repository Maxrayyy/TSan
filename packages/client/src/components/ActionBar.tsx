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
      <div className="flex items-center justify-center py-2 sm:py-3 text-sm sm:text-base text-green-400">
        等待其他玩家...
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center gap-1.5 sm:gap-3 py-2 sm:py-3">
      {canPass && (
        <button
          onClick={onPass}
          className="rounded-lg bg-gray-600 px-3 py-1.5 sm:px-6 sm:py-2 text-sm sm:text-base font-semibold text-white active:bg-gray-500 hover:bg-gray-500"
        >
          不要
        </button>
      )}
      <button
        onClick={onHint}
        className="rounded-lg bg-blue-600 px-3 py-1.5 sm:px-6 sm:py-2 text-sm sm:text-base font-semibold text-white active:bg-blue-500 hover:bg-blue-500"
      >
        提示
      </button>
      <button
        onClick={onClear}
        className="hidden sm:inline-block rounded-lg bg-gray-600 px-4 py-2 text-sm text-white hover:bg-gray-500"
      >
        清空
      </button>
      <button
        onClick={onPlay}
        disabled={selectedCards.length === 0}
        className="rounded-lg bg-yellow-500 px-4 py-1.5 sm:px-8 sm:py-2 text-sm sm:text-base font-bold text-black active:bg-yellow-400 hover:bg-yellow-400 disabled:opacity-40"
      >
        出牌
      </button>
    </div>
  );
}
