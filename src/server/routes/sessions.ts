import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { Server as SocketServer } from 'socket.io';
import { authenticateToken, requireFacilitator } from '../middleware/auth.js';
import { SESSION_STEP_ORDER } from '../../shared/types.js';
import type { WorkshopStep } from '../../shared/types.js';

export function createSessionRoutes(prisma: PrismaClient, io: SocketServer) {
  const router = Router({ mergeParams: true });

  // List sessions for a workshop
  router.get('/', authenticateToken, async (req, res) => {
    try {
      const sessions = await prisma.session.findMany({
        where: { workshopId: req.params.workshopId },
        include: { _count: { select: { challenges: true } } },
        orderBy: { sortOrder: 'asc' },
      });
      res.json(sessions.map(s => ({
        id: s.id,
        title: s.title,
        sortOrder: s.sortOrder,
        isActive: s.isActive,
        currentStep: s.currentStep,
        challengeCount: s._count.challenges,
      })));
    } catch (error) {
      console.error('List sessions error:', error);
      res.status(500).json({ error: 'Feil ved henting av okter' });
    }
  });

  // Create session
  router.post('/', authenticateToken, requireFacilitator, async (req, res) => {
    try {
      const { title } = req.body;
      const count = await prisma.session.count({ where: { workshopId: req.params.workshopId } });
      const session = await prisma.session.create({
        data: { title, workshopId: req.params.workshopId, sortOrder: count },
      });
      res.status(201).json(session);
    } catch (error) {
      console.error('Create session error:', error);
      res.status(500).json({ error: 'Feil ved opprettelse av okt' });
    }
  });

  // Update session
  router.patch('/:sessionId', authenticateToken, requireFacilitator, async (req, res) => {
    try {
      const { title, isActive } = req.body;

      // If activating this session, deactivate all others
      if (isActive) {
        await prisma.session.updateMany({
          where: { workshopId: req.params.workshopId },
          data: { isActive: false },
        });
        io.to(`workshop:${req.params.workshopId}`).emit('workshop:sessionActivated', { sessionId: req.params.sessionId });
      }

      const session = await prisma.session.update({
        where: { id: req.params.sessionId },
        data: { title, isActive },
      });
      res.json(session);
    } catch (error) {
      console.error('Update session error:', error);
      res.status(500).json({ error: 'Feil ved oppdatering av okt' });
    }
  });

  // Advance session step
  router.patch('/:sessionId/step', authenticateToken, requireFacilitator, async (req, res) => {
    try {
      const { step } = req.body as { step: WorkshopStep };

      const targetIdx = SESSION_STEP_ORDER.indexOf(step);
      if (targetIdx < 0) {
        res.status(400).json({ error: 'Ugyldig steg for okt' });
        return;
      }

      const updated = await prisma.session.update({
        where: { id: req.params.sessionId },
        data: { currentStep: step },
      });

      io.to(`workshop:${req.params.workshopId}`).emit('session:stepChanged', {
        sessionId: req.params.sessionId,
        step,
      });
      res.json({ currentStep: updated.currentStep });
    } catch (error) {
      console.error('Update session step error:', error);
      res.status(500).json({ error: 'Feil ved endring av steg' });
    }
  });

  // Delete session
  router.delete('/:sessionId', authenticateToken, requireFacilitator, async (req, res) => {
    try {
      await prisma.session.delete({ where: { id: req.params.sessionId } });
      res.status(204).send();
    } catch (error) {
      console.error('Delete session error:', error);
      res.status(500).json({ error: 'Feil ved sletting av okt' });
    }
  });

  return router;
}
