import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

const redisOptions = {
  host: config.REDIS_HOST,
  port: config.REDIS_PORT,
  password: config.REDIS_PASSWORD,
  maxRetriesPerRequest: null,
  retryStrategy(times) {
    if (times > 3) {
        logger.error('❌ CRITICAL ERROR: Could not connect to Redis.');
        process.exit(1);
    }
    return Math.min(times * 50, 2000);
  }
};

export const connection = process.env.REDIS_URL 
    ? new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: null, tls: { rejectUnauthorized: false } })
    : new Redis(redisOptions);

connection.on('error', (err) => {
    if (!connection._hasLoggedError) {
        logger.error(`⚠️ Redis connection error: ${err.message}`);
        connection._hasLoggedError = true;
    }
});

// Define Pipeline Queues
export const queues = {
    pdfUpload: new Queue('pdf-upload', { connection }),
    aiExtraction: new Queue('ai-extraction', { connection }),
    imageExtraction: new Queue('image-extraction', { connection }),
    questionProcessing: new Queue('question-processing', { connection }),
    resultSaving: new Queue('result-saving', { connection })
};

logger.info('✅ BullMQ Queues initialized');
