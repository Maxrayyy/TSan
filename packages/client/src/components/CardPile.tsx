// packages/client/src/components/CardPile.tsx
import type { Card as CardType, HandType } from '@tuosan/shared';
import { HAND_TYPE_DISPLAY } from '@tuosan/shared';
import Card from './Card.js';

interface CardPileProps {
  cards: CardType[] | null;
  handType: HandType | null;
  playerName?: string;
}

export default function CardPile({ cards, handType, playerName }: CardPileProps) {
  if (!cards || cards.length === 0) {
    return (
      <div className="flex h-28 w-64 items-center justify-center rounded-xl border border-dashed border-green-600 text-green-600">
        等待出牌
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1">
      {playerName && <span className="text-xs text-green-300">{playerName}</span>}
      <div className="flex gap-0.5">
        {cards.map((card) => (
          <Card key={`${card.suit}-${card.rank}`} card={card} size="sm" />
        ))}
      </div>
      {handType && (
        <span className="text-xs text-yellow-400">{HAND_TYPE_DISPLAY[handType.type]}</span>
      )}
    </div>
  );
}
