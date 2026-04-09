// packages/client/src/services/gameSocket.ts
import type { TypedSocket } from './socket.js';
import { useGameStore } from '../stores/useGameStore.js';

/** 绑定游戏 Socket 事件监听 */
export function bindGameSocketListeners(socket: TypedSocket) {
  socket.on('game:start', (data) => {
    useGameStore.getState().setGameState(data.gameState);
  });

  socket.on('game:your-turn', (data) => {
    useGameStore.getState().setMyTurn(data.timeLimit);
  });

  socket.on('game:played', (data) => {
    useGameStore
      .getState()
      .updateAfterPlay(
        data.seatIndex,
        data.cards,
        data.handType,
        data.remainingCards,
        data.nextSeat,
      );
  });

  socket.on('game:passed', (data) => {
    useGameStore.getState().updateAfterPass(data.seatIndex, data.nextSeat);
  });

  socket.on('game:round-end', (data) => {
    useGameStore.getState().updateRoundEnd(data.winnerSeat);
  });

  socket.on('game:player-finished', (data) => {
    useGameStore.getState().updatePlayerFinished(data.seatIndex, data.rank);
  });

  socket.on('game:end', (data) => {
    useGameStore.getState().setGameResult(data.result);
  });
}

/** 解绑游戏 Socket 事件监听 */
export function unbindGameSocketListeners(socket: TypedSocket) {
  socket.off('game:start');
  socket.off('game:your-turn');
  socket.off('game:played');
  socket.off('game:passed');
  socket.off('game:round-end');
  socket.off('game:player-finished');
  socket.off('game:end');
}
