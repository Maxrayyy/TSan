// packages/client/src/components/Timer.tsx
interface TimerProps {
  seconds: number;
  total: number;
}

export default function Timer({ seconds, total }: TimerProps) {
  const pct = total > 0 ? (seconds / total) * 100 : 0;
  const isUrgent = seconds <= 5;

  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-24 overflow-hidden rounded-full bg-gray-700">
        <div
          className={`h-full rounded-full transition-all ${isUrgent ? 'bg-red-500' : 'bg-green-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span
        className={`text-sm font-mono ${isUrgent ? 'text-red-400 animate-pulse' : 'text-gray-300'}`}
      >
        {seconds}s
      </span>
    </div>
  );
}
