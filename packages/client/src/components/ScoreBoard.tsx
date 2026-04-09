// packages/client/src/components/ScoreBoard.tsx
interface ScoreBoardProps {
  teamScores: [number, number];
  myTeamIndex: 0 | 1;
}

export default function ScoreBoard({ teamScores, myTeamIndex }: ScoreBoardProps) {
  return (
    <div className="flex gap-4 rounded-lg bg-black/30 px-4 py-2 text-sm">
      <div className={`${myTeamIndex === 0 ? 'text-yellow-400 font-bold' : 'text-gray-300'}`}>
        A队: {teamScores[0]} 分
      </div>
      <div className="text-gray-600">|</div>
      <div className={`${myTeamIndex === 1 ? 'text-yellow-400 font-bold' : 'text-gray-300'}`}>
        B队: {teamScores[1]} 分
      </div>
    </div>
  );
}
