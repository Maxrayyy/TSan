// packages/client/src/components/CardHand.tsx
import type { Card as CardType } from '@tuosan/shared';
import Card from './Card.js';

interface CardHandProps {
  cards: CardType[];
  selectedCards: CardType[];
  onToggleCard: (card: CardType) => void;
  disabled?: boolean;
}

export default function CardHand({ cards, selectedCards, onToggleCard, disabled }: CardHandProps) {
  const isSelected = (card: CardType) =>
    selectedCards.some((c) => c.suit === card.suit && c.rank === card.rank);

  // 根据手牌数量动态调整重叠度
  const overlapPx = cards.length > 10 ? -8 : cards.length > 7 ? -10 : -12;

  return (
    <div className="flex justify-center gap-0.5 overflow-x-auto px-2">
      {cards.map((card, i) => (
        <div
          key={`${card.suit}-${card.rank}`}
          className="shrink-0"
          style={{ marginLeft: i === 0 ? 0 : `${overlapPx}px`, zIndex: i }}
        >
          <Card
            card={card}
            selected={isSelected(card)}
            onClick={disabled ? undefined : () => onToggleCard(card)}
            size="md"
          />
        </div>
      ))}
    </div>
  );
}
