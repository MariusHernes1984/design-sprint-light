import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, signToken } from '../middleware/auth.js';
import type { LoginRequest, JoinRequest } from '../../shared/types.js';

const router = Router();

export function createAuthRoutes(prisma: PrismaClient) {
  // Facilitator login
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

      const token = signToken({ id: facilitator.id, role: 'facilitator' });
      res.json({ token, user: { id: facilitator.id, name: facilitator.name, email: facilitator.email, role: 'facilitator' } });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Feil ved innlogging' });
    }
  });

  // Facilitator registration (for initial setup)
  router.post('/register', async (req, res) => {
    try {
      const { email, password, name } = req.body;

      const existing = await prisma.facilitator.findUnique({ where: { email } });
      if (existing) {
        res.status(409).json({ error: 'E-post er allerede registrert' });
        return;
      }

      const passwordHash = await bcrypt.hash(password, 12);
      const facilitator = await prisma.facilitator.create({
        data: { email, name, passwordHash },
      });

      const token = signToken({ id: facilitator.id, role: 'facilitator' });
      res.status(201).json({ token, user: { id: facilitator.id, name: facilitator.name, email: facilitator.email, role: 'facilitator' } });
    } catch (error) {
      console.error('Register error:', error);
      res.status(500).json({ error: 'Feil ved registrering' });
    }
  });

  // Participant join via code
  router.post('/join', async (req, res) => {
    try {
      const { joinCode, name } = req.body as JoinRequest;

      const workshop = await prisma.workshop.findUnique({ where: { joinCode } });
      if (!workshop) {
        res.status(404).json({ error: 'Ugyldig kode. Sjekk at du har skrevet riktig.' });
        return;
      }

      if (workshop.status === 'ARCHIVED') {
        res.status(400).json({ error: 'Denne workshopen er arkivert.' });
        return;
      }

      // Upsert: reconnect if same name in same workshop
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
        const facilitator = await prisma.facilitator.findUnique({ where: { id: req.user!.id } });
        if (!facilitator) { res.status(404).json({ error: 'Bruker ikke funnet' }); return; }
        res.json({ id: facilitator.id, name: facilitator.name, email: facilitator.email, role: 'facilitator' });
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
