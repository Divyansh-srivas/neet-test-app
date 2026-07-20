import { Queue } from 'bullmq';
import Redis from 'ioredis';
import dotenv from 'dotenv';
dotenv.config({ path: '../.env' }); // Adjust if .env is at root

const redisOptions = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
  retryStrategy(times) {
    if (times > 3) {
        console.error('❌ CRITICAL ERROR: Could not connect to Redis.');
        console.error('Redis is REQUIRED for BullMQ background job processing.');
        console.error('Please ensure Redis is installed and running on your system, or provide a valid cloud Redis URL in your .env file.');
        console.error('Windows Users: You can run Redis via WSL (sudo service redis-server start) or Docker (docker run -d -p 6379:6379 redis).');
        process.exit(1);
    }
    return Math.min(times * 50, 2000);
  }
};

export const connection = new Redis(redisOptions);

connection.on('error', (err) => {
    // Only log once to avoid spamming
    if (!connection._hasLoggedError) {
        console.error('⚠️ Redis connection error:', err.message);
        connection._hasLoggedError = true;
    }
});

export const pdfQueue = new Queue('pdf-extraction', { connection });

console.log('✅ BullMQ PDF Extraction Queue initialized');
