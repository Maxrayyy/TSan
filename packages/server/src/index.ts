import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { errorHandler } from './middleware/errorHandler.js';
import healthRouter from './routes/health.js';
import authRouter from './routes/auth.js';
import userRouter from './routes/user.js';
import roomRouter from './routes/room.js';
import { initSocketIO } from './socket/index.js';

const app = express();
const httpServer = createServer(app);

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use(healthRouter);
app.use(authRouter);
app.use(userRouter);
app.use(roomRouter);

// Socket.IO
const io = initSocketIO(httpServer);

// Error handling
app.use(errorHandler);

httpServer.listen(env.PORT, () => {
  logger.info(`Server running on port ${env.PORT} (${env.NODE_ENV})`);
});

export { app, httpServer, io };
