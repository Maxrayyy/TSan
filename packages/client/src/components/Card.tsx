// packages/client/src/components/Card.tsx
import type { Card as CardType } from '@tuosan/shared';
import { RANK_DISPLAY, SUIT_SYMBOL, SUIT_COLOR } from '@tuosan/shared';

interface CardProps {
  card: CardType;
  selected?: boolean;
  onClick?: () => void;
  size?: 'sm' | 'md' | 'lg';
  faceDown?: boolean;
}

export default function Card({ card, selected, onClick, size = 'md', faceDown }: CardProps) {
  const sizeClasses = {
    sm: 'w-8 h-12 text-xs',
    md: 'w-12 h-18 text-sm',
    lg: 'w-16 h-24 text-base',
  };

  if (faceDown) {
    return (
      <div
        className={`${sizeClasses[size]} flex items-center justify-center rounded-lg border border-gray-600 bg-blue-800`}
      >
        <span className="text-blue-400">🂠</span>
      </div>
    );
  }

  const color = SUIT_COLOR[card.suit];
  const textColor = color === 'red' ? 'text-red-600' : 'text-gray-900';

  return (
    <div
      onClick={onClick}
      className={`${sizeClasses[size]} relative flex cursor-pointer flex-col items-center justify-between rounded-lg border bg-white p-0.5 shadow-sm transition-transform ${
        selected
          ? '-translate-y-3 border-yellow-400 ring-2 ring-yellow-400'
          : 'border-gray-300 hover:-translate-y-1'
      }`}
    >
      <div className={`self-start text-left font-bold leading-none ${textColor}`}>
        <div>{RANK_DISPLAY[card.rank]}</div>
        <div>{SUIT_SYMBOL[card.suit]}</div>
      </div>
      <div className={`text-xl leading-none ${textColor}`}>{SUIT_SYMBOL[card.suit]}</div>
    </div>
  );
}
