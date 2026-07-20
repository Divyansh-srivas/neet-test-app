import { createPdfWorker } from './pdfWorker.js';
import { createAiWorker } from './aiWorker.js';
import { createImageWorker } from './imageWorker.js';
import { createProcessWorker } from './processWorker.js';
import { createSaveWorker } from './saveWorker.js';
import { logger } from '../utils/logger.js';

export const startAllWorkers = (io) => {
    logger.info('🚀 Starting all BullMQ Workers...');
    
    const workers = [
        createPdfWorker(io),
        createAiWorker(io),
        createImageWorker(io),
        createProcessWorker(io),
        createSaveWorker(io)
    ];

    workers.forEach(w => {
        w.on('failed', (job, err) => {
            logger.error(`Job ${job.id} failed in worker ${w.name}: ${err.message}`);
        });
    });

    return workers;
};
