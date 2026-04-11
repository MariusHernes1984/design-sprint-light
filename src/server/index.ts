import express from 'express';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import { config } from './config.js';
import { setupSocketIO } from './socket/index.js';
import { createAuthRoutes } from './routes/auth.js';
import { createWorkshopRoutes } from './routes/workshops.js';
import { createSessionRoutes } from './routes/sessions.js';
import { createChallengeRoutes } from './routes/challenges.js';
import { createClusterRoutes } from './routes/clusters.js';
import { createHkvRoutes } from './routes/hkv.js';
import { createIdeaRoutes } from './routes/ideas.js';
import { createCanvasRoutes } from './routes/canvas.js';
import { createAiRoutes } from './routes/ai.js';
import { createReportRoutes } from './routes/report.js';

const prisma = new PrismaClient();
const app = express();
const server = createServer(app);

const io = new SocketServer(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', createAuthRoutes(prisma));
app.use('/api/workshops', createWorkshopRoutes(prisma, io));
app.use('/api/workshops/:workshopId/sessions', createSessionRoutes(prisma, io));
app.use('/api/workshops/:workshopId/challenges', createChallengeRoutes(prisma, io));
app.use('/api/workshops/:workshopId/clusters', createClusterRoutes(prisma, io));
app.use('/api/workshops/:workshopId/hkv', createHkvRoutes(prisma, io));
app.use('/api/workshops/:workshopId/ideas', createIdeaRoutes(prisma, io));
app.use('/api/workshops/:workshopId/canvas', createCanvasRoutes(prisma, io));
app.use('/api/workshops/:workshopId/ai', createAiRoutes(prisma, io));
app.use('/api/workshops/:workshopId/report', createReportRoutes(prisma));

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve static frontend in production
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientPath = path.join(__dirname, '..', 'client');

app.use(express.static(clientPath));
app.get('*', (_req, res) => {
  res.sendFile(path.join(clientPath, 'index.html'));
});

// Socket.IO
setupSocketIO(io, prisma);

// Start server
server.listen(config.port, () => {
  console.log(`Server kjører på port ${config.port}`);
});
