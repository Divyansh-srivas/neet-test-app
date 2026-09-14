import { Server } from 'socket.io';
import { logger } from '../utils/logger.js';

let ioInstance = null;

export const initSocket = (server) => {
    const io = new Server(server, {
        cors: {
            origin: [
                'http://localhost:5173', 
                'https://neogravix.in', 
                'https://www.neogravix.in', 
                'https://neogravix.vercel.app'
            ],
            methods: ['GET', 'POST']
        }
    });

    io.on('connection', (socket) => {
        logger.info(`Socket connected: ${socket.id}`);
        
        socket.on('join', (userId) => {
            if (userId) {
                socket.join(userId);
                logger.debug(`Socket ${socket.id} joined room ${userId}`);
            }
        });

        socket.on('disconnect', () => {
            logger.info(`Socket disconnected: ${socket.id}`);
        });
    });

    ioInstance = io;
    return io;
};

export const getIo = () => {
    if (!ioInstance) {
        throw new Error('Socket.io not initialized!');
    }
    return ioInstance;
};
