import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import type { AuthPayload } from '../../shared/types.js';

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export function authenticateToken(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    res.status(401).json({ error: 'Ingen tilgangstoken oppgitt' });
    return;
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret) as AuthPayload;
    req.user = payload;
    next();
  } catch {
    res.status(403).json({ error: 'Ugyldig eller utlopt token' });
  }
}

export function requireFacilitator(req: Request, res: Response, next: NextFunction): void {
  if (req.user?.role !== 'facilitator') {
    res.status(403).json({ error: 'Kun fasilitatorer har tilgang' });
    return;
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.user?.role !== 'facilitator' || req.user?.userRole !== 'ADMIN') {
    res.status(403).json({ error: 'Kun administratorer har tilgang' });
    return;
  }
  next();
}

export function requireWorkshopAccess(req: Request, res: Response, next: NextFunction): void {
  const workshopId = req.params.workshopId || req.params.id;

  // Participants can only access their own workshop
  if (req.user?.role === 'participant' && req.user.workshopId !== workshopId) {
    res.status(403).json({ error: 'Ingen tilgang til denne workshopen' });
    return;
  }

  // USER-role facilitators can only access their assigned workshop
  if (req.user?.role === 'facilitator' && req.user?.userRole === 'USER') {
    if (req.user.assignedWorkshopId !== workshopId) {
      res.status(403).json({ error: 'Du har ikke tilgang til denne workshopen' });
      return;
    }
  }

  next();
}

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: '24h' });
}
