import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents } from '../../shared/types.js';
import { getSocket, connectSocket, disconnectSocket } from '../lib/socket.js';
import { useAuth } from './AuthContext.js';

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const SocketContext = createContext<TypedSocket | null>(null);

export function SocketProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState<TypedSocket | null>(null);

  useEffect(() => {
    if (user) {
      connectSocket();
      setSocket(getSocket());
      return () => {
        disconnectSocket();
        setSocket(null);
      };
    }
  }, [user]);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
