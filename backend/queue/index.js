import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

const redisUrl = process.env.REDIS_URL;
const isTls = redisUrl && redisUrl.startsWith('rediss://');

export const getRedisConnection = () => {
    if (redisUrl) {
        const client = new Redis(redisUrl, { 
            maxRetriesPerRequest: null, 
            enableReadyCheck: false,
            ...(isTls ? { tls: { rejectUnauthorized: false } } : {}) 
        });
        client.on('error', (err) => {
            if (!client._hasLoggedError) {
                logger.error(`⚠️ Redis connection error: ${err.message}`);
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
        retryStrategy(times) {
            if (times > 5) {
                logger.error('❌ CRITICAL ERROR: Could not connect to Redis after 5 retries.');
                return null;
            }
            return Math.min(times * 200, 2000);
        }
    });
    client.on('error', (err) => {
        if (!client._hasLoggedError) {
            logger.error(`⚠️ Redis connection error: ${err.message}`);
            client._hasLoggedError = true;
        }
    });
    return client;
};

// Backwards compatibility export
export const connection = getRedisConnection();

// Define Pipeline Queues with dedicated connections
export const queues = {
    pdfUpload: new Queue('pdf-upload', { connection: getRedisConnection() }),
    aiExtraction: new Queue('ai-extraction', { connection: getRedisConnection() }),
    imageExtraction: new Queue('image-extraction', { connection: getRedisConnection() }),
    questionProcessing: new Queue('question-processing', { connection: getRedisConnection() }),
    resultSaving: new Queue('result-saving', { connection: getRedisConnection() })
};

logger.info('✅ BullMQ Queues initialized with dedicated Redis connections');
