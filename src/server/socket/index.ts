import { Server as SocketServer } from 'socket.io';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { config } from '../config.js';
import type { AuthPayload, ServerToClientEvents, ClientToServerEvents } from '../../shared/types.js';

export function setupSocketIO(
  io: SocketServer<ClientToServerEvents, ServerToClientEvents>,
  prisma: PrismaClient,
) {
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('Ingen token'));
    }
    try {
      const payload = jwt.verify(token, config.jwtSecret) as AuthPayload;
      socket.data.user = payload;
      next();
    } catch {
      next(new Error('Ugyldig token'));
    }
  });

  io.on('connection', async (socket) => {
    const user = socket.data.user as AuthPayload;

    socket.on('join:workshop', async ({ workshopId }) => {
      // Verify access
      if (user.role === 'participant' && user.workshopId !== workshopId) {
        socket.emit('participants:updated', []);
        return;
      }

      socket.join(`workshop:${workshopId}`);

      // Broadcast updated participant list
      const participants = await prisma.participant.findMany({
        where: { workshopId },
        orderBy: { joinedAt: 'asc' },
      });

      io.to(`workshop:${workshopId}`).emit(
        'participants:updated',
        participants.map(p => ({
          id: p.id,
          name: p.name,
          joinedAt: p.joinedAt.toISOString(),
        })),
      );
    });

    socket.on('disconnect', () => {
      // Socket.IO handles room cleanup automatically
    });
  });
}
