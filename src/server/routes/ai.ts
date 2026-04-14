import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { Server as SocketServer } from 'socket.io';
import { authenticateToken, requireFacilitator } from '../middleware/auth.js';
import * as aiService from '../services/aiService.js';

export function createAiRoutes(prisma: PrismaClient, io: SocketServer) {
  const router = Router({ mergeParams: true });

  // AI auto-cluster
  router.post('/cluster', authenticateToken, requireFacilitator, async (req, res) => {
    const { workshopId } = req.params;
    const { sessionId } = req.body;
    const workshop = await prisma.workshop.findUnique({ where: { id: workshopId } });

    io.to(`workshop:${workshopId}`).emit('ai:processing', { type: 'clustering', status: 'started' });

    try {
      const challenges = await prisma.challenge.findMany({
        where: { workshopId, clusterId: null, sessionId },
        select: { id: true, text: true },
      });

      if (challenges.length === 0) {
        res.status(400).json({ error: 'Ingen uklyngede utfordringer å gruppere' });
        return;
      }

      const suggestions = await aiService.suggestClusters(challenges, workshop?.customerName || undefined);

      io.to(`workshop:${workshopId}`).emit('ai:processing', { type: 'clustering', status: 'completed' });
      res.json({ suggestions });
    } catch (error) {
      io.to(`workshop:${workshopId}`).emit('ai:processing', { type: 'clustering', status: 'completed' });
      res.status(500).json({ error: 'AI-klynging feilet' });
    }
  });

  // AI suggest HKV
  router.post('/hkv', authenticateToken, requireFacilitator, async (req, res) => {
    const { workshopId } = req.params;
    const { clusterId } = req.body;

    io.to(`workshop:${workshopId}`).emit('ai:processing', { type: 'hkv', status: 'started' });

    try {
      const cluster = await prisma.cluster.findUnique({
        where: { id: clusterId },
        include: { challenges: { select: { text: true } } },
      });

      if (!cluster) {
        res.status(404).json({ error: 'Klynge ikke funnet' });
        return;
      }

      const suggestions = await aiService.suggestHkv(
        cluster.name,
        cluster.challenges.map(c => c.text),
      );

      io.to(`workshop:${workshopId}`).emit('ai:processing', { type: 'hkv', status: 'completed' });
      res.json({ suggestions });
    } catch (error) {
      io.to(`workshop:${workshopId}`).emit('ai:processing', { type: 'hkv', status: 'completed' });
      res.status(500).json({ error: 'AI HKV-generering feilet' });
    }
  });

  // AI suggest ideas (cluster-based, uses all approved HKV from cluster as context)
  router.post('/ideate', authenticateToken, requireFacilitator, async (req, res) => {
    const { workshopId } = req.params;
    const { clusterId } = req.body;

    io.to(`workshop:${workshopId}`).emit('ai:processing', { type: 'ideation', status: 'started' });

    try {
      const cluster = await prisma.cluster.findUnique({
        where: { id: clusterId },
        include: { hkvQuestions: { where: { isApproved: true } } },
      });
      if (!cluster) {
        res.status(404).json({ error: 'Klynge ikke funnet' });
        return;
      }

      const hkvContext = cluster.hkvQuestions.map(h => h.fullText).join('\n');
      const workshop = await prisma.workshop.findUnique({ where: { id: workshopId } });
      const suggestions = await aiService.suggestIdeas(
        hkvContext || `Klynge: ${cluster.name}`,
        workshop?.customerName || undefined,
      );

      io.to(`workshop:${workshopId}`).emit('ai:processing', { type: 'ideation', status: 'completed' });
      res.json({ suggestions });
    } catch (error) {
      io.to(`workshop:${workshopId}`).emit('ai:processing', { type: 'ideation', status: 'completed' });
      res.status(500).json({ error: 'AI idégenerering feilet' });
    }
  });

  // AI feasibility assessment
  router.post('/assess', authenticateToken, requireFacilitator, async (req, res) => {
    const { ideaId } = req.body;

    try {
      const idea = await prisma.idea.findUnique({
        where: { id: ideaId },
        include: { hkvQuestion: true },
      });
      if (!idea) {
        res.status(404).json({ error: 'Idé ikke funnet' });
        return;
      }

      const assessment = await aiService.assessFeasibility(
        `${idea.title}: ${idea.description || ''}`,
        idea.hkvQuestion?.fullText || '',
      );
      res.json({ assessment });
    } catch (error) {
      res.status(500).json({ error: 'AI-vurdering feilet' });
    }
  });

  // AI canvas draft
  router.post('/canvas', authenticateToken, requireFacilitator, async (req, res) => {
    const { ideaId } = req.body;

    try {
      const idea = await prisma.idea.findUnique({
        where: { id: ideaId },
        include: { hkvQuestion: true },
      });
      if (!idea) {
        res.status(404).json({ error: 'Idé ikke funnet' });
        return;
      }

      const draft = await aiService.generateCanvasDraft(
        idea.title,
        idea.description || '',
        idea.hkvQuestion?.fullText || '',
      );
      res.json({ canvas: draft });
    } catch (error) {
      console.error('AI canvas error:', error);
      res.status(500).json({ error: 'AI canvas-generering feilet' });
    }
  });

  // AI read post-it notes from image
  router.post('/read-postits', authenticateToken, requireFacilitator, async (req, res) => {
    const { workshopId } = req.params;
    const { image, context } = req.body as { image: string; context: 'hkv' | 'ideas' };

    if (!image) {
      res.status(400).json({ error: 'Bilde mangler' });
      return;
    }

    io.to(`workshop:${workshopId}`).emit('ai:processing', { type: 'postit-scan', status: 'started' });

    try {
      const result = await aiService.readPostItsFromImage(image, context || 'ideas');
      io.to(`workshop:${workshopId}`).emit('ai:processing', { type: 'postit-scan', status: 'completed' });
      res.json({ texts: result.texts });
    } catch (error) {
      console.error('AI post-it reading error:', error);
      io.to(`workshop:${workshopId}`).emit('ai:processing', { type: 'postit-scan', status: 'completed' });
      res.status(500).json({ error: 'Kunne ikke lese post-it-lapper fra bildet' });
    }
  });

  return router;
}
