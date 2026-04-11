import { io, Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents } from '../../shared/types.js';

let socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;

export function getSocket(): Socket<ServerToClientEvents, ClientToServerEvents> {
  if (!socket) {
    const token = localStorage.getItem('token');
    socket = io({
      auth: { token },
      autoConnect: false,
    });
  }
  return socket;
}

export function connectSocket(): void {
  const s = getSocket();
  if (!s.connected) {
    // Update token in case it changed
    s.auth = { token: localStorage.getItem('token') };
    s.connect();
  }
}

export function disconnectSocket(): void {
  if (socket?.connected) {
    socket.disconnect();
  }
  socket = null;
}

export function joinWorkshop(workshopId: string): void {
  const s = getSocket();
  s.emit('join:workshop', { workshopId, token: localStorage.getItem('token') || '' });
}
