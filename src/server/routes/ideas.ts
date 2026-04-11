import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { Server as SocketServer } from 'socket.io';
import { authenticateToken, requireWorkshopAccess, requireFacilitator } from '../middleware/auth.js';
import type { MatrixQuadrant, ValueLevel } from '../../shared/types.js';

function computeQuadrant(utility: ValueLevel, feasibility: ValueLevel): MatrixQuadrant {
  const highUtility = utility === 'HIGH' || utility === 'MEDIUM';
  const highFeasibility = feasibility === 'HIGH' || feasibility === 'MEDIUM';

  if (highUtility && highFeasibility) return 'PRIORITER_NA';
  if (highUtility && !highFeasibility) return 'STRATEGISKE_SATSINGER';
  if (!highUtility && highFeasibility) return 'RASKE_GEVINSTER';
  return 'PARKER';
}

export function createIdeaRoutes(prisma: PrismaClient, io: SocketServer) {
  const router = Router({ mergeParams: true });

  // List ideas
  router.get('/', authenticateToken, requireWorkshopAccess, async (req, res) => {
    const where: Record<string, unknown> = { workshopId: req.params.workshopId };
    if (req.query.hkvQuestionId) where.hkvQuestionId = req.query.hkvQuestionId;
    if (req.query.sessionId) where.sessionId = req.query.sessionId;

    const ideas = await prisma.idea.findMany({
      where,
      include: {
        participant: { select: { name: true } },
        score: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    res.json(ideas.map(i => ({
      id: i.id,
      title: i.title,
      description: i.description,
      isAiGenerated: i.isAiGenerated,
      hkvQuestionId: i.hkvQuestionId,
      sessionId: i.sessionId,
      participantName: i.participant?.name || null,
      score: i.score ? {
        utilityValue: i.score.utilityValue,
        feasibility: i.score.feasibility,
        dataAvailability: i.score.dataAvailability,
        systemReadiness: i.score.systemReadiness,
        timeHorizon: i.score.timeHorizon,
        matrixQuadrant: i.score.matrixQuadrant,
      } : null,
      createdAt: i.createdAt.toISOString(),
    })));
  });

  // Submit idea
  router.post('/', authenticateToken, requireWorkshopAccess, async (req, res) => {
    const { title, description, hkvQuestionId, isAiGenerated, sessionId } = req.body;
    const participantId = req.user!.role === 'participant' ? req.user!.id : null;

    const idea = await prisma.idea.create({
      data: {
        title,
        description,
        hkvQuestionId,
        workshopId: req.params.workshopId,
        sessionId,
        participantId,
        isAiGenerated: isAiGenerated || false,
      },
      include: { participant: { select: { name: true } } },
    });

    const ideaData = {
      id: idea.id,
      title: idea.title,
      description: idea.description,
      isAiGenerated: idea.isAiGenerated,
      hkvQuestionId: idea.hkvQuestionId,
      participantName: idea.participant?.name || null,
      score: null,
      createdAt: idea.createdAt.toISOString(),
    };

    io.to(`workshop:${req.params.workshopId}`).emit('idea:added', ideaData);
    res.status(201).json(ideaData);
  });

  // Score idea
  router.post('/:ideaId/score', authenticateToken, requireFacilitator, async (req, res) => {
    const { utilityValue, feasibility, dataAvailability, systemReadiness, timeHorizon, matrixQuadrant } = req.body;
    const quad = matrixQuadrant || computeQuadrant(utilityValue, feasibility);

    const score = await prisma.ideaScore.upsert({
      where: { ideaId: req.params.ideaId },
      create: {
        ideaId: req.params.ideaId,
        utilityValue,
        feasibility,
        dataAvailability,
        systemReadiness,
        timeHorizon,
        matrixQuadrant: quad,
      },
      update: {
        utilityValue,
        feasibility,
        dataAvailability,
        systemReadiness,
        timeHorizon,
        matrixQuadrant: quad,
      },
    });

    const scoreData = {
      utilityValue: score.utilityValue,
      feasibility: score.feasibility,
      dataAvailability: score.dataAvailability,
      systemReadiness: score.systemReadiness,
      timeHorizon: score.timeHorizon,
      matrixQuadrant: score.matrixQuadrant,
    };

    io.to(`workshop:${req.params.workshopId}`).emit('score:updated', { ideaId: req.params.ideaId, score: scoreData });
    res.json(scoreData);
  });

  // Delete idea
  router.delete('/:ideaId', authenticateToken, requireFacilitator, async (req, res) => {
    await prisma.idea.delete({ where: { id: req.params.ideaId } });
    res.status(204).send();
  });

  return router;
}
