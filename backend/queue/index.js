import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

export const getRedisConnection = () => {
    try {
        const redisUrl = config.REDIS_URL || process.env.REDIS_URL;
        const isTls = redisUrl && redisUrl.startsWith('rediss://');
        if (redisUrl) {
            const client = new Redis(redisUrl, { 
                maxRetriesPerRequest: null, 
                enableReadyCheck: false,
                lazyConnect: true,
                retryStrategy(times) {
                    if (times > 3) {
                        logger.warn('⚠️ Redis connection retry limit reached. Background queues disabled.');
                        return null;
                    }
                    return Math.min(times * 500, 2000);
                },
                ...(isTls ? { tls: { rejectUnauthorized: false } } : {}) 
            });
            client.on('error', (err) => {
                if (!client._hasLoggedError) {
                    logger.warn(`⚠️ Redis connection warning: ${err.message}`);
                    client._hasLoggedError = true;
                }
            });
            return client;
        }
        
        const client = new Redis({
            host: config.REDIS_HOST,
            port: config.REDIS_PORT,
            password: config.REDIS_PASSWORD,
            maxRetriesPerRequest: null,
            enableReadyCheck: false,
            lazyConnect: true,
            retryStrategy(times) {
                if (times > 3) {
                    logger.warn('⚠️ Redis connection retry limit reached. Background queues disabled.');
                    return null;
                }
                return Math.min(times * 500, 2000);
            }
        });
        client.on('error', (err) => {
            if (!client._hasLoggedError) {
                logger.warn(`⚠️ Redis connection warning: ${err.message}`);
                client._hasLoggedError = true;
            }
        });
        return client;
    } catch (err) {
        logger.warn(`⚠️ Redis client creation error: ${err.message}`);
        return null;
    }
};

// Backwards compatibility export
export const connection = getRedisConnection();

// Define Pipeline Queues safely
const createQueueSafe = (name) => {
    try {
        const conn = getRedisConnection();
        if (!conn) return null;
        return new Queue(name, { connection: conn });
    } catch (err) {
        logger.warn(`⚠️ Queue '${name}' creation skipped: ${err.message}`);
        return null;
    }
};

export const queues = {
    pdfUpload: createQueueSafe('pdf-upload-local'),
    aiExtraction: createQueueSafe('ai-extraction-local'),
    imageExtraction: createQueueSafe('image-extraction-local'),
    questionProcessing: createQueueSafe('question-processing-local'),
    resultSaving: createQueueSafe('result-saving-local')
};

logger.info('✅ BullMQ Queues initialized safely');
