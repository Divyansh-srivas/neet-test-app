import { Worker } from 'bullmq';
import { getRedisConnection, queues, getBullOptions } from '../queue/index.js';
import { supabaseAdmin } from '../config/supabase.js';
import { logger } from '../utils/logger.js';
import fs from 'fs';

export const createImageWorker = (io) => {
    const processorPath = new URL('./imageProcessor.js', import.meta.url).pathname;
    
    // In Windows, URL.pathname starts with a leading slash (e.g. /C:/...), which breaks child_process on some Node versions.
    // Clean it up if necessary:
    const cleanPath = process.platform === 'win32' && processorPath.startsWith('/') 
        ? processorPath.substring(1) 
        : processorPath;

    const worker = new Worker('image-extraction', cleanPath, { 
        ...getBullOptions(),
        concurrency: 2,
        lockDuration: 120000,
        stalledInterval: 60000,
        maxStalledCount: 1,
        useWorkerThreads: false // explicitly use separate processes, not threads, to fully isolate native crashes
    });
    
    worker.on('progress', (job, progress) => {
        if (job.data && job.data.userId) {
            io.to(job.data.userId).emit('job-progress', { 
                jobId: job.data.jobId, 
                progress, 
                status: 'Extracting diagrams...' 
            });
        }
    });
    
    worker.on('failed', (job, err) => {
        logger.error(`[imageWorker] Job ${job?.id} failed natively or via JS: ${err.message}`);
        if (job && job.data && job.data.userId) {
            io.to(job.data.userId).emit('job-failed', { 
                jobId: job.data.jobId, 
                error: err.message 
            });
        }
    });

    return worker;
};
