import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { Server as SocketServer } from 'socket.io';
import { authenticateToken, requireFacilitator, requireWorkshopAccess } from '../middleware/auth.js';
import { generateUniqueJoinCode } from '../services/joinCodeService.js';
import { STEP_ORDER } from '../../shared/types.js';
import type { WorkshopStep } from '../../shared/types.js';

export function createWorkshopRoutes(prisma: PrismaClient, io: SocketServer) {
  const router = Router();

  // List facilitator's workshops
  router.get('/', authenticateToken, requireFacilitator, async (req, res) => {
    const workshops = await prisma.workshop.findMany({
      where: { facilitatorId: req.user!.id },
      include: {
        _count: { select: { participants: true, challenges: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(workshops.map(w => ({
      id: w.id,
      title: w.title,
      customerName: w.customerName,
      joinCode: w.joinCode,
      status: w.status,
      currentStep: w.currentStep,
      participantCount: w._count.participants,
      challengeCount: w._count.challenges,
      createdAt: w.createdAt.toISOString(),
    })));
  });

  // Create workshop
  router.post('/', authenticateToken, requireFacilitator, async (req, res) => {
    const { title, description, customerName, sessions } = req.body;
    const joinCode = await generateUniqueJoinCode(prisma);

    const workshop = await prisma.workshop.create({
      data: {
        title,
        description,
        customerName,
        joinCode,
        facilitatorId: req.user!.id,
        sessions: sessions?.length
          ? { create: sessions.map((s: { title: string }, i: number) => ({ title: s.title, sortOrder: i })) }
          : undefined,
      },
      include: { sessions: true },
    });

    res.status(201).json(workshop);
  });

  // Get workshop detail
  router.get('/:id', authenticateToken, requireWorkshopAccess, async (req, res) => {
    const workshop = await prisma.workshop.findUnique({
      where: { id: req.params.id },
      include: {
        sessions: { orderBy: { sortOrder: 'asc' } },
        participants: { orderBy: { joinedAt: 'asc' } },
        _count: { select: { challenges: true, clusters: true, ideas: true } },
      },
    });

    if (!workshop) {
      res.status(404).json({ error: 'Workshop ikke funnet' });
      return;
    }

    res.json({
      id: workshop.id,
      title: workshop.title,
      description: workshop.description,
      customerName: workshop.customerName,
      joinCode: workshop.joinCode,
      status: workshop.status,
      currentStep: workshop.currentStep,
      sessions: workshop.sessions.map(s => ({
        id: s.id,
        title: s.title,
        sortOrder: s.sortOrder,
        isActive: s.isActive,
        currentStep: s.currentStep,
      })),
      participants: workshop.participants.map(p => ({
        id: p.id,
        name: p.name,
        joinedAt: p.joinedAt.toISOString(),
      })),
      counts: workshop._count,
      createdAt: workshop.createdAt.toISOString(),
    });
  });

  // Update workshop
  router.patch('/:id', authenticateToken, requireFacilitator, async (req, res) => {
    const { title, description, customerName, status } = req.body;
    const workshop = await prisma.workshop.update({
      where: { id: req.params.id },
      data: { title, description, customerName, status },
    });
    res.json(workshop);
  });

  // Advance workshop step
  router.patch('/:id/step', authenticateToken, requireFacilitator, async (req, res) => {
    const { step } = req.body as { step: WorkshopStep };
    const workshop = await prisma.workshop.findUnique({ where: { id: req.params.id } });

    if (!workshop) {
      res.status(404).json({ error: 'Workshop ikke funnet' });
      return;
    }

    // Validate step is in the allowed order
    const currentIdx = STEP_ORDER.indexOf(workshop.currentStep);
    const targetIdx = STEP_ORDER.indexOf(step);
    if (targetIdx < 0) {
      res.status(400).json({ error: 'Ugyldig steg' });
      return;
    }

    // Allow forward any distance, or back one step
    if (targetIdx < currentIdx - 1) {
      res.status(400).json({ error: 'Kan ikke gå mer enn ett steg tilbake' });
      return;
    }

    const updated = await prisma.workshop.update({
      where: { id: req.params.id },
      data: {
        currentStep: step,
        status: step === 'PREWORK' ? 'ACTIVE' : undefined,
      },
    });

    io.to(`workshop:${workshop.id}`).emit('workshop:stepChanged', { step });
    res.json({ currentStep: updated.currentStep });
  });

  // Delete (archive) workshop
  router.delete('/:id', authenticateToken, requireFacilitator, async (req, res) => {
    await prisma.workshop.update({
      where: { id: req.params.id },
      data: { status: 'ARCHIVED' },
    });
    res.status(204).send();
  });

  return router;
}
