// packages/client/src/components/CardPile.tsx
import type { Card as CardType, HandType } from '@tuosan/shared';
import { HAND_TYPE_DISPLAY, HandTypeEnum } from '@tuosan/shared';
import Card from './Card.js';

interface CardPileProps {
  cards: CardType[] | null;
  handType: HandType | null;
  playerName?: string;
}

const SPECIAL_TYPES = new Set([
  HandTypeEnum.BOMB,
  HandTypeEnum.PURE_FTK,
  HandTypeEnum.PURE_DRAGON,
  HandTypeEnum.TIAN_LONG,
  HandTypeEnum.PURE_TIAN_LONG,
]);

export default function CardPile({ cards, handType, playerName }: CardPileProps) {
  if (!cards || cards.length === 0) {
    return (
      <div className="flex h-28 w-64 items-center justify-center rounded-xl border border-dashed border-green-600 text-green-600">
        等待出牌
      </div>
    );
  }

  const isSpecial = handType && SPECIAL_TYPES.has(handType.type);

  return (
    <div
      className={`flex flex-col items-center gap-1 animate-card-play ${isSpecial ? 'animate-special-flash' : ''}`}
    >
      {playerName && <span className="text-xs text-green-300">{playerName}</span>}
      <div className="flex gap-0.5">
        {cards.map((card) => (
          <Card key={`${card.suit}-${card.rank}`} card={card} size="sm" />
        ))}
      </div>
      {handType && (
        <span className={`text-xs ${isSpecial ? 'font-bold text-red-400' : 'text-yellow-400'}`}>
          {HAND_TYPE_DISPLAY[handType.type]}
          {isSpecial && ' !'}
        </span>
      )}
    </div>
  );
}
