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

// Uncaught exception and unhandled rejection guards to keep server online on Render
process.on('uncaughtException', (err) => {
    logger.error(`[UNCAUGHT EXCEPTION]: ${err.stack || err.message}`);
});

process.on('unhandledRejection', (reason) => {
    logger.error(`[UNHANDLED REJECTION]: ${reason?.stack || reason?.message || reason}`);
});

const app = express();
const server = http.createServer(app);

// Initialize WebSockets
const io = initSocket(server);
app.set('io', io); // Make io accessible in controllers via req.app.get('io')

// Security Middlewares
app.use(helmet({ crossOriginResourcePolicy: false }));
const allowedOrigins = [
    'http://localhost:5173', 
    'https://neogravix.in', 
    'https://www.neogravix.in', 
    'https://neogravix.vercel.app'
];
app.use(cors({ 
    origin: function(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(null, true); // Permissive CORS fallback for production API routes
        }
    } 
}));

// Optimization & Logging
app.use(compression());
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check Endpoint for Render / Load Balancers
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api', apiRoutes);

// Error Handling Middleware
app.use(errorHandler);

// Start Workers safely (so Redis connection failures never crash the server)
try {
    startAllWorkers(io);
} catch (err) {
    logger.warn(`⚠️ Background workers skipped: ${err.message}. Running in direct mode.`);
}

// Start Server
const PORT = config.PORT || process.env.PORT || 3000;
server.listen(PORT, () => {
    logger.info(`🚀 Backend Server running on port ${PORT}`);
});