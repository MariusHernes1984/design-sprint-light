import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, requireAdmin, signToken } from '../middleware/auth.js';
import type { LoginRequest } from '../../shared/types.js';

const router = Router();

export function createAuthRoutes(prisma: PrismaClient) {
  // Login (both admin and user)
  router.post('/login', async (req, res) => {
    try {
      const { email, password } = req.body as LoginRequest;

      const facilitator = await prisma.facilitator.findUnique({ where: { email } });
      if (!facilitator) {
        res.status(401).json({ error: 'Feil e-post eller passord' });
        return;
      }

      const valid = await bcrypt.compare(password, facilitator.passwordHash);
      if (!valid) {
        res.status(401).json({ error: 'Feil e-post eller passord' });
        return;
      }

      const token = signToken({
        id: facilitator.id,
        role: 'facilitator',
        userRole: facilitator.role as 'ADMIN' | 'USER',
        assignedWorkshopId: facilitator.assignedWorkshopId || undefined,
      });

      res.json({
        token,
        user: {
          id: facilitator.id,
          name: facilitator.name,
          email: facilitator.email,
          role: 'facilitator',
          userRole: facilitator.role,
          assignedWorkshopId: facilitator.assignedWorkshopId,
        },
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Feil ved innlogging' });
    }
  });

  // Admin: Create user
  router.post('/users', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { email, password, name, role, assignedWorkshopId } = req.body;

      const existing = await prisma.facilitator.findUnique({ where: { email } });
      if (existing) {
        res.status(409).json({ error: 'E-post er allerede registrert' });
        return;
      }

      const passwordHash = await bcrypt.hash(password, 12);
      const user = await prisma.facilitator.create({
        data: {
          email,
          name,
          passwordHash,
          role: role || 'USER',
          assignedWorkshopId: assignedWorkshopId || null,
        },
        include: {
          assignedWorkshop: { select: { id: true, title: true } },
        },
      });

      res.status(201).json({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        assignedWorkshopId: user.assignedWorkshopId,
        assignedWorkshopTitle: user.assignedWorkshop?.title || null,
      });
    } catch (error) {
      console.error('Create user error:', error);
      res.status(500).json({ error: 'Feil ved opprettelse av bruker' });
    }
  });

  // Admin: List users
  router.get('/users', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const users = await prisma.facilitator.findMany({
        include: {
          assignedWorkshop: { select: { id: true, title: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      res.json(users.map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        assignedWorkshopId: u.assignedWorkshopId,
        assignedWorkshopTitle: u.assignedWorkshop?.title || null,
        createdAt: u.createdAt.toISOString(),
      })));
    } catch (error) {
      console.error('List users error:', error);
      res.status(500).json({ error: 'Feil ved henting av brukere' });
    }
  });

  // Admin: Update user
  router.patch('/users/:userId', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { name, email, password, role, assignedWorkshopId } = req.body;
      const data: Record<string, unknown> = {};

      if (name !== undefined) data.name = name;
      if (email !== undefined) data.email = email;
      if (role !== undefined) data.role = role;
      if (assignedWorkshopId !== undefined) data.assignedWorkshopId = assignedWorkshopId || null;
      if (password) data.passwordHash = await bcrypt.hash(password, 12);

      const user = await prisma.facilitator.update({
        where: { id: req.params.userId },
        data,
        include: {
          assignedWorkshop: { select: { id: true, title: true } },
        },
      });

      res.json({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        assignedWorkshopId: user.assignedWorkshopId,
        assignedWorkshopTitle: user.assignedWorkshop?.title || null,
      });
    } catch (error) {
      console.error('Update user error:', error);
      res.status(500).json({ error: 'Feil ved oppdatering av bruker' });
    }
  });

  // Admin: Delete user
  router.delete('/users/:userId', authenticateToken, requireAdmin, async (req, res) => {
    try {
      // Prevent deleting yourself
      if (req.params.userId === req.user!.id) {
        res.status(400).json({ error: 'Du kan ikke slette din egen konto' });
        return;
      }
      await prisma.facilitator.delete({ where: { id: req.params.userId } });
      res.status(204).send();
    } catch (error) {
      console.error('Delete user error:', error);
      res.status(500).json({ error: 'Feil ved sletting av bruker' });
    }
  });

  // Participant join via code (for presentation view)
  router.post('/join', async (req, res) => {
    try {
      const { joinCode, name } = req.body;

      const workshop = await prisma.workshop.findUnique({ where: { joinCode } });
      if (!workshop) {
        res.status(404).json({ error: 'Ugyldig kode. Sjekk at du har skrevet riktig.' });
        return;
      }

      if (workshop.status === 'ARCHIVED') {
        res.status(400).json({ error: 'Denne workshopen er arkivert.' });
        return;
      }

      let participant = await prisma.participant.findUnique({
        where: { name_workshopId: { name, workshopId: workshop.id } },
      });

      if (!participant) {
        participant = await prisma.participant.create({
          data: { name, workshopId: workshop.id },
        });
      }

      const token = signToken({
        id: participant.id,
        role: 'participant',
        workshopId: workshop.id,
      });

      res.json({
        token,
        user: { id: participant.id, name: participant.name, role: 'participant' },
        workshop: { id: workshop.id, title: workshop.title, currentStep: workshop.currentStep },
      });
    } catch (error) {
      console.error('Join error:', error);
      res.status(500).json({ error: 'Feil ved tilkobling til workshop' });
    }
  });

  // Get current user info
  router.get('/me', authenticateToken, async (req, res) => {
    try {
      if (req.user!.role === 'facilitator') {
        const facilitator = await prisma.facilitator.findUnique({
          where: { id: req.user!.id },
          include: { assignedWorkshop: { select: { id: true, title: true, currentStep: true } } },
        });
        if (!facilitator) { res.status(404).json({ error: 'Bruker ikke funnet' }); return; }
        res.json({
          id: facilitator.id,
          name: facilitator.name,
          email: facilitator.email,
          role: 'facilitator',
          userRole: facilitator.role,
          assignedWorkshopId: facilitator.assignedWorkshopId,
          assignedWorkshop: facilitator.assignedWorkshop,
        });
      } else {
        const participant = await prisma.participant.findUnique({
          where: { id: req.user!.id },
          include: { workshop: { select: { id: true, title: true, currentStep: true } } },
        });
        if (!participant) { res.status(404).json({ error: 'Deltaker ikke funnet' }); return; }
        res.json({ id: participant.id, name: participant.name, role: 'participant', workshop: participant.workshop });
      }
    } catch (error) {
      console.error('Get user error:', error);
      res.status(500).json({ error: 'Feil ved henting av brukerinfo' });
    }
  });

  return router;
}
