import { useEffect } from 'react';
import { useSocket } from '../contexts/SocketContext.js';
import type { ServerToClientEvents } from '../../shared/types.js';

export function useSocketEvent<K extends keyof ServerToClientEvents>(
  event: K,
  handler: ServerToClientEvents[K],
) {
  const socket = useSocket();

  useEffect(() => {
    if (!socket) return;
    socket.on(event as string, handler as (...args: unknown[]) => void);
    return () => {
      socket.off(event as string, handler as (...args: unknown[]) => void);
    };
  }, [socket, event, handler]);
}
