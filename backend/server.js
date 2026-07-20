import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import apiRoutes from './routes/api.js';
import { initSocket } from './socket/index.js';
import { startAllWorkers } from './workers/index.js';
import { errorHandler } from './middlewares/error.js';
import { config } from './config/env.js';
import { logger } from './utils/logger.js';

const app = express();
const server = http.createServer(app);

// Initialize WebSockets
const io = initSocket(server);

// Security Middlewares
app.use(helmet());
app.use(cors({ origin: '*' }));

// Optimization & Logging
app.use(compression());
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api', apiRoutes);

// Error Handling Middleware
app.use(errorHandler);

// Start Workers
startAllWorkers(io);

// Start Server
server.listen(config.PORT, () => {
    logger.info(`🚀 Backend Server running on http://localhost:${config.PORT}`);
});
