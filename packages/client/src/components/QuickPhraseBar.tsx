// packages/client/src/components/QuickPhraseBar.tsx
import { QUICK_PHRASES } from '@tuosan/shared';

interface QuickPhraseBarProps {
  onSend: (message: string) => void;
}

export default function QuickPhraseBar({ onSend }: QuickPhraseBarProps) {
  return (
    <div className="flex flex-wrap gap-1 sm:gap-1.5">
      {QUICK_PHRASES.map((phrase) => (
        <button
          key={phrase}
          onClick={() => onSend(phrase)}
          className="rounded-full bg-green-700 px-2 py-0.5 text-[10px] sm:px-3 sm:py-1 sm:text-xs text-green-200 hover:bg-green-600 active:bg-green-500"
        >
          {phrase}
        </button>
      ))}
    </div>
  );
}
