// packages/client/src/pages/Result.tsx
import { useNavigate, useParams } from 'react-router-dom';
import { useGameStore } from '../stores/useGameStore.js';
import { getTeamIndex, RANK_LABELS } from '@tuosan/shared';

export default function Result() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { gameResult, reset } = useGameStore();

  if (!gameResult) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-green-800 text-white">
        <div className="text-center">
          <p className="mb-4 text-xl">无结算数据</p>
          <button
            onClick={() => navigate('/')}
            className="rounded-lg bg-green-600 px-6 py-2 hover:bg-green-500"
          >
            返回首页
          </button>
        </div>
      </div>
    );
  }

  const { rankings, teamScores, isShuangDaiHua } = gameResult;
  const winningTeam = teamScores[0] >= teamScores[1] ? 0 : 1;

  const handlePlayAgain = () => {
    reset();
    navigate(`/room/${roomId}`);
  };

  const handleGoHome = () => {
    reset();
    navigate('/');
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-green-800 p-4 text-white">
      {/* 标题 */}
      <h1 className="mb-2 text-4xl font-bold">{isShuangDaiHua ? '双带花!' : '游戏结束'}</h1>

      {/* 队伍得分 */}
      <div className="mb-6 flex gap-8 text-xl">
        <div
          className={`rounded-lg px-6 py-3 ${winningTeam === 0 ? 'bg-yellow-600 font-bold' : 'bg-gray-700'}`}
        >
          A队: {teamScores[0]} 分
        </div>
        <div
          className={`rounded-lg px-6 py-3 ${winningTeam === 1 ? 'bg-yellow-600 font-bold' : 'bg-gray-700'}`}
        >
          B队: {teamScores[1]} 分
        </div>
      </div>

      {/* 排名表格 */}
      <div className="mb-8 w-full max-w-lg rounded-xl bg-green-900 p-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-green-700 text-green-400">
              <th className="py-2 text-left">排名</th>
              <th className="text-left">玩家</th>
              <th className="text-left">队伍</th>
              <th className="text-right">抓分</th>
              <th className="text-right">拖三</th>
              <th className="text-right">憋三</th>
              <th className="text-right">总分</th>
            </tr>
          </thead>
          <tbody>
            {rankings.map((r) => (
              <tr key={r.seatIndex} className="border-b border-green-800">
                <td className="py-2 text-yellow-400 font-bold">{RANK_LABELS[r.rank]}</td>
                <td>{r.nickname}</td>
                <td className="text-gray-400">{getTeamIndex(r.seatIndex) === 0 ? 'A' : 'B'}队</td>
                <td className="text-right">{r.capturedScore}</td>
                <td className="text-right text-green-400">
                  {r.tuoSanCount > 0 ? `+${r.tuoSanCount}` : '-'}
                </td>
                <td className="text-right text-red-400">
                  {r.bieSanCount > 0 ? `-${r.bieSanCount}` : '-'}
                </td>
                <td className="text-right font-bold">{r.totalScore}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 操作按钮 */}
      <div className="flex gap-4">
        <button
          onClick={handlePlayAgain}
          className="rounded-lg bg-yellow-500 px-8 py-3 font-bold text-black hover:bg-yellow-400"
        >
          再来一局
        </button>
        <button
          onClick={handleGoHome}
          className="rounded-lg border border-white px-8 py-3 hover:bg-white/10"
        >
          返回首页
        </button>
      </div>
    </div>
  );
}
