import { Worker } from 'bullmq';
import { getRedisConnection } from '../queue/index.js';
import { logger } from '../utils/logger.js';

export const createAiWorker = (io) => {
    return new Worker('ai-extraction', async job => {
        logger.info(`[aiWorker TEST] I PICKED UP JOB ${job.id}`);
        return { success: true };
    }, { 
        connection: getRedisConnection()
    });
};
