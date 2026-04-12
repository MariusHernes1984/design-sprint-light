import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { Server as SocketServer } from 'socket.io';
import { authenticateToken, requireFacilitator } from '../middleware/auth.js';

export function createHkvRoutes(prisma: PrismaClient, io: SocketServer) {
  const router = Router({ mergeParams: true });

  // List HKV questions
  router.get('/', authenticateToken, async (req, res) => {
    try {
      const where: Record<string, unknown> = { workshopId: req.params.workshopId };
      if (req.query.clusterId) where.clusterId = req.query.clusterId;
      if (req.query.sessionId) where.sessionId = req.query.sessionId;

      const questions = await prisma.hkvQuestion.findMany({
        where,
        include: { _count: { select: { ideas: true } } },
        orderBy: { createdAt: 'asc' },
      });

      res.json(questions.map(h => ({
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
      })));
    } catch (error) {
      console.error('List HKV error:', error);
      res.status(500).json({ error: 'Feil ved henting av HKV-sporsmaal' });
    }
  });

  // Create HKV question
  router.post('/', authenticateToken, requireFacilitator, async (req, res) => {
    try {
      const { problem, benefit, constraint, clusterId, isAiGenerated, sessionId, fullText: providedFullText } = req.body;
      const fullText = providedFullText || `Hvordan kan vi ${problem}, slik at ${benefit}, uten at ${constraint}?`;

      const hkv = await prisma.hkvQuestion.create({
        data: {
          problem,
          benefit,
          constraint,
          fullText,
          isAiGenerated: isAiGenerated || false,
          workshopId: req.params.workshopId,
          clusterId,
          sessionId,
        },
        include: { _count: { select: { ideas: true } } },
      });

      const hkvData = {
        id: hkv.id,
        problem: hkv.problem,
        benefit: hkv.benefit,
        constraint: hkv.constraint,
        fullText: hkv.fullText,
        isAiGenerated: hkv.isAiGenerated,
        isApproved: hkv.isApproved,
        clusterId: hkv.clusterId,
        sessionId: hkv.sessionId,
        ideaCount: hkv._count.ideas,
      };

      io.to(`workshop:${req.params.workshopId}`).emit('hkv:added', hkvData);
      res.status(201).json(hkvData);
    } catch (error) {
      console.error('Create HKV error:', error);
      res.status(500).json({ error: 'Feil ved opprettelse av HKV-sporsmaal' });
    }
  });

  // Update HKV question
  router.patch('/:hkvId', authenticateToken, requireFacilitator, async (req, res) => {
    try {
      const { problem, benefit, constraint, isApproved } = req.body;
      const data: Record<string, unknown> = {};

      if (problem !== undefined) data.problem = problem;
      if (benefit !== undefined) data.benefit = benefit;
      if (constraint !== undefined) data.constraint = constraint;
      if (isApproved !== undefined) data.isApproved = isApproved;

      if (problem !== undefined || benefit !== undefined || constraint !== undefined) {
        const existing = await prisma.hkvQuestion.findUnique({ where: { id: req.params.hkvId } });
        if (existing) {
          const p = (problem ?? existing.problem) as string;
          const b = (benefit ?? existing.benefit) as string;
          const c = (constraint ?? existing.constraint) as string;
          data.fullText = `Hvordan kan vi ${p}, slik at ${b}, uten at ${c}?`;
        }
      }

      const hkv = await prisma.hkvQuestion.update({
        where: { id: req.params.hkvId },
        data,
        include: { _count: { select: { ideas: true } } },
      });

      const hkvData = {
        id: hkv.id,
        problem: hkv.problem,
        benefit: hkv.benefit,
        constraint: hkv.constraint,
        fullText: hkv.fullText,
        isAiGenerated: hkv.isAiGenerated,
        isApproved: hkv.isApproved,
        clusterId: hkv.clusterId,
        sessionId: hkv.sessionId,
        ideaCount: hkv._count.ideas,
      };

      io.to(`workshop:${req.params.workshopId}`).emit('hkv:updated', hkvData);
      res.json(hkvData);
    } catch (error) {
      console.error('Update HKV error:', error);
      res.status(500).json({ error: 'Feil ved oppdatering av HKV-sporsmaal' });
    }
  });

  // Delete HKV question
  router.delete('/:hkvId', authenticateToken, requireFacilitator, async (req, res) => {
    try {
      await prisma.hkvQuestion.delete({ where: { id: req.params.hkvId } });
      res.status(204).send();
    } catch (error) {
      console.error('Delete HKV error:', error);
      res.status(500).json({ error: 'Feil ved sletting av HKV-sporsmaal' });
    }
  });

  return router;
}
