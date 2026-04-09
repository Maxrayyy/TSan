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

  return (
    <div className="flex justify-center gap-0.5">
      {cards.map((card, i) => (
        <div
          key={`${card.suit}-${card.rank}`}
          style={{ marginLeft: i === 0 ? 0 : '-12px', zIndex: i }}
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
