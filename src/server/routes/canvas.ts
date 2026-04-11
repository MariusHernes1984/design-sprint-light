import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { Server as SocketServer } from 'socket.io';
import { authenticateToken, requireFacilitator } from '../middleware/auth.js';

// AI sometimes returns arrays/objects instead of strings — normalize them
function toStr(val: unknown): string {
  if (val == null) return '';
  if (typeof val === 'string') return val;
  if (Array.isArray(val)) return val.map(v => typeof v === 'string' ? v : JSON.stringify(v)).join('\n');
  if (typeof val === 'object') {
    // e.g. { sources: [...], description: "..." } → flatten to readable text
    return Object.entries(val as Record<string, unknown>)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
      .join('\n');
  }
  return String(val);
}

export function createCanvasRoutes(prisma: PrismaClient, io: SocketServer) {
  const router = Router({ mergeParams: true });

  // Get canvas for an idea
  router.get('/:ideaId', authenticateToken, async (req, res) => {
    try {
      const canvas = await prisma.ideaCanvas.findUnique({
        where: { ideaId: req.params.ideaId },
      });
      if (!canvas) {
        res.status(404).json({ error: 'Idécanvas ikke funnet' });
        return;
      }
      res.json(canvas);
    } catch (error) {
      console.error('Canvas GET error:', error);
      res.status(500).json({ error: 'Feil ved henting av canvas' });
    }
  });

  // Create or update canvas
  router.put('/:ideaId', authenticateToken, requireFacilitator, async (req, res) => {
    try {
      const problemStatement = toStr(req.body.problemStatement);
      const solutionSummary = toStr(req.body.solutionSummary);
      const dataNeeds = toStr(req.body.dataNeeds);
      const stakeholders = toStr(req.body.stakeholders) || null;
      const firstSteps = toStr(req.body.firstSteps);
      const expectedOutcome = toStr(req.body.expectedOutcome) || null;
      const isAiDraft = req.body.isAiDraft || false;

      const canvas = await prisma.ideaCanvas.upsert({
        where: { ideaId: req.params.ideaId },
        create: {
          ideaId: req.params.ideaId,
          problemStatement,
          solutionSummary,
          dataNeeds,
          stakeholders,
          firstSteps,
          expectedOutcome,
          isAiDraft,
        },
        update: {
          problemStatement,
          solutionSummary,
          dataNeeds,
          stakeholders,
          firstSteps,
          expectedOutcome,
          isAiDraft,
          editedAt: new Date(),
        },
      });

      io.to(`workshop:${req.params.workshopId}`).emit('canvas:updated', { ideaId: req.params.ideaId });
      res.json(canvas);
    } catch (error) {
      console.error('Canvas PUT error:', error);
      res.status(500).json({ error: 'Feil ved lagring av canvas' });
    }
  });

  return router;
}
