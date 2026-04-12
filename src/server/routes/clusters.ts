import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { Server as SocketServer } from 'socket.io';
import { authenticateToken, requireFacilitator } from '../middleware/auth.js';

export function createClusterRoutes(prisma: PrismaClient, io: SocketServer) {
  const router = Router({ mergeParams: true });

  // List clusters with challenges and HKV questions
  router.get('/', authenticateToken, async (req, res) => {
    try {
      const where: Record<string, unknown> = { workshopId: req.params.workshopId };
      if (req.query.sessionId) where.sessionId = req.query.sessionId;

      const clusters = await prisma.cluster.findMany({
        where,
        include: {
          challenges: {
            include: { participant: { select: { name: true } } },
            orderBy: { createdAt: 'asc' },
          },
          hkvQuestions: {
            include: { _count: { select: { ideas: true } } },
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: { sortOrder: 'asc' },
      });

      res.json(clusters.map(cl => ({
        id: cl.id,
        name: cl.name,
        summary: cl.summary,
        sortOrder: cl.sortOrder,
        sessionId: cl.sessionId,
        challenges: cl.challenges.map(c => ({
          id: c.id,
          text: c.text,
          source: c.source,
          participantId: c.participantId,
          participantName: c.participant?.name || 'Fasilitator',
          sessionId: c.sessionId,
          clusterId: c.clusterId,
          createdAt: c.createdAt.toISOString(),
        })),
        hkvQuestions: cl.hkvQuestions.map(h => ({
          id: h.id,
          problem: h.problem,
          benefit: h.benefit,
          constraint: h.constraint,
          fullText: h.fullText,
          isAiGenerated: h.isAiGenerated,
          isApproved: h.isApproved,
          clusterId: h.clusterId,
          sessionId: h.sessionId,
          ideaCount: h._count.ideas,
        })),
      })));
    } catch (error) {
      console.error('List clusters error:', error);
      res.status(500).json({ error: 'Feil ved henting av klynger' });
    }
  });

  // Create cluster
  router.post('/', authenticateToken, requireFacilitator, async (req, res) => {
    try {
      const { name, summary, sessionId } = req.body;
      const count = await prisma.cluster.count({ where: { workshopId: req.params.workshopId, sessionId } });

      const cluster = await prisma.cluster.create({
        data: { name, summary, workshopId: req.params.workshopId, sessionId, sortOrder: count },
        include: {
          challenges: { include: { participant: { select: { name: true } } } },
          hkvQuestions: { include: { _count: { select: { ideas: true } } } },
        },
      });

      const clusterData = {
        id: cluster.id,
        name: cluster.name,
        summary: cluster.summary,
        sortOrder: cluster.sortOrder,
        sessionId: cluster.sessionId,
        challenges: [] as unknown[],
        hkvQuestions: [] as unknown[],
      };

      io.to(`workshop:${req.params.workshopId}`).emit('cluster:created', clusterData);
      res.status(201).json(clusterData);
    } catch (error) {
      console.error('Create cluster error:', error);
      res.status(500).json({ error: 'Feil ved opprettelse av klynge' });
    }
  });

  // Update cluster
  router.patch('/:clusterId', authenticateToken, requireFacilitator, async (req, res) => {
    try {
      const { name, summary } = req.body;
      const cluster = await prisma.cluster.update({
        where: { id: req.params.clusterId },
        data: { name, summary },
      });
      res.json(cluster);
    } catch (error) {
      console.error('Update cluster error:', error);
      res.status(500).json({ error: 'Feil ved oppdatering av klynge' });
    }
  });

  // Delete cluster (unassigns challenges)
  router.delete('/:clusterId', authenticateToken, requireFacilitator, async (req, res) => {
    try {
      await prisma.challenge.updateMany({
        where: { clusterId: req.params.clusterId },
        data: { clusterId: null },
      });
      await prisma.cluster.delete({ where: { id: req.params.clusterId } });

      io.to(`workshop:${req.params.workshopId}`).emit('cluster:deleted', { clusterId: req.params.clusterId });
      res.status(204).send();
    } catch (error) {
      console.error('Delete cluster error:', error);
      res.status(500).json({ error: 'Feil ved sletting av klynge' });
    }
  });

  return router;
}
