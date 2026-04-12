import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { Server as SocketServer } from 'socket.io';
import { authenticateToken, requireWorkshopAccess } from '../middleware/auth.js';

export function createChallengeRoutes(prisma: PrismaClient, io: SocketServer) {
  const router = Router({ mergeParams: true });

  // List challenges
  router.get('/', authenticateToken, requireWorkshopAccess, async (req, res) => {
    try {
      const where: Record<string, unknown> = { workshopId: req.params.workshopId };
      if (req.query.sessionId) where.sessionId = req.query.sessionId;
      if (req.query.source) where.source = req.query.source;
      if (req.query.unclustered === 'true') where.clusterId = null;

      const challenges = await prisma.challenge.findMany({
        where,
        include: { participant: { select: { name: true } } },
        orderBy: { createdAt: 'asc' },
      });

      res.json(challenges.map(c => ({
        id: c.id,
        text: c.text,
        source: c.source,
        participantId: c.participantId,
        participantName: c.participant?.name || 'Fasilitator',
        sessionId: c.sessionId,
        clusterId: c.clusterId,
        createdAt: c.createdAt.toISOString(),
      })));
    } catch (error) {
      console.error('List challenges error:', error);
      res.status(500).json({ error: 'Feil ved henting av utfordringer' });
    }
  });

  // Submit challenge
  router.post('/', authenticateToken, requireWorkshopAccess, async (req, res) => {
    try {
      const { text, source, sessionId } = req.body;
      const participantId = req.user!.role === 'participant' ? req.user!.id : (req.body.participantId || null);

      const challenge = await prisma.challenge.create({
        data: {
          text,
          source: source || 'SESSION',
          workshopId: req.params.workshopId,
          sessionId,
          participantId,
        },
        include: { participant: { select: { name: true } } },
      });

      const challengeData = {
        id: challenge.id,
        text: challenge.text,
        source: challenge.source,
        participantId: challenge.participantId,
        participantName: challenge.participant?.name || 'Fasilitator',
        sessionId: challenge.sessionId,
        clusterId: challenge.clusterId,
        createdAt: challenge.createdAt.toISOString(),
      };

      io.to(`workshop:${req.params.workshopId}`).emit('challenge:added', challengeData);
      res.status(201).json(challengeData);
    } catch (error) {
      console.error('Create challenge error:', error);
      res.status(500).json({ error: 'Feil ved opprettelse av utfordring' });
    }
  });

  // Update challenge text
  router.patch('/:challengeId', authenticateToken, async (req, res) => {
    try {
      const { text } = req.body;
      const challenge = await prisma.challenge.update({
        where: { id: req.params.challengeId },
        data: { text },
        include: { participant: { select: { name: true } } },
      });

      const challengeData = {
        id: challenge.id,
        text: challenge.text,
        source: challenge.source,
        participantId: challenge.participantId,
        participantName: challenge.participant?.name || 'Fasilitator',
        sessionId: challenge.sessionId,
        clusterId: challenge.clusterId,
        createdAt: challenge.createdAt.toISOString(),
      };

      io.to(`workshop:${req.params.workshopId}`).emit('challenge:updated', challengeData);
      res.json(challengeData);
    } catch (error) {
      console.error('Update challenge error:', error);
      res.status(500).json({ error: 'Feil ved oppdatering av utfordring' });
    }
  });

  // Assign challenge to cluster
  router.patch('/:challengeId/cluster', authenticateToken, async (req, res) => {
    try {
      const { clusterId } = req.body;
      await prisma.challenge.update({
        where: { id: req.params.challengeId },
        data: { clusterId },
      });

      io.to(`workshop:${req.params.workshopId}`).emit('challenge:clustered', {
        challengeId: req.params.challengeId,
        clusterId,
      });
      res.json({ challengeId: req.params.challengeId, clusterId });
    } catch (error) {
      console.error('Cluster challenge error:', error);
      res.status(500).json({ error: 'Feil ved klyngetildeling' });
    }
  });

  // Delete challenge
  router.delete('/:challengeId', authenticateToken, async (req, res) => {
    try {
      await prisma.challenge.delete({ where: { id: req.params.challengeId } });
      res.status(204).send();
    } catch (error) {
      console.error('Delete challenge error:', error);
      res.status(500).json({ error: 'Feil ved sletting av utfordring' });
    }
  });

  return router;
}
