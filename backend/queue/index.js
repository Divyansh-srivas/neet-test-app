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
                    // BullMQ workers MUST stay connected forever.
                    // If this returns null, the connection dies permanently.
                    return Math.min(times * 1000, 5000);
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
                // BullMQ workers MUST stay connected forever.
                // If this returns null, the connection dies permanently.
                return Math.min(times * 1000, 5000);
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

export const getBullOptions = () => {
    const conn = getRedisConnection();
    if (!conn) return null;
    // Prefix 'local' in dev to prevent polluting production Redis
    const isProd = process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';
    return { 
        connection: conn, 
        prefix: isProd ? 'bull' : 'local' 
    };
};

// Define Pipeline Queues safely
const createQueueSafe = (name) => {
    try {
        const opts = getBullOptions();
        if (!opts) return null;
        return new Queue(name, opts);
    } catch (err) {
        logger.warn(`⚠️ Queue '${name}' creation skipped: ${err.message}`);
        return null;
    }
};

export const queues = {
    pdfUpload: createQueueSafe('pdf-upload'),
    aiExtraction: createQueueSafe('ai-extraction'),
    imageExtraction: createQueueSafe('image-extraction'),
    questionProcessing: createQueueSafe('question-processing'),
    resultSaving: createQueueSafe('result-saving')
};

logger.info('✅ BullMQ Queues initialized safely');
