import { createPdfWorker } from './pdfWorker.js';
import { createAiWorker } from './aiWorker.js';
import { createImageWorker } from './imageWorker.js';
import { createProcessWorker } from './processWorker.js';
import { createSaveWorker } from './saveWorker.js';
import { logger } from '../utils/logger.js';

export const startAllWorkers = (io) => {
    logger.info('🚀 Starting BullMQ Workers (safe mode)...');
    
    const workerCreators = [
        { name: 'pdfWorker', fn: createPdfWorker },
        { name: 'aiWorker', fn: createAiWorker },
        { name: 'imageWorker', fn: createImageWorker },
        { name: 'processWorker', fn: createProcessWorker },
        { name: 'saveWorker', fn: createSaveWorker }
    ];

    const startedWorkers = [];

    for (const { name, fn } of workerCreators) {
        try {
            const w = fn(io);
            if (w) {
                w.on('failed', (job, err) => {
                    const jobId = job ? job.id : 'unknown';
                    logger.error(`Job ${jobId} failed in worker ${w.name}: ${err.message}`);
                });
                w.on('error', (err) => {
                    logger.warn(`Worker ${w.name} connection warning: ${err.message}`);
                });
                startedWorkers.push(w);
            }
        } catch (err) {
            logger.warn(`⚠️ Worker ${name} initialization skipped: ${err.message}`);
        }
    }

    return startedWorkers;
};
