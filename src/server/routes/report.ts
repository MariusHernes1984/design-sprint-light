import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.js';

export function createReportRoutes(prisma: PrismaClient) {
  const router = Router({ mergeParams: true });

  // GET /workshops/:workshopId/report — all data for PDF export
  router.get('/', authenticateToken, async (req, res) => {
    try {
      const { workshopId } = req.params;

      const workshop = await prisma.workshop.findUnique({
        where: { id: workshopId },
        include: {
          facilitator: { select: { name: true } },
          sessions: { orderBy: { sortOrder: 'asc' } },
        },
      });

      if (!workshop) {
        res.status(404).json({ error: 'Workshop ikke funnet' });
        return;
      }

      const challenges = await prisma.challenge.findMany({
        where: { workshopId },
        include: { participant: { select: { name: true } } },
        orderBy: { createdAt: 'asc' },
      });

      const clusters = await prisma.cluster.findMany({
        where: { workshopId },
        include: {
          challenges: {
            include: { participant: { select: { name: true } } },
          },
        },
        orderBy: { sortOrder: 'asc' },
      });

      const hkvQuestions = await prisma.hkvQuestion.findMany({
        where: { workshopId },
        include: { cluster: { select: { name: true } } },
        orderBy: { createdAt: 'asc' },
      });

      const ideas = await prisma.idea.findMany({
        where: { workshopId },
        include: {
          score: true,
          canvas: true,
          hkvQuestion: { select: { fullText: true, cluster: { select: { name: true } } } },
          cluster: { select: { name: true } },
          participant: { select: { name: true } },
        },
        orderBy: { createdAt: 'asc' },
      });

      res.json({
        workshop: {
          title: workshop.title,
          description: workshop.description,
          customerName: workshop.customerName,
          facilitatorName: workshop.facilitator.name,
          createdAt: workshop.createdAt.toISOString(),
        },
        sessions: workshop.sessions.map(s => ({
          id: s.id,
          title: s.title,
          sortOrder: s.sortOrder,
        })),
        challenges: challenges.map(c => ({
          id: c.id,
          text: c.text,
          source: c.source,
          sessionId: c.sessionId,
          clusterId: c.clusterId,
          participantName: c.participant?.name || 'Fasilitator',
        })),
        clusters: clusters.map(cl => ({
          id: cl.id,
          name: cl.name,
          summary: cl.summary,
          sessionId: cl.sessionId,
          challenges: cl.challenges.map(c => ({
            id: c.id,
            text: c.text,
            participantName: c.participant?.name || 'Fasilitator',
          })),
        })),
        hkvQuestions: hkvQuestions.map(h => ({
          id: h.id,
          fullText: h.fullText,
          isApproved: h.isApproved,
          isAiGenerated: h.isAiGenerated,
          clusterId: h.clusterId,
          clusterName: h.cluster.name,
          sessionId: h.sessionId,
        })),
        ideas: ideas.map(i => ({
          id: i.id,
          title: i.title,
          description: i.description,
          isAiGenerated: i.isAiGenerated,
          sessionId: i.sessionId,
          hkvQuestionId: i.hkvQuestionId,
          hkvText: i.hkvQuestion?.fullText || '',
          clusterId: i.clusterId,
          clusterName: i.cluster?.name || i.hkvQuestion?.cluster?.name || '',
          participantName: i.participant?.name || null,
          score: i.score ? {
            utilityValue: i.score.utilityValue,
            feasibility: i.score.feasibility,
            matrixQuadrant: i.score.matrixQuadrant,
            dataAvailability: i.score.dataAvailability,
            systemReadiness: i.score.systemReadiness,
            timeHorizon: i.score.timeHorizon,
          } : null,
          canvas: i.canvas ? {
            problemStatement: i.canvas.problemStatement,
            solutionSummary: i.canvas.solutionSummary,
            dataNeeds: i.canvas.dataNeeds,
            stakeholders: i.canvas.stakeholders,
            firstSteps: i.canvas.firstSteps,
            expectedOutcome: i.canvas.expectedOutcome,
          } : null,
        })),
      });
    } catch (error) {
      console.error('Report data error:', error);
      res.status(500).json({ error: 'Feil ved generering av rapportdata' });
    }
  });

  return router;
}
