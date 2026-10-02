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
        concurrency: 1, // MUST BE 1 to prevent native @napi-rs/canvas crash across threads
        lockDuration: 120000,
        stalledInterval: 60000,
        maxStalledCount: 1,
        useWorkerThreads: false
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
    
    worker.on('failed', async (job, err) => {
        logger.error(`[imageWorker] Job ${job?.id} failed natively or via JS: ${err.message}`);
        
        // CRITICAL: Ensure Supabase knows the job failed so it doesn't get stuck at 75% forever
        if (job && job.data && job.data.jobId) {
            try {
                await supabaseAdmin.from('jobs').update({ 
                    status: 'failed', 
                    error_message: 'Image extraction crashed natively: ' + err.message 
                }).eq('id', job.data.jobId);
            } catch (dbErr) {}
        }

        if (job && job.data && job.data.userId) {
            io.to(job.data.userId).emit('job-failed', { 
                jobId: job.data.jobId, 
                error: err.message 
            });
        }
    });

    return worker;
};
