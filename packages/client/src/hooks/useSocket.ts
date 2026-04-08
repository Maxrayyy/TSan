import { useEffect, useRef } from 'react';
import { getSocket, disconnectSocket, type TypedSocket } from '../services/socket.js';

export function useSocket(): TypedSocket | null {
  const socketRef = useRef<TypedSocket | null>(null);

  useEffect(() => {
    try {
      socketRef.current = getSocket();
    } catch {
      socketRef.current = null;
    }

    return () => {
      // Don't disconnect on unmount - let the store manage lifecycle
    };
  }, []);

  return socketRef.current;
}

export { disconnectSocket };
